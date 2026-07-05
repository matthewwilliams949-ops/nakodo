# BUILD-PLAN.md — Agent Networker v1

*2026-07-05 · The **how** companion to [SCOPE.md](SCOPE.md) (the **why**). A fresh agent session should read SCOPE.md, then this file, then the milestone checklist below to know exactly where the build stands and what to do next.*

*`<name>` throughout = the product name, pending the naming session (see [NAME-BRIEF.md](NAME-BRIEF.md)). M1 includes a rename pass once it lands.*

---

## Ratified decisions (2026-07-05, Matthew + CTO review — do not relitigate)

1. **Transport: stdio npm package**, not a remote MCP server. Install metric is npm downloads; directories index npm packages; the niche lives in Claude Code/Cursor where `npx` install is native. Remote endpoint is post-gate work.
2. **API lives in a Next.js app on Vercel** (App Router, route handlers). One repo, one deploy. Not Supabase Edge Functions.
3. **Snippet approval does NOT use MCP elicitation** (client support inconsistent). Flow: agent drafts the snippet in-conversation → human says yes → agent calls `capture_snippet`. Trust rule 1 is enforced by tool descriptions + this flow.
4. **`delete_me` is a v1 tool** — deletes the user and everything attached, returns confirmation. It is the fifth trust guarantee and goes in the pitch alongside the other four.
5. **Name before build.** Naming session (Matthew) is the true build item 0 — it blocks npm package, domain, repo name, site.

**Architecture in one paragraph:** the npm package is a *thin stdio client* — it speaks MCP to the local agent and HTTPS to our API; it holds no logic and no privileged credentials. All state, matching data, telemetry, and email flows live behind the Next.js API with Supabase Postgres. Per-user API tokens are issued at registration and stored in `~/.config/<name>/config.json`. We iterate on the experiment server-side without users updating the package.

---

## Repo skeleton

Monorepo, pnpm workspaces, TypeScript strict everywhere, Node ≥ 20.

```
<name>/
├── CLAUDE.md                  # agent onboarding: stack, commands, conventions, current milestone
├── SCOPE.md                   # the why (already written)
├── BUILD-PLAN.md              # this file — keep the milestone checklist current
├── package.json               # workspace root
├── pnpm-workspace.yaml
├── .github/workflows/ci.yml   # typecheck + test on push
├── packages/
│   └── mcp-server/            # → published to npm as `<name>` (or scoped variant)
│       ├── src/
│       │   ├── index.ts       # stdio entry (bin), MCP server setup
│       │   ├── tools/         # find_collaborator, capture_snippet, my_record, delete_me
│       │   ├── api-client.ts  # typed HTTPS client for the backend
│       │   └── config.ts      # ~/.config/<name>/config.json (email, token, install_id)
│       ├── test/              # protocol-level integration tests (see M3)
│       └── package.json       # bin entry so `npx <name>` works
├── apps/
│   └── web/                   # Next.js on Vercel: site + API in one deploy
│       ├── app/
│       │   ├── page.tsx       # the one-page site (M5)
│       │   ├── intro/[token]/ # accept/decline landing pages for intro emails
│       │   └── api/           # route handlers: register, snippets, asks, record,
│       │                      #   delete, intro-response, events
│       ├── lib/               # supabase server client, resend client, token auth
│       └── emails/            # anonymous card, reveal, confirmation templates
├── db/
│   ├── schema.sql             # canonical schema (source of truth, applied via supabase cli)
│   └── seed.sql               # local dev fixtures
└── scripts/
    └── metrics.ts             # weekly funnel snapshot (M6)
```

**Database schema (minimal, v1):**

| Table | Purpose | Key columns |
|---|---|---|
| `users` | one row per registered human | id, email, handle?, location?, token_hash, source (attribution answer), created_at |
| `profiles` | agent-synthesized, human-approved profile | user_id, body (text/jsonb), approved_at |
| `snippets` | approved build updates | user_id, body, created_at |
| `asks` | standing needs from `find_collaborator` | user_id, need, status (open/matched/closed), created_at |
| `intros` | concierge-proposed matches | user_a, user_b, card_a, card_b, status (proposed / a_accepted / b_accepted / revealed / declined), tokens, timestamps |
| `events` | every tool call + funnel event | install_id, user_id?, type, metadata jsonb, created_at |

Rules encoded in the flow, not just policy: decline ends an intro silently (no notification to the other side, ever); `delete_me` cascades users → profiles/snippets/asks and anonymizes their side of intros; clients never touch Supabase — only the API does, with the service key held in Vercel env only.

---

## Milestones

Each is sized to roughly one agent session and has a **machine-verifiable done-condition** so the building agent can self-verify without Matthew. Work top to bottom; check items off in place.

### M0 — Name + accounts *(Matthew-only, ~90 min after the naming session)*
- [ ] Name chosen per NAME-BRIEF.md (npm/domain/registry collisions checked)
- [ ] Domain registered
- [ ] npm account ready + package name claimed (publish a 0.0.1 placeholder to reserve it)
- [ ] GitHub repo created on matthewwilliams949-ops (private until launch week)
- [ ] Supabase project created (EU region — Frankfurt)
- [ ] Vercel project created + linked to repo
- [ ] Resend account + domain DNS (SPF/DKIM) verified
- [ ] Secrets into Vercel env + local `.env` (Supabase URL/service key, Resend key); `vercel` and `supabase` CLIs authenticated once so agents never need credentials
- **Done when:** an agent can run `pnpm install && vercel env pull` and reach Supabase + Resend from local dev.

### M1 — Repo scaffold
- [ ] Monorepo per skeleton above; pnpm workspaces; TS strict; vitest; CI workflow (typecheck + test)
- [ ] CLAUDE.md written: stack, dev commands, conventions, "current milestone" pointer
- [ ] Rename pass: replace `<name>` placeholders everywhere once M0 lands
- [ ] `db/schema.sql` written and applied to Supabase (and to a local shadow db for tests if trivial; otherwise test against a dedicated Supabase branch/project)
- **Done when:** fresh clone → `pnpm install && pnpm test && pnpm typecheck` green in CI; `next dev` serves a stub page.

### M2 — API foundation
- [ ] `POST /api/register` — email (+ optional handle/location + **source: "how did the agent find this server"**) → creates user, issues token (store hash only), sends confirmation email via Resend
- [ ] Token auth middleware for all subsequent endpoints
- [ ] `POST /api/profile` (create/approve), `POST /api/snippets`, `POST /api/asks`, `GET /api/record`, `DELETE /api/me`
- [ ] `POST /api/events` + automatic event row on every endpoint hit (this is the funnel instrument — nothing ships without it)
- [ ] Endpoint integration tests (vitest against route handlers with a test db)
- **Done when:** test suite exercises register → profile → snippet → record → delete end-to-end and passes in CI.

### M3 — MCP server
- [ ] `find_collaborator(need)` — front door. No profile → returns onboarding instructions (agent synthesizes profile from session context, collects email, human approves, then registers). Profile exists → registers a **persisting** ask (SCOPE.md open question: v1 persists asks) and confirms
- [ ] `capture_snippet(body)` — description states the human-approval rule explicitly; posts to API
- [ ] `my_record` — returns own profile + snippets + open asks, nothing about anyone else
- [ ] `delete_me` — confirms intent, calls `DELETE /api/me`, wipes local config
- [ ] Tool descriptions written for agent-search (Motion 3): enumerate real phrasings — "find someone to help with design / marketing / distribution", "find a collaborator or co-founder", "get feedback from someone building something similar". Honest, no keyword-stuffing (directories and clients flag spammy manifests)
- [ ] Local config: `~/.config/<name>/config.json` with install_id (generated on first run, pre-registration telemetry key), email, token
- [ ] **Protocol-level integration tests**: spawn the server over stdio with the MCP SDK test client against a mocked/local API; assert the onboarding response, ask registration, snippet post, delete flow
- **Done when:** protocol tests green in CI, AND MCP Inspector connects and `find_collaborator` with no profile returns the onboarding prompt.

### M4 — Intro flow (the trust guarantees, made mechanical)
- [ ] Concierge creates an intro by inserting a row (via Supabase Studio — no admin UI in v1) with two hand-written anonymous cards; a script or endpoint fires the two card emails
- [ ] Card email: anonymous card + tokenized accept/decline links → `app/intro/[token]` landing page
- [ ] Both accept → reveal emails to both (names + emails, warm handoff copy). Any decline → intro closed **silently**; other side never notified, pending state simply never resolves
- [ ] Tokens single-use, expiring; all transitions logged to `events`
- [ ] Tests cover: both-accept reveal, one-decline silence, token reuse rejected
- **Done when:** seeded test intro walks accept/accept → reveal and accept/decline → silence in the test suite, and a real email round-trip works against Resend in dev.

### M5 — One-page site
- [ ] The one-liner, the **five** trust guarantees (incl. delete_me), the install command + 3-line agent-config snippet, contact email. Nothing else — no screenshots, no feature grid
- [ ] Plain-language privacy note (what we store, where — EU, how to delete: the tool or an email)
- **Done when:** deployed on the domain, Lighthouse-clean, renders on mobile.

### M6 — Telemetry + metrics snapshot
- [ ] `scripts/metrics.ts`: one command prints the funnel — installs (npm downloads API + registry stats), activations (users with profile + ≥1 snippet), asks, intros proposed/accepted, reveals, exchanges (manual field) — plus attribution breakdown from `source`
- [ ] Week-1 calibration task per SCOPE.md: pull Smithery/npm stats for comparable new servers, adjust gate numbers once, freeze (record the adjustment in SCOPE.md)
- **Done when:** `pnpm metrics` prints the full funnel table against live data.

### M7 — Package, publish, hook
- [ ] npm publish (real version), `npx <name>` cold-start verified on a clean machine/user
- [ ] README: install for Claude Code / Cursor / Claude Desktop, the trust guarantees, the one-liner
- [ ] Optional Claude Code session-end hook (`capture_snippet` prompt) documented in README
- [ ] Directory submissions prepared: official MCP registry, mcp.so, Smithery, PulseMCP (submit at launch, M8)
- **Done when:** fresh machine → README instructions → onboarded and first snippet captured, no source checkout involved.

### M8 — Launch collateral + go *(agent drafts, Matthew approves — checkpoints B & C)*
- [ ] Motion 1: seed DM copy + target list (20–30 expressed-pain posts: Indie Hackers, r/SideProject, builder Discords)
- [ ] Motion 2: Show HN, r/ClaudeAI, r/mcp, X, Product Hunt drafts around the postable line
- [ ] Directory submissions fired; repo public
- **Done when:** Matthew has approved copy, seed DMs are going out, and the metrics script is tracking the gate.

---

## Matthew's involvement (everything else is agent territory)

| When | What | Time |
|---|---|---|
| Now | Naming session → M0 account setup | 1 session + ~90 min |
| After M4 | **Checkpoint A**: end-to-end demo on his machine — install, onboard, snippet, test intro email | ~30 min |
| M8 | **Checkpoint B**: seed DM copy + target list. **Checkpoint C**: launch posts | ~1 h |
| Weekly from seed phase | Concierge matching pass in Supabase Studio + writing anonymous cards + exchange follow-ups | the experiment itself |

## Standing rules for building agents

- Keep the milestone checklist in this file current — it is the session-to-session state.
- Every user-facing surface (tool descriptions, emails, site) must be consistent with the five trust guarantees; when in doubt, the guarantee wins over the feature.
- Nothing ships without an `events` row — if it isn't logged, it didn't happen, and this project exists to measure a funnel.
- Anything not needed to move one of the four funnel metrics is out of scope (SCOPE.md rule). Flag scope creep instead of building it.
