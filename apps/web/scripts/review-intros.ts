// EMERGENCY BRAKE (2026-07-12): the live propose path skips 'held' — proposals
// deliver directly. This CLI only has work if the propose route is flipped back
// to inserting 'held' rows (see app/api/intros/propose/route.ts header).
// M8 seed-phase review (T6): Matthew's weekly one-click quality floor over
// agent proposals. Shows exactly what the target WOULD see plus the
// proposer's why_for_me (intent signal) — no identity fields, nothing else.
//
// Usage:
//   pnpm intro:review               list held proposals
//   pnpm intro:review approve <id>  deliver it (target gets the card)
//   pnpm intro:review veto <id>     kill it silently (nobody ever knows)
import { approveProposal, listHeldProposals, vetoProposal } from '../lib/intros'

const [action, id] = process.argv.slice(2)

if (!action || action === 'list') {
  const held = await listHeldProposals()
  if (held.length === 0) {
    console.log('No proposals waiting for review.')
  } else {
    for (const p of held) {
      console.log(`── ${p.id} · held since ${String(p.created_at).slice(0, 16)}`)
      console.log(`   The target would see:\n${p.card_b.split('\n').map((l) => `   │ ${l}`).join('\n')}`)
      console.log(`   Proposer's why_for_me (review-only): ${p.why_for_me ?? '(not recorded)'}`)
      console.log(`   → pnpm intro:review approve ${p.id}   |   pnpm intro:review veto ${p.id}\n`)
    }
    console.log(`${held.length} waiting. Approve delivers the card; veto is silent — nobody ever learns it existed.`)
  }
  process.exit(0)
}

if ((action === 'approve' || action === 'veto') && id) {
  const ok = action === 'approve' ? await approveProposal(id) : await vetoProposal(id)
  if (!ok) {
    console.error(`No held proposal with id ${id} (already reviewed, expired, or wrong id).`)
    process.exit(1)
  }
  console.log(
    action === 'approve'
      ? `Approved — the target now has the card (email if on file, otherwise their agent surfaces it in-session).`
      : `Vetoed, silently. The target never learns it existed; the proposer just keeps waiting.`,
  )
  process.exit(0)
}

console.error('Usage: pnpm intro:review [list | approve <id> | veto <id>]')
process.exit(1)
