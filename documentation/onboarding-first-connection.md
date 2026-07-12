# Onboarding = the first search — strategy + build record

*2026-07-12 · Head of Activation, from Matthew's brief. Onboarding's fundamental goal: position the new user to actually reach their first connection. Two requirements: (1) the value proposition IS "your agent knows you and can identify the person who moves your project forward" — onboarding must demonstrate that; (2) at completion the user must be positioned to SEE their first introduction — an explicit tie from onboarding-complete to the notification channel.*

## The frame

Onboarding is not a signup form; it is **commissioning a search**. The agent describes the work (profile from evidence, not questions), names who's missing (the match hypothesis), files the freshest proof (first snippet from the live session), and closes with a contract: *here is what arrives next, and here is how you'll hear.*

## The arc (shipped as tool guidance, branch `m9a2/onboarding-arc`)

1. **Anchor to one project** *(M9a, unchanged)*.
2. **Profile drafted from evidence** the agent already has; ask only what the session can't tell *(sharpened framing)*.
3. **Match hypothesis** *(new)*: the agent names the TYPE of person who would most move the project forward and why; the user confirms or corrects; the agreed version becomes the ask. This is the "my agent gets it" beat — the user's stated need is the starting hypothesis, the agent's sharper version is the product.
4. Reveal name + email offers *(unchanged, honesty framing kept)*; source attribution *(unchanged)*.
5. `create_profile`, then **first snippet from THIS session** *(new)*: 2–4 concrete sentences of what they actually worked on today, approved exactly, `capture_snippet`. Closes the activation metric (profile + ≥1 snippet) inside onboarding and gives the first match fresh material.
6. Re-run `find_collaborator` with the agreed ask.
7. **The completion contract** *(new)*: what arrives next (anonymous card + two-way why, human-vetted), what a mutual yes opens, honest seed-window timing ("usually within a day or two" — made true by the daily founder-welcome pass), and the channel question asked once, lightly: Telegram (`connect_telegram` deep link, lock screen), the email given, or in-session only — a valid choice whose lossiness is stated honestly. Never pushed.

`create_profile`'s return copy reinforces beats 5–7 for agents that lose the guidance thread.

## Instrumentation (shipped in the same branch)

Card links now carry a whitelisted `?via=email|telegram|session` tag; `card_viewed` records it; `pnpm metrics` prints **card-seen latency by channel** (first view per intro). This is the evidence base for every future notification decision — and for M9d's value story at the gates.

## What deliberately did not change

Onboarding length (new beats ride existing approval moments), the five guarantees (restated, not renegotiated), guarantee #1 mechanics (snippet/ask ride the same approve-exact-text law), channel pressure (one light ask). Load-bearing phrasings are protocol-test-pinned like every prior guidance surface.

## Ops half (no code)

- **Founder-welcome is the onboarding payoff**: everyone's first intro is Matthew (playbook Rule #1 — over-invest). Seed-window cadence: the `pnpm metrics` ▶ FOUNDER-WELCOME PASS is a same-day loop, so the completion contract's timing promise stays honest.
- Watch the per-channel card-seen split daily alongside the latency indicator; if in-session-only users dominate the slow tail, that's the datum for pushing channel adoption harder (or M9d tier 1 browser push).

## Boundaries

Consult ping sent to Acquisition (first-session experience sits near the install promise). No PII or guarantee surface touched → no Safety co-review required; flagged in the CTO handoff for their check.

## Addendum 2026-07-12 (later the same day) — the first-match flow, Matthew's spec

Matthew's refinements after reviewing the arc, built on `m9e/first-match-flow`:

1. **No founder self-disclosure.** The first match presents as a normal anonymous card. Matthew's live card already says the sanctioned facts in its own words — solo founder, building an MCP that introduces builders, shipping the whole stack alone, wants thoughts and honest feedback — so the agent's "why them" draws on card content, exactly like any other match. No server flag, no guarantee-#2 exception, nothing for anyone to spoof.
2. **The manual approve step is removed — for all proposals, not just first ones.** Agents select; both humans still approve (proposer says go, target accepts/declines). Server lint, the 2-outbound cap, inbound dampening, and invisible declines are unchanged. The `held`/review machinery stays as an emergency brake (route header documents the flip). Consequence for the wow: "sent — you'll hear the moment they respond" is now literally true; the target's knock goes out at propose time.
3. **Recommendation-first matching:** the calibration guide now leads with ONE confident recommendation and the agent's own case for it ("I found someone — here's why them"), falling back to calibration when the user hesitates. "Here are some options" is explicitly named as the anti-pattern.
4. **The channel moment rides the send:** propose_intro's return copy asks the how-will-you-hear question at the moment a concrete pending thing exists. Step 9's "day or two" timing promise is GONE (resolves the CTO's honesty flag — no cadence-dependent promise remains).
5. **Profile spec gains project phase** (just starting / mid-build / launching / growing).
6. **Ops flip:** Matthew's seed-window heartbeat is answering inbound intros fast — new users' first sends target his card, and his response latency is their first impression of whether this network is alive.

Third notification channel (browser/web push, M9d tier 1) is wanted for this flow but unbuilt and now LTV's surface — demand signal filed with them; onboarding offers the live channels only.
