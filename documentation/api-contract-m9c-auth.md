# M9c API contract — auth sessions for /inbox

*2026-07-11 · Trust & Platform Engineer · Contract-first for the M9c auth backend (design: [design/inbox-surface.md](design/inbox-surface.md) §4; decided behavior: roadmap §M9c; seam pre-agreed with Product 2026-07-11). Product mocks the page against this; AIE mocks the mint tool against §1. Live code ships on `m9c/auth` when the CTO ungates M9c.*

**The trust posture in one line:** the agent is the key. There is no password, no login form, no email-entry field anywhere — a session begins only from a link minted by an already-authenticated credential (the MCP token) or carried by an email we were already sending. **An intro token is never a login credential** (they travel in forwardable emails; a forwarded intro must never grant account access).

## Storage

Two tables, both `user_id … on delete cascade` — **guarantee 5 is structural: `delete_me` revokes every live session and pending link mechanically.** All tokens stored hashed (sha256), same as user API tokens: a DB leak grants no sessions.

```sql
sessions:    id, user_id (cascade), token_hash unique, created_at, last_seen_at, expires_at
login_links: id, user_id (cascade), token_hash unique, purpose ('agent' | 'email'), created_at, expires_at, used_at
```

## 1. `POST /api/auth/link` — mint a sign-in link (the agent's key)

**Auth:** Bearer (the per-user MCP token). The link inherits the caller's identity — no user selection, ever.

Response `201`:
```json
{ "url": "https://nakodo.dev/auth/<token>", "expires_in": 600 }
```

- Single-use, **10-minute TTL** (`purpose='agent'`). The tool's response copy is fixed by the design brief §4 ("Here's your key to nakodo…") — AIE carries it verbatim.
- Rate limit: 5 mints/hour per user → `429 { retry_after }`.
- Event `login_link_minted` (`purpose` only — never the token).

## 2. Email fallback — a line in emails we already send (no new email, no form)

Per the brief's recommended mechanic, adopted: every notification email to a user with an email on file gains one line — `Your inbox: {url}` — where the url is a login link minted at send time with `purpose='email'`, single-use, **24-hour TTL** (agent links are 10-min because the human is sitting right there; email links meet a human who reads mail later). Same landing route, same single-use law. The page never asks for an email; the fallback exists only because the email already did.

## 3. `GET /auth/[token]` — the landing

- Valid + unused + unexpired → mark used, create session, `Set-Cookie`, `303 → /inbox`. No interstitial (brief §4).
- Anything else (unknown, expired, already used) → one calm lapsed page, **no reason detail**: "This key has lapsed — ask your agent for a fresh one." Indistinguishable outcomes by design; event `login_link_lapsed` server-side only.
- Cookie: **`nakodo_session`** = raw 64-hex session token; `HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000` (30 days, sliding: `expires_at` extends on use when under 15 days left). Lax so top-level GETs from email links carry the session.

## 4. Server-side seam (what Product's RSCs import — no HTTP)

From `apps/web/lib/session.ts`:

- `sessionUser(cookieStore)` → `{ id } | null`. Hash-lookup, expiry-checked, updates `last_seen_at`/sliding renewal. The page only ever sees the user id.
- `introBelongsTo(token, userId)` → boolean. Backs the redirect rule: `/intro/[token]` redirects to `/inbox` **only when** a session exists AND the intro belongs to the session user. No session → the token page renders standalone exactly as today. The token itself never mints or extends a session.
- `POST /api/auth/logout` (session cookie) → deletes the session row, clears the cookie, `303 → /`. Placement is Product's call; the mechanism exists.

## 5. What deliberately does not exist

- No `GET /api/sessions`, no session list UI (v1) — one desk, one key at a time; delete_me is the kill switch.
- No password, no email-entry field, no account-recovery flow — recovery IS "ask your agent" (the MCP token in `~/.config/nakodo/` is the root credential, unchanged).
- No session-from-intro-token path, no cross-user link minting, no long-lived links.

## Events

`login_link_minted` (purpose), `signed_in` (purpose), `signed_out`, `login_link_lapsed`. Metadata never contains tokens or emails.

## Mocking notes

- **Product:** mock `sessionUser` to return a fixed id / null — the whole page can build against that plus existing libs. Signed-out copy per brief §4.
- **AIE:** mint tool calls §1; fixture the `429` and the copy-carrying `201`. The tool must never print the link without the "works once, ten minutes" framing — expiry surprise is a trust paper-cut.
