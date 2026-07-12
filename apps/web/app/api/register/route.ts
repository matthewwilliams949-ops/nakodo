import { createHash } from 'node:crypto'
import { z } from 'zod'
import { getDb } from '../../../lib/db'
import { generateToken, hashToken } from '../../../lib/tokens'
import { logEvent } from '../../../lib/events'
import { sendEmail } from '../../../lib/email'
import { welcome } from '../../../emails/templates'

// Launch-hardening (2026-07-12 audit): registration is the choke point for
// pool poisoning — every pool write needs a token, every token starts here.
// 51 junk profiles would trip the pool's deliberate >50 hard-fail (503) for
// every real user, so an unlimited register endpoint is a one-script DoS.
// Two limits, both computed from the events log like the pool limiter:
//   * per-IP hourly (successful registrations) — the drive-by bar
//   * global daily breaker — the distributed backstop; blocking signups for a
//     day is recoverable, a poisoned pool is a cleanup job
// Privacy: the raw IP is never stored — only a salted, truncated hash, good
// for counting and useless for lookup (Safety co-review routed 2026-07-12).
const HOURLY_PER_IP = Number(process.env.REGISTER_HOURLY_PER_IP ?? 3)
const DAILY_GLOBAL = Number(process.env.REGISTER_DAILY_GLOBAL ?? 200)

function ipHash(req: Request): string | null {
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    req.headers.get('x-real-ip')?.trim() ||
    null
  if (!ip) return null // no proxy header (tests, local dev) — Vercel always sets one
  return createHash('sha256').update(`nakodo-register:${ip}`).digest('hex').slice(0, 16)
}

const Body = z.object({
  // v1.1: optional. Notification channel only — never shared, never required.
  email: z.string().email().optional(),
  handle: z.string().min(1).max(80).optional(),
  // M8: what a match may call this person after a mutual yes. PII store only —
  // never in the pool, never on a card; shown only on the revealed intro page.
  display_name: z.string().min(1).max(80).optional(),
  location: z.string().min(1).max(120).optional(),
  // Attribution: how the agent found this server — the Motion 3 instrument.
  source: z.string().min(1).max(500).optional(),
  install_id: z.string().min(1).max(100).optional(),
})

export async function POST(req: Request): Promise<Response> {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })
  const { email, handle, display_name, location, source, install_id } = parsed.data

  const db = getDb()
  const ip_h = ipHash(req)
  const usage = await db.query<{ per_ip: number; global_daily: number }>(
    `select
       count(*) filter (where metadata->>'ip_h' = $1 and created_at > now() - interval '1 hour')::int as per_ip,
       count(*) filter (where created_at > now() - interval '24 hours')::int as global_daily
     from events where type = 'registered'`,
    [ip_h],
  )
  const { per_ip, global_daily } = usage.rows[0]!
  if (global_daily >= DAILY_GLOBAL) {
    await logEvent({ type: 'register_breaker_tripped', metadata: { global_daily } })
    return Response.json({ error: 'rate_limited', retry_after: 3600 }, { status: 429 })
  }
  if (ip_h && per_ip >= HOURLY_PER_IP) {
    await logEvent({ type: 'register_rate_limited', metadata: { ip_h } })
    return Response.json({ error: 'rate_limited', retry_after: 3600 }, { status: 429 })
  }

  if (email) {
    const existing = await db.query('select id from users where email = $1', [email])
    if (existing.rows.length > 0) {
      return Response.json(
        { error: 'already_registered', hint: 'This email already has a record. Reply to any of our emails to recover access.' },
        { status: 409 },
      )
    }
  }

  const token = generateToken()
  let userId: string
  try {
    const { rows } = await db.query<{ id: string }>(
      'insert into users (email, handle, display_name, location, token_hash, source) values ($1, $2, $3, $4, $5, $6) returning id',
      [email ?? null, handle ?? null, display_name ?? null, location ?? null, hashToken(token), source ?? null],
    )
    userId = rows[0]!.id
  } catch (err) {
    // Concurrent duplicate slipping past the pre-check: the email unique
    // constraint is the arbiter — answer 409 like the pre-check, never 500.
    if ((err as { code?: string })?.code === '23505') {
      return Response.json(
        { error: 'already_registered', hint: 'This email already has a record. Reply to any of our emails to recover access.' },
        { status: 409 },
      )
    }
    throw err
  }
  await logEvent({ type: 'registered', userId, installId: install_id, metadata: { source: source ?? null, has_email: Boolean(email), ip_h } })
  // Welcome email is best-effort; registration must not fail on email trouble.
  if (email) {
    await sendEmail({ to: email, ...welcome() }).catch((err) => console.error('welcome email failed:', err))
  }

  return Response.json({ token, user_id: userId }, { status: 201 })
}
