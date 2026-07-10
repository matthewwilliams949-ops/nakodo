// In-process mock of the backend API. The MCP server runs as a child process
// and talks to this over localhost; tests inspect `state` directly.
//
// ASSUMES T2: the /api/pool and /api/intros/propose shapes here are the Agent
// Interface lane's stub of Trust's contract (spec-named fields only). When T2
// lands, reconcile this mock with it. Every field maps to agent-matching-v2.md
// "v1 mechanics" — nothing invented beyond what the spec names.
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'

// Per api-contract-m8.md: card is profiles+snippets only, no `users` columns.
export interface PoolCard {
  card_id: string
  profile: string
  snippets: { body: string; created_at: string }[]
}

export type PendingState = 'card' | 'say_hello' | 'message_waiting'

export interface MockState {
  registered: { email: string | null; display_name?: string | null; source?: string; install_id?: string } | null
  profile: string | null
  snippets: string[]
  asks: string[]
  // Ask ids the server considers open (POST /api/asks issues a{n}); propose
  // validates ask_id against these → ask_not_found otherwise.
  openAskIds: string[]
  events: { type: string; install_id?: string }[]
  deleted: boolean
  pendingIntros: { url: string; state?: PendingState; created_at: string }[]
  // The anonymous pool the server would return to this user (self already excluded).
  pool: PoolCard[]
  // Proposals this user has submitted; each becomes a `held` intro.
  proposals: { card_id: string; ask_id: string; why_for_them: string; why_for_me: string }[]
  // Cards whose target can't receive a proposal right now → propose returns 409 target_busy.
  overProposedCardIds: string[]
}

const TEST_TOKEN = 'test-token-1234'
const OUTBOUND_CAP = 2

// A tiny stand-in for T3's PII lint — just enough to exercise the 422 redraft
// path (emails and URLs). The real lint (apps/web/lib/pii-lint.ts) is far richer;
// the contract only pins the { error, flags, findings } response shape.
function mockPiiCheck(text: string): { error: 'pii_detected'; flags: string[]; findings: { flag: string; excerpt: string }[] } | null {
  const flags: string[] = []
  const findings: { flag: string; excerpt: string }[] = []
  const email = text.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/i)
  if (email) {
    flags.push('email')
    findings.push({ flag: 'email', excerpt: email[0] })
  }
  const url = text.match(/https?:\/\/\S+/i)
  if (url) {
    flags.push('url')
    findings.push({ flag: 'url', excerpt: url[0] })
  }
  return flags.length ? { error: 'pii_detected', flags, findings } : null
}

export async function startMockApi(): Promise<MockApi> {
  const state: MockState = {
    registered: null,
    profile: null,
    snippets: [],
    asks: [],
    openAskIds: [],
    events: [],
    deleted: false,
    pendingIntros: [],
    pool: [],
    proposals: [],
    overProposedCardIds: [],
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
          state.registered = {
            email: body.email ?? null,
            display_name: body.display_name ?? null,
            source: body.source,
            install_id: body.install_id,
          }
          return json(201, { token: TEST_TOKEN, user_id: 'u1' })
        case 'POST /api/events':
          state.events.push({ type: body.type, install_id: body.install_id })
          return json(201, { ok: true })
        case 'POST /api/profile': {
          if (!authed) return json(401, { error: 'unauthorized' })
          const pii = mockPiiCheck(body.body ?? '')
          if (pii) return json(422, pii)
          state.profile = body.body
          return json(200, { ok: true })
        }
        case 'POST /api/snippets': {
          if (!authed) return json(401, { error: 'unauthorized' })
          const pii = mockPiiCheck(body.body ?? '')
          if (pii) return json(422, pii)
          state.snippets.push(body.body)
          return json(201, { ok: true, id: `s${state.snippets.length}` })
        }
        case 'POST /api/asks': {
          if (!authed) return json(401, { error: 'unauthorized' })
          state.asks.push(body.need)
          const askId = `a${state.asks.length}`
          state.openAskIds.push(askId)
          return json(201, { ok: true, id: askId })
        }
        case 'GET /api/pool':
          if (!authed) return json(401, { error: 'unauthorized' })
          // Contract precondition: ≥1 open ask, else 403 no_open_ask.
          if (state.openAskIds.length === 0) {
            return json(403, { error: 'no_open_ask', hint: "Declare what you're looking for first." })
          }
          return json(200, { pool: state.pool, generated_at: '2026-07-10T18:00:00Z' })
        case 'POST /api/intros/propose': {
          if (!authed) return json(401, { error: 'unauthorized' })
          // Error precedence mirrors api-contract-m8.md; branch on error code.
          const pii = mockPiiCheck(`${body.why_for_them ?? ''} ${body.why_for_me ?? ''}`)
          if (pii) return json(422, pii)
          if (!state.pool.some((c) => c.card_id === body.card_id)) {
            return json(404, { error: 'card_not_found', hint: 'Refresh the pool.' })
          }
          if (!state.openAskIds.includes(body.ask_id)) {
            return json(404, { error: 'ask_not_found' })
          }
          if (state.proposals.some((p) => p.card_id === body.card_id)) {
            return json(409, { error: 'already_proposed' })
          }
          if (state.overProposedCardIds.includes(body.card_id)) {
            return json(409, { error: 'target_busy' })
          }
          if (state.proposals.length >= OUTBOUND_CAP) {
            return json(409, { error: 'proposal_cap', open_outbound: state.proposals.length })
          }
          state.proposals.push({
            card_id: body.card_id,
            ask_id: body.ask_id,
            why_for_them: body.why_for_them,
            why_for_me: body.why_for_me,
          })
          return json(201, {
            intro_id: `i${state.proposals.length}`,
            status: 'held',
            note: 'Held for human review before anything reaches them.',
            open_outbound: state.proposals.length,
          })
        }
        case 'GET /api/record':
          if (!authed) return json(401, { error: 'unauthorized' })
          return json(200, {
            user: {
              email: state.registered?.email ?? '',
              handle: 'mw',
              location: 'Berlin',
              display_name: state.registered?.display_name ?? null,
            },
            profile: state.profile ? { body: state.profile, approved_at: '2026-07-05T00:00:00Z' } : null,
            snippets: state.snippets.map((s) => ({ body: s, created_at: '2026-07-05T00:00:00Z' })),
            asks: state.asks.map((need) => ({ need, status: 'open', created_at: '2026-07-05T00:00:00Z' })),
          })
        case 'GET /api/intros/pending':
          if (!authed) return json(401, { error: 'unauthorized' })
          return json(200, { intros: state.pendingIntros, has_email: !!state.registered?.email })
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

export interface MockApi {
  url: string
  state: MockState
  close(): Promise<void>
}
