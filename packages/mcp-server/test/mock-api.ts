// In-process mock of the backend API. The MCP server runs as a child process
// and talks to this over localhost; tests inspect `state` directly.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

export interface MockState {
  registered: { email: string | null; source?: string; install_id?: string } | null
  profile: string | null
  snippets: string[]
  asks: string[]
  events: { type: string; install_id?: string }[]
  deleted: boolean
  pendingIntros: { url: string; created_at: string }[]
}

export interface MockApi {
  url: string
  state: MockState
  close(): Promise<void>
}

const TEST_TOKEN = 'test-token-1234'

export async function startMockApi(): Promise<MockApi> {
  const state: MockState = {
    registered: null,
    profile: null,
    snippets: [],
    asks: [],
    events: [],
    deleted: false,
    pendingIntros: [],
  }

  const server: Server = createServer((req, res) => {
    const chunks: Buffer[] = []
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => {
      const body = chunks.length > 0 ? JSON.parse(Buffer.concat(chunks).toString()) : {}
      const authed = req.headers.authorization === `Bearer ${TEST_TOKEN}`
      const route = `${req.method} ${req.url}`

      const json = (status: number, payload: unknown) => {
        res.writeHead(status, { 'content-type': 'application/json' })
        res.end(JSON.stringify(payload))
      }

      switch (route) {
        case 'POST /api/register':
          if (body.email && state.registered?.email === body.email) {
            return json(409, { error: 'already_registered', hint: 'Reply to any of our emails to recover access.' })
          }
          state.registered = { email: body.email ?? null, source: body.source, install_id: body.install_id }
          return json(201, { token: TEST_TOKEN, user_id: 'u1' })
        case 'POST /api/events':
          state.events.push({ type: body.type, install_id: body.install_id })
          return json(201, { ok: true })
        case 'POST /api/profile':
          if (!authed) return json(401, { error: 'unauthorized' })
          state.profile = body.body
          return json(200, { ok: true })
        case 'POST /api/snippets':
          if (!authed) return json(401, { error: 'unauthorized' })
          state.snippets.push(body.body)
          return json(201, { ok: true, id: `s${state.snippets.length}` })
        case 'POST /api/asks':
          if (!authed) return json(401, { error: 'unauthorized' })
          state.asks.push(body.need)
          return json(201, { ok: true, id: `a${state.asks.length}` })
        case 'GET /api/record':
          if (!authed) return json(401, { error: 'unauthorized' })
          return json(200, {
            user: { email: state.registered?.email ?? '', handle: 'mw', location: 'Berlin' },
            profile: state.profile ? { body: state.profile, approved_at: '2026-07-05T00:00:00Z' } : null,
            snippets: state.snippets.map((s) => ({ body: s, created_at: '2026-07-05T00:00:00Z' })),
            asks: state.asks.map((need) => ({ need, status: 'open', created_at: '2026-07-05T00:00:00Z' })),
          })
        case 'GET /api/intros/pending':
          if (!authed) return json(401, { error: 'unauthorized' })
          return json(200, { intros: state.pendingIntros })
        case 'DELETE /api/me':
          if (!authed) return json(401, { error: 'unauthorized' })
          state.deleted = true
          state.registered = null
          return json(200, { ok: true, deleted: true })
        default:
          return json(404, { error: 'not_found' })
      }
    })
  })

  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve))
  const { port } = server.address() as AddressInfo
  return {
    url: `http://127.0.0.1:${port}`,
    state,
    close: () => new Promise((resolve, reject) => server.close((e) => (e ? reject(e) : resolve()))),
  }
}
