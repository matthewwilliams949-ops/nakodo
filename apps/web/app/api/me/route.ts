import { getDb } from '../../../lib/db'
import { authenticate, unauthorized } from '../../../lib/auth'
import { logEvent } from '../../../lib/events'

// delete_me: the fifth trust guarantee. Cascades profile/snippets/asks and
// (M8) their intro-thread messages; FK SET NULL anonymizes their side of
// intros, their proposals (proposed_by), and past events (schema.sql).
export async function DELETE(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  // Logged before the delete; the FK sets user_id null so only the fact remains.
  await logEvent({ type: 'user_deleted', userId: user.id })
  await getDb().query('delete from users where id = $1', [user.id])
  return Response.json({ ok: true, deleted: true })
}
