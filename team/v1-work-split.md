# Engineering work split & process rules

*Owner: CTO. Keep current as milestones change. This is the org's operational doc — lane assignments, the review ring, and the process rules that keep parallel agent work from colliding. Referenced by the CTO CLAUDE.md.*

## The three engineering lanes

- **Trust & Platform Engineer** — schema, API, PII separation, lint, silence mechanics. Leads trust-critical critical paths; the **mandatory extra reviewer** on anything touching a trust guarantee.
- **Agent Interface Engineer** — MCP package, tool descriptions (the distribution surface), the matching orchestration loop.
- **Product Engineer** — human-facing trust moments (reveal, thread, emails, site), funnel instrumentation.

## The review ring

Agent Interface → reviewed by Trust & Platform → reviewed by Product → reviewed by Agent Interface. The CTO tie-breaks disputed findings and does final integration review. Any engineer may refuse a trust-guarantee violation in writing — including one from the CTO; that refusal is a first-class escalation, never insubordination.

## CTO-owned (not delegated)

Lane assignment · API-contract arbitration · the merge train (**only the CTO merges to main**) · integration · version bumps · prod migration/deploy · final e2e verification · the timebox clock.

---

## Process rules (adopted 2026-07-11, post-M8 retrospective)

These exist because M8 shipped well but leaked time and attention on coordination overhead and tooling friction. Each rule maps to a concrete thing that went wrong.

### Rule 1 — The inbox holds *requests only*, never status

*Why: during M8 the inbox grew to ~10 items, most of them `▶ HANDOFF … Done: …` status posts. Every session re-parsed a growing log for information already recorded in BUILD-PLAN + git. Compounding token/time cost at every session start.*

- An inbox item is valid only if it needs the reader's **input, decision, or unblocking**. "Done, FYI" is not an inbox item.
- Status lives in **BUILD-PLAN checkboxes** (with verification notes) and **git history**. Handoffs that only report progress go there, not the inbox.
- **Prune on read:** when you open an inbox, delete every item that is already resolved or is pure status. An inbox that only grows is a bug.
- A session-ending `▶ NEXT` / handoff line that names the *one next action + who runs it* is allowed (it's a request: "fire session X"). A paragraph of what you did is not.

### Rule 2 — `main` has a single writer at a time; CTO work uses worktrees and fetches first

*Why: concurrent CTO sessions independently wrote the same gate-4 metrics fix (two commits), created a `metrics.ts` collision, and burned a user decision on a conflict that a parallel session had already resolved. The per-lane-worktree rule covered engineers but not coordination work.*

- The per-lane-worktree rule extends to **all** work, including CTO coordination. No two sessions edit the same files on `main` concurrently.
- **Before any `main` mutation** (merge, commit, push): `git fetch` and check `origin/main` first. If it moved, reconcile against the new state before acting — never act on a stale mental model.
- **Before asking the user to decide** a repo-state question (conflict, revert, sequencing): re-check origin. Do not spend the user's attention on a question a parallel session may have already answered.
- Prefer **one writer** for a launch/merge train. If capacity must run in parallel, sessions claim **disjoint files** up front.

### Rule 3 — Wording passes and publishes run against explicit checklists

*Why: the guarantees-v2 reword missed two surfaces caught late (welcome email via review; site "How it works" as a launch-gate). `serverInfo.version` shipped as 0.0.1 inside 0.2.0. The main clone sat on a feature branch at the old version — the runbook's publish command would have shipped the wrong package.*

**A. User-facing-surface checklist** (run whenever guarantee/positioning wording changes — tick every one):
`site (all pages incl. "How it works") · README · every email template · MCP tool descriptions · launch/marketing posts · in-session agent copy`

**B. Pre-publish checklist** (run before any `npm publish`):
- [ ] Publishing from a checkout that is **on `main` at the release version** (not a feature branch / stale clone)
- [ ] `package.json` version **and** any in-code version string (e.g. MCP `serverInfo.version`) match the release
- [ ] `npm publish --dry-run` — tarball contents + version correct
- [ ] Cold-start the built package over stdio (`npx <pkg>@<version>` handshake), against prod
- [ ] Working clone left **on `main`** afterward (so the next session/runbook command is not a trap)

---

*Net from M8: the engineering was sound and trust held; the waste was coordination overhead (Rule 1, Rule 2) and late-surface/publish gaps (Rule 3). These three rules target exactly those.*
