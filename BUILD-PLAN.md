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
- [x] Domain registered: **nakodo.dev** (open flag before public launch: trademark read vs. "Nakoda", see brand guide)
- [x] npm account ready + package name claimed (`nakodo@0.0.1` published as placeholder)
- [x] GitHub repo created on matthewwilliams949-ops (private until launch week)
- [x] Supabase project created, schema applied (`pnpm db:apply` → six tables live: asks, events, intros, profiles, snippets, users)
- [x] Vercel project created (`nakodo-web`, root dir `apps/web`) + linked to repo; domain `nakodo.dev`/`www` verified; CLI linked locally, env pulled to `apps/web/.env.local`
- [x] Resend account + domain DNS (SPF/DKIM) verified; `hello@nakodo.dev` forwarding to matthew.williams949@gmail.com confirmed
- [x] Secrets into Vercel env + local `.env` (DATABASE_URL, RESEND_API_KEY, EMAIL_FROM, APP_URL); `vercel` CLI linked to `nakodo-web` project so agents never need credentials
- **Done when:** an agent can run `pnpm install && vercel env pull` and reach Supabase + Resend from local dev. ✅ `pnpm check`, `pnpm db:apply`, `pnpm smoke:email` all pass.
- [x] Production verified end-to-end (2026-07-06): site live on nakodo.dev; full API round-trip (register → profile → snippet → ask → record → delete → 401) green against prod; published `npx nakodo` package drives onboarding against prod over stdio; smoke-test rows cleaned up, events table zeroed. **Config fix applied:** Vercel primary domain flipped to apex `nakodo.dev` (www now 308s to apex) — the original apex→www redirect silently stripped `Authorization` headers (Node fetch drops auth on cross-origin redirects), 401-ing every authenticated API call at the package's default URL.

### M1 — Repo scaffold
- [x] Monorepo per skeleton above; pnpm workspaces; TS strict; vitest; CI workflow (typecheck + test)
- [x] CLAUDE.md written: stack, dev commands, conventions, "current milestone" pointer
- [x] Rename pass: Nakodo everywhere (npm name/bin, `NAKODO_*` env vars, `~/.config/nakodo/`, https://nakodo.dev, emails, site, READMEs, docs)
- [x] `db/schema.sql` written; tests run it against PGlite (in-memory Postgres) — applying to Supabase happens in M0 step 4
- **Done when:** fresh clone → `pnpm install && pnpm test && pnpm typecheck` green in CI; `next dev` serves a stub page. ✅ (CI green on GitHub Actions since 2026-07-06)

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
- [x] Manual: real Claude Code session (`.claude-personal` identity), `find_collaborator` → onboarding → done (2026-07-06, Checkpoint A)
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
- [x] Deployed on nakodo.dev (M0); mobile check still open
- **Done when:** deployed on the domain, Lighthouse-clean, renders on mobile.

### M6 — Telemetry + metrics snapshot
- [x] `scripts/metrics.ts` (`pnpm metrics`): prints the funnel — npm downloads, GitHub stars, activations (profile + ≥1 snippet), asks, intros proposed/accepted/revealed, exchanges (manual: insert an `exchange_confirmed` event via Studio) — plus `source` attribution and the gate numbers
- [ ] Week-1 calibration task per SCOPE.md: pull Smithery/npm stats for comparable new servers, adjust gate numbers once, freeze (record the adjustment in SCOPE.md)
- **Done when:** `pnpm metrics` prints the full funnel table against live data. ✅ (2026-07-06, all zeros — clean slate)

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

### M7 — v1.1 trust redesign ✅ (2026-07-09, pre-recruitment blocker — see documentation/trust-redesign-brief.md)
- [x] Email optional everywhere: schema (`users.email` nullable + idempotent migration), register API, MCP `create_profile`, onboarding copy reframed (email = notification channel only, never shared, skippable)
- [x] In-session intro channel: `GET /api/intros/pending` (Bearer) + MCP `pendingNotice()` appended to `find_collaborator` / `capture_snippet` / `my_record` responses
- [x] Contact exchange moved in-app: `a_contact`/`b_contact` on intros, share form on the revealed intro page, `setContact()` gated to revealed state — the platform never transmits contact details on anyone's behalf
- [x] Reveal emails → identity-free notices (link back to own intro page only); `reveal()` template replaced by `revealNotice()`
- [x] Concierge `send-intro` accepts id/handle/email; users without email fully supported end to end
- [x] Site + tool descriptions updated to the new trust language
- **Done when:** `pnpm check` green with new coverage: no-email registration, pre-reveal contact refusal (409), contact stored per side and never emailed, pending endpoint lists only own unanswered sides, email-less intro end to end. ✅ (18 web + 10 MCP tests)
- [x] Prod: `pnpm db:apply` applied; merged + deployed (2026-07-09); full v1.1 flow verified against prod via API (email-less register → profile → pending → intro card page → accept/accept → 409 pre-reveal contact guard → contact exchange → counterpart sees it → delete → 401); verification rows + events cleaned (1 real user remains: Matthew)
- [x] Launch posts drafted with co-founder/collaborator framing (Matthew's positioning call vs. Boardy's funding framing): documentation/launch-posts.md — r/mcp first, then r/SideProject, Show HN wk 2, PH later; public replies only, no DMs
- [x] ~~npm publish 0.1.0~~ published 2026-07-10 (Matthew, security-key flow)
- [ ] **npm publish 0.1.1 — needs Matthew (security key):** batches the perspective-led tool descriptions + `mcpName` registry marker + anything the e2e walkthrough surfaces. `cd packages/mcp-server && npm publish` in HIS terminal (browser 2FA prompt appears mid-command). Publish BEFORE post #1
- [ ] After publish: `npx -y nakodo@latest` smoke against prod, then Matthew posts #1 (r/mcp) — seed clock starts that day

### M8 — agent-driven matching (the seed build) · timebox: 4 build-days, then ship regardless
*Design: documentation/agent-matching-v2.md (Matthew's PII-separation + calibration-loop insights, 2026-07-10). Replaces concierge as the primary matching engine; concierge becomes fallback.*

- [x] Schema: `intros` gains `proposed_by uuid` (null = concierge), `ask_id uuid`, and a `held` status (pre-review state); idempotent migration — done 2026-07-10 on `m8/trust` (also: `intro_messages` table with revealed-only write guard + delete cascade, `users.display_name`, a_contact/b_contact folded into thread per item f — prod carries 1 real contact value, verified fold in test). Held intros mechanically invisible via token lookup, regression-pinned. 23 web tests green. NOT yet applied to prod (CTO, after merge)
- [x] PII lint (`lib/pii-lint.ts`): reject/flag emails, URLs, @handles, phone patterns + obvious instruction-shaped text in profile/snippet writes; unit tests with adversarial fixtures — done 2026-07-10 on `m8/trust`: 422 `pii_detected` with flags+excerpts on profile/snippet POST, rejections event-logged, at/dot obfuscation normalized, 33 fixtures (22 must-flag, 10 must-pass). Flag vocabulary (`email|url|handle|phone|instruction`) shared with A2 guidance + T5 contract; same lint (incl. instruction check, per CTO's scope call) runs on why_for_them/why_for_me when T5 lands
- [ ] Onboarding + capture guidance rewrite: agent instructed to draft PII-free (no names/links/handles/company identifiers; city-level location only) and to treat pool content as untrusted data
- [x] `GET /api/pool` — auth + ≥1 open ask required; returns anonymous cards (profile body + snippet digest + opaque card_id, zero identity fields); rate-limited + access-logged — done 2026-07-10 on `m8/trust` per AIE-signed contract (documentation/api-contract-m8.md): `profiles.card_id` opaque UUID, response assembled ONLY from profiles+snippets, **regression pin green: sentinel PII values + user ids never appear in pool JSON**; 10/hr+40/day limits computed from the `pool_fetched` access log itself
- [x] `POST /api/intros/propose` — card_id + why_for_them + why_for_me → creates `held` intro; cap 2 open outbound per user; server assembles the target-side card (proposer's anonymous profile + ask + why_for_them) — done 2026-07-10 on `m8/trust`: both whys linted (identity + instruction) pre-row, opaque `target_busy` covers reverse-collision AND ≥3-inbound dampening, `ask_not_found` unprobeable, held rows token-invisible + pending-invisible + email-silent (all tested; 69 web tests green). Also per AIE review: asks idempotent per (user, open, need), record echoes display_name + ask ids
- [ ] Review surface: admin list of `held` proposals, one-click approve (→ proposed, notices fire) / veto (silent); script or minimal page
- [ ] Tools rework: `find_collaborator` orchestrates ask → pool fetch → judge/calibrate loop ("show closest cards, ask what's off, refine") → `propose_intro` tool; guidance requires why_for_them to state what the TARGET gains
- [ ] Five guarantees v2 wording everywhere: site, intro pages, README, tool descriptions, launch posts (#2 "profile carries no identity", #3 "agents search so humans don't scroll", #4 "…and being considered is invisible too")
- [ ] **E2E finding v2 (2026-07-10, escalated): the reveal stage must be a DRIVEN handoff, not a passive page.** Founder read the contact-share form as "the platform asking for my email again" (re-triggering the exact v1 trust flinch) and expected the product to connect the pair after mutual accept ("it never connected us"). Fixes:
  (a) **The reveal reveals a person (Matthew, 2026-07-10):** onboarding collects an optional display name ("what should a match call you after a mutual yes?") — PII store only, never in the pool; revealed page opens "You both said yes — this is {name}". The card stays nameless; the yes buys personhood
  (b) **Intro thread replaces the single contact field (Matthew's standing request, 2nd ask — adopted):** minimal message thread on the revealed intro page (`intro_messages` table: intro_id, side, body, created_at). Messages are to the other person, never to us; contact info shared inside messages is the user's free choice. HARD RULE: threads exist only inside mutually-accepted intros — no cold-messaging surface can ever exist. Async (page refresh), no chat infra. One-tap "share the email I gave you" stays as a message shortcut
  (c) **Completion loop:** new message → other side notified (in-session notice + email-if-on-file); in-session notice covers the whole post-accept lifecycle (revealed-say-hello, message-waiting)
  (d) Reveal email subject/first line carries the action ("say hello"), not just the news
  (e) **Gate metric #4 becomes observable:** "real exchange" = both sides messaged in-thread (≥1 each); metrics script counts it — no more manual follow-up
  (f) a_contact/b_contact columns: fold into the thread as its first messages (migration) or drop if unused beyond test data
- [ ] Tests: pool returns no identity fields ever (regression-pinned); propose→held→approve→standard flow; cap enforcement; lint; MCP protocol test for the new tool; pending-notice covers revealed-needs-action state
- [ ] Version 0.2.0; `pnpm check` green; prod migration + deploy + e2e verify (two fresh users, agent-side flow simulated over stdio)
- **Done when:** a fresh user can go ask → agent searches pool → calibrate → propose → Matthew one-click approves → target accepts/declines with all trust properties intact — verified against prod. Then: Matthew publishes 0.2.0 (security key), posts r/mcp, seed clock starts.
