import { z } from 'zod'
import { authenticate, unauthorized } from '../../../lib/auth'
import { getDb } from '../../../lib/db'
import { logEvent } from '../../../lib/events'
import { lintPII, piiRejection } from '../../../lib/pii-lint'

// POST /api/feedback — agent-collected product feedback (contract:
// documentation/api-contract-m9-feedback.md). Guarantee 1 extended: the
// share_feedback tool shows the user the exact text and files only on their
// yes — this endpoint stores what arrives and is deliberately write-only
// (no read endpoint exists; the admin digest is `pnpm feedback`).
//
// Lint scope is INSTRUCTION-ONLY: admins read these bodies, so instruction-
// shaped text is rejected, but identity patterns are allowed — "the link on
// nakodo.dev was broken" is legitimate feedback, and the store is internal.

const Body = z.object({
  moment: z.enum(['onboarding', 'cards', 'intro_quality', 'reveal', 'thread', 'waiting']),
  sentiment: z.enum(['positive', 'neutral', 'negative', 'mixed']),
  body: z.string().min(1).max(4000),
})

const DAILY_LIMIT = 10

export async function POST(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })
  const { moment, sentiment, body } = parsed.data
  const db = getDb()

  const instructionFindings = lintPII(body).findings.filter((f) => f.flag === 'instruction')
  if (instructionFindings.length > 0) {
    await logEvent({ type: 'pii_lint_rejected', userId: user.id, metadata: { surface: 'feedback', flags: ['instruction'] } })
    return piiRejection(instructionFindings, ['instruction'])
  }

  const recent = await db.query<{ n: number }>(
    "select count(*)::int as n from feedback where user_id = $1 and created_at > now() - interval '24 hours'",
    [user.id],
  )
  if (recent.rows[0]!.n >= DAILY_LIMIT) {
    return Response.json({ error: 'rate_limited', retry_after: 86400 }, { status: 429 })
  }

  await db.query('insert into feedback (user_id, moment, sentiment, body) values ($1, $2, $3, $4)', [
    user.id,
    moment,
    sentiment,
    body,
  ])
  // moment + sentiment only — the body never enters the events table.
  await logEvent({ type: 'feedback_shared', userId: user.id, metadata: { moment, sentiment } })
  return Response.json({ ok: true }, { status: 201 })
}
