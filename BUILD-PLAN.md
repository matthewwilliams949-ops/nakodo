# BUILD-PLAN.md — Nakodo v1

*2026-07-05 · The **how** companion to [SCOPE.md](SCOPE.md) (the **why**). A fresh agent session should read SCOPE.md, then this file, then the milestone checklist below to know exactly where the build stands and what to do next.*

*Name decided 2026-07-05: **Nakodo** (npm `nakodo`, nakodo.dev) — see SCOPE.md "Name" and [documentation/nakodo-brand-guide.md](documentation/nakodo-brand-guide.md). Rename pass done. The repo folder is still `agent-networker` (pre-naming working title).*

---

## Ratified decisions (2026-07-05, Matthew + CTO review — do not relitigate)

1. **Transport: stdio npm package**, not a remote MCP server. Install metric is npm downloads; directories index npm packages; the niche lives in Claude Code/Cursor where `npx` install is native. Remote endpoint is post-gate work.
2. **API lives in a Next.js app on Vercel** (App Router, route handlers). One repo, one deploy. Not Supabase Edge Functions.
3. **Snippet approval does NOT use MCP elicitation** (client support inconsistent). Flow: agent drafts the snippet in-conversation → human says yes → agent calls `capture_snippet`. Trust rule 1 is enforced by tool descriptions + this flow.
4. **`delete_me` is a v1 tool** — deletes the user and everything attached, returns confirmation. It is the fifth trust guarantee and goes in the pitch alongside the other four.
5. **Name before build.** Naming session (Matthew) is the true build item 0 — it blocks npm package, domain, repo name, site.

**Architecture in one paragraph:** the npm package is a *thin stdio client* — it speaks MCP to the local agent and HTTPS to our API; it holds no logic and no privileged credentials. All state, matching data, telemetry, and email flows live behind the Next.js API with Supabase Postgres. Per-user API tokens are issued at registration and stored in `~/.config/nakodo/config.json`. We iterate on the experiment server-side without users updating the package.

---

## Repo skeleton

Monorepo, pnpm workspaces, TypeScript strict everywhere, Node ≥ 20.

```
nakodo/
├── CLAUDE.md                  # agent onboarding: stack, commands, conventions, current milestone
├── SCOPE.md                   # the why (already written)
├── BUILD-PLAN.md              # this file — keep the milestone checklist current
├── package.json               # workspace root
├── pnpm-workspace.yaml
├── .github/workflows/ci.yml   # typecheck + test on push
├── packages/
│   └── mcp-server/            # → published to npm as `nakodo` (or scoped variant)
│       ├── src/
│       │   ├── index.ts       # stdio entry (bin), MCP server setup
│       │   ├── tools/         # find_collaborator, capture_snippet, my_record, delete_me
│       │   ├── api-client.ts  # typed HTTPS client for the backend
│       │   └── config.ts      # ~/.config/nakodo/config.json (email, token, install_id)
│       ├── test/              # protocol-level integration tests (see M3)
│       └── package.json       # bin entry so `npx nakodo` works
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
- [x] Name chosen per NAME-BRIEF.md (npm/domain/registry collisions checked): **Nakodo** / npm `nakodo` / nakodo.dev
- [ ] Domain registered: **nakodo.dev** (open flag before public launch: trademark read vs. "Nakoda", see brand guide)
- [ ] npm account ready + package name claimed (publish a 0.0.1 placeholder to reserve it)
- [ ] GitHub repo created on matthewwilliams949-ops (private until launch week)
- [ ] Supabase project created (EU region — Frankfurt)
- [ ] Vercel project created + linked to repo
- [ ] Resend account + domain DNS (SPF/DKIM) verified
- [ ] Secrets into Vercel env + local `.env` (Supabase URL/service key, Resend key); `vercel` and `supabase` CLIs authenticated once so agents never need credentials
- **Done when:** an agent can run `pnpm install && vercel env pull` and reach Supabase + Resend from local dev.

### M1 — Repo scaffold
- [x] Monorepo per skeleton above; pnpm workspaces; TS strict; vitest; CI workflow (typecheck + test)
- [x] CLAUDE.md written: stack, dev commands, conventions, "current milestone" pointer
- [x] Rename pass: Nakodo everywhere (npm name/bin, `NAKODO_*` env vars, `~/.config/nakodo/`, https://nakodo.dev, emails, site, READMEs, docs)
- [x] `db/schema.sql` written; tests run it against PGlite (in-memory Postgres) — applying to Supabase happens in M0 step 4
- **Done when:** fresh clone → `pnpm install && pnpm test && pnpm typecheck` green in CI; `next dev` serves a stub page. ✅ (CI run itself pending the GitHub repo from M0)

### M2 — API foundation ✅
- [x] `POST /api/register` — email (+ optional handle/location + **source: "how did the agent find this server"**) → creates user, issues token (store hash only), sends welcome email via Resend (no-op sender until M0 provides the key)
- [x] Token auth (`lib/auth.ts`, Bearer → sha256 lookup) on all user endpoints
- [x] `POST /api/profile` (upsert), `POST /api/snippets`, `POST /api/asks`, `GET /api/record`, `DELETE /api/me`
- [x] `POST /api/events` (unauthenticated, `client_*`-namespaced) + event row on every funnel action
- [x] Endpoint integration tests — vitest runs the real `schema.sql` in PGlite and calls the route handlers directly (14 tests)
- **Done when:** test suite exercises register → profile → snippet → record → delete end-to-end and passes. ✅

### M3 — MCP server ✅ (one manual check left)
- [x] `find_collaborator(need)` — front door. No profile → onboarding instructions (incl. the attribution question). Profile exists → registers a **persisting** ask
- [x] `create_profile` — registration tool the onboarding flow calls after human approval (email, approved profile, source, handle?, location?)
- [x] `capture_snippet(snippet)` — description states the human-approval rule explicitly; posts to API
- [x] `my_record` — own profile + snippets + open asks, nothing about anyone else
- [x] `delete_me(confirm)` — refuses without confirm=true, calls `DELETE /api/me`, wipes local config
- [x] Tool descriptions written for agent-search (Motion 3), real phrasings, no keyword-stuffing; protocol test asserts the phrasings stay present
- [x] Local config: `~/.config/nakodo/config.json` with install_id / email / token (env-overridable for tests)
- [x] **Protocol-level integration tests**: server spawned over stdio via the MCP SDK client against a mock API (9 tests: onboarding, registration, ask, snippet, record, delete)
- [ ] Manual: MCP Inspector connect + onboarding check (fold into Checkpoint A demo)
- **Done when:** protocol tests green ✅, AND MCP Inspector connects and `find_collaborator` with no profile returns the onboarding prompt.

### M4 — Intro flow (the trust guarantees, made mechanical) ✅ (Resend round-trip pending M0)
- [x] Concierge creates an intro via `pnpm --filter web intro:send intro.json` (emails, two hand-written cards) — inserts the row and fires both card emails
- [x] Card email: anonymous card + tokenized links → `app/intro/[token]` page (card + accept/pass buttons; state change is a POST, links alone never mutate)
- [x] Both accept → reveal emails to both. Any decline → closed **silently**: the other side's view renders only from its own response, so a decline is indistinguishable from waiting — forever
- [x] Responses idempotent (first response wins), tokens expire (14 days), all transitions logged to `events`
- [x] Tests cover: both-accept reveal, one-decline silence + late-accept-after-decline, idempotency, expiry, unknown token
- [ ] Real email round-trip against Resend (needs M0 step 6; fold into Checkpoint A)
- **Done when:** accept/accept → reveal and accept/decline → silence pass in the suite ✅, and a real email round-trip works against Resend in dev.

### M5 — One-page site (copy done; deploy pending M0)
- [x] Page structure + first-pass copy: one-liner, **five** trust guarantees (incl. delete_me), install command, privacy note. Nothing else
- [x] Rename pass: real name, real npm command, agent-config snippet, contact email (hello@nakodo.dev)
- [ ] Deploy on the domain (M0 step 5), check mobile
- **Done when:** deployed on the domain, Lighthouse-clean, renders on mobile.

### M6 — Telemetry + metrics snapshot
- [ ] `scripts/metrics.ts`: one command prints the funnel — installs (npm downloads API + registry stats), activations (users with profile + ≥1 snippet), asks, intros proposed/accepted, reveals, exchanges (manual field) — plus attribution breakdown from `source`
- [ ] Week-1 calibration task per SCOPE.md: pull Smithery/npm stats for comparable new servers, adjust gate numbers once, freeze (record the adjustment in SCOPE.md)
- **Done when:** `pnpm metrics` prints the full funnel table against live data.

### M7 — Package, publish, hook
- [ ] npm publish (real version), `npx nakodo` cold-start verified on a clean machine/user
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
