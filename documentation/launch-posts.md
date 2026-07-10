# Launch posts — drafts for Matthew (v1, 2026-07-09)

*Positioning call v2 (Matthew, 2026-07-10, supersedes the co-founder-led v1): **perspective-led.** The promise is "your agent knows when an outside perspective would move your work forward — we find that person and make the warm intro." Weekly-frequency need (fixes the graveyard's low-frequency killer); co-founder/collaborator stays as the emergent outcome and as agent-pull phrases, never the headline. Boardy still owns "raise money"; we own "the outside perspective your AI can't give you."*

*Companion doc: `launch-objections.md` — the hard questions (fake profiles, "what do I do with a match", Boardy) with our honest answers, for comment replies.*

*These are drafts — rewrite anything that doesn't sound like you. Post from your own accounts, reply to every comment yourself (I'll draft reply suggestions in-session when they come in). Don't post all at once: r/mcp first (densest fit, lowest stakes), r/SideProject a few days later, Show HN in week 2 once the first feedback has sharpened the pitch. Product Hunt only after HN teaches us what lands.*

*The seed clock starts the day the first post goes up. Seed proxy gate: ≥25 installs, ≥40% activation, two weeks later.*

---

## 1. r/mcp (first — post this one when ready)

**Title:** I built an MCP server that gets you the one thing your agent can't give — an outside perspective. It finds the right builder and makes a warm intro.

**Body:**

Solo building with agents has a quiet failure mode: your agent can build almost anything with you, but it can't give you a genuinely *outside* perspective — it's agreeable, it has no lived context, no skin in the game. The moments that actually move a project are still human: honest feedback from someone three weeks ahead of you on the same problem, a designer's eye, sometimes the person who becomes your co-founder.

But here's the thing your agent *does* have: it knows exactly what you're building, what you're good at, and where you're stuck. It watched you work. That's better matching data than any profile anyone ever wrote.

So I made it the go-between (nakōdo, 仲人 — the Japanese matchmaker). Nakodo is an MCP server:

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

**Title:** Your AI agent knows exactly when you need an outside perspective. I made mine go find that person.

**Body:**

AI made building alone possible — and made one thing scarcer: the outside eye. Your agent is brilliant and agreeable; what it can't be is someone who sees what you can't, tells you your onboarding is confusing, or is three weeks ahead of you on the exact problem you're stuck on.

But my coding agent doesn't know my pitch — it knows my sessions. It watched me struggle with the backend and ship the design in an afternoon. So Nakodo (nakōdo, 仲人 — the Japanese go-between) makes it the introducer: it keeps a private record drawn from real work (every entry approved by you), and when someone out there is the perspective you need — or you're the perspective *they* need — you both get an anonymous card. Mutual yes → you connect and exchange contact yourselves. Either declines → the other never knows it was proposed.

A social network with no feed, no faces, and no performance. The only output is the right person — honest feedback today, a collaborator tomorrow, maybe your co-founder.

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

Your agent can build almost anything with you.

The one thing it can't give you is an outside perspective — so I taught mine to go find the person who can.

Nakodo: matched on your actual work, anonymous cards, mutual yes or nothing. No feed, no faces. The only output is the right person.

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
