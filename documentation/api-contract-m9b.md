# M9b API contract addendum — rematches / the circle

*2026-07-11 · Trust & Platform Engineer · Additive contract for M9b (spec: [agent-rematches-m9b.md](agent-rematches-m9b.md)). Extends [api-contract-m8.md](api-contract-m8.md); everything there stands. AIE mocks against this; live code ships on `m9b/trust` after the 0.2.1 train.*

**The invariant, restated for this addendum:** the pool's zero-identity pin is absolute and survives M9b unmodified. A prior-connection card differs from a stranger card by EXACTLY two fields — `prior_connection: true` and `reconnect_url` — and the URL contains the **requester's own** intro token (a credential they already hold), never the counterpart's, never a name.

---

## `GET /api/pool` — prior-connection marking (additive)

Cards whose owner shares a **previously REVEALED intro** with the requester gain two fields:

```json
{
  "card_id": "9f2b6c1e-…",
  "profile": "…",
  "snippets": [ … ],
  "prior_connection": true,
  "reconnect_url": "https://nakodo.dev/intro/<requester's-own-token>"
}
```

- **Derivation:** an intro row with `status = 'revealed'` where the pair is (requester, card owner) — in either side order. Nothing less marks: `held`, `vetoed`, `proposed`, `declined` intros do NOT mark (anything less than revealed would leak consideration — guarantee 4). Regression-pinned.
- **Stranger cards are byte-identical to M8:** the two fields are OMITTED, not `false` — the M8 pin (`card_id`/`profile`/`snippets` exactly) still passes verbatim on them.
- Multiple revealed intros for a pair: the most recent one's token is used.
- A deleted counterpart stops marking automatically (their intro side is SET NULL, the pair join fails) — guarantee 5, no new code.
- `reconnect_url` points at the requester's own revealed intro page (their existing thread). It is the same URL their agent already gets from `GET /api/intros/pending` at reveal time.

## `POST /api/intro/[token]` — reconnect attribution (additive, JSON only)

The existing message path gains an **optional** `ask_id` alongside `message`:

```json
{ "message": "I'm now working on X — you said you'd hit this exact problem. Can I pick your brain?", "ask_id": "5c77a0d2-…" }
```

- Semantics unchanged: revealed-intros-only, user-approved text, standard ball-crossing notice. `ask_id` only attributes the message to the ask that motivated the reconnect, so the retention metric is real.
- When `ask_id` is present it MUST be an open ask **belonging to the posting side's user**; otherwise the whole request is `400 invalid_body` and nothing posts. Loud, not silent — a mis-attributed reconnect is an agent bug, and silently dropping the attribution would quietly corrupt the CIRCLE metric.
- Valid `ask_id` → server logs `rematch_reconnected` with `{ intro_id, ask_id, side }` after the normal `message_sent`. No response-shape change (`{ view, message_sent: true }`).
- The HTML form path never sends `ask_id` (human messages aren't rematch-attributed).

## Events (the CIRCLE metric)

| Event | Fired by | Name in the events table | Metadata |
|---|---|---|---|
| rematch proposed | MCP layer via `POST /api/events` when the agent surfaces ≥1 prior-connection card for an ask | **`client_rematch_proposed`** (the events route namespaces unauthenticated events — mind the prefix when counting) | `{ ask_id, card_ids }` — the MCP layer has card ids at surface time, not intro ids (2026-07-11 ruling: the pool card stays at exactly 2 additions, so no intro_id on the card; the metrics side maps card→owner→revealed pair for founder exclusion) |
| rematch reconnected | server, in the message path (above) | `rematch_reconnected` | `{ intro_id, ask_id, side }` |

`pnpm metrics` gains a CIRCLE line counting both (founder exclusion applies, same rule as gate 4).

## Mocking notes for the AIE lane

- Pool mock: at least one fixture where a card carries `prior_connection: true` + `reconnect_url`, alongside stranger cards without the keys (assert your rendering keeps them omitted-not-false).
- The reconnect post is the EXISTING message endpoint with `ask_id` added — no new route to mock. Fixture the `400` for a stale/foreign `ask_id`.
- Guidance reminder from the spec, contract-adjacent: passing on a prior-connection card records NOTHING (no proposal object exists) — your flow must not call any endpoint on a pass.
