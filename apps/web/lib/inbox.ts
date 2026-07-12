import { getDb } from './db'
import { appUrl, getIntroMessages, getRevealParties, threadTurn, viewFor, type IntroRow, type ThreadTurn } from './intros'

// The /inbox read model (M9c). One pass over the signed-in user's own intros,
// keyed by SESSION user id — own data only, the boundary the libs already
// enforce. Matthew's framing (2026-07-12): people threads are the home, listed
// by last activity; the anonymous cards awaiting a yes sit above as the one
// "needs you" strip; asks/record/channels fold into a quiet footer.
//
// Anti-feed law (design brief): no counts of other people's activity, nothing
// finer than the day, no strangers, no declined intros (invisible, always).
// This page has NO input fields — the thread composer stays the only free-text
// surface in the product.

export interface CardItem {
  url: string // the intro page stays the acting surface; /inbox only lists
  card: string // the anonymous card text (no identity — pre-reveal)
}

export interface PersonItem {
  url: string
  name: string | null // counterpart display name (revealed → PII store)
  why: string | null // short recap of the card that connected you
  turn: ThreadTurn
  lastActivity: string | Date // last message, or the reveal day — the sort key
  reconnected: boolean // M9b: a prior connection you came back to
}

export interface AskItem {
  need: string
  created_at: string | Date
}

export interface InboxData {
  needsYou: CardItem[] // anonymous introductions awaiting your yes/no
  people: PersonItem[] // revealed threads, last-activity first
  waitingOnThem: number // intros you accepted, still awaiting their yes
  asks: AskItem[]
  record: { profileFirst: string | null; snippetCount: number }
  // The notification-centre piece (LTV's lane): which channels can reach you.
  // Presence only — never the address/chat-id itself (that stays PII-store).
  channels: { email: boolean; telegram: boolean }
}

function firstLine(body: string | null | undefined, max = 96): string | null {
  if (!body) return null
  const line = body.split('\n')[0]!.trim()
  return line.length > max ? `${line.slice(0, max - 1)}…` : line
}

function ms(d: string | Date): number {
  return new Date(d).getTime()
}

export async function inboxData(userId: string): Promise<InboxData> {
  const db = getDb()

  // Safety ruling (2026-07-12, guarantee 4): the read model keys off the
  // VIEWER'S OWN view — never the intro's global status — so a decline by the
  // other side is indistinguishable from waiting, exactly as the token-link
  // `viewFor` already behaves. We fetch everything the target is allowed to see
  // ('held'/'vetoed' are invisible to the target — token lookups exclude them)
  // and let viewFor decide each row. A globally-'declined' intro therefore
  // still surfaces to the NON-decliner as their card/waiting; only the person
  // who themselves declined (view 'closed') drops.
  const { rows: intros } = await db.query<IntroRow & { resolved_at: string | null }>(
    `select id, user_a, user_b, proposed_by, ask_id, card_a, card_b, a_response, b_response,
            status, token_a, token_b, token_expires_at, resolved_at
     from intros
     where (user_a = $1 or user_b = $1) and status not in ('held', 'vetoed')`,
    [userId],
  )

  // M9b: which of these revealed intros are reconnections (a new ask landed in
  // an existing thread). One query, not per-row — the CIRCLE event carries the
  // intro_id in metadata.
  const revealedIds = intros.filter((r) => r.status === 'revealed').map((r) => r.id)
  const reconnectedIds = new Set<string>()
  if (revealedIds.length > 0) {
    const { rows } = await db.query<{ intro_id: string }>(
      `select distinct metadata->>'intro_id' as intro_id from events
       where type = 'rematch_reconnected' and metadata->>'intro_id' = any($1)`,
      [revealedIds],
    )
    for (const r of rows) if (r.intro_id) reconnectedIds.add(r.intro_id)
  }

  const needsYou: CardItem[] = []
  const people: PersonItem[] = []
  let waitingOnThem = 0

  for (const r of intros) {
    const side = r.user_a === userId ? 'a' : 'b'
    const url = `${appUrl()}/intro/${side === 'a' ? r.token_a : r.token_b}`
    const view = viewFor(r, side) // the viewer's OWN view — same call as the token link

    if (view === 'card') {
      // An anonymous card awaiting your answer — the intro engine's live moment.
      // (Persists even if the OTHER side has declined: their decline is silent.)
      needsYou.push({ url, card: side === 'a' ? r.card_a : r.card_b })
      continue
    }
    if (view === 'waiting') {
      // You said yes, they haven't (or they declined — you can't tell): the
      // quiet nameless "waiting" line.
      waitingOnThem += 1
      continue
    }
    if (view !== 'revealed') continue // 'closed' (you declined) or 'expired' — not shown

    // revealed → a person and a thread
    const messages = await getIntroMessages(r.id)
    const { counterpartName } = await getRevealParties(r as IntroRow, side)
    const last = messages[messages.length - 1]
    people.push({
      url,
      name: counterpartName,
      why: firstLine(side === 'a' ? r.card_a : r.card_b),
      turn: threadTurn(messages, side),
      lastActivity: last?.created_at ?? r.resolved_at ?? r.token_expires_at,
      reconnected: reconnectedIds.has(r.id),
    })
  }

  // Matthew's spec: strictly last activity, descending. The one order that
  // carries no editorial judgment about people.
  people.sort((a, b) => ms(b.lastActivity) - ms(a.lastActivity))

  const [asks, profile, snippetCount, channelRow] = await Promise.all([
    db.query<AskItem>("select need, created_at from asks where user_id = $1 and status = 'open' order by created_at desc", [userId]),
    db.query<{ body: string }>('select body from profiles where user_id = $1', [userId]),
    db.query<{ n: number }>('select count(*)::int n from snippets where user_id = $1', [userId]),
    db.query<{ has_email: boolean; has_telegram: boolean }>(
      'select (email is not null) has_email, (telegram_chat_id is not null) has_telegram from users where id = $1',
      [userId],
    ),
  ])

  return {
    needsYou,
    people,
    waitingOnThem,
    asks: asks.rows,
    record: { profileFirst: firstLine(profile.rows[0]?.body), snippetCount: snippetCount.rows[0]?.n ?? 0 },
    channels: {
      email: channelRow.rows[0]?.has_email ?? false,
      telegram: channelRow.rows[0]?.has_telegram ?? false,
    },
  }
}
