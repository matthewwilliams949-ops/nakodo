# Testing guide — hands-on e2e against prod

*2026-07-12. How to test Nakodo end-to-end as a human, without a CTO session driving each step. Tools: the **e2e panel** (browser buttons), the **e2e harness** (CLI it wraps), and the **"Nakodo testing" sandbox workspace** (agent-side onboarding). All of it targets whatever `DATABASE_URL`/`APP_URL` are in the repo `.env` — today that is production, so the hygiene rules at the bottom are law.*

## The panel

```
cd ~/Personal/agent-networker-m8-integrate   # a checkout with a known-good prod .env
pnpm e2e:panel                               # → http://localhost:4747
```

It's a **long-running process** — leave it up in its own terminal for the session. If `http://localhost:4747` **refuses to connect**, it just isn't running: (re)start it with the command above (check nothing else holds the port with `lsof -ti:4747`). On boot it prints the target `app` + `db`; a `⚠ NON-LOCAL` db line is **expected** today — you're pointed at prod, which is the point, so the hygiene rules below are law.

Local-only (binds 127.0.0.1, never deployed). One page:

- **Pool** — every user on the target DB: real users, e2e personas, onboarding test users, with profile/snippet/ask counts. `Seed 4 personas` / `Cleanup e2e rows`.
- **Send yourself a match** — one click stages an inbound intro persona → you through the real concierge path (`createIntro`), so the card **email actually fires** if you have an address on record.
- **Intros** — every intro with status and per-side responses. The buttons act **as the persona** (Accept / Decline / Reply). Since m9e (2026-07-12) proposals deliver **directly** — they no longer wait in `held` — so the admin **Approve** button appears only in the rare case a proposal was held via the emergency brake. Your own side never has buttons: you experience it the way a user does — email, agent, intro page.
- **Onboarding runs** — resets/deletes the sandbox identity (below).

Principle: **the panel drives the counterparty and the admin; you play yourself.**

## Recipe 1 — receive a match (the inbound experience)

1. `Seed 4 personas` (skip if seeded).
2. Click e.g. `Nao → Matthew`. Check your email: "An introduction is waiting for you" with the card + link.
3. Open the link, read the anonymous card, **Accept** (or Decline — declines are invisible, verify the persona side shows nothing).
4. Your accept alone doesn't reveal — click `Accept as Nao` in the panel for the mutual yes. Reveal email lands; page shows the person.
5. Say hello on the page → `Reply as Nao` in the panel → "message waiting" email + notice.
6. `Cleanup e2e rows` when done (kills personas + their intros + messages, surgically).

## Recipe 2 — propose a match (the outbound experience)

1. Seed personas, then in **your own agent session**: "find me someone who…" (phrase it to fit a persona). The agent searches the pool, shows cards, and proposes on your go.
2. Since m9e (2026-07-12) the proposal **delivers directly** — no human-review step. The persona gets the card immediately (its email fires if it has an address); in the panel the intro shows `proposed`, no Approve needed. (The `held`→Approve path still exists as an emergency brake, off by default — see the panel note.)
3. `Accept as <persona>` → reveal (proposing was your yes, so one accept completes it). Continue as in recipe 1.

## Recipe 3 — onboarding loop (fresh user, repeatable, ~2 min per run)

`~/Personal/Nakodo testing` is a standalone sandbox workspace — deliberately **outside the repo**, so an onboarding session never sits on top of the codebase and can't drift into "fixing" Nakodo. Its `.mcp.json` runs the nakodo client with `NAKODO_CONFIG_DIR` pointed at a scratch identity (`~/.config/nakodo-e2e-user`) — onboarding runs there can never touch your real account. **Two modes:** point `command`/`args` at `npx -y nakodo` to test the **published** artifact (the real install experience), or at the local build (`node <repo>/packages/mcp-server/dist/index.js`, after `pnpm build` in that package) to test **unreleased** client changes before publishing. Either way the client targets prod (`https://nakodo.dev`) by default. The folder carries founder-voice context (`CLAUDE.md`, `PROJECT.md`, `progress-log.md`) so the agent can draft a realistic Nakodo-builder profile from what it "knows", the way a real user's agent would — refresh `progress-log.md` occasionally so profiles stay current.

1. Panel: `Reset fresh-user identity`.
2. New session in `~/Personal/Nakodo testing`. Say what a stranger would: *"find me someone who could give feedback on what I'm building."* The agent should draft the profile from the folder's context — judge the cold onboarding: per-word approval, no name/links in the profile, optional email.
3. Watch the new user appear in the panel's Pool table.
4. Panel: `Delete test user (server + local)` — deletes via the user's own token (the guarantee-5 path), then clears the local identity. Repeat as often as you like.

Tip: give the sandbox user `you+test@gmail.com` (plus-alias) if the run should exercise emails.

## Full agent-side e2e (the real product, no shortcuts)

Recipe 3 → capture a snippet → recipe 2 driven from the sandbox session. That covers install (published package = the artifact test; or the local build for pre-publish client changes) → onboard → search → propose → **deliver** → accept → reveal → thread → feedback (`share_feedback` after a reveal) → `delete me`. If any step needs the counterparty, the panel is standing next to you.

## Hygiene (non-negotiable)

- **Personas & their intros:** always end with `Cleanup e2e rows`. Only `source='e2e-harness'` rows are ever touched; real users are structurally safe.
- **Onboarding users:** always end with `Delete test user`. They are NOT e2e-tagged (they register like real users), so the panel's token-scoped delete is the correct cleanup — don't leave them for a sweep.
- **Concurrent sessions:** before seeding test data that outlives your sitting, drop a line in the CTO inbox (`live e2e in flight — do not clean`); before any cleanup/sweep, read that inbox. A CTO session once swept a live founder test mid-flight; don't repeat it.
- **Emails are real.** Every card/reveal/message email in a test goes to a real mailbox. Expect them; they're part of what you're testing.
- **After launch:** real users exist. Prefer quiet hours for panel runs, keep persona lifetimes short, and never `Send yourself a match` to anyone but yourself.

## CLI equivalents (what the panel wraps)

```
pnpm e2e seed|status|match|accept <tok>|decline <tok>|say <tok> "msg"|cleanup
pnpm --filter web intro:review list|approve <id>|veto <id>   # emergency brake only — proposals deliver directly by default
pnpm --filter web intro:send <spec.json>
pnpm feedback        # admin digest of share_feedback rows
```
