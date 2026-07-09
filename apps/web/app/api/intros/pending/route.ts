import { authenticate, unauthorized } from '../../../../lib/auth'
import { getDb } from '../../../../lib/db'
import { appUrl } from '../../../../lib/intros'

// v1.1: the in-session intro channel. The MCP server polls this (best-effort)
// so users without an email — and users mid-session — hear about a waiting
// card from their agent. Returns only the caller's own pending intro links;
// cards and counterpart data stay on the web page.
export async function GET(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()

  const { rows } = await getDb().query<{
    token_a: string
    token_b: string
    user_a: string | null
    created_at: string
  }>(
    `select token_a, token_b, user_a, created_at from intros
     where status = 'proposed' and token_expires_at > now()
       and ((user_a = $1 and a_response is null) or (user_b = $1 and b_response is null))
     order by created_at asc`,
    [user.id],
  )

  return Response.json({
    intros: rows.map((r) => ({
      url: `${appUrl()}/intro/${r.user_a === user.id ? r.token_a : r.token_b}`,
      created_at: r.created_at,
    })),
  })
}
