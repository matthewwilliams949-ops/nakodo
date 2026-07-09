export class ApiError extends Error {
  constructor(
    public status: number,
    public body: { error?: string; hint?: string } | null,
  ) {
    super(`API error ${status}${body?.error ? `: ${body.error}` : ''}`)
  }
}

export interface RecordResponse {
  user: { email: string | null; handle: string | null; location: string | null }
  profile: { body: string; approved_at: string } | null
  snippets: { body: string; created_at: string }[]
  asks: { need: string; status: string; created_at: string }[]
}

export interface PendingIntrosResponse {
  intros: { url: string; created_at: string }[]
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

  addAsk(need: string): Promise<{ ok: true; id: string }> {
    return this.request('POST', '/api/asks', { need })
  }

  getRecord(): Promise<RecordResponse> {
    return this.request('GET', '/api/record')
  }

  deleteMe(): Promise<{ ok: true; deleted: true }> {
    return this.request('DELETE', '/api/me')
  }

  pendingIntros(): Promise<PendingIntrosResponse> {
    return this.request('GET', '/api/intros/pending')
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
