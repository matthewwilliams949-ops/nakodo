// M9c /inbox read-model + auth-seam tests. PGlite + real schema, same harness
// as api.test.ts. The page (RSC) renders straight from this data, so pinning
// the read model here pins the surface's behavior.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { setDb } from '../lib/db'
import { setEmailSender } from '../lib/email'
import { createIntro, postIntroMessage, respondToIntro } from '../lib/intros'
import { inboxData } from '../lib/inbox'
import { introBelongsTo, sessionUser, __setSessionUserForTest, type CookieStore } from '../lib/session'

let pg: PGlite

beforeAll(async () => {
  pg = new PGlite()
  await pg.exec(readFileSync(join(import.meta.dirname, '..', '..', '..', 'db', 'schema.sql'), 'utf8'))
  setDb({
    query: async <T>(text: string, params?: unknown[]) => {
      const res = await pg.query<T>(text, params as unknown[] | undefined)
      return { rows: res.rows }
    },
  })
  setEmailSender(async () => {})
})

beforeEach(async () => {
  __setSessionUserForTest(null)
  await pg.exec('delete from events; delete from intro_messages; delete from intros; delete from asks; delete from snippets; delete from profiles; delete from users;')
})

async function mkUser(
  handle: string,
  opts: { email?: string; display_name?: string; profile?: string; snippets?: string[] } = {},
): Promise<string> {
  const { rows } = await pg.query<{ id: string }>(
    'insert into users (handle, display_name, email, token_hash) values ($1,$2,$3,$4) returning id',
    [handle, opts.display_name ?? null, opts.email ?? null, `h_${handle}`],
  )
  const id = rows[0]!.id
  if (opts.profile) await pg.query('insert into profiles (user_id, body) values ($1,$2)', [id, opts.profile])
  for (const s of opts.snippets ?? []) await pg.query('insert into snippets (user_id, body) values ($1,$2)', [id, s])
  return id
}

// Create + mutually accept an intro so it reveals into a thread. Returns the
// two side tokens (a = the perspective we test the inbox from).
async function revealedPair(
  aHandle: string,
  bHandle: string,
  cardForA: string,
  cardForB: string,
): Promise<{ tokenA: string; tokenB: string; introId: string }> {
  const { id } = await createIntro({ userA: aHandle, userB: bHandle, cardA: cardForA, cardB: cardForB })
  const { rows } = await pg.query<{ token_a: string; token_b: string }>(
    'select token_a, token_b from intros where id = $1',
    [id],
  )
  const { token_a, token_b } = rows[0]!
  await respondToIntro(token_a, 'accepted')
  await respondToIntro(token_b, 'accepted')
  return { tokenA: token_a, tokenB: token_b, introId: id }
}

describe('inboxData — the desk read model', () => {
  it('brand-new user: profile + channels only, everything else empty', async () => {
    const id = await mkUser('alice', { display_name: 'Alice', email: 'a@x.dev', profile: 'Building an agent-memory tool.\nSecond line.' })
    const d = await inboxData(id)
    expect(d.needsYou).toHaveLength(0)
    expect(d.people).toHaveLength(0)
    expect(d.waitingOnThem).toBe(0)
    expect(d.asks).toHaveLength(0)
    expect(d.record.profileFirst).toBe('Building an agent-memory tool.') // first line only
    expect(d.channels).toEqual({ email: true, telegram: false })
  })

  it('a proposed intro shows as an anonymous card in needs-you — never a person', async () => {
    const a = await mkUser('alice', { profile: 'p' })
    await mkUser('bob', { display_name: 'Bob' })
    await createIntro({ userA: 'alice', userB: 'bob', cardA: 'someone strong on eval harnesses', cardB: 'x' })
    const d = await inboxData(a)
    expect(d.people).toHaveLength(0) // not revealed → not a person
    expect(d.needsYou).toHaveLength(1)
    expect(d.needsYou[0]!.card).toBe('someone strong on eval harnesses')
    expect(d.needsYou[0]!.card).not.toContain('Bob') // no identity pre-reveal
  })

  it('after you accept but they have not, it leaves needs-you and counts as waiting', async () => {
    const a = await mkUser('alice', { profile: 'p' })
    await mkUser('bob', { display_name: 'Bob' })
    const { id } = await createIntro({ userA: 'alice', userB: 'bob', cardA: 'card for alice', cardB: 'card for bob' })
    const tokenA = (await pg.query<{ token_a: string }>('select token_a from intros where id = $1', [id])).rows[0]!.token_a
    await respondToIntro(tokenA, 'accepted')
    const d = await inboxData(a)
    expect(d.needsYou).toHaveLength(0)
    expect(d.waitingOnThem).toBe(1)
    expect(d.people).toHaveLength(0)
  })

  it('revealed intros are people, sorted by last activity descending', async () => {
    const alice = await mkUser('alice')
    await mkUser('bob', { display_name: 'Bob Osei' })
    await mkUser('cara', { display_name: 'Cara Lee' })

    // Bob first, then Cara — but Bob's thread gets a later message, so Bob wins.
    const bob = await revealedPair('alice', 'bob', 'you both went deep on retrieval eval', 'x')
    const cara = await revealedPair('alice', 'cara', 'traded onboarding-copy notes', 'y')
    await postIntroMessage(cara.tokenB, 'hi from cara') // cara thread active...
    await postIntroMessage(bob.tokenB, 'hi from bob') // ...then bob, latest

    const d = await inboxData(alice)
    expect(d.people.map((p) => p.name)).toEqual(['Bob Osei', 'Cara Lee']) // last-activity desc
    const bobRow = d.people[0]!
    expect(bobRow.why).toBe('you both went deep on retrieval eval') // the card recap
    expect(bobRow.turn).toBe('your-turn') // bob spoke last → your move
    expect(bobRow.reconnected).toBe(false)
  })

  it('a reconnected thread (rematch_reconnected event) is flagged', async () => {
    const alice = await mkUser('alice')
    await mkUser('dev', { display_name: 'Devin' })
    const pair = await revealedPair('alice', 'dev', 'pgvector at scale', 'x')
    await pg.query("insert into events (type, metadata) values ('rematch_reconnected', $1)", [
      JSON.stringify({ intro_id: pair.introId }),
    ])
    const d = await inboxData(alice)
    expect(d.people[0]!.reconnected).toBe(true)
  })

  it('a declined intro drops from BOTH inboxes — consistent with the pending endpoint; the token link keeps the fiction', async () => {
    const alice = await mkUser('alice')
    const bob = await mkUser('bob', { display_name: 'Bob' })
    const { id } = await createIntro({ userA: 'alice', userB: 'bob', cardA: 'card a', cardB: 'card b' })
    const tokenA = (await pg.query<{ token_a: string }>('select token_a from intros where id = $1', [id])).rows[0]!.token_a
    await respondToIntro(tokenA, 'declined')
    // Alice declined → status is now 'declined' globally, so the intro leaves
    // the list on BOTH sides — exactly how the agent pending endpoint (lists
    // only 'proposed') already behaves. The decline itself stays invisible:
    // Bob's own token link still resolves to 'card' (pinned in api.test.ts),
    // and a disappearance is ambiguous with expiry. (Design question flagged to
    // Safety: should a declined-by-other card instead PERSIST in the
    // recipient's inbox for maximum invisibility? This matches shipped behavior.)
    expect((await inboxData(alice)).needsYou).toHaveLength(0)
    expect((await inboxData(alice)).people).toHaveLength(0)
    const bd = await inboxData(bob)
    expect(bd.needsYou).toHaveLength(0)
    expect(bd.people).toHaveLength(0)
  })
})

describe('session seam', () => {
  function cookieJar(value?: string): CookieStore {
    return { get: (name) => (name === 'nakodo_session' && value ? { value } : undefined) }
  }

  it('no cookie → no user', async () => {
    expect(await sessionUser(cookieJar())).toBeNull()
  })

  it('cookie carrying a real user id resolves that user (stub behavior)', async () => {
    const id = await mkUser('alice')
    expect(await sessionUser(cookieJar(id))).toEqual({ id })
  })

  it('introBelongsTo is true only for a party of a non-held intro', async () => {
    const alice = await mkUser('alice')
    const bob = await mkUser('bob')
    const carol = await mkUser('carol')
    const { id } = await createIntro({ userA: 'alice', userB: 'bob', cardA: 'a', cardB: 'b' })
    const { token_a } = (await pg.query<{ token_a: string }>('select token_a from intros where id = $1', [id])).rows[0]!
    expect(await introBelongsTo(token_a, alice)).toBe(true)
    expect(await introBelongsTo(token_a, carol)).toBe(false) // not a party
  })

  it('the test resolver seam overrides cookie resolution', async () => {
    __setSessionUserForTest(async () => ({ id: 'seam-user' }))
    expect(await sessionUser(cookieJar())).toEqual({ id: 'seam-user' })
  })
})
