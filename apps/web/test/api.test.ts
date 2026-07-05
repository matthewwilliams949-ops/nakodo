// Full-stack API tests against an in-memory Postgres (PGlite) with the real
// schema. Route handlers are plain (Request) => Response functions, so we
// call them directly — no Next server needed.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { setDb } from '../lib/db'
import { setEmailSender, type Email } from '../lib/email'
import { createIntro, findIntroByToken } from '../lib/intros'
import { POST as register } from '../app/api/register/route'
import { POST as postProfile } from '../app/api/profile/route'
import { POST as postSnippet } from '../app/api/snippets/route'
import { POST as postAsk } from '../app/api/asks/route'
import { GET as getRecord } from '../app/api/record/route'
import { DELETE as deleteMe } from '../app/api/me/route'
import { POST as postEvent } from '../app/api/events/route'
import { POST as respondIntro } from '../app/api/intro/[token]/route'

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
  await pg.exec('delete from events; delete from intros; delete from asks; delete from snippets; delete from profiles; delete from users;')
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

async function registerUser(email: string, extra: Record<string, unknown> = {}): Promise<string> {
  const res = await register(jsonReq('/api/register', 'POST', { email, ...extra }))
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
  async function setupIntro(): Promise<{ tokenA: string; tokenB: string; id: string }> {
    await registerUser('a@example.com', { handle: 'alice' })
    await registerUser('b@example.com', { handle: 'bob' })
    sentEmails = []
    const { id } = await createIntro({
      userAEmail: 'a@example.com',
      userBEmail: 'b@example.com',
      cardA: 'someone in Berlin, strong at design',
      cardB: 'someone three weeks into an agent-memory tool',
    })
    const row = (await pg.query<{ token_a: string; token_b: string }>('select token_a, token_b from intros')).rows[0]!
    return { tokenA: row.token_a, tokenB: row.token_b, id }
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

  it('both accept → revealed, both reveal emails sent with names', async () => {
    const { tokenA, tokenB } = await setupIntro()
    sentEmails = []

    expect(((await (await respond(tokenA, 'accepted')).json()) as { view: string }).view).toBe('waiting')
    expect(sentEmails).toHaveLength(0) // first accept reveals nothing

    expect(((await (await respond(tokenB, 'accepted')).json()) as { view: string }).view).toBe('revealed')
    expect(sentEmails).toHaveLength(2)
    const toA = sentEmails.find((e) => e.to === 'a@example.com')!
    expect(toA.text).toContain('bob')
    expect(toA.text).toContain('b@example.com')

    const intro = (await pg.query<{ status: string }>('select status from intros')).rows[0]!
    expect(intro.status).toBe('revealed')
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
