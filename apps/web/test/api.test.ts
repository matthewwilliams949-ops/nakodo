// Full-stack API tests against an in-memory Postgres (PGlite) with the real
// schema. Route handlers are plain (Request) => Response functions, so we
// call them directly — no Next server needed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { setDb } from '../lib/db'
import { setEmailSender, type Email } from '../lib/email'
import { createIntro, findIntroByToken, getRevealParties, threadTurn } from '../lib/intros'
import { POST as register } from '../app/api/register/route'
import { POST as postProfile } from '../app/api/profile/route'
import { POST as postSnippet } from '../app/api/snippets/route'
import { POST as postAsk } from '../app/api/asks/route'
import { GET as getRecord } from '../app/api/record/route'
import { DELETE as deleteMe } from '../app/api/me/route'
import { POST as postEvent } from '../app/api/events/route'
import { POST as respondIntro } from '../app/api/intro/[token]/route'
import { GET as getPendingIntros } from '../app/api/intros/pending/route'

let pg: PGlite
let sentEmails: Email[] = []

beforeAll(async () => {
  pg = new PGlite()
  const schema = readFileSync(join(import.meta.dirname, '..', '..', '..', 'db', 'schema.sql'), 'utf8')
  await pg.exec(schema)
  setDb({
    query: async <T>(text: string, params?: unknown[]) => {
      const res = await pg.query<T>(text, params as unknown[] | undefined)
      return { rows: res.rows }
    },
  })
  setEmailSender(async (e) => {
    sentEmails.push(e)
  })
})

beforeEach(async () => {
  sentEmails = []
  await pg.exec('delete from events; delete from intro_messages; delete from intros; delete from asks; delete from snippets; delete from profiles; delete from users;')
})

function jsonReq(url: string, method: string, body?: unknown, token?: string): Request {
  return new Request(`http://test${url}`, {
    method,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  })
}

async function registerUser(email?: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await register(jsonReq('/api/register', 'POST', { ...(email ? { email } : {}), ...extra }))
  expect(res.status).toBe(201)
  const { token } = (await res.json()) as { token: string }
  return token
}

describe('registration', () => {
  it('registers, stores attribution, issues a token, sends welcome email, logs event', async () => {
    const token = await registerUser('a@example.com', { source: 'registry search', install_id: 'ins-1' })
    expect(token).toHaveLength(64)
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0]!.to).toBe('a@example.com')

    const users = await pg.query<{ source: string; token_hash: string }>('select source, token_hash from users')
    expect(users.rows[0]!.source).toBe('registry search')
    expect(users.rows[0]!.token_hash).not.toBe(token) // stored hashed

    const events = await pg.query<{ type: string; install_id: string }>('select type, install_id from events')
    expect(events.rows.map((e) => e.type)).toContain('registered')
    expect(events.rows[0]!.install_id).toBe('ins-1')
  })

  it('rejects duplicate email with 409', async () => {
    await registerUser('a@example.com')
    const res = await register(jsonReq('/api/register', 'POST', { email: 'a@example.com' }))
    expect(res.status).toBe(409)
  })

  it('stores display_name in the PII store (M8)', async () => {
    await registerUser('a@example.com', { display_name: 'Alice W' })
    const users = await pg.query<{ display_name: string }>('select display_name from users')
    expect(users.rows[0]!.display_name).toBe('Alice W')
  })

  it('registers without an email — email is optional (v1.1)', async () => {
    const token = await registerUser(undefined, { handle: 'ghost' })
    expect(token).toHaveLength(64)
    expect(sentEmails).toHaveLength(0) // no address, no welcome email
    const users = await pg.query<{ email: string | null; handle: string }>('select email, handle from users')
    expect(users.rows[0]!.email).toBeNull()
    expect(users.rows[0]!.handle).toBe('ghost')
  })

  it('rejects invalid body', async () => {
    const res = await register(jsonReq('/api/register', 'POST', { email: 'not-an-email' }))
    expect(res.status).toBe(400)
  })
})

describe('profile, snippets, asks, record', () => {
  it('requires auth', async () => {
    for (const res of [
      await postProfile(jsonReq('/api/profile', 'POST', { body: 'x' })),
      await postSnippet(jsonReq('/api/snippets', 'POST', { body: 'x' })),
      await postAsk(jsonReq('/api/asks', 'POST', { need: 'x' })),
      await getRecord(jsonReq('/api/record', 'GET')),
    ]) {
      expect(res.status).toBe(401)
    }
  })

  it('walks the activation flow end to end', async () => {
    const token = await registerUser('a@example.com', { handle: 'mw' })

    expect((await postProfile(jsonReq('/api/profile', 'POST', { body: 'building an MCP tool' }, token))).status).toBe(200)
    expect((await postSnippet(jsonReq('/api/snippets', 'POST', { body: 'shipped auth today' }, token))).status).toBe(201)
    expect((await postAsk(jsonReq('/api/asks', 'POST', { need: 'design help' }, token))).status).toBe(201)

    const record = (await (await getRecord(jsonReq('/api/record', 'GET', undefined, token))).json()) as {
      user: { handle: string }
      profile: { body: string }
      snippets: { body: string }[]
      asks: { need: string; status: string }[]
    }
    expect(record.user.handle).toBe('mw')
    expect(record.profile.body).toBe('building an MCP tool')
    expect(record.snippets[0]!.body).toBe('shipped auth today')
    expect(record.asks[0]!).toMatchObject({ need: 'design help', status: 'open' })
  })

  it('profile upsert replaces the body', async () => {
    const token = await registerUser('a@example.com')
    await postProfile(jsonReq('/api/profile', 'POST', { body: 'v1' }, token))
    await postProfile(jsonReq('/api/profile', 'POST', { body: 'v2' }, token))
    const profiles = await pg.query<{ body: string }>('select body from profiles')
    expect(profiles.rows).toHaveLength(1)
    expect(profiles.rows[0]!.body).toBe('v2')
  })
})

describe('events endpoint', () => {
  it('accepts unauthenticated events, namespaced client_*', async () => {
    const res = await postEvent(jsonReq('/api/events', 'POST', { type: 'front_door', install_id: 'ins-9' }))
    expect(res.status).toBe(201)
    const events = await pg.query<{ type: string }>('select type from events')
    expect(events.rows[0]!.type).toBe('client_front_door')
  })
})

describe('delete_me', () => {
  it('deletes the user and everything attached; token stops working', async () => {
    const token = await registerUser('a@example.com')
    await postProfile(jsonReq('/api/profile', 'POST', { body: 'p' }, token))
    await postSnippet(jsonReq('/api/snippets', 'POST', { body: 's' }, token))

    expect((await deleteMe(jsonReq('/api/me', 'DELETE', undefined, token))).status).toBe(200)
    expect((await getRecord(jsonReq('/api/record', 'GET', undefined, token))).status).toBe(401)
    expect((await pg.query('select * from users')).rows).toHaveLength(0)
    expect((await pg.query('select * from profiles')).rows).toHaveLength(0)
    expect((await pg.query('select * from snippets')).rows).toHaveLength(0)
    // the deletion fact remains, anonymized
    const ev = await pg.query<{ type: string; user_id: string | null }>(
      "select type, user_id from events where type = 'user_deleted'",
    )
    expect(ev.rows).toHaveLength(1)
    expect(ev.rows[0]!.user_id).toBeNull()
  })
})

describe('intro flow', () => {
  async function setupIntro(): Promise<{ tokenA: string; tokenB: string; id: string; bearerA: string; bearerB: string }> {
    const bearerA = await registerUser('a@example.com', { handle: 'alice' })
    const bearerB = await registerUser('b@example.com', { handle: 'bob' })
    sentEmails = []
    const { id } = await createIntro({
      userA: 'alice', // exercise handle lookup
      userB: 'b@example.com', // exercise email lookup
      cardA: 'someone in Berlin, strong at design',
      cardB: 'someone three weeks into an agent-memory tool',
    })
    const row = (await pg.query<{ token_a: string; token_b: string }>('select token_a, token_b from intros')).rows[0]!
    return { tokenA: row.token_a, tokenB: row.token_b, id, bearerA, bearerB }
  }

  function respond(token: string, response: 'accepted' | 'declined') {
    return respondIntro(jsonReq(`/api/intro/${token}`, 'POST', { response }), {
      params: Promise.resolve({ token }),
    })
  }

  it('createIntro emails both cards with tokenized links', async () => {
    const { tokenA } = await setupIntro()
    expect(sentEmails).toHaveLength(2)
    expect(sentEmails.map((e) => e.to).sort()).toEqual(['a@example.com', 'b@example.com'])
    expect(sentEmails[0]!.text).toContain(tokenA)
    expect(sentEmails[0]!.text).toContain('someone in Berlin, strong at design')
  })

  it('both accept → revealed; reveal notices carry no identity and no contact details', async () => {
    const { tokenA, tokenB } = await setupIntro()
    sentEmails = []

    expect(((await (await respond(tokenA, 'accepted')).json()) as { view: string }).view).toBe('waiting')
    expect(sentEmails).toHaveLength(0) // first accept reveals nothing

    expect(((await (await respond(tokenB, 'accepted')).json()) as { view: string }).view).toBe('revealed')
    expect(sentEmails).toHaveLength(2)
    const toA = sentEmails.find((e) => e.to === 'a@example.com')!
    // v1.1: the platform never transmits identity or contact details —
    // the notice only points back to the recipient's own intro page.
    expect(toA.text).toContain(tokenA)
    expect(toA.text).not.toContain('bob')
    expect(toA.text).not.toContain('b@example.com')

    const intro = (await pg.query<{ status: string }>('select status from intros')).rows[0]!
    expect(intro.status).toBe('revealed')
  })

  it('thread messages: refused before reveal, stored per side after, never emailed', async () => {
    const { tokenA, tokenB } = await setupIntro()

    // HARD RULE (regression-pinned): no message can ever be written to an
    // intro that is not revealed — no cold-messaging surface can exist.
    const early = await respondIntro(jsonReq(`/api/intro/${tokenA}`, 'POST', { message: 'hi there' }), {
      params: Promise.resolve({ token: tokenA }),
    })
    expect(early.status).toBe(409)
    expect((await pg.query('select * from intro_messages')).rows).toHaveLength(0)

    await respond(tokenA, 'accepted')
    await respond(tokenB, 'accepted')
    sentEmails = []

    const msgA = await respondIntro(jsonReq(`/api/intro/${tokenA}`, 'POST', { message: 'hello — a@x.dev or @alice' }), {
      params: Promise.resolve({ token: tokenA }),
    })
    expect(msgA.status).toBe(200)
    // legacy alias: the v1.1 contact form field becomes a plain message
    const msgB = await respondIntro(jsonReq(`/api/intro/${tokenB}`, 'POST', { contact: '@bob on X' }), {
      params: Promise.resolve({ token: tokenB }),
    })
    expect(msgB.status).toBe(200)

    const rows = (await pg.query<{ side: string; body: string }>('select side, body from intro_messages order by created_at')).rows
    expect(rows).toEqual([
      { side: 'a', body: 'hello — a@x.dev or @alice' },
      { side: 'b', body: '@bob on X' },
    ])
    // The completion loop DOES knock by email when the ball crosses courts, but
    // the knock is identity- and content-free — the message body lives only on
    // the page. B's reply crossed the ball back to A (who left an email).
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0]!.to).toBe('a@example.com')
    for (const e of sentEmails) {
      expect(e.text).not.toContain('@bob on X') // no message body
      expect(e.text).not.toContain('a@x.dev')
      expect(e.text).not.toContain('@alice')
    }
  })

  it("held intros are invisible: tokens resolve to nothing, pending excludes them", async () => {
    const { tokenA, tokenB, bearerB } = await setupIntro()
    await pg.query("update intros set status = 'held'")

    // To the target, a held intro is indistinguishable from one that never existed.
    expect(await findIntroByToken(tokenA)).toBeNull()
    expect((await respond(tokenB, 'accepted')).status).toBe(404)
    const forB = (await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, bearerB))).json()) as {
      intros: unknown[]
    }
    expect(forB.intros).toHaveLength(0)
  })

  it('delete_me removes own thread messages and anonymizes own proposals', async () => {
    const { tokenA, tokenB, bearerA } = await setupIntro()
    await respond(tokenA, 'accepted')
    await respond(tokenB, 'accepted')
    for (const [token, message] of [
      [tokenA, 'from alice'],
      [tokenB, 'from bob'],
    ] as const) {
      await respondIntro(jsonReq(`/api/intro/${token}`, 'POST', { message }), {
        params: Promise.resolve({ token }),
      })
    }
    // pretend alice's agent proposed this intro
    await pg.query("update intros set proposed_by = (select id from users where handle = 'alice')")

    expect((await deleteMe(jsonReq('/api/me', 'DELETE', undefined, bearerA))).status).toBe(200)

    const messages = (await pg.query<{ side: string; body: string }>('select side, body from intro_messages')).rows
    expect(messages).toEqual([{ side: 'b', body: 'from bob' }]) // alice's message is gone, bob's survives
    const intro = (await pg.query<{ proposed_by: string | null; user_a: string | null }>('select proposed_by, user_a from intros')).rows[0]!
    expect(intro.proposed_by).toBeNull()
    expect(intro.user_a).toBeNull()
  })

  it('pending intros endpoint lists only own unanswered sides', async () => {
    const { tokenA, bearerA, bearerB } = await setupIntro()

    const forA = (await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, bearerA))).json()) as {
      intros: { url: string }[]
    }
    expect(forA.intros).toHaveLength(1)
    expect(forA.intros[0]!.url).toContain(tokenA)

    await respond(tokenA, 'accepted')
    const forAAfter = (await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, bearerA))).json()) as {
      intros: { url: string }[]
    }
    expect(forAAfter.intros).toHaveLength(0)

    // B has not responded: still pending for B
    const forB = (await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, bearerB))).json()) as {
      intros: { url: string }[]
    }
    expect(forB.intros).toHaveLength(1)

    // and unauthenticated → 401
    expect((await getPendingIntros(jsonReq('/api/intros/pending', 'GET'))).status).toBe(401)
  })

  it('users without email get no card email but the intro still works end to end', async () => {
    const bearerA = await registerUser(undefined, { handle: 'ghost-a' })
    await registerUser(undefined, { handle: 'ghost-b' })
    sentEmails = []
    await createIntro({ userA: 'ghost-a', userB: 'ghost-b', cardA: 'card a', cardB: 'card b' })
    expect(sentEmails).toHaveLength(0)

    const forA = (await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, bearerA))).json()) as {
      intros: { url: string }[]
    }
    expect(forA.intros).toHaveLength(1)
    const tokA = forA.intros[0]!.url.split('/intro/')[1]!
    const row = (await pg.query<{ token_a: string; token_b: string }>('select token_a, token_b from intros')).rows[0]!
    expect(tokA).toBe(row.token_a)

    await respond(row.token_a, 'accepted')
    expect(((await (await respond(row.token_b, 'accepted')).json()) as { view: string }).view).toBe('revealed')
    expect(sentEmails).toHaveLength(0) // reveal notices skipped — no addresses anywhere
  })

  it('decline is silent: no email, and the other side still sees a pending card', async () => {
    const { tokenA, tokenB } = await setupIntro()
    sentEmails = []

    expect(((await (await respond(tokenA, 'declined')).json()) as { view: string }).view).toBe('closed')
    expect(sentEmails).toHaveLength(0)

    // B's link behaves exactly as if nothing happened
    const foundB = await findIntroByToken(tokenB)
    expect(foundB).not.toBeNull()
    const { viewFor } = await import('../lib/intros')
    expect(viewFor(foundB!.intro, foundB!.side)).toBe('card')

    // B accepting after A declined: recorded silently, never reveals
    expect(((await (await respond(tokenB, 'accepted')).json()) as { view: string }).view).toBe('waiting')
    expect(sentEmails).toHaveLength(0)
    const intro = (await pg.query<{ status: string }>('select status from intros')).rows[0]!
    expect(intro.status).toBe('declined')
  })

  it('responses are idempotent — a second response cannot flip the first', async () => {
    const { tokenA } = await setupIntro()
    await respond(tokenA, 'accepted')
    expect(((await (await respond(tokenA, 'declined')).json()) as { view: string }).view).toBe('waiting')
    const intro = (await pg.query<{ a_response: string }>('select a_response from intros')).rows[0]!
    expect(intro.a_response).toBe('accepted')
  })

  it('expired tokens show expired and reject responses', async () => {
    const { tokenA } = await setupIntro()
    await pg.query("update intros set token_expires_at = now() - interval '1 day'")
    expect(((await (await respond(tokenA, 'accepted')).json()) as { view: string }).view).toBe('expired')
    const intro = (await pg.query<{ a_response: string | null }>('select a_response from intros')).rows[0]!
    expect(intro.a_response).toBeNull()
  })

  it('unknown token → 404', async () => {
    const res = await respond('deadbeef', 'accepted')
    expect(res.status).toBe(404)
  })
})

describe('M8 completion loop — thread lifecycle, events, notices, copy', () => {
  function message(token: string, body: string) {
    return respondIntro(jsonReq(`/api/intro/${token}`, 'POST', { message: body }), {
      params: Promise.resolve({ token }),
    })
  }
  function respond(token: string, response: 'accepted' | 'declined') {
    return respondIntro(jsonReq(`/api/intro/${token}`, 'POST', { response }), {
      params: Promise.resolve({ token }),
    })
  }
  async function pending(bearer: string): Promise<{ url: string; state: string }[]> {
    const res = (await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, bearer))).json()) as {
      intros: { url: string; state: string }[]
    }
    return res.intros
  }
  const countEvents = async (type: string): Promise<number> =>
    Number((await pg.query<{ n: string }>('select count(*) n from events where type = $1', [type])).rows[0]!.n)

  // A revealed intro between two named people. emails=false → both email-less.
  async function revealed(emails = true): Promise<{ tokenA: string; tokenB: string; bearerA: string; bearerB: string }> {
    const bearerA = await registerUser(emails ? 'a@example.com' : undefined, { handle: 'alice', display_name: 'Alice' })
    const bearerB = await registerUser(emails ? 'b@example.com' : undefined, { handle: 'bob', display_name: 'Bob' })
    await createIntro({ userA: 'alice', userB: 'bob', cardA: 'card shown to A', cardB: 'card shown to B' })
    const row = (await pg.query<{ token_a: string; token_b: string }>('select token_a, token_b from intros')).rows[0]!
    await respond(row.token_a, 'accepted')
    await respond(row.token_b, 'accepted')
    sentEmails = []
    return { tokenA: row.token_a, tokenB: row.token_b, bearerA, bearerB }
  }

  it('message_sent per message; thread_connected fires exactly once, on the connecting message', async () => {
    const { tokenA, tokenB } = await revealed()
    await message(tokenA, 'hi from A')
    expect(await countEvents('message_sent')).toBe(1)
    expect(await countEvents('thread_connected')).toBe(0) // only A has spoken

    await message(tokenB, 'hi from B') // makes both sides ≥1 → connected
    expect(await countEvents('message_sent')).toBe(2)
    expect(await countEvents('thread_connected')).toBe(1)

    await message(tokenA, 'again') // already connected — no second event
    expect(await countEvents('message_sent')).toBe(3)
    expect(await countEvents('thread_connected')).toBe(1)
  })

  it('message email fires once per ball-crossing — never re-nudges, never on the first hello', async () => {
    const { tokenA, tokenB } = await revealed()

    await message(tokenA, 'first hello') // empty thread → reveal already covered it
    expect(sentEmails).toHaveLength(0)
    await message(tokenA, 'still me') // consecutive → B already knocked, don't re-nudge
    expect(sentEmails).toHaveLength(0)

    await message(tokenB, 'reply') // crosses the ball back to A
    expect(sentEmails).toHaveLength(1)
    expect(sentEmails[0]!.to).toBe('a@example.com')
    expect(sentEmails[0]!.subject).toContain('message is waiting')

    await message(tokenB, 'more from B') // consecutive → no re-nudge
    expect(sentEmails).toHaveLength(1)

    await message(tokenA, 'A back') // crosses to B
    expect(sentEmails).toHaveLength(2)
    expect(sentEmails[1]!.to).toBe('b@example.com')
  })

  it('pending endpoint reports the lifecycle state per side, and only when the ball is in your court', async () => {
    const { tokenA, tokenB, bearerA, bearerB } = await revealed()

    // Empty thread: both sides have the ball — say_hello for each.
    expect((await pending(bearerA))[0]).toMatchObject({ state: 'say_hello' })
    expect((await pending(bearerB))[0]).toMatchObject({ state: 'say_hello' })

    await message(tokenA, 'hello')
    // A just spoke (their-turn) → nothing pending. B has a message → message_waiting.
    expect(await pending(bearerA)).toHaveLength(0)
    expect((await pending(bearerB))[0]).toMatchObject({ state: 'message_waiting' })

    await message(tokenB, 'hi back')
    expect((await pending(bearerA))[0]).toMatchObject({ state: 'message_waiting' })
    expect(await pending(bearerB)).toHaveLength(0)
  })

  it('identity stays off the pending channel — no display name ever appears in the payload', async () => {
    const { bearerA } = await revealed()
    const raw = await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, bearerA))).text()
    expect(raw).not.toContain('Alice')
    expect(raw).not.toContain('Bob')
  })

  it('email-less side: no message email, but the waiting message surfaces in-session', async () => {
    const { tokenA, bearerB } = await revealed(false)
    await message(tokenA, 'knock knock') // B has no email → no mail, but pending shows it
    expect(sentEmails).toHaveLength(0)
    expect((await pending(bearerB))[0]).toMatchObject({ state: 'message_waiting' })
  })

  it('getRevealParties: counterpart name is display_name → handle → none; own email for the share chip', async () => {
    const { tokenA } = await revealed()
    const found = (await findIntroByToken(tokenA))!
    const parties = await getRevealParties(found.intro, found.side)
    expect(parties.counterpartName).toBe('Bob') // A sees B's display name
    expect(parties.ownEmail).toBe('a@example.com')

    // handle fallback when there is no display name
    await pg.query("update users set display_name = null where handle = 'bob'")
    expect((await getRevealParties(found.intro, found.side)).counterpartName).toBe('bob')
  })

  it('pending payload carries has_email (gates the no-email re-offer, §5)', async () => {
    const withEmail = await registerUser('e@example.com')
    const noEmail = await registerUser(undefined, { handle: 'ghost' })
    const yes = (await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, withEmail))).json()) as { has_email: boolean }
    const no = (await (await getPendingIntros(jsonReq('/api/intros/pending', 'GET', undefined, noEmail))).json()) as { has_email: boolean }
    expect(yes.has_email).toBe(true)
    expect(no.has_email).toBe(false)
  })

  it('threadTurn derives whose court from the last message only', async () => {
    expect(threadTurn([], 'a')).toBe('say-hello')
    expect(threadTurn([{ id: '1', side: 'b', body: 'x', created_at: new Date() }], 'a')).toBe('your-turn')
    expect(threadTurn([{ id: '1', side: 'a', body: 'x', created_at: new Date() }], 'a')).toBe('their-turn')
  })

  it('the card email is a single link — no Accept/Decline pair, no inert query params', async () => {
    await registerUser('c@example.com', { handle: 'carol' })
    await registerUser('d@example.com', { handle: 'dave' })
    sentEmails = []
    await createIntro({ userA: 'carol', userB: 'dave', cardA: 'ca', cardB: 'cb' })
    const email = sentEmails.find((e) => e.to === 'c@example.com')!
    expect(email.text).toContain('/intro/')
    expect(email.text).toContain('See the card and decide')
    expect(email.text).not.toContain('?respond=')
    expect(email.text).not.toContain('Decline:')
  })

  it('the reveal email subject carries the action, not just the news (item d)', async () => {
    const bearerA = await registerUser('a@example.com', { handle: 'alice' })
    await registerUser('b@example.com', { handle: 'bob' })
    await createIntro({ userA: 'alice', userB: 'bob', cardA: 'ca', cardB: 'cb' })
    const row = (await pg.query<{ token_a: string; token_b: string }>('select token_a, token_b from intros')).rows[0]!
    sentEmails = []
    await respond(row.token_a, 'accepted')
    await respond(row.token_b, 'accepted')
    const reveal = sentEmails.find((e) => e.to === 'a@example.com')!
    expect(reveal.subject.toLowerCase()).toContain('say hello')
    void bearerA
  })
})

describe('schema migration (M8)', () => {
  const schema = readFileSync(join(import.meta.dirname, '..', '..', '..', 'db', 'schema.sql'), 'utf8')

  it('re-applies idempotently on a current database', async () => {
    const fresh = new PGlite()
    await fresh.exec(schema)
    await fresh.exec(schema) // second apply must not error
    const cols = await fresh.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'intros'",
    )
    const names = cols.rows.map((c) => c.column_name)
    expect(names).toContain('proposed_by')
    expect(names).toContain('ask_id')
    expect(names).not.toContain('a_contact')
  })

  it('folds v1.1 contact columns into the thread, then drops them', async () => {
    const fresh = new PGlite()
    await fresh.exec(schema)
    // Simulate a v1.1 database: contact columns exist and one holds data.
    await fresh.exec('alter table intros add column a_contact text; alter table intros add column b_contact text;')
    await fresh.exec(`
      insert into users (id, handle, token_hash) values
        ('00000000-0000-0000-0000-00000000000a', 'ua', 'ha'),
        ('00000000-0000-0000-0000-00000000000b', 'ub', 'hb');
      insert into intros (user_a, user_b, card_a, card_b, token_a, token_b, token_expires_at, status, b_contact, resolved_at)
      values ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-00000000000b',
              'ca', 'cb', 'ta', 'tb', now() + interval '14 days', 'revealed', 'reach me: b@x.dev', now());
    `)

    await fresh.exec(schema) // the migration runs

    const messages = await fresh.query<{ side: string; body: string }>('select side, body from intro_messages')
    expect(messages.rows).toEqual([{ side: 'b', body: 'reach me: b@x.dev' }])
    const cols = await fresh.query<{ column_name: string }>(
      "select column_name from information_schema.columns where table_name = 'intros' and column_name in ('a_contact', 'b_contact')",
    )
    expect(cols.rows).toHaveLength(0)
  })
})
