import { z } from 'zod'
import { getDb } from '../../../lib/db'
import { authenticate, unauthorized } from '../../../lib/auth'
import { logEvent } from '../../../lib/events'

const Body = z.object({ need: z.string().min(1).max(2_000) })

// Asks persist as standing needs (SCOPE.md decision) — highest-signal
// matching input the concierge has.
export async function POST(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })

  const { rows } = await getDb().query<{ id: string }>(
    'insert into asks (user_id, need) values ($1, $2) returning id',
    [user.id, parsed.data.need],
  )
  await logEvent({ type: 'ask_registered', userId: user.id })
  return Response.json({ ok: true, id: rows[0]!.id }, { status: 201 })
}
