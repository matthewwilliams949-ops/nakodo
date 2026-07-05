import { getDb } from '../../../lib/db'
import { authenticate, unauthorized } from '../../../lib/auth'

// A user's own record: profile + snippets + open asks. Never anything about
// anyone else (trust rule 2).
export async function GET(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const db = getDb()

  const [profile, snippets, asks] = await Promise.all([
    db.query<{ body: string; approved_at: string }>(
      'select body, approved_at from profiles where user_id = $1',
      [user.id],
    ),
    db.query<{ body: string; created_at: string }>(
      'select body, created_at from snippets where user_id = $1 order by created_at desc',
      [user.id],
    ),
    db.query<{ need: string; status: string; created_at: string }>(
      "select need, status, created_at from asks where user_id = $1 and status = 'open' order by created_at desc",
      [user.id],
    ),
  ])

  return Response.json({
    user: { email: user.email, handle: user.handle, location: user.location },
    profile: profile.rows[0] ?? null,
    snippets: snippets.rows,
    asks: asks.rows,
  })
}
