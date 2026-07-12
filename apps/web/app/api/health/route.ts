import { createHash, timingSafeEqual } from 'node:crypto'
import { getDb } from '../../../lib/db'

// GET /api/health — configuration + dependency check for the synthetic uptime
// probe (Safety lane). Exists because the app fails SILENTLY when env is
// missing: lib/email.ts no-ops without RESEND_API_KEY/EMAIL_FROM, which is how
// prod sent zero email after the Frankfurt cutover until a manual e2e caught
// it. This endpoint makes that class of drift machine-detectable.
//
// Gated by PROBE_SECRET: unset, or wrong bearer, → 404 — the public surface
// gains no new endpoint. Response is booleans only, never values.
//
// SCHEMA-DRIFT CHECK (added 2026-07-12 after two incidents in one day): code
// deploys on push, but DB migrations are a separate manual `pnpm db:apply`, so
// a schema-touching merge opens a window where the deployed code queries a
// column the DB doesn't have yet — every reveal 500s (the M9d telegram_chat_id
// break) until someone notices. This asserts the columns the live intro path
// depends on actually exist, so the probe catches drift on a cheap catalog
// read instead of needing to walk a full reveal. Append a column here in the
// SAME change that adds a migration reading it — that pairing is the guard.
const REQUIRED_USER_COLUMNS = [
  'email',
  'token_hash',
  'telegram_chat_id',
  'push_subscription',
]

const sha = (s: string): Buffer => createHash('sha256').update(s).digest()

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.PROBE_SECRET
  if (!secret) return new Response(null, { status: 404 })
  const header = req.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (!timingSafeEqual(sha(presented), sha(secret))) return new Response(null, { status: 404 })

  let db = false
  let schema = false
  try {
    // One catalog read covers both connectivity and drift: which of the
    // required columns actually exist on users right now.
    const { rows } = await getDb().query<{ column_name: string }>(
      `select column_name from information_schema.columns
       where table_schema = 'public' and table_name = 'users' and column_name = any($1)`,
      [REQUIRED_USER_COLUMNS],
    )
    db = true
    schema = rows.length === REQUIRED_USER_COLUMNS.length
  } catch {
    /* db + schema stay false */
  }
  const checks = {
    db,
    schema,
    resend_configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    app_url: Boolean(process.env.APP_URL),
    register_ip_salt: Boolean(process.env.REGISTER_IP_SALT),
  }
  const ok = Object.values(checks).every(Boolean)
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 })
}
