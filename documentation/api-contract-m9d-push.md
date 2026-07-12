# M9d tier 1 API contract — browser push notify

*2026-07-12 · Head of LTV · Contract for the Web Push notification channel: `POST/DELETE /api/intro/[token]/push`, the service worker, and the three payloads wired into `lib/intros.ts`. Roadmap: M9d tier 1 (`roadmap-post-m8.md` — "plain browser Web Push, no install, one click"). Built on Matthew's freeze override, 2026-07-12 (launch-critical call); env-gated so the merge changes nothing until keys land. Safety co-review required (subscription endpoint is PII-class).*

**The trust frame (same law as email and Telegram):** a push subscription (endpoint URL + browser keys) is a **capability to notify this browser** — it lives in the **PII store** (`users.push_subscription`), is **notification-only**, never shared, never on a card, never in a pool response, never in event metadata, never used for matching. `delete_me` removes it with the row (guarantee 5, no special case). Disabling from the page or revoking browser permission kills the channel; a dead subscription self-heals server-side (a `404/410` from the push service clears the column).

**One prompt-placement rule (the design decision this contract encodes):** the roadmap hung the enable button on M9c's `/inbox`; M9c doesn't exist. Tier 1 instead rides the **existing tokenized intro page**, on the two post-decision views: `waiting` ("want to know the moment they say yes?") and `revealed` ("want to know the moment they reply?"). The intro token — a credential the user already holds and already uses to post messages — is the auth for the subscribe call. **The prompt appears only after the user has said yes to something** — never beside the accept/pass decision, so enabling notifications can never read as pressure toward accepting.

**The lock-screen rule (pinned in tests, identical to Telegram):** a push notification lands on an unauthenticated, glanceable surface. Pre-reveal payloads carry **no card content and no names**. The counterpart's reveal name may appear only in the mutual-yes payload. The message-waiting payload never carries the body or a name. Anything sensitive lives on the tokenized intro page the notification opens.

**Best-effort channel:** push sends are swallowed on failure (`notifyPush`) — a dead subscription or push-service hiccup must never fail the intro flow it rides on. Absence of a subscription just skips the channel (email's exact pattern); in-session `pending` remains the floor.

**Single subscription per user (v1):** enabling on a second browser overwrites the first — the latest device wins, matching the one-chat-per-account Telegram rule. A per-device table is a post-gate upgrade if feedback asks for it.

---

## `POST /api/intro/[token]/push` — store this browser's subscription

**Auth:** a live intro token in the path (resolves via the standard lookup — `held`/`vetoed` resolve to nothing). The subscription binds to **that side's user**.

Body (zod-validated; anything else `400 invalid_body`):

```json
{ "endpoint": "https://fcm.googleapis.com/…", "keys": { "p256dh": "…", "auth": "…" } }
```

- `endpoint` MUST be an `https:` URL, ≤ 1024 chars; `keys.p256dh` / `keys.auth` ≤ 256 chars each. Only these three fields are stored — anything extra the browser sends is stripped.
- `503 push_not_configured` when `VAPID_PUBLIC_KEY`/`VAPID_PRIVATE_KEY` are unset (channel off).
- `404` when the token resolves to nothing (indistinguishable from any dead token).
- `200 { ok: true }` on store; logs `push_enabled` (user-attributed, **no endpoint in metadata**).

## `DELETE /api/intro/[token]/push` — remove it

Same auth. Clears the column, logs `push_disabled`. `200 { ok: true }` whether or not anything was stored (no state leak on a bearer surface).

## The service worker — `GET /sw.js`

Static file (`apps/web/public/sw.js`). Handles exactly two events: `push` (shows the payload's title/body; malformed payload falls back to a generic "something is waiting" — never crashes into silence) and `notificationclick` (opens the payload's tokenized URL, focusing an existing tab when one has it). No fetch handler, no caching, no analytics — it is a doorbell, not an app.

## The three payloads (all it ever sends)

| Event | Fires from | Content rule |
|---|---|---|
| introduction waiting | `createIntro`, `approveProposal` | generic + intro URL; **no card, no names** |
| you both said yes | `sendRevealNotices` | counterpart reveal name allowed (`display_name → handle → none`) + URL |
| message waiting | `notifyMessageWaiting` (anti-nag rule unchanged, incl. M9b reconnect exception) | generic + URL; **no body, no name** |

Payload JSON: `{ "title": "…", "body": "…", "url": "https://nakodo.dev/intro/<own-token>?via=push" }`. URLs carry `?via=push` — the card-seen-by-channel latency split gains a third channel (page whitelist extended).

## Events

`push_enabled`, `push_disabled` — user-attributed, no endpoint/keys in metadata (events outlive users via SET NULL; the capability must die with the row).

## Env

`VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT` (`mailto:hello@nakodo.dev`) — `.env` + Vercel. Generate once with `npx web-push generate-vapid-keys`. **All unset = channel off, everything else unaffected**: no button renders, subscribe returns 503, sends skip. The public key reaches the client as a server-component prop — it is public by definition; the private key never leaves env.

## Mocking notes

`setPushSender(fn)` mirrors `setTelegramSender`. A sender that throws with `statusCode: 410` exercises the self-heal path (column cleared, flow unaffected). Fixture the lock-screen pins against payload title+body, not the URL.
