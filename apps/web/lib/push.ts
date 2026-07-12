// M9d tier 1 — Web Push notify. Same shape as telegram.ts: injectable sender,
// console no-op when unconfigured, and best-effort — notifyPush SWALLOWS send
// failures, a dead subscription must never fail the intro flow it rides on.
// One extra duty telegram doesn't have: a 404/410 from the push service means
// the browser revoked or dropped the subscription — self-heal by clearing the
// column so we stop knocking on a dead door.
import { getDb } from './db'

const PRODUCT = 'Nakodo'

export interface PushSubscription {
  endpoint: string
  keys: { p256dh: string; auth: string }
}

export interface PushMessage {
  userId: string
  subscription: PushSubscription
  payload: PushPayload
}

// The payload is what lands on a LOCK SCREEN — title/body obey the same rule
// as the Telegram DMs: no card content and no names pre-reveal; the
// counterpart's name only after a mutual yes. The URL is the tokenized intro
// page, where anything sensitive lives.
export interface PushPayload {
  title: string
  body: string
  url: string
}

type Sender = (m: PushMessage) => Promise<void>

// Thrown (or duck-typed via statusCode) when the push service says the
// subscription no longer exists — 404/410 per RFC 8030.
function isGone(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'statusCode' in err &&
    ((err as { statusCode: unknown }).statusCode === 404 || (err as { statusCode: unknown }).statusCode === 410)
  )
}

let sender: Sender = async (m) => {
  const publicKey = process.env.VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  if (!publicKey || !privateKey) {
    console.log(`[push skipped — VAPID keys not set] user=${m.userId}`)
    return
  }
  // Lazy import: web-push pulls in crypto machinery the rest of the app never
  // needs, and tests always inject their own sender.
  const webpush = (await import('web-push')).default
  webpush.setVapidDetails(process.env.VAPID_SUBJECT ?? 'mailto:hello@nakodo.dev', publicKey, privateKey)
  await webpush.sendNotification(m.subscription, JSON.stringify(m.payload))
}

export function setPushSender(fn: Sender): void {
  sender = fn
}

// Notification-only channel: failures are logged, never propagated. A gone
// subscription (404/410) clears itself from the row.
export async function notifyPush(m: PushMessage): Promise<void> {
  try {
    await sender(m)
  } catch (err) {
    if (isGone(err)) {
      await getDb()
        .query('update users set push_subscription = null where id = $1', [m.userId])
        .catch(() => {})
      console.log(`[push subscription gone — cleared] user=${m.userId}`)
      return
    }
    console.error(`[push send failed] ${err instanceof Error ? err.message : String(err)}`)
  }
}

// ---------------------------------------------------------------------------
// The three payloads (contract: api-contract-m9d-push.md — exactly these, no
// others). Text mirrors the Telegram DMs; the lock-screen rule is pinned in
// tests against title+body.
// ---------------------------------------------------------------------------

export function pushIntroWaiting(url: string): PushPayload {
  return {
    title: `${PRODUCT}: an introduction is waiting`,
    body: `See the card and decide. They see nothing unless you both say yes — and if you pass, they'll never know.`,
    url,
  }
}

export function pushRevealNotice(url: string, counterpartName: string | null): PushPayload {
  return {
    title: `${PRODUCT}: you both said yes`,
    body: counterpartName ? `${counterpartName} is waiting for your hello.` : `The thread is open — go say hello.`,
    url,
  }
}

export function pushMessageWaiting(url: string): PushPayload {
  return {
    title: `${PRODUCT}: a message is waiting`,
    body: `Someone wrote to you on your introduction. Pick it up when you're ready.`,
    url,
  }
}
