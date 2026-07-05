import { z } from 'zod'
import { getDb } from '../../../lib/db'
import { authenticate, unauthorized } from '../../../lib/auth'
import { logEvent } from '../../../lib/events'

const Body = z.object({ body: z.string().min(1).max(5_000) })

// Only ever called after explicit per-snippet human approval (trust rule 1 —
// enforced in the MCP tool description and flow; the API trusts its client).
export async function POST(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })

  const { rows } = await getDb().query<{ id: string }>(
    'insert into snippets (user_id, body) values ($1, $2) returning id',
    [user.id, parsed.data.body],
  )
  await logEvent({ type: 'snippet_captured', userId: user.id })
  return Response.json({ ok: true, id: rows[0]!.id }, { status: 201 })
}
