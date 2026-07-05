import { z } from 'zod'
import { authenticate } from '../../../lib/auth'
import { logEvent } from '../../../lib/events'

const Body = z.object({
  type: z.string().min(1).max(100),
  install_id: z.string().min(1).max(100).optional(),
  metadata: z.record(z.unknown()).optional(),
})

// Unauthenticated on purpose: pre-registration funnel events (first tool call
// before onboarding) are keyed by install_id only.
export async function POST(req: Request): Promise<Response> {
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })
  const user = await authenticate(req) // optional; attaches user_id when present
  await logEvent({
    type: `client_${parsed.data.type}`, // namespaced so clients can't forge server events
    userId: user?.id,
    installId: parsed.data.install_id,
    metadata: parsed.data.metadata,
  })
  return Response.json({ ok: true }, { status: 201 })
}
