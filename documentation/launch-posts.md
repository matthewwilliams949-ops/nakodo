# Launch posts — drafts for Matthew (v1, 2026-07-09)

*Positioning call v2 (Matthew, 2026-07-10, supersedes the co-founder-led v1): **perspective-led.** The promise is "your agent knows when an outside perspective would move your work forward — we find that person and make the warm intro." Weekly-frequency need (fixes the graveyard's low-frequency killer); co-founder/collaborator stays as the emergent outcome and as agent-pull phrases, never the headline. Boardy still owns "raise money"; we own "the outside perspective your AI can't give you."*

*Honesty recalibration to M8 reality (Head of Distribution, 2026-07-10): agent-driven matching now exists. The old "matching is me, by hand" line is retired — the honest line is now **held-for-review**: your agent does the searching over an anonymized pool and proposes; a human (Matthew) approves every intro before it's sent. The agent-search story moves from roadmap-teaser to product-truth. See `distribution/launch-asset-audit.md` for the full change log. Post these only once M8 is verified in prod — until then they overclaim.*

*v2 guarantee alignment done (Head of Design, 2026-07-11): guarantee-carrying lines now match the site and README exactly — where a post enumerates the guarantees it uses the canonical five verbatim; where it carries them in prose the signature clauses stay intact ("profiles carry no identity," "agents search so humans don't scroll," "declines are invisible — and so is being considered," "one command deletes everything"). Per Distribution's channel-fit constraint the language stays precise and un-slick. Canonical reference: site guarantees block = README §Five guarantees (verified identical, 2026-07-11).*

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
- Both accept → the card becomes a person (the name they chose to be called) and a private thread opens between the two of you — the platform never handles your contact details; you share what you want, inside the thread. Decline → the other person never knows.

Five guarantees, same wording as the site:

1. Nothing is captured without your explicit, per-snippet approval.
2. Your profile carries no identity — no name, no links, nothing personally identifying; agents match on the work, not the person. Identity and contact live separately, revealed only when you both say yes.
3. No feed. No human browse surface. Agents search so humans don't scroll — the only human-visible output is an introduction.
4. Declines are invisible — and so is being considered: candidates an agent passes over never know.
5. One command deletes everything: tell your agent "delete me", and your record is gone.

Email is optional (notification-only, never shared).

How the matching works, honestly: your agent does the searching — over a pool of profiles that carry no identity — and drafts the intro. Then I personally review and approve every proposed intro before it reaches anyone; nothing goes out that I haven't looked at. I'd rather send ten real introductions than a thousand plausible ones.

`claude mcp add nakodo -- npx -y nakodo` — or tell your agent "find me a collaborator" and see what happens. Works with anything MCP-capable. nakodo.dev

Tell me where this is wrong — the trust design especially. I built it because the first version made *me* uncomfortable, and I redesigned it until it didn't.

---

## 2. r/SideProject (a few days later)

**Title:** Your AI agent knows exactly when you need an outside perspective. I made mine go find that person.

**Body:**

AI made building alone possible — and made one thing scarcer: the outside eye. Your agent is brilliant and agreeable; what it can't be is someone who sees what you can't, tells you your onboarding is confusing, or is three weeks ahead of you on the exact problem you're stuck on.

But my coding agent doesn't know my pitch — it knows my sessions. It watched me struggle with the backend and ship the design in an afternoon. So Nakodo (nakōdo, 仲人 — the Japanese go-between) makes it the introducer: it keeps a private record drawn from real work (every entry approved by you), and when someone out there is the perspective you need — or you're the perspective *they* need — you both get an anonymous card. Mutual yes → the card becomes a person and a private thread opens where you take it from there (the platform never handles your contact details). Either declines → the other never knows it was proposed.

A social network with no feed, no faces, and no performance — profiles carry no identity, and declines are invisible in both directions. The only output is the right person: honest feedback today, a collaborator tomorrow, maybe your co-founder.

Free while it's small. `npx -y nakodo` with any MCP-capable agent (Claude Code, Cursor, …). nakodo.dev

---

## 3. Show HN (week 2, after the first feedback)

**Title:** Show HN: Nakodo – my coding agent is my matchmaker (no feed, no faces)

**Body:**

Hi HN — I'm a PM in Berlin, building solo on evenings with AI agents, and the hardest part hasn't been the code. It's been the moment you need a human: a co-founder, a designer, someone who's already solved the problem you're stuck on.

The insight: my coding agent has better data about me than any social network — what I'm actually building, evidenced strengths, real gaps. So Nakodo makes the agent the networker. MCP server; the agent maintains an approved-by-me, proof-of-work profile; your agent searches an anonymized pool of records and proposes intros; a human (me) approves each one before it's sent; matches surface as anonymous cards; double opt-in; then a private thread opens where the two people take it from there — the platform never transmits contact details on anyone's behalf.

Five hard trust rules, because the first version failed my own gut check: nothing is captured without per-entry approval; profiles carry no identity — agents match on the work, not the person; no feed and no human browse surface — agents search so humans don't scroll; declines are invisible, and so is being considered; one command deletes everything.

How the matching actually works: **your own agent does the searching** — over a pool where profiles carry no identity, matched on the work rather than the person — and proposes the intro. Every proposal is then reviewed and approved by a human (me) before it goes out; nothing reaches anyone unvetted. This isn't a smarter central matcher — deliberately. The platform's job is the graph and the trust rules; the judgment belongs to the agent that knows you, with a human backstop on every send. (One bad intro would cost more than a hundred good ones earn — hence the backstop, until the accept-rate data says it's safe to loosen.)

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

> Building [their thing] solo is exactly the situation I built my current project for. I made an MCP server that turns your coding agent into a matchmaker — it knows what you're building from your actual sessions, and it matches you privately with people who complement it (no feed, profiles carry no identity, anonymous double opt-in intros). It's small and I personally review and approve every intro before it's sent, which honestly means early users get the most attention: `npx -y nakodo` / nakodo.dev. If you try it, I'll make sure your match gets a careful look this week.

---

## Product Hunt (LATER — after HN, needs assets)

Tagline candidates:
- "Your AI agent, but as your matchmaker — co-founders, not followers"
- "The anti-social network: no feed, no faces, just your person"

Hold until: HN feedback digested, 2–3 screenshots of the intro-card flow made, and at least one real matched pair we can (with permission) mention.
