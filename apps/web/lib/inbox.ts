import { getDb } from './db'
import { appUrl, getIntroMessages, getRevealParties, threadTurn, type IntroRow } from './intros'

// The /inbox read model (M9c). One query per zone, all keyed by the SESSION
// user id — own data only, the same boundary the libs already enforce. The
// "needs you" zone is exactly the pending-v2 ball-in-court set (design brief
// §7: no new read model), just carrying the extra display fields the desk
// surface shows (counterpart name, day, message preview) that the agent
// channel deliberately omits.

export interface NeedsYouItem {
  kind: 'card' | 'say_hello' | 'message_waiting'
  url: string // the intro page stays the acting surface; /inbox only lists
  card: string | null // kind 'card': the anonymous card text
  name: string | null // counterpart display name (say_hello / message_waiting)
  day: string | Date | null // message_waiting: day of their latest message
  preview: string | null // message_waiting: first line of their latest message
}

export interface AskItem {
  need: string
  created_at: string | Date
}

export interface IntroItem {
  url: string
  name: string | null
  day: string | Date | null // day of the last message, or the reveal day
  turn: 'say-hello' | 'your-turn' | 'their-turn'
}

export interface InboxData {
  needsYou: NeedsYouItem[]
  asks: AskItem[]
  intros: IntroItem[]
  record: { profileFirst: string | null; snippetCount: number }
}

function firstLine(body: string | null | undefined): string | null {
  if (!body) return null
  const line = body.split('\n')[0]!.trim()
  return line.length > 140 ? `${line.slice(0, 139)}…` : line
}

export async function inboxData(userId: string): Promise<InboxData> {
  const db = getDb()

  const { rows: intros } = await db.query<IntroRow & { resolved_at: string | null }>(
    `select id, user_a, user_b, proposed_by, ask_id, card_a, card_b, a_response, b_response, status, token_a, token_b, token_expires_at, resolved_at
     from intros
     where (user_a = $1 or user_b = $1) and status in ('proposed', 'revealed')
     order by created_at asc`,
    [userId],
  )

  const needsYou: NeedsYouItem[] = []
  const introItems: IntroItem[] = []

  for (const r of intros) {
    const side = r.user_a === userId ? 'a' : 'b'
    const url = `${appUrl()}/intro/${side === 'a' ? r.token_a : r.token_b}`

    if (r.status === 'proposed') {
      const own = side === 'a' ? r.a_response : r.b_response
      if (own === null && new Date(r.token_expires_at).getTime() > Date.now()) {
        needsYou.push({ kind: 'card', url, card: side === 'a' ? r.card_a : r.card_b, name: null, day: null, preview: null })
      }
      continue // proposed intros are not yet an "introduction" — zone 3 is revealed only
    }

    // revealed
    const messages = await getIntroMessages(r.id)
    const turn = threadTurn(messages, side)
    const { counterpartName } = await getRevealParties(r as IntroRow, side)
    const last = messages[messages.length - 1]
    introItems.push({ url, name: counterpartName, day: last?.created_at ?? r.resolved_at, turn })

    if (turn === 'say-hello') {
      needsYou.push({ kind: 'say_hello', url, card: null, name: counterpartName, day: null, preview: null })
    } else if (turn === 'your-turn') {
      needsYou.push({ kind: 'message_waiting', url, card: null, name: counterpartName, day: last!.created_at, preview: firstLine(last!.body) })
    }
  }

  // A new person outranks an ongoing thread — cards first (brief §2, pending §5).
  const rank: Record<NeedsYouItem['kind'], number> = { card: 0, say_hello: 1, message_waiting: 1 }
  needsYou.sort((a, b) => rank[a.kind] - rank[b.kind])

  const [asks, profile, snippetCount] = await Promise.all([
    db.query<AskItem>("select need, created_at from asks where user_id = $1 and status = 'open' order by created_at desc", [userId]),
    db.query<{ body: string }>('select body from profiles where user_id = $1', [userId]),
    db.query<{ n: number }>('select count(*)::int n from snippets where user_id = $1', [userId]),
  ])

  return {
    needsYou,
    asks: asks.rows,
    intros: introItems,
    record: { profileFirst: firstLine(profile.rows[0]?.body), snippetCount: snippetCount.rows[0]?.n ?? 0 },
  }
}
