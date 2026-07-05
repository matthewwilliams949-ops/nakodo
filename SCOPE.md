# Nakodo — v1 scope

*2026-07-05 · named Nakodo (see [documentation/nakodo-brand-guide.md](documentation/nakodo-brand-guide.md)); repo folder still `agent-networker`*
*Lineage: idea-pipeline S-031 → SH-004 → K-041 (PARK 58, Low confidence) — consciously picked up as a build-to-validate distribution test. Sister bet: S-030 MCP probe portfolio (this is effectively probe #1 and the strongest test of the tier-3 agent-recommendation channel).*

## The one-liner

> **Your agent knows what you're building better than anyone. We make it your networker — a social network with no feed, no faces, and no performance, that only ever outputs one thing: the right person, today.**

## What v1 is testing (and what it is not)

**Primary bet: distribution.** Does the networking promise — not the devlog — convert to installs? We are deliberately sequencing distribution before WTP (Matthew's call, 2026-07-05): installs are the precondition for everything else in a network-shaped product. The K-041 crux (would builders *pay* for intros?) is deferred but not forgotten — the concierge stage produces accept-rate evidence that feeds it.

**The funnel, four honest stages, each a metric:**

| Stage | Proves | Measured by |
|---|---|---|
| Install | The pitch pulls | npm downloads, registry/directory installs, GitHub stars |
| Activation (profile created + first approved snippet) | The pain point is real | backend counts |
| Intro proposed → accepted | Match value exists | concierge log |
| Exchange after reveal (reply, call, collaboration) | The whole thesis | manual follow-up |

**Not being built in v1:** matching algorithm (concierge/manual behind the curtain), payments, in-MCP messaging relay, agent-to-agent negotiation, any feed or browse surface. If it isn't needed to move one of the four metrics, it's out.

## Product design

**The front door is the need, not the tool.** The primary MCP tool is `find_collaborator(need)` — named and described so that when someone asks their agent *"can you help me find someone who could help with [design / code / marketing / distribution strategy]?"*, the agent's registry tool-search lands here. First call inverts onboarding: the server responds "to match you, I need to know what you're building — let's set up your profile." Need first, sensor second.

**Tools (v1):**
- `find_collaborator(need)` — front door; triggers onboarding if no profile, otherwise registers the ask
- `capture_snippet` — agent drafts a short build update from the session, human approves with one keystroke; posts to backend
- `my_record` — shows the user their own profile + all snippets on record (nothing about anyone else)
- Registration collects: email (framed as "where your person shows up"), optional handle/name, optional location (enables near-you bias)
- Optional Claude Code hook so capture fires automatically at session end (MCP tools remain the portable path for Cursor etc.)

**Identity: rich for the machine, anonymous for humans.**
- At onboarding the agent synthesizes a profile from what it already knows — what they're building, evidenced strengths, gaps, optional location. Agent drafts, human approves. Proof-of-work profile, not claims.
- The matcher sees everything. Humans see nothing until double opt-in.
- An intro arrives as an **anonymous card**: relevant facts only ("someone in Berlin, three weeks into an agent-memory tool, strong at backend, looking for design help"). No name, no face, no link.
- Both accept → identities reveal, email handoff (v1). Decline → the other side never knows they were proposed. **Rejection is invisible in both directions.**

**Trust guarantees (hard rules, in the pitch, never violated):**
1. Nothing is ever captured without explicit per-snippet human approval.
2. Snippets and profiles are never displayed to anyone — only compared. (Matching-without-publishing.)
3. No feed exists. No browse surface exists. The only output is an intro.
4. Declines are never revealed.

**Concierge matching (the curtain).** V1 "engine" is Matthew reading profile/snippet pairs weekly in a plain admin table and making intros by hand. Strictly better than an algorithm at low density — protects the one-bad-intro-kills-trust risk — and it *is* the K-041 crux test running inside the product. The real engine gets built only after hand-matching proves intros get accepted.

## Distribution: three motions, three clocks

**Motion 1 — hand-recruit the seed pool from expressed pain (weeks 1–2, manual).**
The first 20–30 users come from people who have *already posted the pain*: "looking for a collaborator/cofounder" threads on Indie Hackers, r/SideProject, builder Discords. DM: "I'm building the thing you just asked for — install this and I'll personally find you your person." Seeds density in the first niche (people building MCP servers/agents — densest, most reachable, and they ARE the directory audience) so launch-wave installers hit a live network, not a waiting room.
*Metric: recruited-install → activation rate (expect high, ≥60% — they expressed the pain).*

**Motion 2 — launch moments + directories (weeks 3–4, spike).**
Story surfaces: Show HN, r/ClaudeAI, r/mcp, X, Product Hunt (audience = makers, whose pain this literally is). The postable line: *"I made my coding agent my networker — a social network with no feed and no faces."* Simultaneously listed on mcp.so, Smithery, PulseMCP, official MCP registry, npm — launches spike installs, installs make directories rank you.
*Metric: install spike size, post-spike activation rate.*

**Motion 3 — agent-pull (slow compounding, thereafter).**
The tier-3 channel from the S-030 finding: an agent searches the registry at the moment its human asks for collaborator help, and recommends this server because `find_collaborator` + its description literally match the request. Description enumerates real phrasings: "find someone to help with design / marketing / distribution," "find a collaborator or co-founder," "get feedback from someone building something similar."
*Metric: registry-attributed installs (imperfect attribution — watch for installs with no launch/backlink referrer).*

## Build list (in order)

1. **Name + one-page site** — the one-liner, the four trust guarantees, install command. Nothing else.
2. **MCP server** — `find_collaborator`, `capture_snippet`, `my_record`, registration; TypeScript, published to npm; personal GitHub (matthewwilliams949-ops).
3. **Minimal backend** — store profiles + snippets + asks; nothing clever. (Supabase-shaped; Matthew has prior Supabase experience from Viertel.)
4. **Concierge admin view** — plain table: users × profiles × snippets × asks. Weekly matching pass.
5. **Intro delivery** — email for v1 (anonymous card → double opt-in → reveal). In-session delivery is a later delight.
6. **Directory listings + Claude Code hook + launch posts.**

## The gate (set now, before building — decision rule against validate-by-building drift)

Seed phase (end of week 2): **≥15 of ~25 recruited installs activated** (profile + first snippet). Below → the pain-post population didn't convert; stop and re-examine the pitch before spending a launch.

Launch phase (4 weeks after public launch):
- **≥150 installs** across npm + directories, AND
- **≥40% activation** of installs, AND
- **≥10 intros proposed, ≥50% accepted**, AND
- **≥3 revealed pairs with a real exchange beyond the intro**

→ All four: build the matching engine, continue. → Installs high but activation low: pitch works, product doesn't — fix onboarding, one more cycle. → Installs low across all three motions: the channel bet failed; write it up, park K-041 with evidence, feed lessons to S-030.

*(Numbers are honest first-pass estimates, not baselines — calibrate against comparable new servers' Smithery/npm stats during build week 1, adjust once, then freeze.)*

## Deferred (v2+, only after the gate passes)

Matching engine (replace concierge) · in-MCP anonymous messaging relay (persistent pseudonymity; agents answering clarifying questions on each other's behalf pre-reveal) · in-session intro delivery · subscription for match quality/frequency (the K-041 crux, tested with real accept-rate data by then) · the long-horizon proof-of-work talent graph.

## Name: Nakodo (decided 2026-07-05)

**Nakodo** — from the Japanese 仲人 (*nakōdo*), the traditional marriage go-between: the discreet figure who knows both sides in private, pitches each to the other, carries a refusal so nobody loses face, arranges the one meeting, then steps back. The role maps one-to-one onto the product's four trust guarantees. Full rationale and source note in [documentation/nakodo-brand-guide.md](documentation/nakodo-brand-guide.md).

- **npm package:** `nakodo` — verified free (2026-07-05).
- **Domain to register:** nakodo.dev (primary) — unregistered as of check; nakodo.so / nakodo.app also open. (.com is taken; not required per brief.)
- **Collision check:** no existing Nakodo MCP server, dev tool, startup, or app surfaced in web/npm/registry search. Trademark watch-out for later: "Nakoda" (with an *a*) is a common Indian brand name — needs a proper trademark read before public launch.

*Also-ran candidates (parked): Goen/Enishi (縁, the fateful bond — great story, sound too soft for an MCP); Backchannel (known VC-fund trademark risk); Wavelength, Introvert, Emissary, Darkroom, Kismet; spirit-angle names Daimon (npm taken, already an MCP dev tool) and Musubi (npm taken).*

## Open questions

- Snippet cadence: every session end vs. meaningful-change detection — start with session-end hook + agent judgment, tune with seed users.
- How the anonymous card gets composed (agent-written from both profiles?) — concierge writes them by hand in v1; that's the training data.
- Does `find_collaborator` register a standing ask ("looking for design help") that persists, or is it point-in-time? V1: persist it; asks are the highest-signal matching input we have.
- German/Berlin local layer (location bias → Kiez events?) — park until matching works at all.
