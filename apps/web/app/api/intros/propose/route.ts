import { z } from 'zod'
import { authenticate, unauthorized } from '../../../../lib/auth'
import { getDb } from '../../../../lib/db'
import { generateToken } from '../../../../lib/tokens'
import { logEvent } from '../../../../lib/events'
import { lintPII, piiRejection } from '../../../../lib/pii-lint'
import { sendIntroCardNotices } from '../../../../lib/intros'

// POST /api/intros/propose — an agent proposes an introduction after its
// human said go (contract: documentation/api-contract-m8.md + 2026-07-12
// addendum). Creates a live 'proposed' intro and notifies the target
// immediately — the seed-phase human review ('held') was removed on Matthew's
// call (2026-07-12): agents select, both humans still approve (the proposer
// said go; the target accepts or declines), and the server-side lint, caps,
// and busy-dampening below remain the guard rails. The review machinery
// (lib listHeldProposals/approve/veto + `pnpm --filter web intro:review`)
// stays intact as an EMERGENCY BRAKE: flip this insert back to 'held' and
// the old flow works unchanged.
//
// Silence rules encoded here, not in policy:
//  * one opaque 'target_busy' covers BOTH inbound dampening and a reverse-
//    direction collision, so a proposer can never learn they are being
//    considered by the other side
//  * 'ask_not_found' covers not-exists / not-yours / not-open — no probing
//  * own card is simply not in your pool → 'card_not_found', same as unknown

const Body = z.object({
  card_id: z.string().uuid(),
  ask_id: z.string().uuid(),
  why_for_them: z.string().min(1).max(1000),
  why_for_me: z.string().min(1).max(1000),
})

const TOKEN_TTL_DAYS = 14
const MAX_OPEN_OUTBOUND = 2
const MAX_OPEN_INBOUND = 3

export async function POST(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const parsed = Body.safeParse(await req.json().catch(() => null))
  if (!parsed.success) return Response.json({ error: 'invalid_body' }, { status: 400 })
  const { card_id, ask_id, why_for_them, why_for_me } = parsed.data
  const db = getDb()

  // Both whys are linted — why_for_them lands in the target's card (a
  // stranger's agent context), so identity AND instruction-shaped text are
  // rejected before a proposal row exists (CTO scope call, 2026-07-10).
  const lint = lintPII(`${why_for_them}\n${why_for_me}`)
  if (!lint.clean) {
    await logEvent({ type: 'pii_lint_rejected', userId: user.id, metadata: { surface: 'propose', flags: lint.flags } })
    return piiRejection(lint.findings, lint.flags)
  }

  const ask = await db.query<{ id: string; need: string }>(
    "select id, need from asks where id = $1 and user_id = $2 and status = 'open'",
    [ask_id, user.id],
  )
  if (!ask.rows[0]) return Response.json({ error: 'ask_not_found' }, { status: 404 })

  const target = await db.query<{ user_id: string; body: string }>(
    'select user_id, body from profiles where card_id = $1',
    [card_id],
  )
  if (!target.rows[0] || target.rows[0].user_id === user.id) {
    return Response.json({ error: 'card_not_found' }, { status: 404 })
  }
  const targetId = target.rows[0].user_id

  // Proposer needs a profile: it IS the card the target will see.
  const ownProfile = await db.query<{ body: string }>(
    'select body from profiles where user_id = $1',
    [user.id],
  )
  if (!ownProfile.rows[0]) {
    return Response.json(
      { error: 'no_profile', hint: 'Your anonymous profile is the card the other side sees — create it first.' },
      { status: 403 },
    )
  }

  // Proposal scarcity: max 2 open outbound. Counts only the caller's own
  // proposals — the single cap-related number the caller may ever see.
  // Expired proposals free their slot: a held intro nobody ever reviewed must
  // not lock the user's cap forever.
  const outbound = await db.query<{ n: number }>(
    "select count(*)::int as n from intros where proposed_by = $1 and status in ('held', 'proposed') and token_expires_at > now()",
    [user.id],
  )
  const openOutbound = outbound.rows[0]!.n
  if (openOutbound >= MAX_OPEN_OUTBOUND) {
    return Response.json({ error: 'proposal_cap', open_outbound: openOutbound }, { status: 409 })
  }

  // Same-direction duplicate: discloses only the caller's own prior action.
  const dup = await db.query(
    "select 1 from intros where user_a = $1 and user_b = $2 and status in ('held', 'proposed') and token_expires_at > now() limit 1",
    [user.id, targetId],
  )
  if (dup.rows[0]) return Response.json({ error: 'already_proposed' }, { status: 409 })

  // One opaque answer for reverse-direction collision AND inbound dampening.
  const busy = await db.query<{ reverse: boolean; inbound: number }>(
    `select
       exists(select 1 from intros where user_a = $2 and user_b = $1 and status in ('held', 'proposed') and token_expires_at > now()) as reverse,
       (select count(*)::int from intros where user_b = $2 and status in ('held', 'proposed') and token_expires_at > now()) as inbound`,
    [user.id, targetId],
  )
  if (busy.rows[0]!.reverse || busy.rows[0]!.inbound >= MAX_OPEN_INBOUND) {
    return Response.json({ error: 'target_busy' }, { status: 409 })
  }

  // Server-assembled cards — the proposer controls only profile/ask/why_for_them.
  // card_a (shown to the proposer after approval) is the target's pool card;
  // card_b (shown to the target) is the proposer's pool card + ask + why.
  const targetSnippets = await db.query<{ body: string }>(
    'select body from snippets where user_id = $1 order by created_at desc limit 3',
    [targetId],
  )
  const cardA = [
    target.rows[0].body,
    targetSnippets.rows.length ? `Recent work:\n${targetSnippets.rows.map((s) => `— ${s.body}`).join('\n')}` : null,
  ]
    .filter(Boolean)
    .join('\n\n')
  const cardB = [
    ownProfile.rows[0].body,
    `They're looking for: ${ask.rows[0].need}`,
    `Why this could be for you: ${why_for_them}`,
  ].join('\n\n')

  // Proposing IS the proposer's opt-in: a_response is 'accepted' from birth,
  // so the target's accept completes the double opt-in directly, and the
  // proposer's own pending channel never offers them their own proposal.
  const tokenB = generateToken()
  const { rows } = await db.query<{ id: string }>(
    `insert into intros (user_a, user_b, proposed_by, ask_id, card_a, card_b, token_a, token_b, token_expires_at, status, a_response, a_responded_at)
     values ($1, $2, $1, $3, $4, $5, $6, $7, now() + interval '${TOKEN_TTL_DAYS} days', 'proposed', 'accepted', now())
     returning id`,
    [user.id, targetId, ask_id, cardA, cardB, generateToken(), tokenB],
  )
  const introId = rows[0]!.id
  // The target hears the knock now (email/Telegram if on file; otherwise
  // their agent's pending channel) — no review gate between propose and deliver.
  await sendIntroCardNotices(targetId, cardB, tokenB)
  // why_for_me is calibration/audit data only — event metadata, never a card.
  await logEvent({
    type: 'intro_proposed',
    userId: user.id,
    metadata: { intro_id: introId, ask_id, via: 'agent_direct', why_for_me },
  })

  return Response.json(
    {
      intro_id: introId,
      status: 'proposed',
      note:
        "Delivered — they have your anonymous card and will accept or decline in their own time. You'll hear only if you both say yes.",
      open_outbound: openOutbound + 1,
    },
    { status: 201 },
  )
}
