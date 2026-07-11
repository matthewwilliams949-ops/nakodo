// M9c /inbox read-model + auth-seam tests. PGlite + real schema, same harness
// as api.test.ts. The page itself (RSC) is verified by render-walkthrough; here
// we pin the data contract the page renders from.
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { PGlite } from '@electric-sql/pglite'
import { setDb } from '../lib/db'
import { setEmailSender } from '../lib/email'
import { createIntro, postIntroMessage, respondToIntro } from '../lib/intros'
import { inboxData } from '../lib/inbox'
import { introBelongsTo, sessionUser, __setSessionUserForTest } from '../lib/session'

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

async function mkUser(handle: string, opts: { email?: string; display_name?: string; profile?: string; snippets?: string[] } = {}): Promise<string> {
  const { rows } = await pg.query<{ id: string }>(
    'insert into users (handle, display_name, email, token_hash) values ($1,$2,$3,$4) returning id',
    [handle, opts.display_name ?? null, opts.email ?? null, `h_${handle}`],
  )
  const id = rows[0]!.id
  if (opts.profile) await pg.query('insert into profiles (user_id, body) values ($1,$2)', [id, opts.profile])
  for (const s of opts.snippets ?? []) await pg.query('insert into snippets (user_id, body) values ($1,$2)', [id, s])
  return id
}

async function tokensOf(): Promise<{ token_a: string; token_b: string }> {
  return (await pg.query<{ token_a: string; token_b: string }>('select token_a, token_b from intros')).rows[0]!
}

describe('inboxData — the desk read model', () => {
  it('brand-new user: profile only, everything else empty', async () => {
    const id = await mkUser('alice', { display_name: 'Alice', profile: 'Building an agent-memory tool.\nSecond line.' })
    const d = await inboxData(id)
    expect(d.needsYou).toHaveLength(0)
    expect(d.asks).toHaveLength(0)
    expect(d.intros).toHaveLength(0)
    expect(d.record.profileFirst).toBe('Building an agent-memory tool.') // first line only
    expect(d.record.snippetCount).toBe(0)
  })

  it('standing ask, nothing waiting', async () => {
    const id = await mkUser('alice', { profile: 'p', snippets: ['s1', 's2'] })
    await pg.query("insert into asks (user_id, need) values ($1, 'a designer’s eye')", [id])
    const d = await inboxData(id)
    expect(d.needsYou).toHaveLength(0)
    expect(d.asks).toEqual([expect.objectContaining({ need: 'a designer’s eye' })])
    expect(d.record.snippetCount).toBe(2)
  })

  it('proposed intro shows as a card in needs-you (not yet an introduction)', async () => {
    const a = await mkUser('alice', { profile: 'p' })
    await mkUser('bob', { display_name: 'Bob' })
    await createIntro({ userA: 'alice', userB: 'bob', cardA: 'someone strong at backend', cardB: 'someone strong at design' })
    const d = await inboxData(a)
    expect(d.needsYou).toHaveLength(1)
    expect(d.needsYou[0]).toMatchObject({ kind: 'card', card: 'someone strong at backend' })
    expect(d.intros).toHaveLength(0) // proposed ≠ revealed
  })

  it('revealed, empty thread: say_hello in needs-you + intro listed as say-hello', async () => {
    const a = await mkUser('alice', { profile: 'p' })
    await mkUser('bob', { display_name: 'Bob' })
    await createIntro({ userA: 'alice', userB: 'bob', cardA: 'ca', cardB: 'cb' })
    const { token_a, token_b } = await tokensOf()
    await respondToIntro(token_a, 'accepted')
    await respondToIntro(token_b, 'accepted')
    const d = await inboxData(a)
    expect(d.needsYou).toEqual([expect.objectContaining({ kind: 'say_hello', name: 'Bob' })])
    expect(d.intros).toEqual([expect.objectContaining({ name: 'Bob', turn: 'say-hello' })])
  })

  it("their message latest → message_waiting with preview; my message latest → not in needs-you", async () => {
    const a = await mkUser('alice', { display_name: 'Alice', profile: 'p' })
    const b = await mkUser('bob', { display_name: 'Bob' })
    await createIntro({ userA: 'alice', userB: 'bob', cardA: 'ca', cardB: 'cb' })
    const { token_a, token_b } = await tokensOf()
    await respondToIntro(token_a, 'accepted')
    await respondToIntro(token_b, 'accepted')

    // Bob writes → ball in Alice's court
    await postIntroMessage(token_b, 'Hi Alice — free Thursday?\nsecond line')
    let d = await inboxData(a)
    expect(d.needsYou).toEqual([expect.objectContaining({ kind: 'message_waiting', name: 'Bob', preview: 'Hi Alice — free Thursday?' })])
    expect(d.intros[0]).toMatchObject({ turn: 'your-turn' })

    // Alice replies → ball leaves her court; nothing needs her
    await postIntroMessage(token_a, 'Thursday works')
    d = await inboxData(a)
    expect(d.needsYou).toHaveLength(0)
    expect(d.intros[0]).toMatchObject({ turn: 'their-turn' })
    void b
  })

  it('cards outrank threads in needs-you ordering', async () => {
    const a = await mkUser('alice', { profile: 'p' })
    await mkUser('bob', { display_name: 'Bob' })
    await mkUser('carol')
    // a revealed intro where Bob has written (message_waiting for alice)
    await createIntro({ userA: 'alice', userB: 'bob', cardA: 'ca', cardB: 'cb' })
    const first = await tokensOf()
    await respondToIntro(first.token_a, 'accepted')
    await respondToIntro(first.token_b, 'accepted')
    await postIntroMessage(first.token_b, 'ping')
    // a fresh proposed card from carol
    await createIntro({ userA: 'carol', userB: 'alice', cardA: 'x', cardB: 'a new card for alice' })
    const d = await inboxData(a)
    expect(d.needsYou[0]!.kind).toBe('card') // card first
    expect(d.needsYou.map((n) => n.kind)).toContain('message_waiting')
  })

  it('own data only: another user’s intros and asks never leak in', async () => {
    const a = await mkUser('alice', { profile: 'p' })
    const b = await mkUser('bob', { profile: 'p' })
    await pg.query("insert into asks (user_id, need) values ($1, 'bob only')", [b])
    await createIntro({ userA: 'bob', userB: 'alice', cardA: 'x', cardB: 'y' }) // alice is a party
    // a third-party intro not involving alice
    await mkUser('dave', { profile: 'p' })
    await createIntro({ userA: 'bob', userB: 'dave', cardA: 'x', cardB: 'y' })
    const d = await inboxData(a)
    expect(d.asks).toHaveLength(0) // bob's ask never shows
    expect(d.needsYou).toHaveLength(1) // only the intro alice is in
  })
})

describe('auth seam (stub, matches Trust contract shape)', () => {
  it('introBelongsTo: true for a party, false for a stranger and for held', async () => {
    const a = await mkUser('alice', { profile: 'p' })
    const stranger = await mkUser('zoe', { profile: 'p' })
    await mkUser('bob')
    await createIntro({ userA: 'alice', userB: 'bob', cardA: 'ca', cardB: 'cb' })
    const { token_a } = await tokensOf()
    expect(await introBelongsTo(token_a, a)).toBe(true)
    expect(await introBelongsTo(token_a, stranger)).toBe(false)
    await pg.query("update intros set status = 'held'")
    expect(await introBelongsTo(token_a, a)).toBe(false) // held is invisible even to a party
  })

  it('sessionUser: no cookie → null; cookie present → resolved user (stub)', async () => {
    const a = await mkUser('alice', { profile: 'p' })
    expect(await sessionUser({ get: () => undefined })).toBeNull()
    expect(await sessionUser({ get: () => ({ value: a }) })).toEqual({ id: a })
  })
})
