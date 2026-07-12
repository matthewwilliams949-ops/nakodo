import { getDb } from '../../../../lib/db'
import { authenticate, unauthorized } from '../../../../lib/auth'
import { logEvent } from '../../../../lib/events'
import { generateToken } from '../../../../lib/tokens'

// M9d tier 2 — Telegram connect, no web surface. POST mints a one-time link
// token and returns the t.me deep link; the user taps Start in their own
// Telegram app and the webhook binds the chat. The tap IS the approval —
// nothing binds unless the user acts in an app only they control.
// Telegram caps the ?start= payload at 64 chars; generateToken() is 64 hex.

const LINK_TTL_MINUTES = 30

export async function POST(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const bot = process.env.TELEGRAM_BOT_USERNAME
  if (!bot) return Response.json({ error: 'telegram_not_configured' }, { status: 503 })

  const token = generateToken()
  await getDb().query(
    `update users set telegram_link_token = $2,
       telegram_link_expires_at = now() + interval '${LINK_TTL_MINUTES} minutes'
     where id = $1`,
    [user.id, token],
  )
  await logEvent({ type: 'telegram_link_created', userId: user.id })
  return Response.json({
    url: `https://t.me/${bot}?start=${token}`,
    expires_in_minutes: LINK_TTL_MINUTES,
  })
}

// Disconnect: back to email/in-session only. (delete_me needs no special case —
// chat_id lives on the users row and dies with it, guarantee 5.)
export async function DELETE(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  await getDb().query(
    'update users set telegram_chat_id = null, telegram_link_token = null, telegram_link_expires_at = null where id = $1',
    [user.id],
  )
  await logEvent({ type: 'telegram_disconnected', userId: user.id })
  return Response.json({ ok: true })
}
