export class ApiError extends Error {
  constructor(
    public status: number,
    // Extra fields carry the M8 contract's structured error payloads: `flags` +
    // `findings` (pii_detected), `open_outbound` (proposal_cap), `retry_after`
    // (rate_limited).
    public body:
      | {
          error?: string
          hint?: string
          flags?: string[]
          findings?: { flag: string; excerpt: string }[]
          open_outbound?: number
          retry_after?: number
        }
      | null,
  ) {
    super(`API error ${status}${body?.error ? `: ${body.error}` : ''}`)
  }
}

export interface RecordResponse {
  // ASSUMES (not in T2 contract — pending Trust): GET /api/record does not yet
  // echo `display_name` (record route on m8/trust returns email/handle/location
  // only). Optional here so my_record shows the reveal name once Trust adds it;
  // harmless until then. Flagged to Trust's inbox. Never anyone else's record.
  user: { email: string | null; handle: string | null; location: string | null; display_name?: string | null }
  profile: { body: string; approved_at: string } | null
  snippets: { body: string; created_at: string }[]
  asks: { id: string; need: string; status: string; created_at: string }[]
}

// M8: the pending channel is meant to become a whole-lifecycle channel (design
// brief §5/§8): the server returns only states where the ball is in the user's
// court — card / say_hello / message_waiting — plus `has_email` to gate the
// add-email re-offer.
// ASSUMES (NOT in the T2 contract — the live endpoint on m8/trust is still v1:
// it returns `{ url, created_at }` with no `state`, no `has_email`, `card` only).
// So `state`/`has_email` are OPTIONAL and pendingNotice() defaults a missing
// state to 'card' — that keeps the v1.1 card notice working against today's
// endpoint and lights up the lifecycle the moment Trust/Product ship §8. Flagged.
export type PendingState = 'card' | 'say_hello' | 'message_waiting'

export interface PendingIntrosResponse {
  intros: { url: string; state?: PendingState; created_at: string }[]
  has_email?: boolean
}

// M8 pool card — per documentation/api-contract-m8.md (T2). Anonymous by
// construction: assembled ONLY from profiles + snippets rows, never any `users`
// column (no location — that lives in the PII store and is excluded by the
// contract's invariant). `card_id` is an opaque stable UUID, not the user id.
export interface PoolCard {
  card_id: string
  profile: string
  snippets: { body: string; created_at: string }[]
  // M9b: set only for a card whose owner shares a previously REVEALED intro with
  // the requester. Still zero identity — no name ever enters a pool response.
  // `reconnect_url` carries the REQUESTER's OWN intro token (their existing
  // credential), never the counterpart's. (api-contract addendum pending; fields
  // defined by agent-rematches-m9b.md §1.)
  prior_connection?: boolean
  reconnect_url?: string
}

// GET /api/pool response — note the key is `pool` (not `cards`), per T2.
export interface PoolResponse {
  pool: PoolCard[]
  generated_at?: string
}

// POST /api/intros/propose response `201` — per T2 + the 2026-07-12 addendum
// (review removed: proposals deliver directly as 'proposed'; 'held' kept for
// back-compat with a server running the emergency-brake flow). `open_outbound`
// is the only cap-related number ever exposed (the caller's own open intros).
export interface ProposeResult {
  intro_id: string
  status: 'proposed' | 'held'
  note: string
  open_outbound: number
}

export class ApiClient {
  constructor(
    private baseUrl: string,
    private token?: string,
  ) {}

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      method,
      headers: {
        'content-type': 'application/json',
        ...(this.token ? { authorization: `Bearer ${this.token}` } : {}),
      },
      body: body === undefined ? undefined : JSON.stringify(body),
    })
    if (!res.ok) {
      const errBody = (await res.json().catch(() => null)) as { error?: string; hint?: string } | null
      throw new ApiError(res.status, errBody)
    }
    return (await res.json()) as T
  }

  register(input: {
    email?: string
    handle?: string
    location?: string
    // Confirmed against m8/trust register route: it accepts + persists display_name.
    display_name?: string
    source?: string
    install_id: string
  }): Promise<{ token: string; user_id: string }> {
    return this.request('POST', '/api/register', input)
  }

  saveProfile(body: string): Promise<{ ok: true }> {
    return this.request('POST', '/api/profile', { body })
  }

  addSnippet(body: string): Promise<{ ok: true; id: string }> {
    return this.request('POST', '/api/snippets', { body })
  }

  // Idempotent per (user, open, need): a repeat returns 200 { id, existing: true }.
  addAsk(need: string): Promise<{ ok: true; id: string; existing?: boolean }> {
    return this.request('POST', '/api/asks', { need })
  }

  getRecord(): Promise<RecordResponse> {
    return this.request('GET', '/api/record')
  }

  deleteMe(): Promise<{ ok: true; deleted: true }> {
    return this.request('DELETE', '/api/me')
  }

  // M8: update own PII-store fields (notification email + reveal display_name).
  // Backs the "add an email any time" re-offer (design §4.3). Explicit null
  // clears a field; omitted fields untouched. 409 if the email is someone else's.
  updateMe(input: { email?: string | null; display_name?: string | null }): Promise<{ ok: true }> {
    return this.request('PATCH', '/api/me', input)
  }

  pendingIntros(): Promise<PendingIntrosResponse> {
    return this.request('GET', '/api/intros/pending')
  }

  // M8 (T2): the whole anonymous pool in one call — at seed density (N<50) it
  // fits the client agent's context and the agent is the matcher. Precondition:
  // caller has ≥1 open ask (else 403 no_open_ask). Rate-limited (429).
  getPool(): Promise<PoolResponse> {
    return this.request('GET', '/api/pool')
  }

  // M8 (T2): propose an intro to the person behind an anonymous card. The server
  // assembles the target-side card from the proposer's own profile + the ask +
  // why_for_them and holds it for seed-phase review. `ask_id` is required — every
  // proposal answers a declared open ask. why_for_them must state what the TARGET
  // gains (guidance enforces the intent; server PII-lints both reasons → 422).
  proposeIntro(input: {
    card_id: string
    ask_id: string
    why_for_them: string
    why_for_me: string
  }): Promise<ProposeResult> {
    return this.request('POST', '/api/intros/propose', input)
  }

  // M9-0: file a piece of user feedback about a Nakodo moment. Per
  // documentation/api-contract-m9-feedback.md. Internal-only — no read endpoint
  // exists; the server never puts it in the pool or shows it to any user. `body`
  // is instruction-linted only (admins read it; identity is allowed) → 422 like
  // M8. 10/day cap → 429. Response is `{ ok: true }` — nothing to do with a row.
  shareFeedback(input: { moment: string; sentiment: string; body: string }): Promise<{ ok: true }> {
    return this.request('POST', '/api/feedback', input)
  }

  // M9b (api-contract-m9b): reconnect with a prior connection by posting an
  // approved message into their EXISTING revealed thread, with `ask_id` so the
  // server can attribute the reconnect (fires rematch_reconnected). Same message
  // path the web thread uses — revealed-intros-only is enforced server-side; a
  // foreign/stale ask_id is 400 (loud, never silently dropped). `token` is the
  // requester's own intro token, from the reconnect_url find_collaborator surfaced.
  reconnectMessage(token: string, message: string, ask_id: string): Promise<{ view: string; message_sent: true }> {
    return this.request('POST', `/api/intro/${encodeURIComponent(token)}`, { message, ask_id })
  }

  // M9d tier 2: mint a one-time Telegram deep link (30-min expiry). The user
  // taps Start in their own Telegram app — that tap is the approval that binds.
  // 503 telegram_not_configured until the bot exists in the environment.
  connectTelegram(): Promise<{ url: string; expires_in_minutes: number }> {
    return this.request('POST', '/api/me/telegram')
  }

  disconnectTelegram(): Promise<{ ok: true }> {
    return this.request('DELETE', '/api/me/telegram')
  }

  // Telemetry must never break the user experience — swallow all failures.
  async logEvent(type: string, installId: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      await this.request('POST', '/api/events', { type, install_id: installId, metadata })
    } catch {
      // ignore
    }
  }
}
