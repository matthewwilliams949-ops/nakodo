// probe.main.ts — synthetic uptime probe for the intro flow (Safety lane).
//
// "Vercel is green" is not the metric — the FLOW completing is. Every run
// walks the real product path against the target in APP_URL:
//
//   site up → /api/health (env drift: the Resend-absent class of silent
//   failure) → register ×2 → auth → ask → pool front door → intro
//   (DB-seeded, like the e2e harness) → card page → accept A → accept B →
//   reveal → thread message both ways → revealed page → cleanup.
//
// Run: pnpm probe   (needs DATABASE_URL + APP_URL; PROBE_SECRET optional but
// expected in CI — without it the health leg is SKIPPED, not passed.)
//
// HYGIENE (non-negotiable — pnpm metrics has NO source exclusion, and intros
// proposed is a launch-gate number):
//   * every row carries source='uptime-probe' / install_id='uptime-probe'
//   * every run deletes everything it created, and sweeps leftovers from
//     crashed runs first; the last leg ASSERTS zero residue by tag
//   * probe users get no profile → they can never appear in the pool
//   * deliberately NO delete_me leg: the user_deleted event is anonymized by
//     FK on delete and would be unremovable residue (guarantee 5 is covered
//     by the security pass, not the probe)
//
// LOG HYGIENE: this runs in public-repo GitHub Actions — logs are public.
// Never print tokens, links, emails, or pool content. Leg names, statuses,
// and latencies only.
import pg from 'pg'
import { randomBytes, createHash } from 'node:crypto'

const TAG = 'uptime-probe'
const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const PROBE_SECRET = process.env.PROBE_SECRET
const REQUEST_TIMEOUT_MS = 15_000

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set.')
  process.exit(1)
}

const generateToken = (): string => randomBytes(32).toString('hex')
const hashToken = (t: string): string => createHash('sha256').update(t).digest('hex')

const db = new pg.Client({ connectionString: url })

interface LegResult {
  name: string
  ok: boolean
  ms: number
  detail?: string // sanitized — never tokens/links/content
}
const results: LegResult[] = []

async function leg<T>(name: string, fn: () => Promise<T>): Promise<T> {
  const start = Date.now()
  try {
    const value = await fn()
    results.push({ name, ok: true, ms: Date.now() - start })
    return value
  } catch (e) {
    results.push({ name, ok: false, ms: Date.now() - start, detail: String(e instanceof Error ? e.message : e) })
    throw new ProbeFailure(name)
  }
}

class ProbeFailure extends Error {
  constructor(public legName: string) {
    super(`leg failed: ${legName}`)
  }
}

async function http(
  path: string,
  init: RequestInit = {},
): Promise<{ status: number; body: unknown; text: string }> {
  const res = await fetch(`${APP_URL}${path}`, {
    ...init,
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  })
  const text = await res.text()
  let body: unknown = null
  try {
    body = JSON.parse(text)
  } catch {
    /* HTML pages */
  }
  return { status: res.status, body, text }
}

function expect(cond: boolean, msg: string): void {
  if (!cond) throw new Error(msg)
}

// --- cleanup: surgical by tag, mirrors the e2e harness ----------------------

async function cleanup(): Promise<{ users: number; intros: number; events: number; messages: number }> {
  const ids = (await db.query<{ id: string }>('select id from users where source = $1', [TAG])).rows.map(
    (r) => r.id,
  )
  const introIds = ids.length
    ? (
        await db.query<{ id: string }>('select id from intros where user_a = any($1) or user_b = any($1)', [ids])
      ).rows.map((r) => r.id)
    : []

  await db.query('begin')
  try {
    const messages = introIds.length
      ? await db.query('delete from intro_messages where intro_id = any($1)', [introIds])
      : { rowCount: 0 }
    const evByIntro = introIds.length
      ? await db.query(`delete from events where metadata->>'intro_id' = any($1)`, [introIds])
      : { rowCount: 0 }
    const evByUser = ids.length
      ? await db.query('delete from events where user_id = any($1)', [ids])
      : { rowCount: 0 }
    const evByInstall = await db.query('delete from events where install_id = $1', [TAG])
    const intros = introIds.length
      ? await db.query('delete from intros where id = any($1)', [introIds])
      : { rowCount: 0 }
    const users = ids.length ? await db.query('delete from users where id = any($1)', [ids]) : { rowCount: 0 }
    await db.query('commit')
    return {
      users: users.rowCount ?? 0,
      intros: intros.rowCount ?? 0,
      messages: messages.rowCount ?? 0,
      events: (evByIntro.rowCount ?? 0) + (evByUser.rowCount ?? 0) + (evByInstall.rowCount ?? 0),
    }
  } catch (e) {
    await db.query('rollback')
    throw e
  }
}

async function assertZeroResidue(): Promise<void> {
  const users = await db.query('select count(*)::int n from users where source = $1', [TAG])
  const events = await db.query('select count(*)::int n from events where install_id = $1', [TAG])
  const u = (users.rows[0] as { n: number }).n
  const e = (events.rows[0] as { n: number }).n
  expect(u === 0 && e === 0, `residue after cleanup: ${u} users, ${e} tagged events`)
}

// --- the walk ----------------------------------------------------------------

async function register(label: 'a' | 'b', runId: string): Promise<{ token: string; userId: string }> {
  const { status, body } = await http('/api/register', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      handle: `probe-${label}-${runId}`,
      display_name: `Probe ${label.toUpperCase()}`,
      source: TAG,
      install_id: TAG,
      // deliberately NO email: no Resend sends, no notification noise
    }),
  })
  expect(status === 201, `register ${label}: status ${status}`)
  const b = body as { token?: string; user_id?: string }
  expect(Boolean(b.token && b.user_id), `register ${label}: missing token/user_id`)
  return { token: b.token!, userId: b.user_id! }
}

async function main(): Promise<void> {
  const runId = randomBytes(4).toString('hex')
  const prod = /nakodo\.dev/.test(APP_URL)
  console.log(`intro-flow probe · target ${prod ? 'PROD' : APP_URL} · run ${runId}\n`)

  await db.connect()
  let failed = false
  try {
    const swept = await leg('sweep-leftovers', cleanup)
    if (swept.users > 0) console.log(`  (swept ${swept.users} leftover probe users from a prior run)`)

    await leg('site-up', async () => {
      const { status } = await http('/')
      expect(status === 200, `GET / → ${status}`)
    })

    if (PROBE_SECRET) {
      await leg('health-env', async () => {
        const { status, body } = await http('/api/health', {
          headers: { authorization: `Bearer ${PROBE_SECRET}` },
        })
        expect(status !== 404, 'health endpoint dark — PROBE_SECRET missing/wrong in app env')
        const b = body as { ok?: boolean; checks?: Record<string, boolean> }
        const bad = Object.entries(b.checks ?? {})
          .filter(([, v]) => !v)
          .map(([k]) => k)
        expect(status === 200 && b.ok === true, `health ${status}: failing checks: ${bad.join(', ') || 'unknown'}`)
      })
    } else {
      results.push({ name: 'health-env', ok: true, ms: 0, detail: 'SKIPPED — no PROBE_SECRET in probe env' })
      console.log('  ⚠ health leg skipped (PROBE_SECRET not set) — env drift is NOT being checked')
    }

    const a = await leg('register-a', () => register('a', runId))
    const b = await leg('register-b', () => register('b', runId))

    await leg('auth-record', async () => {
      const { status } = await http('/api/record', { headers: { authorization: `Bearer ${a.token}` } })
      expect(status === 200, `GET /api/record → ${status}`)
    })

    await leg('ask', async () => {
      const { status } = await http('/api/asks', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${a.token}` },
        body: JSON.stringify({ need: `[synthetic probe ${runId}] verifying the ask leg — never matched` }),
      })
      expect(status === 201 || status === 200, `POST /api/asks → ${status}`)
    })

    await leg('pool-front-door', async () => {
      const { status, body } = await http('/api/pool', { headers: { authorization: `Bearer ${a.token}` } })
      expect(status === 200, `GET /api/pool → ${status}`)
      expect(Array.isArray((body as { pool?: unknown[] })?.pool), 'pool: unexpected shape')
    })

    // Intro seeded directly (the concierge path) — probe users have no
    // profile, so nothing the probe creates can ever surface in the pool.
    const intro = await leg('seed-intro', async () => {
      const tokenA = generateToken()
      const tokenB = generateToken()
      const card = `[synthetic probe card ${runId}] — not a person; created and removed by the uptime probe.`
      const { rows } = await db.query<{ id: string }>(
        `insert into intros (user_a, user_b, card_a, card_b, status, token_a, token_b, token_expires_at)
         values ($1, $2, $3, $3, 'proposed', $4, $5, now() + interval '1 day') returning id`,
        [a.userId, b.userId, card, tokenA, tokenB],
      )
      await db.query(`insert into events (install_id, type, metadata) values ($1, 'intro_proposed', $2)`, [
        TAG,
        JSON.stringify({ intro_id: rows[0]!.id, via: TAG }),
      ])
      return { id: rows[0]!.id, tokenA, tokenB }
    })

    await leg('card-page', async () => {
      const { status } = await http(`/intro/${intro.tokenA}`)
      expect(status === 200, `GET /intro/<tokenA> → ${status}`)
    })

    await leg('accept-a', async () => {
      const { status, body } = await http(`/api/intro/${intro.tokenA}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: 'accepted' }),
      })
      const view = (body as { view?: string })?.view
      expect(status === 200 && view === 'waiting', `accept A → ${status}, view ${view}`)
    })

    await leg('accept-b-reveal', async () => {
      const { status, body } = await http(`/api/intro/${intro.tokenB}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ response: 'accepted' }),
      })
      const view = (body as { view?: string })?.view
      expect(status === 200 && view === 'revealed', `accept B → ${status}, view ${view} (expected revealed)`)
    })

    await leg('thread', async () => {
      for (const token of [intro.tokenA, intro.tokenB]) {
        const { status, body } = await http(`/api/intro/${token}`, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ message: `[synthetic probe ${runId}] hello from the probe` }),
        })
        const bb = body as { message_sent?: boolean; view?: string }
        expect(status === 200 && bb.message_sent === true, `thread message → ${status}, view ${bb.view}`)
      }
    })

    await leg('revealed-page', async () => {
      const { status } = await http(`/intro/${intro.tokenA}`)
      expect(status === 200, `GET /intro/<tokenA> (revealed) → ${status}`)
    })

    await leg('cleanup', cleanup)
    await leg('zero-residue', assertZeroResidue)
  } catch (e) {
    failed = true
    if (!(e instanceof ProbeFailure)) results.push({ name: 'unexpected', ok: false, ms: 0, detail: String(e) })
    // Best-effort cleanup even on failure — the metrics baseline stays honest.
    try {
      await cleanup()
      console.log('  (post-failure cleanup ran — no probe rows left behind)')
    } catch {
      console.error('  ⚠ POST-FAILURE CLEANUP ALSO FAILED — probe rows may be polluting metrics (source=uptime-probe)')
    }
  } finally {
    await db.end()
  }

  console.log('')
  for (const r of results) {
    console.log(`  ${r.ok ? '✓' : '✗'} ${r.name.padEnd(18)} ${String(r.ms).padStart(5)}ms${r.detail ? `  ${r.detail}` : ''}`)
  }
  const total = results.reduce((s, r) => s + r.ms, 0)
  console.log(`\n${failed ? '✗ PROBE FAILED' : '✓ intro flow healthy'} · ${results.length} legs · ${total}ms total`)
  if (failed) process.exit(1)
}

void main()
