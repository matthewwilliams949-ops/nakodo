# M9b — Rematches: the circle (technical spec)

*2026-07-11 · CTO. Build contract for the roadmap's M9b (`roadmap-post-m8.md`) — the KIEZ spine: the unit of value is the relationship, not the transaction. Ships after 0.2.1. Size: 1–2 days. Lanes: Trust & Platform + Agent Interface (Product: none — the thread page is untouched). Spec-first so both lanes build against the same contract; CTO arbitrates drift.*

## The principle, made mechanical

When a new ask arrives and someone the user has **already revealed with** plausibly fits, the agent surfaces them FIRST, with the why ("you already know each other — this is exactly what she was strong at"), before any stranger cards. Reconnecting reopens the existing thread; no new double-opt-in between already-revealed people; declining a rematch suggestion is invisible — like every decline.

**"Prior connection" is defined by exactly one thing: a previously REVEALED intro between the pair.** Not proposed, not accepted-one-side — revealed. Anything less would leak consideration (guarantee 4).

## The design tension, resolved up front

The roadmap floats "the card can even show their display name for these." **The pool's zero-identity regression pin stays absolute — no name ever enters a pool response, prior connection or not.** Instead: a prior-connection card carries the user's **own existing intro link** (their own bearer token, already their credential — they hold it in their email/agent history today). Identity arrives where it always arrives: on the revealed intro page they already have access to. The pin survives unmodified; no new identity surface is created; Trust's regression test extends rather than weakens.

## Mechanics (near-zero new surface — this is the point)

### 1. Pool marking (Trust & Platform)

`GET /api/pool` response: cards whose owner shares a revealed intro with the requester gain:

```json
{ "card_id": "…", "body": "…", "prior_connection": true, "reconnect_url": "https://nakodo.dev/intro/<requester's own token>" }
```

- Derivation is a join, no schema change: `intros` where `status = 'revealed'` and the pair matches. `delete_me` already SET-NULLs intro sides, so a deleted counterpart naturally stops marking — guarantee 5 needs no new code.
- `reconnect_url` uses the REQUESTER's own side token (`token_a`/`token_b` by side). Never the counterpart's. This is the requester's existing credential, not new exposure.
- **Regression pin extension (mandatory, Trust lane):** sentinel test that a prior-connection card still contains zero identity fields — `prior_connection` and `reconnect_url` are the ONLY additions, and `reconnect_url` must contain the requester's own token, never the counterpart's.

### 2. Reconnect = a message in the existing thread (no new write path)

No new proposal object, no new opt-in, no new API route. The agent drafts a reconnect message carrying the new ask ("I'm now working on X — you said you'd hit this exact problem; can I pick your brain?"), the user **approves the exact text** (guarantee 1, unchanged), and it posts through the existing `POST /api/intro/[token]` message path into the existing thread. The standard ball-crossing notice fires — the counterpart hears about it exactly like any thread message. Nothing is ever sent unapproved; nothing new is sent by us.

### 3. Tool guidance (Agent Interface)

- `find_collaborator` orchestration: when pool results include `prior_connection: true` cards that plausibly fit the ask, present them FIRST, explicitly framed as reconnection ("you already know each other from a previous introduction — this is exactly what they were strong at"), before stranger cards. Then normal calibration on the rest.
- If the user picks a prior connection → agent drafts the reconnect message → approval → post to `reconnect_url`'s thread. If the user passes → nothing happens, nothing is recorded against the counterpart, no proposal exists to decline (invisibility by construction).
- Guidance wording is distribution surface — AIE drafts, Trust reviews the trust-language.

### 4. Events (the retention curve's backbone)

- `rematch_proposed` — fired via `POST /api/events` by the MCP layer when the agent surfaces ≥1 prior-connection card for an ask. Metadata: `{ ask_id, intro_id }`.
- `rematch_reconnected` — fired when the approved reconnect message posts. Metadata: `{ ask_id, intro_id }`. Server-side hook in the message path when the poster supplies ask context; MCP passes `ask_id` alongside the message. (Exact plumbing: AIE + Trust agree at contract time; the event MUST be attributable to the ask, or the retention metric is mush.)
- `pnpm metrics` gains a CIRCLE line: rematches proposed / reconnected. Founder exclusion applies (same rule as gate 4).

## Trust analysis (the part that must not drift)

| Guarantee | Impact |
|---|---|
| 1 — nothing without approval | Reconnect message is drafted → shown → approved → sent. Unchanged mechanics. |
| 2 — no identity in pool | **Pin intact.** `prior_connection` boolean + own-token URL only. Name stays on the revealed intro page where it already lives. |
| 3 — no browse surface | Pool semantics unchanged (auth + open ask still required). No new human-visible surface. |
| 4 — invisible declines | Stronger than base case: no proposal object even exists until the user acts. Passing on a rematch is unobservable. |
| 5 — delete_me | SET-NULL on intro sides already kills the derivation. Feedback: none. New data: none. |

**Hard rule carried over:** threads exist only inside mutually-revealed intros. Rematch adds no path around that — it rides the existing thread precisely so no cold-messaging surface can ever exist.

## Build order + review ring

1. Trust & Platform: pool derivation + `reconnect_url` + regression-pin extension + `rematch_reconnected` server hook. Contract doc addendum (M8 pattern) so AIE mocks against it.
2. Agent Interface: guidance rework + `rematch_proposed` event + reconnect flow against the mock.
3. Review ring per standing assignment; Trust is mandatory extra reviewer (touches guarantee-2 surface). CTO merges, integrates, prod-verifies (fresh pair → reveal → new ask → rematch surfaces first → reconnect message lands in the old thread → events counted → rows cleaned).

## Out of scope (flag, don't build)

Cross-user rematch suggestions ("Anna should meet your new match"), any counterpart-side notification that a rematch was *considered*, prior-connection display names in pool responses, multi-project profiles. All post-gate or never.
