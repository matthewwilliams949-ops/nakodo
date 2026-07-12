# M9d tier 2 API contract — Telegram notify

*2026-07-12 · Head of Activation · Contract for the Telegram notification channel: `POST/DELETE /api/me/telegram`, `POST /api/telegram/webhook`, and the three DMs wired into `lib/intros.ts`. Roadmap: M9d tier 2 (`roadmap-post-m8.md`) — the accept-rate lever; no web surface, the agent hands a deep link in-session. Safety co-review required (chat-id is PII).*

**The trust frame (same law as email):** the Telegram chat-id lives in the **PII store** (`users` row), is **notification-only**, never shared, never on a card, never in a pool response, never used for matching. The user's own tap on **Start** — inside an app only they control — is the approval that binds; nothing can bind a chat without a token minted by that user's bearer credential in the last 30 minutes. `delete_me` removes it with the row (guarantee 5, no special case); `/stop` to the bot or `connect_telegram(disconnect: true)` unbinds instantly.

**The lock-screen rule (pinned in tests):** a Telegram DM lands on a lock screen — an unauthenticated, glanceable surface, same threat model as email but more exposed. Pre-reveal DMs carry **no card content and no names**. The counterpart's reveal name may appear only in the mutual-yes DM. The message-waiting DM never carries the body or a name. Anything sensitive lives on the tokenized intro page the DM points at.

**Best-effort channel:** Telegram sends are swallowed on failure (`notifyTelegram`) — a blocked bot must never fail the intro flow it rides on. Absence of a chat-id just skips the channel (email's exact pattern); in-session `pending` remains the floor.

---

## `POST /api/me/telegram` — mint a connect link

**Auth:** `Authorization: Bearer <token>`.

Response `200`: `{ "url": "https://t.me/<bot>?start=<token>", "expires_in_minutes": 30 }`.
`503 telegram_not_configured` when `TELEGRAM_BOT_USERNAME` is unset (feature off).

The link token is 64 hex (Telegram's `?start=` cap is 64 chars), single-use, stored on the user's row, overwritten by re-minting, cleared on bind/disconnect.

## `DELETE /api/me/telegram` — disconnect

**Auth:** bearer. Clears chat-id + any pending link token. `200 { ok: true }`.

## `POST /api/telegram/webhook` — the bot's only inbound surface

**Auth:** `X-Telegram-Bot-Api-Secret-Token` must equal `TELEGRAM_WEBHOOK_SECRET` (registered via `pnpm telegram:setup`); anything else is `401`. Valid deliveries always answer `200` (Telegram re-delivers non-2xx forever).

- `/start <token>` — binds when the token is valid and unexpired; single-use. A chat backs exactly one account: binding unbinds any previous owner (delete-and-reregister case). Confirmation DM mentions `/stop`.
- `/stop` — unbinds. The reply is **identical whether or not anything was bound** — an inbound Telegram message is unauthenticated text from anyone, so the webhook never confirms account state (pinned).
- Anything else (including bare `/start` or a bad token) — one static pointer to ask their agent; no state leaks.

## The three DMs (all it ever sends)

| Event | Fires from | Content rule |
|---|---|---|
| introduction waiting | `createIntro`, `approveProposal` | generic + intro URL; **no card, no names** |
| you both said yes | `sendRevealNotices` | counterpart reveal name allowed (`display_name → handle → none`) + URL |
| message waiting | `notifyMessageWaiting` (anti-nag rule unchanged, incl. M9b reconnect exception) | generic + URL; **no body, no name** |

## Env

`TELEGRAM_BOT_TOKEN`, `TELEGRAM_BOT_USERNAME`, `TELEGRAM_WEBHOOK_SECRET` — `.env` + Vercel (SETUP-ACCOUNTS.md §8, Matthew-only). All unset = channel off, everything else unaffected.

## Events

`telegram_link_created`, `telegram_connected`, `telegram_disconnected` — user-attributed, no chat-id in metadata (events outlive users via SET NULL; the chat-id must die with the row).
