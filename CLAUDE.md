# CLAUDE.md

Read [SCOPE.md](SCOPE.md) (why this exists, the funnel, the gate) and [BUILD-PLAN.md](BUILD-PLAN.md) (milestones + current state) before doing anything. BUILD-PLAN's milestone checklist is the session-to-session state — keep it current as you complete work.

## What this is

An MCP server ("Agent Networker" — **placeholder name**, see below) that makes a user's coding agent their networker. Thin stdio npm package → hosted API (Next.js on Vercel) → Supabase Postgres. Matching is concierge/manual in v1. The project exists to validate a distribution channel; measurement is not optional.

## Layout

- `packages/mcp-server` — the npm package. Tools: `find_collaborator` (front door), `create_profile`, `capture_snippet`, `my_record`, `delete_me`. Talks HTTPS to the API; holds no secrets beyond the per-user token in `~/.config/agent-networker/config.json`.
- `apps/web` — Next.js: one-page site, API route handlers (`app/api/*`), intro accept/decline page (`app/intro/[token]`), email templates (`emails/`), concierge script (`scripts/send-intro.ts`).
- `db/schema.sql` — canonical schema, applied with `pnpm db:apply`. PGlite runs the same file in tests.
- `scripts/` — root ops scripts (db apply, email smoke test).

## Commands

- `pnpm check` — typecheck + tests, all packages. Must be green before any commit.
- `pnpm test` / `pnpm typecheck` — same, individually. Per-package: `pnpm --filter web test`, `pnpm --filter agent-networker test`.
- `pnpm dev` — Next.js dev server (needs `.env` with DATABASE_URL for API routes; the static page works without).
- `pnpm db:apply`, `pnpm smoke:email` — ops (need `.env`, see SETUP-ACCOUNTS.md).

## Conventions and hard rules

- **The five trust guarantees (SCOPE.md) outrank any feature.** Per-snippet approval; never display profiles/snippets (only compare); no feed/browse; declines invisible in both directions; delete_me removes everything. Every user-facing surface (tool descriptions, emails, pages) must be consistent with them. The invisible-decline rule has a specific implementation: a side's view renders ONLY from its own response + reveal state (`viewFor` in `apps/web/lib/intros.ts`).
- **Everything funnel-relevant logs an event** (`lib/events.ts` server-side, `logEvent` in the client). If it isn't in the events table, it didn't happen.
- **Tool descriptions are distribution surface** (Motion 3): they must contain the real phrasings users say, honestly — no keyword stuffing. Don't casually edit them; they're load-bearing.
- Tests: API tests run against PGlite with the real `schema.sql`; MCP tests spawn the real server over stdio against a mock API. Keep both true — they're what lets agents verify without a human.
- Anything not needed to move one of the four funnel metrics is out of scope. Flag scope creep instead of building it.

## Placeholder name

The product name is undecided (naming brief: NAME-BRIEF.md). `agent-networker` / `Agent Networker` / `AGENT_NETWORKER_*` env vars / `agent-networker.example` API URL are placeholders. When the name lands, do the **rename pass**: npm package name + bin, `src/config.ts` (dir, env prefix, prod API URL), `emails/templates.ts`, site copy in `apps/web/app/`, both READMEs, and this file.
