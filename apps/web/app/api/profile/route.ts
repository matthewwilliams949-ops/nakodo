import { z } from 'zod'
import { getDb } from '../../../lib/db'
import { authenticate, unauthorized } from '../../../lib/auth'
import { logEvent } from '../../../lib/events'
import { lintPII, piiRejection } from '../../../lib/pii-lint'

const Body = z.object({ body: z.string().min(1).max(10_000) })

// Upsert: onboarding creates the profile; later approved re-syntheses replace it.
// M8: the profile body IS the anonymous pool card, so it is PII-linted here —
// rejected writes never touch the pool (guarantee 2, mechanical).
export async function POST(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })

  const lint = lintPII(parsed.data.body)
  if (!lint.clean) {
    await logEvent({ type: 'pii_lint_rejected', userId: user.id, metadata: { surface: 'profile', flags: lint.flags } })
    return piiRejection(lint.findings, lint.flags)
  }

  await getDb().query(
    `insert into profiles (user_id, body) values ($1, $2)
     on conflict (user_id) do update set body = excluded.body, approved_at = now()`,
    [user.id, parsed.data.body],
  )
  await logEvent({ type: 'profile_approved', userId: user.id })
  return Response.json({ ok: true })
}
