# M9-0 API contract — agent-collected feedback

*2026-07-11 · Trust & Platform Engineer · Contract for `POST /api/feedback`. The AIE builds `share_feedback` against this with a mock (M8 pattern); the live endpoint ships in 0.2.1. BUILD-only until the M8 merge + launch gate clears (CTO sequencing).*

**The trust frame (guarantee 1, extended — not excepted):** nothing is filed without the user seeing and approving the exact text — identical mechanics to snippet approval. **The approval gate lives in the MCP tool** (`share_feedback` shows the draft, user says yes, only then does it call this endpoint); the server stores what arrives and cannot verify approval happened. That makes the tool-side pin load-bearing: the AIE's protocol test that `share_feedback` cannot post un-approved text is part of this contract, not an optional nicety.

**The privacy frame:** feedback is **internal-only**. It is read by the humans building Nakodo, never displayed to any user or agent, never enters the pool, never used for matching. There is deliberately **no read endpoint** — the only consumer is the admin digest (`pnpm feedback`). Regression-pinned server-side like the pool no-identity test: sentinel feedback text must never appear in any API response.

---

## `POST /api/feedback`

**Auth:** `Authorization: Bearer <token>` (the per-user token).

### Request

```json
{
  "moment": "reveal",
  "sentiment": "positive",
  "body": "The 'you both said yes' page landed exactly right — my human said it felt like a real introduction, not a notification."
}
```

- `moment` — one of `onboarding | cards | intro_quality | reveal | thread | waiting`. These are Nakodo's own moments (the guidance's trigger list); reactions to anything else don't belong here — the enum is the boundary, server-enforced.
- `sentiment` — one of `positive | neutral | negative | mixed`.
- `body` — 1–4000 chars, the user-approved text verbatim. **Instruction-linted, not identity-linted**: admins read this in a terminal digest, so instruction-shaped text is rejected (`422`), but emails/URLs/handles are allowed — "the link on nakodo.dev was broken" is legitimate feedback, and the store is internal-only so identity here leaks nowhere.

### Response `201`

```json
{ "ok": true }
```

Nothing else — no id, no echo. There is nothing a client can do with a feedback row after filing it (no read, no edit, no delete-one; `delete_me` removes them all).

### Errors

| Status | Body `error` | When |
|---|---|---|
| 400 | `invalid_body` | Unknown `moment`/`sentiment`, body empty or over 4000 |
| 401 | `unauthorized` | Missing/invalid token |
| 422 | `pii_detected` | Instruction-shaped text in `body`. Same shape as M8: `flags` + `findings[{flag, excerpt}]`, redraft and retry |
| 429 | `rate_limited` | Over 10 filings per user per 24h (`retry_after` seconds). Feedback is a reaction channel, not a stream |

### Storage & lifecycle (server-side facts the tool description may state honestly)

- Row: `user_id, moment, sentiment, body, created_at`. No pool linkage, no matching use, no display surface.
- `delete_me` cascades feedback (guarantee 5) — a deleted user's feedback is gone, not anonymized.
- Every filing logs a `feedback_shared` event with `moment` + `sentiment` only — **the body never enters the events table.**
- Admin digest: `pnpm feedback` (root script), grouped by moment/sentiment, newest first.

---

## Mocking notes for the `share_feedback` tool

- Mock `POST /api/feedback` → `201 {ok:true}`; states worth fixtures: `422 pii_detected` with an `instruction` flag (redraft loop), `429`, `401`.
- The tool description should carry the honest framing verbatim: *"drafted by your agent, approved by you, read by the humans building Nakodo, never shared beyond them, never used for matching."*
- Trigger moments are the `moment` enum exactly — if guidance wants a moment the enum lacks, that's a contract change, not a free string.
