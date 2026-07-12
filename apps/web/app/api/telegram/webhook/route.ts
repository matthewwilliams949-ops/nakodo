import { getDb } from '../../../../lib/db'
import { logEvent } from '../../../../lib/events'
import { notifyTelegram } from '../../../../lib/telegram'

// M9d tier 2 — the bot's only inbound surface. Two commands, nothing else:
// /start <token> binds the chat to the user who minted the token (the deep
// link the agent handed over in-session), /stop unbinds. Every other message
// gets one static pointer. The bot never answers questions, never echoes
// account state, never confirms whether a chat is bound — an inbound Telegram
// message is unauthenticated text from anyone, so nothing here may read data
// out; it may only bind (with a valid unexpired token) or unbind (self-serve).
//
// Auth: Telegram echoes back the secret we register with setWebhook
// (scripts/telegram-setup.ts) in this header on every delivery.

interface TelegramUpdate {
  message?: { chat?: { id?: number | string }; text?: string }
}

const NOT_BOUND_REPLY =
  'This bot only delivers Nakodo notifications. To connect, ask your agent for a Telegram link and tap it — the link is minted for your account and expires after 30 minutes.'

export async function POST(req: Request): Promise<Response> {
  const secret = process.env.TELEGRAM_WEBHOOK_SECRET
  if (!secret || req.headers.get('x-telegram-bot-api-secret-token') !== secret) {
    return Response.json({ error: 'unauthorized' }, { status: 401 })
  }

  const update = (await req.json().catch(() => null)) as TelegramUpdate | null
  const chatId = update?.message?.chat?.id
  const text = update?.message?.text?.trim()
  // Always 200 from here down: Telegram re-delivers non-2xx responses forever.
  if (chatId === undefined || chatId === null || !text) return Response.json({ ok: true })
  const chat = String(chatId)
  const db = getDb()

  const start = text.match(/^\/start(?:\s+(\S+))?/)
  if (start) {
    const token = start[1]
    // Gate on the token being redeemable RIGHT NOW: an expired or unknown
    // token must be a complete no-op — otherwise a stale /start link severs
    // the chat's working connection before the bind below fails.
    const redeemable =
      token &&
      (
        await db.query('select 1 from users where telegram_link_token = $1 and telegram_link_expires_at > now()', [
          token,
        ])
      ).rows.length > 0
    if (redeemable) {
      // Bind on a valid, unexpired token; the token is single-use. A chat can
      // back exactly one account (unique column), so unbind any previous owner
      // first — delete-and-reregister is the common case. Two statements, not
      // one CTE: same-table data-modifying CTEs run in unpredictable order and
      // can trip the unique constraint mid-statement.
      await db.query(
        'update users set telegram_chat_id = null where telegram_chat_id = $2 and telegram_link_token is distinct from $1',
        [token, chat],
      )
      const { rows } = await db.query<{ id: string }>(
        `update users set telegram_chat_id = $2, telegram_link_token = null, telegram_link_expires_at = null
         where telegram_link_token = $1 and telegram_link_expires_at > now()
         returning id`,
        [token, chat],
      )
      if (rows[0]) {
        await logEvent({ type: 'telegram_connected', userId: rows[0].id })
        await notifyTelegram({
          chatId: chat,
          text: 'Connected. Nakodo will knock here when an introduction or a message is waiting — nothing else, ever. Send /stop to disconnect any time.',
        })
        return Response.json({ ok: true })
      }
    }
    await notifyTelegram({ chatId: chat, text: NOT_BOUND_REPLY })
    return Response.json({ ok: true })
  }

  if (text.startsWith('/stop')) {
    // Self-serve unbind: possession of the chat is the credential, matching
    // how the binding was created. No confirmation of prior state leaks —
    // the reply is identical whether or not anything was bound.
    const { rows } = await db.query<{ id: string }>(
      'update users set telegram_chat_id = null where telegram_chat_id = $1 returning id',
      [chat],
    )
    if (rows[0]) await logEvent({ type: 'telegram_disconnected', userId: rows[0].id })
    await notifyTelegram({
      chatId: chat,
      text: 'Disconnected — no more notifications here. Your agent can hand you a fresh link whenever you want back in.',
    })
    return Response.json({ ok: true })
  }

  await notifyTelegram({ chatId: chat, text: NOT_BOUND_REPLY })
  return Response.json({ ok: true })
}
