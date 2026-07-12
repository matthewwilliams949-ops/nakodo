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

const sha = (s: string): Buffer => createHash('sha256').update(s).digest()

export async function GET(req: Request): Promise<Response> {
  const secret = process.env.PROBE_SECRET
  if (!secret) return new Response(null, { status: 404 })
  const header = req.headers.get('authorization') ?? ''
  const presented = header.startsWith('Bearer ') ? header.slice('Bearer '.length).trim() : ''
  if (!timingSafeEqual(sha(presented), sha(secret))) return new Response(null, { status: 404 })

  let db = false
  try {
    await getDb().query('select 1')
    db = true
  } catch {
    /* db stays false */
  }
  const checks = {
    db,
    resend_configured: Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM),
    app_url: Boolean(process.env.APP_URL),
    register_ip_salt: Boolean(process.env.REGISTER_IP_SALT),
  }
  const ok = Object.values(checks).every(Boolean)
  return Response.json({ ok, checks }, { status: ok ? 200 : 503 })
}
