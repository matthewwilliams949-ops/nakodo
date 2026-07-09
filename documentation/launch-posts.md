# Launch posts — drafts for Matthew (v1, 2026-07-09)

*Positioning call (Matthew, 2026-07-09): Boardy owns "raise money." We own "find your co-founder / collaborator." Every post leads with that.*

*These are drafts — rewrite anything that doesn't sound like you. Post from your own accounts, reply to every comment yourself (I'll draft reply suggestions in-session when they come in). Don't post all at once: r/mcp first (densest fit, lowest stakes), r/SideProject a few days later, Show HN in week 2 once the first feedback has sharpened the pitch. Product Hunt only after HN teaches us what lands.*

*The seed clock starts the day the first post goes up. Seed proxy gate: ≥25 installs, ≥40% activation, two weeks later.*

---

## 1. r/mcp (first — post this one when ready)

**Title:** I built an MCP server that turns your coding agent into your matchmaker — for finding a co-founder or collaborator, not followers

**Body:**

Solo building has one brutal failure mode: you need a person — a co-founder, a designer, someone who's three weeks ahead of you on the same problem — and your options are performative (LinkedIn), dead ("looking for cofounder" posts that sink in an hour), or random (Discord roulette).

Meanwhile your coding agent knows *exactly* what you're building, what you're good at, and where you're stuck. It has the evidence — it watched you work.

So I made it the matchmaker. Nakodo is an MCP server:

- Your agent drafts your profile from your actual work. You approve every word.
- As you build, it captures short updates (each one approved) — proof-of-work, not a résumé.
- When there's a real match, you get an anonymous card: *"someone in Berlin, three weeks into an agent-memory tool, strong at backend, looking for design help."* No name, no face.
- Both accept → the intro page becomes your connection, and you two exchange whatever contact you want. Decline → the other person never knows.

No feed. No browse. Nothing about you is ever displayed to anyone — profiles are only *compared*. Email is optional (notification-only, never shared).

Honest admission: matching is me, by hand, weekly, for now. At low density a human curator beats an algorithm, and I'd rather make ten real introductions than a thousand bad ones.

`claude mcp add nakodo -- npx -y nakodo` — or tell your agent "find me a collaborator" and see what happens. Works with anything MCP-capable. nakodo.dev

Tell me where this is wrong — the trust design especially. I built it because the first version made *me* uncomfortable, and I redesigned it until it didn't.

---

## 2. r/SideProject (a few days later)

**Title:** Your AI agent already knows what you're building. I made mine find me collaborators.

**Body:**

Every "find a co-founder" platform fails the same way: everyone describes themselves at their best, nobody can verify anything, and the whole thing feels like LinkedIn cosplay.

But my coding agent doesn't know my pitch — it knows my commits. It watched me struggle with the backend and ship the design in an afternoon. That's the honest signal a co-founder search actually needs.

Nakodo (nakōdo, 仲人 — the Japanese matchmaker) is an MCP server that makes your agent your networker. It keeps a private proof-of-work record (every entry approved by you), and when someone out there matches what you need, you both get an anonymous card. Mutual yes → you connect and exchange contact yourselves. Either declines → the other never knows it was proposed.

It's a social network with no feed, no faces, and no performance. The only output is the right person.

Free while it's small. `npx -y nakodo` with any MCP-capable agent (Claude Code, Cursor, …). nakodo.dev

---

## 3. Show HN (week 2, after the first feedback)

**Title:** Show HN: Nakodo – my coding agent is my matchmaker (no feed, no faces)

**Body:**

Hi HN — I'm a PM in Berlin, building solo on evenings with AI agents, and the hardest part hasn't been the code. It's been the moment you need a human: a co-founder, a designer, someone who's already solved the problem you're stuck on.

The insight: my coding agent has better data about me than any social network — what I'm actually building, evidenced strengths, real gaps. So Nakodo makes the agent the networker. MCP server; the agent maintains an approved-by-me, proof-of-work profile; a (for now human) matchmaker compares records privately; matches surface as anonymous cards; double opt-in; then the two people exchange contact themselves on the intro page — the platform never transmits contact details on anyone's behalf.

Four hard trust rules, because the first version failed my own gut check: nothing captured without per-entry approval; profiles are never displayed, only compared; no feed or browse surface exists; declines are invisible in both directions.

Matching is concierge (me, weekly) until density justifies an algorithm — at small scale a human beats one, and one bad intro would cost more than a hundred good ones earn.

Stack: TypeScript MCP server on stdio → Next.js/Vercel → Postgres. `claude mcp add nakodo -- npx -y nakodo` · nakodo.dev

I'd genuinely value HN's read on the trust model — where does it leak?

---

## 4. X/Twitter (same day as r/mcp, thread starter)

I made my coding agent my matchmaker.

It knows what I'm building better than anyone — so now it finds me collaborators: matched on proof-of-work, revealed only on mutual yes, no feed, no faces.

A social network where the only output is the right person.

`npx -y nakodo`

---

## 5. Reply template — for existing "looking for a co-founder/collaborator" threads

*(Public replies only, never DMs. Only reply where the ask genuinely matches what Nakodo can do — a hollow reply burns the account and the brand. Personalize the first line to their actual post.)*

> Building [their thing] solo is exactly the situation I built my current project for. I made an MCP server that turns your coding agent into a matchmaker — it knows what you're building from your actual sessions, and it matches you privately with people who complement it (no feed, no profiles on display, anonymous double opt-in intros). It's small and matching is human-curated right now, which honestly means early users get the most attention: `npx -y nakodo` / nakodo.dev. If you try it, I'll personally look for your match this week.

---

## Product Hunt (LATER — after HN, needs assets)

Tagline candidates:
- "Your AI agent, but as your matchmaker — co-founders, not followers"
- "The anti-social network: no feed, no faces, just your person"

Hold until: HN feedback digested, 2–3 screenshots of the intro-card flow made, and at least one real matched pair we can (with permission) mention.
