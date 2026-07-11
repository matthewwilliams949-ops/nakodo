import { z } from 'zod'
import { getDb } from '../../../lib/db'
import { authenticate, unauthorized } from '../../../lib/auth'
import { logEvent } from '../../../lib/events'

const Patch = z
  .object({
    // Both PII-store-only fields: never in the pool, never on a card. Email
    // stays a notification channel; display_name appears only after mutual yes.
    email: z.string().email().nullable().optional(),
    display_name: z.string().min(1).max(80).nullable().optional(),
  })
  .refine((b) => b.email !== undefined || b.display_name !== undefined, { message: 'nothing to update' })

// M8: update own identity-store fields. Exists so "you can add an email any
// time" (the agent-channel re-offer, design brief §4.3) is a real capability,
// not a promise. Explicit null clears a field; omitted fields are untouched.
export async function PATCH(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const parsed = Patch.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })
  const { email, display_name } = parsed.data
  const db = getDb()

  if (email) {
    const taken = await db.query('select 1 from users where email = $1 and id <> $2', [email, user.id])
    if (taken.rows[0]) return Response.json({ error: 'already_registered' }, { status: 409 })
  }

  const sets: string[] = []
  const params: unknown[] = [user.id]
  if (email !== undefined) {
    params.push(email)
    sets.push(`email = $${params.length}`)
  }
  if (display_name !== undefined) {
    params.push(display_name)
    sets.push(`display_name = $${params.length}`)
  }
  await db.query(`update users set ${sets.join(', ')} where id = $1`, params)
  await logEvent({
    type: 'identity_updated',
    userId: user.id,
    // field names only, never the values
    metadata: { fields: [email !== undefined ? 'email' : null, display_name !== undefined ? 'display_name' : null].filter(Boolean) },
  })
  return Response.json({ ok: true })
}

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
