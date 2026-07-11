import { getDb } from './db'

// ───────────────────────────────────────────────────────────────────────────
// M9c AUTH SEAM — STUB (mock-first, per the CTO's BUILD-only scope).
//
// Signatures match Trust's contract (documentation/api-contract-m9c-auth.md §4)
// so integration is a drop-in file swap: `sessionUser(cookieStore)` and
// `introBelongsTo(token, userId)`. Trust owns the REAL implementation — a
// `sessions` table (hashed token → user_id), `delete_me`-cascade-revocable,
// cookie `nakodo_session` HttpOnly/Secure/SameSite=Lax, minted only from an
// already-authenticated credential. DO NOT SHIP this stub.
//
// The page only ever sees the resolved user id; an intro token NEVER mints a
// session (a forwarded email must not grant account access).
// ───────────────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = 'nakodo_session'

export interface SessionUser {
  id: string
}

// Minimal structural type for the cookie store next/headers `cookies()` returns.
export interface CookieStore {
  get(name: string): { value: string } | undefined
}

// Test seam (same shape as lib/db's setDb): render tests inject a resolver so
// they need no cookie jar. Production/real path ignores it.
let testResolver: (() => Promise<SessionUser | null>) | null = null
export function __setSessionUserForTest(fn: (() => Promise<SessionUser | null>) | null): void {
  testResolver = fn
}

// STUB behaviour: the cookie value is treated as the user id directly. Trust's
// real version hashes the value, looks up the `sessions` row, checks expiry and
// slides the TTL. Call site is identical, so the page/redirect swap over with
// no changes.
export async function sessionUser(cookieStore: CookieStore): Promise<SessionUser | null> {
  if (testResolver) return testResolver()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  if (!raw) return null
  const { rows } = await getDb().query<{ id: string }>('select id from users where id::text = $1', [raw])
  return rows[0] ? { id: rows[0].id } : null
}

// An intro belongs to the signed-in user iff its (non-held) intro has that user
// on a side. Backs the /intro/[token] → /inbox redirect only; the token itself
// is never a login credential (contract §4, design brief §4).
export async function introBelongsTo(token: string, userId: string): Promise<boolean> {
  const { rows } = await getDb().query<{ n: number }>(
    "select count(*)::int n from intros where (token_a = $1 or token_b = $1) and status <> 'held' and (user_a = $2 or user_b = $2)",
    [token, userId],
  )
  return (rows[0]?.n ?? 0) > 0
}
