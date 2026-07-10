import { authenticate, unauthorized } from '../../../../lib/auth'
import { getDb } from '../../../../lib/db'
import { appUrl, getIntroMessages, threadTurn } from '../../../../lib/intros'

// The in-session lifecycle channel. The MCP server polls this (best-effort) so
// users without an email — and users mid-session — hear from their agent when
// the ball is in their court, and ONLY then (reveal-handoff.md §2, §5). Returns
// actionable states only:
//   card           — an anonymous card is waiting for a response
//   say_hello      — a mutual yes, thread still empty
//   message_waiting — the other person's message is the latest; a reply is due
// their-turn / connected are deliberately absent: nothing to do, so we stay
// quiet. Identity stays off this channel — names live on the page (like cards).
type PendingState = 'card' | 'say_hello' | 'message_waiting'

export async function GET(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()

  const { rows } = await getDb().query<{
    id: string
    token_a: string
    token_b: string
    user_a: string | null
    a_response: string | null
    b_response: string | null
    status: string
    token_expires_at: string
    created_at: string
  }>(
    `select id, token_a, token_b, user_a, a_response, b_response, status, token_expires_at, created_at
     from intros
     where status in ('proposed', 'revealed')
       and (user_a = $1 or user_b = $1)
     order by created_at asc`,
    [user.id],
  )

  const out: { url: string; state: PendingState; created_at: string }[] = []
  for (const r of rows) {
    const side = r.user_a === user.id ? 'a' : 'b'
    const url = `${appUrl()}/intro/${side === 'a' ? r.token_a : r.token_b}`

    if (r.status === 'proposed') {
      const own = side === 'a' ? r.a_response : r.b_response
      // The card page expires; the revealed page never does (viewFor).
      if (own === null && new Date(r.token_expires_at).getTime() > Date.now()) {
        out.push({ url, state: 'card', created_at: r.created_at })
      }
      continue
    }

    // revealed: surface only when the ball is in this side's court.
    const turn = threadTurn(await getIntroMessages(r.id), side)
    if (turn === 'say-hello') out.push({ url, state: 'say_hello', created_at: r.created_at })
    else if (turn === 'your-turn') out.push({ url, state: 'message_waiting', created_at: r.created_at })
  }

  // A new person outranks an ongoing thread: card items first (§5).
  const rank: Record<PendingState, number> = { card: 0, say_hello: 1, message_waiting: 1 }
  out.sort((x, y) => rank[x.state] - rank[y.state])

  return Response.json({ intros: out })
}
