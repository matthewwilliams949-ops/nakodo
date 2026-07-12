// M9d tier 2 — Telegram notify. Same shape as email.ts: injectable sender,
// console no-op when unconfigured. One law difference: Telegram is a
// best-effort side channel, so notifyTelegram SWALLOWS send failures — a
// blocked bot or an API hiccup must never fail the intro flow it rides on
// (email keeps its throw; it predates this and the callers expect it).
const PRODUCT = 'Nakodo'

export interface TelegramMessage {
  chatId: string
  text: string
}

type Sender = (m: TelegramMessage) => Promise<void>

let sender: Sender = async (m) => {
  const token = process.env.TELEGRAM_BOT_TOKEN
  if (!token) {
    console.log(`[telegram skipped — TELEGRAM_BOT_TOKEN not set] chat=${m.chatId}`)
    return
  }
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ chat_id: m.chatId, text: m.text }),
  })
  if (!res.ok) throw new Error(`Telegram sendMessage failed: ${res.status} ${await res.text()}`)
}

export function setTelegramSender(fn: Sender): void {
  sender = fn
}

// Notification-only channel: failures are logged, never propagated.
export async function notifyTelegram(m: TelegramMessage): Promise<void> {
  try {
    await sender(m)
  } catch (err) {
    console.error(`[telegram send failed] ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ---------------------------------------------------------------------------
// The three DMs (roadmap M9d tier 2 — exactly these, no others). These land on
// LOCK SCREENS: the pre-reveal text carries no card content and no names; the
// counterpart's name may appear only after a mutual yes. The URL is the same
// tokenized intro page every email points at — the page is where anything
// sensitive lives.
// ---------------------------------------------------------------------------

export function tgIntroWaiting(url: string): string {
  return [
    `${PRODUCT}: an introduction is waiting for you.`,
    ``,
    `See the card and decide: ${url}`,
    ``,
    `They see nothing unless you both say yes — and if you pass, they'll never know.`,
  ].join('\n')
}

export function tgRevealNotice(url: string, counterpartName: string | null): string {
  return [
    counterpartName
      ? `${PRODUCT}: you both said yes — ${counterpartName} is waiting for your hello.`
      : `${PRODUCT}: you both said yes — go say hello.`,
    ``,
    `The thread is open: ${url}`,
  ].join('\n')
}

export function tgMessageWaiting(url: string): string {
  return [
    `${PRODUCT}: a message is waiting on your introduction.`,
    ``,
    `Pick it up here: ${url}`,
  ].join('\n')
}
