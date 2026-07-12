import { getDb } from './db'

// ───────────────────────────────────────────────────────────────────────────
// M9c AUTH SEAM — STUB (surface-first; Trust & Platform owns the real impl).
//
// This file is the seam the /inbox surface renders against. Signatures match
// the auth-session contract (documentation/api-contract-m9c-auth.md) so the
// real implementation is a drop-in swap: `sessionUser(cookieStore)` resolves
// the signed-in user, `introBelongsTo(token, userId)` backs the token→inbox
// redirect. DO NOT SHIP this stub to prod — it treats the cookie value as the
// user id directly. The real version (Trust's lane, Safety co-review — it's an
// auth surface): a `sessions` table (hashed token → user_id, TTL, slid on use),
// cookie `nakodo_session` HttpOnly/Secure/SameSite=Lax, minted ONLY from an
// already-authenticated credential (the agent's MCP token, or an email
// magic-link), and revoked by delete_me cascade.
//
// The load-bearing invariant, true in stub and real alike: an intro token
// NEVER mints a session. A forwarded notification email must not grant account
// access — it only ever redirects an ALREADY-signed-in owner into their inbox.
// ───────────────────────────────────────────────────────────────────────────

export const SESSION_COOKIE = 'nakodo_session'

export interface SessionUser {
  id: string
}

// Minimal structural type for what next/headers `cookies()` returns.
export interface CookieStore {
  get(name: string): { value: string } | undefined
}

// Test seam (same shape as lib/db's setDb): render tests inject a resolver so
// they need no cookie jar. The production path ignores it.
let testResolver: (() => Promise<SessionUser | null>) | null = null
export function __setSessionUserForTest(fn: (() => Promise<SessionUser | null>) | null): void {
  testResolver = fn
}

export async function sessionUser(cookieStore: CookieStore): Promise<SessionUser | null> {
  if (testResolver) return testResolver()
  const raw = cookieStore.get(SESSION_COOKIE)?.value
  if (!raw) return null
  // STUB: cookie value == user id. Real version hashes it and looks up the
  // sessions row (expiry check + TTL slide). Call site is identical.
  const { rows } = await getDb().query<{ id: string }>('select id from users where id::text = $1', [raw])
  return rows[0] ? { id: rows[0].id } : null
}

// An intro belongs to the signed-in user iff a non-held intro has that user on
// a side. Backs the /intro/[token] → /inbox redirect only; the token itself is
// never a login credential.
export async function introBelongsTo(token: string, userId: string): Promise<boolean> {
  const { rows } = await getDb().query<{ n: number }>(
    "select count(*)::int n from intros where (token_a = $1 or token_b = $1) and status <> 'held' and (user_a = $2 or user_b = $2)",
    [token, userId],
  )
  return (rows[0]?.n ?? 0) > 0
}
