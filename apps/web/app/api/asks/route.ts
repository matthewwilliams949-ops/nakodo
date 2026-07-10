import { z } from 'zod'
import { getDb } from '../../../lib/db'
import { authenticate, unauthorized } from '../../../lib/auth'
import { logEvent } from '../../../lib/events'

const Body = z.object({ need: z.string().min(1).max(2_000) })

// Asks persist as standing needs (SCOPE.md decision) — highest-signal
// matching input the concierge has.
// M8: idempotent per (user, open, need-text) — find_collaborator re-runs with
// the same need during a calibration session must not pile up duplicate rows.
export async function POST(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })

  const db = getDb()
  const existing = await db.query<{ id: string }>(
    "select id from asks where user_id = $1 and status = 'open' and need = $2",
    [user.id, parsed.data.need],
  )
  if (existing.rows[0]) {
    return Response.json({ ok: true, id: existing.rows[0].id, existing: true })
  }

  const { rows } = await db.query<{ id: string }>(
    'insert into asks (user_id, need) values ($1, $2) returning id',
    [user.id, parsed.data.need],
  )
  await logEvent({ type: 'ask_registered', userId: user.id })
  return Response.json({ ok: true, id: rows[0]!.id }, { status: 201 })
}
