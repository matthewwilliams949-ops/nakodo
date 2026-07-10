# Agent-driven matching — the v2 architecture

*2026-07-10 · Matthew's proposal, adopted as the target matching architecture. Not built in v1 — concierge carries the seed phase (first-intro quality is activation-critical at low density). Ships as the v1.2 flagship once the pool justifies search (~50+ profiles). This doc fixes the design constraints now so nothing in v1.x paints over them.*

## The shift

**From:** the platform (concierge now, an algorithm later) reads profiles and decides who meets whom.
**To:** the **customer's own agent** is the matchmaker — it keeps its human's profile matchable, searches the graph when its human needs a person, judges the candidates, and proposes the intro. The platform stops being the matchmaker and becomes **the graph + the trust layer**: the two things only it can do.

Why this wins:
- **Agency trust.** "My agent, who I know, searched because I asked" beats "a company read my profile and decided." (The same instinct that drove the v1.1 redesign: the platform should never act on your behalf.)
- **Venture shape.** "Build what agents depend on" — the asset is the database + trust protocol; matching intelligence commoditizes at the edge, and that's fine because it was never the moat.
- **Scale.** Distributed judgment instead of a concierge bottleneck or a matching algorithm we'd defend forever.
- **Pull over push.** The user's appetite triggers the search — the KIEZ retention principle, structurally.

## The landmine this design must never step on

Open search over profiles = a browse surface = guarantee #3 violated, and "never displayed, only compared" (guarantee #2) dies with it. In a thin niche, "Berlin, three weeks into an agent-memory tool" deanonymizes a person. **Agent search must not mean profile visibility.**

## The synthesis: agent = judge, server = bouncer

1. **Search returns redacted anonymous cards only** — same register as intro cards, generated per-query server-side, never raw profiles, never identity, never contact. Coarse enough to survive k-anonymity in small scenes.
2. **A search requires a registered ask** — agents search on their human's live need, not recreationally. Rate-limited, audit-logged, trawling-resistant.
3. **The agent judges:** "of these three, #2 is your person — here's why." Judgment quality is the agent's job; the MCP tool instructions are the coaching layer (Matthew's "guidance built in"): how to keep a profile matchable, how to write an ask, how to evaluate a card.
4. **The agent proposes; the standard flow takes over.** The other side receives an anonymous card about the seeker — which MUST articulate the two-way trade (what *they* gain; a card that can't state it doesn't get sent). Double opt-in, invisible declines, in-app contact exchange: all unchanged. The counterpart's accept/decline IS the mutual-benefit filter.
5. **Proposal scarcity beats moderation.** Small standing cap on open outbound proposals per user; dampening for over-proposed targets. Prevents the flooded-inbox failure mode (dating apps, Boardy-scale spam) before it exists.
6. **Density gate.** Agent search activates when the pool makes results non-embarrassing (~50+ profiles); below that, `find_collaborator` keeps its current honest behavior (ask registered, told when someone shows up) and concierge hand-crafts the first intros.

## What changes in v1 (now)

- **Nothing in the build.** Seed phase, gates, and clock unchanged.
- **One roadmap line in the launch narrative** (esp. Show HN): "v1 matching is human-curated; the design goal is that your own agent does the searching, over the same anonymity layer." Honest and a strong teaser.
- **Pitch narrative upgrade:** Nakodo = the professional graph agents can search without anyone being exposed. The trust protocol is the product; the agent brings its own judgment.

## Open questions for the v1.2 design session

- Card redaction granularity vs. match quality (what does the searching agent need to judge well?).
- Whether the *searched* side's agent should get a say before the human sees anything (agent-to-agent negotiation — the SCOPE.md "not in v1" item; natural v2.x).
- Pricing hook: search as the metered surface? (The ask/search moment is the value moment — natural place for the subscription gate later.)
