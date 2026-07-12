# M10a — Retrieval matching: design (pre-built plan, gate-triggered build)

*2026-07-12 · CTO · Written ahead of need per Track A's rule ("pre-planned so success never stalls on planning"). **Build trigger** (refined 2026-07-11): pool-warning events observed (N ≥ 40 activated cards) OR the seed gate passes — whichever first. Until then this document is the plan and nothing is built.*

## The cliff, restated from code

`GET /api/pool` serves the whole pool in one response and **hard-503s past N = 50** (`apps/web/app/api/pool/route.ts`, deliberate tripwire, warning events from 40). If the seed window works, this is an outage with a date on it. The fix must not change what the network *is*: **the agent still judges; the server only shortlists.** No score ever reaches a human, no ranking of people ever exists — shortlisting ranks *cards against one ask*, transiently, and is discarded.

## Decision: structured search first, embeddings only if recall fails

Two candidate mechanisms were on the table:

1. **Embeddings** (pgvector on Supabase): embed profile+snippets per card, embed the ask, cosine-shortlist top K.
2. **Structured search** (Postgres full-text): `tsvector` over profile+snippets, `websearch_to_tsquery` over the ask's text, `ts_rank` shortlist.

**Start with (2).** Reasons, in order of weight:

- **The residency claim.** Frankfurt is a *guarantee-adjacent* fact. Every managed embedding API ships card text to a third party; the honest alternatives are pgvector with a self-hosted embedding model (operational cost we shouldn't buy pre-PMF) or an EU-pinned API (a new vendor, a new DPA, a new thing that can leak). Full-text search runs entirely inside the Frankfurt Postgres we already have. Zero new data flows — **Safety co-review becomes a formality instead of a project.**
- **The pool is text written to be searched.** Cards are drafted by agents that were told to describe the work concretely. Asks are drafted by agents that read the same guidance. Vocabulary overlap between ask and card is high by construction — the regime where lexical search is strong and embeddings' paraphrase advantage matters least.
- **Reversible.** If recall visibly fails (agents report "nothing fits" while a fitting card exists — measurable, see telemetry below), pgvector can be added *behind the same contract* without touching the MCP layer again.

## Contract change (the only one)

`GET /api/pool` keeps its shape, auth, no-open-ask precondition, and rate limits. Two changes:

- The response becomes a **shortlist for the caller's most recent open ask** (server picks the ask the same way `find_collaborator` just registered it — freshest open ask), capped at **K = 15** cards, `ts_rank`-ordered but **order still contractually unspecified** (clients must not depend on it; we shuffle within rank bands to keep it honest).
- New optional field `"scope": "shortlist" | "whole_pool"` in the response. Below N = 40 activated cards the server keeps returning the whole pool (`whole_pool`) — nothing changes for the seed window; the shortlist path activates itself at the same threshold as the warning tripwire. The MCP server needs no version bump for the flip (it already treats the pool as opaque), but 0.2.x guidance gains one sentence: *"the pool you see is the closest slice for this ask, not everyone — refining the ask re-slices it."*

The N = 50 hard-fail moves from "pool size" to "shortlist unavailable" (i.e., it becomes dead code in practice but stays as the guard behind the feature flag).

## Trust invariants (unchanged, re-pinned)

- Response assembled ONLY from `profiles`/`snippets`/`asks` — no `users` column. The tsvector lives in a generated column on `profiles`; the ask text is the caller's own.
- No score, rank, or "match quality" number in any response body or any human-visible surface — `ts_rank` is `ORDER BY` and nothing else. Regression test: response JSON contains no numeric field beyond `created_at` timestamps.
- Being *outside* the shortlist is invisible (nobody knows they weren't shown) — same property guarantee 4 already gives declines.
- Rate limits and the ask precondition unchanged; a shortlist is still ask-gated, so scraping economics get *worse*, not better (K = 15 per fetch instead of the whole pool).

## Build sketch (1–2 days when triggered)

1. Migration: `alter table profiles add column search tsvector generated always as (to_tsvector('english', body)) stored` + GIN index; snippets folded in via a small view or trigger-maintained column on profiles (decide at build time; view is simpler, measure first).
2. Pool route: when activated-card count ≥ 40 → shortlist path (`websearch_to_tsquery` from the freshest open ask, `ts_rank` top 15, rank-band shuffle); else whole-pool path unchanged.
3. Telemetry for the recall question: log `pool_fetched` with `scope`, `shortlist_size`, and (client-side, existing behavior) the agent's silence/proposal outcome. The recall alarm is: rising `find_collaborator` calls with shortlists served and falling `propose` rate — reviewed weekly, triggers the pgvector escalation.
4. Tests: PGlite supports tsvector/GIN — the existing harness covers it; pin the no-numeric-fields invariant and the ≥40 flip.

## What this deliberately does not do

No pagination, no query parameters, no client-visible knobs — the agent's lever stays what it always was: **sharpen the ask.** No global ranking of people, ever; that sentence is the moat and the law at the same time.
