// One-time Telegram webhook registration (M9d tier 2). Run: pnpm telegram:setup
// Prereqs (Matthew-only, SETUP-ACCOUNTS.md): create the bot with @BotFather,
// then set TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET
// in .env AND in Vercel env. Re-run any time; setWebhook is idempotent.

const token = process.env.TELEGRAM_BOT_TOKEN
const username = process.env.TELEGRAM_BOT_USERNAME
const secret = process.env.TELEGRAM_WEBHOOK_SECRET
const appUrl = (process.env.APP_URL ?? '').replace(/\/$/, '')

if (!token || !username || !secret || !appUrl) {
  console.error('Missing env: need TELEGRAM_BOT_TOKEN, TELEGRAM_BOT_USERNAME, TELEGRAM_WEBHOOK_SECRET, APP_URL.')
  process.exit(1)
}

const api = (method: string) => `https://api.telegram.org/bot${token}/${method}`

// Sanity: the token belongs to the bot the deep links will point at.
const me = (await (await fetch(api('getMe'))).json()) as {
  ok: boolean
  result?: { username?: string }
}
if (!me.ok) {
  console.error('getMe failed — is TELEGRAM_BOT_TOKEN correct?', JSON.stringify(me))
  process.exit(1)
}
if (me.result?.username?.toLowerCase() !== username.toLowerCase()) {
  console.error(`Token belongs to @${me.result?.username}, but TELEGRAM_BOT_USERNAME=${username} — deep links would point at the wrong bot.`)
  process.exit(1)
}

const webhookUrl = `${appUrl}/api/telegram/webhook`
const set = (await (
  await fetch(api('setWebhook'), {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      url: webhookUrl,
      secret_token: secret,
      allowed_updates: ['message'], // /start and /stop are all the bot listens to
    }),
  })
).json()) as { ok: boolean; description?: string }

if (!set.ok) {
  console.error('setWebhook failed:', set.description)
  process.exit(1)
}

const info = (await (await fetch(api('getWebhookInfo'))).json()) as {
  result?: { url?: string; pending_update_count?: number; last_error_message?: string }
}
console.log(`Webhook set: ${info.result?.url}`)
console.log(`Bot: @${me.result?.username} · pending updates: ${info.result?.pending_update_count ?? 0}`)
if (info.result?.last_error_message) console.log(`Last delivery error (may predate this run): ${info.result.last_error_message}`)
console.log('Done. Connect flow: agent calls connect_telegram → user taps the t.me link → bound.')
