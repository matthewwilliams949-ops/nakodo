import { z } from 'zod'
import { getDb } from '../../../lib/db'
import { generateToken, hashToken } from '../../../lib/tokens'
import { logEvent } from '../../../lib/events'
import { sendEmail } from '../../../lib/email'
import { welcome } from '../../../emails/templates'

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
  const { rows } = await db.query<{ id: string }>(
    'insert into users (email, handle, display_name, location, token_hash, source) values ($1, $2, $3, $4, $5, $6) returning id',
    [email ?? null, handle ?? null, display_name ?? null, location ?? null, hashToken(token), source ?? null],
  )
  const userId = rows[0]!.id
  await logEvent({ type: 'registered', userId, installId: install_id, metadata: { source: source ?? null, has_email: Boolean(email) } })
  // Welcome email is best-effort; registration must not fail on email trouble.
  if (email) {
    await sendEmail({ to: email, ...welcome() }).catch((err) => console.error('welcome email failed:', err))
  }

  return Response.json({ token, user_id: userId }, { status: 201 })
}
