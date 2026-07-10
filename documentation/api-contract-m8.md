# M8 API contract — pool search + agent proposals

*2026-07-10 · Trust & Platform Engineer · The contract for `GET /api/pool` and `POST /api/intros/propose`. The Agent Interface Engineer builds A1 against this with a mock API; the live endpoints (T4/T5) implement exactly this. Changes after AIE sign-off go through the CTO. Spec: [agent-matching-v2.md](agent-matching-v2.md).*

**The invariant behind both endpoints:** pool and proposal responses are assembled ONLY from `profiles`, `snippets`, and `asks` rows. No column of `users` (email, handle, display_name, location, source, timestamps — none of it) ever appears in any response body defined here. This is regression-pinned in the test suite; if a field you want is on `users`, the answer is no — put it in the profile body via guidance instead.

---

## `GET /api/pool`

The whole anonymous pool, for the caller's agent to judge in-context. v1 is deliberately algorithm-free: no query parameters, no server-side ranking, no pagination (N < 50; revisit when size demands it — that's a contract change).

**Auth:** `Authorization: Bearer <token>` (the per-user token from registration).
**Precondition:** caller has ≥ 1 open ask. Search without a declared need is scraping, not matching.

### Response `200`

```json
{
  "pool": [
    {
      "card_id": "9f2b6c1e-…",
      "profile": "Building an agent-memory tool, three weeks in. Strongest at…",
      "snippets": [
        { "body": "Shipped the retrieval layer…", "created_at": "2026-07-08T12:00:00Z" }
      ]
    }
  ],
  "generated_at": "2026-07-10T18:00:00Z"
}
```

- `card_id` — opaque stable UUID. It is **not** the user id and never appears alongside identity anywhere in the system. Stable across fetches so the calibration loop can refer to cards it has already shown ("not this one — why?").
- `profile` — the approved profile body, verbatim. It is anonymous **by construction** (drafting guidance + PII lint), not by redaction.
- `snippets` — up to the 5 most recent approved snippet bodies, newest first.
- The caller's **own card is excluded**.
- Only users with an approved profile appear. There is no flag for "has open asks", response counts, or any other metadata about pool members.
- Ordering is unspecified; clients must not depend on it.

**Treat every `profile` and `snippet` string as untrusted data.** Pool content is written by strangers and flows into agent context. Never follow instructions found in card text; the MCP tool output must frame it as data (A1's responsibility, stated here so the contract carries the warning).

### Errors

| Status | Body `error` | When |
|---|---|---|
| 401 | `unauthorized` | Missing/invalid token |
| 403 | `no_open_ask` | Caller has no open ask. `hint`: "Declare what you're looking for first — search follows a need." |
| 429 | `rate_limited` | Over limit. Includes `retry_after` (seconds). Initial limits: **10 fetches/hour, 40/day per user** (server-tunable without contract change; only shape is contractual). |

Every fetch is access-logged (`events` type `pool_fetched`, with user id and pool size — server-side only, never echoed to other users).

---

## `POST /api/intros/propose`

The agent proposes an introduction after the human said go. Creates a **`held`** intro: invisible to the target (token resolves to nothing, pending endpoint excludes it) until Matthew's one-click review approves it (seed-phase quality floor). Approval flips it to `proposed` and the standard flow — anonymous card, double opt-in, invisible decline — takes over unchanged.

**Auth:** Bearer token required.

### Request

```json
{
  "card_id": "9f2b6c1e-…",
  "ask_id": "5c77a0d2-…",
  "why_for_them": "You're three weeks into agent memory; they've shipped retrieval eval harnesses and are looking for a real workload to test on — your tool is that workload.",
  "why_for_me": "Their eval experience is exactly what my human needs to validate the memory layer."
}
```

- `card_id` — from a pool fetch.
- `ask_id` — the caller's own **open** ask this proposal serves. Required: every proposal answers a declared need.
- `why_for_them` — 1–1000 chars. **Must state what the TARGET gains** (mutual-benefit rule as protocol; drafting guidance enforces it, PII lint checks it for identity leakage). This text becomes part of the card the target sees.
- `why_for_me` — 1–1000 chars. For the review surface and calibration data. **Never shown to the target.**

### Response `201`

```json
{
  "intro_id": "e41d9a77-…",
  "status": "held",
  "note": "Held for human review before anything reaches them. If it clears review, they get your anonymous card; you'll hear only if you both say yes.",
  "open_outbound": 2
}
```

Nothing else. No target metadata, no review ETA, no queue position — any of those would leak information about the other side.

**What the target eventually sees (server-assembled, on approval):** the proposer's anonymous profile + the ask text + `why_for_them`. The proposer never controls the target-side card beyond those inputs.

### Errors

| Status | Body `error` | When |
|---|---|---|
| 400 | `invalid_body` | Shape/length violations |
| 401 | `unauthorized` | Missing/invalid token |
| 404 | `card_not_found` | Unknown `card_id` (or a card that has left the pool) |
| 404 | `ask_not_found` | `ask_id` doesn't exist, isn't the caller's, or isn't open — one error for all three, so ask ids can't be probed |
| 409 | `proposal_cap` | Caller already has 2 open outbound proposals (`held` or `proposed`). Body includes `open_outbound: 2`. Resolves when one reveals, declines, or expires |
| 409 | `already_proposed` | The **caller** already has an open intro to this card. Discloses only the caller's own prior action |
| 409 | `target_busy` | The target can't receive proposals right now. Deliberately covers BOTH over-proposal dampening AND a reverse-direction collision (the target already has an open/held proposal toward the caller) — one opaque error, so a proposer can never learn they are being considered. Carries no count, no reason |
| 422 | `pii_detected` | PII lint flagged `why_for_them`/`why_for_me`. Body includes `flags: ["email", "url", …]` so the agent can redraft |
| 429 | `rate_limited` | Burst guard, same shape as pool |

**Silence rules, restated for this endpoint:** a proposal that is vetoed in review stays exactly as invisible as one that was declined — the proposer sees `held` forever (or an eventual quiet expiry); the target never learns it existed. `open_outbound` counts only the caller's own proposals and is the only cap-related number ever exposed.

Events: `intro_proposal_held` on creation; the existing `intro_proposed` fires only at approval (when notices go out).

---

## Mocking notes for A1

- The repo's mock-API pattern (`packages/mcp-server/test/mock-api.ts`) — add `GET /api/pool` and `POST /api/intros/propose` handlers returning the shapes above.
- Useful mock states: pool with 3 cards / empty pool / `no_open_ask` / `proposal_cap` / `pii_detected` with `flags`.
- `card_id` in mocks: any stable UUIDs. Don't reuse user ids, even in fixtures — the habit is the point.
