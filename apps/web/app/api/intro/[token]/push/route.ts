import { z } from 'zod'
import { getDb } from '../../../../../lib/db'
import { logEvent } from '../../../../../lib/events'
import { findIntroByToken } from '../../../../../lib/intros'

// M9d tier 1 — Web Push subscribe/unsubscribe, from the intro page. The intro
// token is the auth: the same credential class the user already holds to read
// the card and post messages. The subscription binds to that side's USER (not
// the intro), so every future intro/message knocks on this browser too.
// Contract: api-contract-m9d-push.md. One subscription per user — the latest
// browser wins, matching the one-chat-per-account Telegram rule.

// Only these fields are stored; anything extra the browser attaches is
// stripped. The endpoint is a capability URL → PII store, never in events.
const subscriptionSchema = z.object({
  endpoint: z.string().url().startsWith('https://').max(1024),
  keys: z.object({
    p256dh: z.string().min(1).max(256),
    auth: z.string().min(1).max(256),
  }),
})

async function userIdForToken(token: string): Promise<string | null> {
  const found = await findIntroByToken(token)
  if (!found) return null
  const userId = found.side === 'a' ? found.intro.user_a : found.intro.user_b
  return userId ?? null
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  if (!process.env.VAPID_PUBLIC_KEY || !process.env.VAPID_PRIVATE_KEY) {
    return Response.json({ error: 'push_not_configured' }, { status: 503 })
  }
  const { token } = await params
  const userId = await userIdForToken(token)
  if (!userId) return Response.json({ error: 'not_found' }, { status: 404 })

  const parsed = subscriptionSchema.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })

  const { endpoint, keys } = parsed.data
  await getDb().query('update users set push_subscription = $2 where id = $1', [
    userId,
    JSON.stringify({ endpoint, keys: { p256dh: keys.p256dh, auth: keys.auth } }),
  ])
  await logEvent({ type: 'push_enabled', userId })
  return Response.json({ ok: true })
}

// Unsubscribe from the page. 200 either way — a bearer surface never confirms
// prior state. (delete_me needs no special case: the subscription lives on the
// users row and dies with it, guarantee 5.)
export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params
  const userId = await userIdForToken(token)
  if (!userId) return Response.json({ error: 'not_found' }, { status: 404 })

  const { rows } = await getDb().query<{ id: string }>(
    'update users set push_subscription = null where id = $1 and push_subscription is not null returning id',
    [userId],
  )
  if (rows[0]) await logEvent({ type: 'push_disabled', userId })
  return Response.json({ ok: true })
}
