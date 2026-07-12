import { getDb } from './db'
import { generateToken } from './tokens'
import { sendEmail } from './email'
import { logEvent } from './events'
import { introCard, revealNotice, messageWaiting } from '../emails/templates'
import { notifyTelegram, tgIntroWaiting, tgRevealNotice, tgMessageWaiting } from './telegram'

const TOKEN_TTL_DAYS = 14

export interface IntroRow {
  id: string
  user_a: string | null
  user_b: string | null
  proposed_by: string | null // M8: proposing user (null = concierge)
  ask_id: string | null // M8: the ask this intro answers
  card_a: string
  card_b: string
  a_response: 'accepted' | 'declined' | null
  b_response: 'accepted' | 'declined' | null
  status: 'held' | 'vetoed' | 'proposed' | 'revealed' | 'declined'
  token_a: string
  token_b: string
  token_expires_at: string | Date
}

export interface IntroMessage {
  id: string
  side: 'a' | 'b'
  body: string
  created_at: string | Date
}

export function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

interface UserRow {
  id: string
  email: string | null
  handle: string | null
  telegram_chat_id: string | null
}

// Concierge lookup: accepts a user id, handle, or email. Email is optional in
// v1.1, so id/handle must work as first-class identifiers.
async function findUser(key: string): Promise<UserRow | null> {
  const { rows } = await getDb().query<UserRow>(
    'select id, email, handle, telegram_chat_id from users where id::text = $1 or handle = $1 or email = $1',
    [key],
  )
  if (rows.length > 1) throw new Error(`ambiguous user key ${JSON.stringify(key)} — use the user id`)
  return rows[0] ?? null
}

// Concierge entry point (used by scripts/send-intro.ts and tests): creates the
// intro row. The card itself lives at the tokenized web page; users with an
// email on record additionally get a notification email carrying their card.
// Users without one are told in-session by their agent (GET /api/intros/pending).
export async function createIntro(input: {
  userA: string // id, handle, or email
  userB: string
  cardA: string // shown TO user A, describes user B
  cardB: string
}): Promise<{ id: string }> {
  const db = getDb()
  const userA = await findUser(input.userA)
  const userB = await findUser(input.userB)
  if (!userA || !userB) throw new Error('both users must exist (by id, handle, or email)')
  if (userA.id === userB.id) throw new Error('cannot introduce a user to themselves')

  const tokenA = generateToken()
  const tokenB = generateToken()
  const { rows } = await db.query<{ id: string }>(
    `insert into intros (user_a, user_b, card_a, card_b, token_a, token_b, token_expires_at)
     values ($1, $2, $3, $4, $5, $6, now() + interval '${TOKEN_TTL_DAYS} days')
     returning id`,
    [userA.id, userB.id, input.cardA, input.cardB, tokenA, tokenB],
  )
  const id = rows[0]!.id

  for (const [user, card, token] of [
    [userA, input.cardA, tokenA],
    [userB, input.cardB, tokenB],
  ] as const) {
    // Channels are independent, absence just skips (M9d rides the email
    // pattern); no channel at all = the agent surfaces the intro in-session.
    const base = `${appUrl()}/intro/${token}`
    if (user.email) {
      await sendEmail({ to: user.email, ...introCard(card, base) })
    }
    // Telegram DM lands on a lock screen: intro-waiting text only, never the card.
    if (user.telegram_chat_id) {
      await notifyTelegram({ chatId: user.telegram_chat_id, text: tgIntroWaiting(base) })
    }
  }
  await logEvent({ type: 'intro_proposed', metadata: { intro_id: id } })
  return { id }
}

// M8: 'held' (awaiting review) and 'vetoed' (review said no) intros are
// excluded HERE, in the lookup — their tokens resolve to nothing, so to the
// target they are mechanically indistinguishable from never having existed.
export async function findIntroByToken(
  token: string,
): Promise<{ intro: IntroRow; side: 'a' | 'b' } | null> {
  const { rows } = await getDb().query<IntroRow>(
    "select * from intros where (token_a = $1 or token_b = $1) and status not in ('held', 'vetoed')",
    [token],
  )
  const intro = rows[0]
  if (!intro) return null
  return { intro, side: intro.token_a === token ? 'a' : 'b' }
}

// What this side is allowed to see. Renders ONLY from own response + reveal
// state — a decline by the other side is indistinguishable from waiting.
export type IntroView = 'expired' | 'card' | 'waiting' | 'revealed' | 'closed'

export function viewFor(intro: IntroRow, side: 'a' | 'b'): IntroView {
  const own = side === 'a' ? intro.a_response : intro.b_response
  if (intro.status === 'revealed') return 'revealed'
  if (own === 'declined') return 'closed'
  if (own === 'accepted') return 'waiting'
  if (new Date(intro.token_expires_at).getTime() < Date.now()) return 'expired'
  return 'card'
}

// Within a revealed intro, whose turn is it for THIS side? The whole lifecycle
// is derivable from the last message's side — no read-receipts, no unread flags
// (reveal-handoff.md §2). "Ball in this side's court" = say-hello OR your-turn.
//   say-hello  — thread empty; either side may open
//   your-turn  — the latest message is the OTHER side's (a reply is waiting)
//   their-turn — the latest message is this side's (nothing to do)
export type ThreadTurn = 'say-hello' | 'your-turn' | 'their-turn'

export function threadTurn(messages: IntroMessage[], side: 'a' | 'b'): ThreadTurn {
  const latest = messages[messages.length - 1]
  if (!latest) return 'say-hello'
  return latest.side === side ? 'their-turn' : 'your-turn'
}

// Records a response. Returns the view this side should now see.
// Reveal fires only on the second accept; declines write nothing anywhere else
// and send nothing to anyone (trust rule 4).
export async function respondToIntro(
  token: string,
  response: 'accepted' | 'declined',
): Promise<{ view: IntroView } | null> {
  const db = getDb()
  const found = await findIntroByToken(token)
  if (!found) return null
  const { intro, side } = found

  const current = viewFor(intro, side)
  if (current !== 'card') return { view: current } // resolved/expired: no-op, idempotent

  const col = side === 'a' ? 'a_response' : 'b_response'
  const at = side === 'a' ? 'a_responded_at' : 'b_responded_at'
  await db.query(
    `update intros set ${col} = $1, ${at} = now() where id = $2 and ${col} is null`,
    [response, intro.id],
  )
  await logEvent({
    type: response === 'accepted' ? 'intro_accepted' : 'intro_declined',
    userId: side === 'a' ? intro.user_a : intro.user_b,
    metadata: { intro_id: intro.id, side },
  })

  const fresh = (await db.query<IntroRow>('select * from intros where id = $1', [intro.id])).rows[0]!

  if (response === 'declined') {
    await db.query(
      `update intros set status = 'declined', resolved_at = now() where id = $1`,
      [intro.id],
    )
    return { view: 'closed' }
  }

  const other = side === 'a' ? fresh.b_response : fresh.a_response
  if (other === 'accepted' && fresh.status === 'proposed') {
    // Atomic flip: concurrent double-accepts both reach here, but only the one
    // that wins this conditional update sends notices / logs the reveal —
    // otherwise duplicate emails and a double-counted gate metric.
    const flip = await db.query(
      `update intros set status = 'revealed', resolved_at = now() where id = $1 and status = 'proposed' returning id`,
      [intro.id],
    )
    if (flip.rows.length === 1) {
      await sendRevealNotices(fresh)
      await logEvent({ type: 'intro_revealed', metadata: { intro_id: intro.id } })
    }
    return { view: 'revealed' }
  }
  return { view: 'waiting' }
}

// v1.1: reveal emails carry NO identity and NO contact details — they only
// point each person back to their own intro page, where the two of them
// exchange whatever contact info they choose. The platform never transmits
// contact details on anyone's behalf.
async function sendRevealNotices(intro: IntroRow): Promise<void> {
  const db = getDb()
  const sides = [
    { userId: intro.user_a, token: intro.token_a },
    { userId: intro.user_b, token: intro.token_b },
  ]
  const ids = sides.map((s) => s.userId).filter((x): x is string => x !== null)
  if (ids.length < 2) return // a party deleted their account mid-intro; close silently
  const { rows } = await db.query<{
    id: string
    email: string | null
    telegram_chat_id: string | null
    display_name: string | null
    handle: string | null
  }>('select id, email, telegram_chat_id, display_name, handle from users where id = any($1)', [ids])
  for (const [i, side] of sides.entries()) {
    const user = rows.find((u) => u.id === side.userId)
    if (!user) continue
    const url = `${appUrl()}/intro/${side.token}`
    if (user.email) {
      // Email carries no identity (unauthenticated, forwardable) — see above.
      await sendEmail({ to: user.email, ...revealNotice(url) })
    }
    if (user.telegram_chat_id) {
      // Post-mutual-yes the counterpart's reveal name is allowed (M9d spec);
      // same fallback chain as the reveal page: display_name → handle → none.
      const other = rows.find((u) => u.id === sides[1 - i]!.userId)
      const name = other ? (other.display_name ?? other.handle ?? null) : null
      await notifyTelegram({ chatId: user.telegram_chat_id, text: tgRevealNotice(url, name) })
    }
  }
}

// M8: the intro thread (replaces the v1.1 single contact field). Messages are
// person-to-person; contact details shared inside them are the sender's free
// choice. HARD RULE, enforced here and regression-pinned: a message can only
// ever be written to a REVEALED intro — no cold-messaging surface can exist.
export async function postIntroMessage(
  token: string,
  body: string,
  // M9b: attributes a reconnect message to the ask that motivated it (contract:
  // api-contract-m9b.md). Must be the POSTING user's own OPEN ask — anything
  // else rejects the whole post, loudly, so the CIRCLE metric stays honest.
  askId?: string,
): Promise<{ view: IntroView; posted: boolean; badAsk?: true } | null> {
  const found = await findIntroByToken(token)
  if (!found) return null
  const { intro, side } = found
  const view = viewFor(intro, side)
  if (view !== 'revealed') return { view, posted: false }

  const senderId = side === 'a' ? intro.user_a : intro.user_b
  if (!senderId) return { view, posted: false } // sender deleted their account

  if (askId !== undefined) {
    const ask = await getDb().query(
      "select 1 from asks where id = $1 and user_id = $2 and status = 'open'",
      [askId, senderId],
    )
    if (!ask.rows[0]) return { view, posted: false, badAsk: true }
  }

  // Read the thread BEFORE inserting: the previous latest message decides both
  // the completion event and whether this crosses the ball into the other court.
  const before = await getIntroMessages(intro.id)
  const otherSide = side === 'a' ? 'b' : 'a'
  const prevLatest = before[before.length - 1]
  const myPriorCount = before.filter((m) => m.side === side).length
  const otherPriorCount = before.filter((m) => m.side === otherSide).length

  await getDb().query(
    'insert into intro_messages (intro_id, sender_id, side, body) values ($1, $2, $3, $4)',
    [intro.id, senderId, side, body],
  )
  // Event name per reveal-handoff §8 (matches the Product lane's standard).
  await logEvent({
    type: 'message_sent',
    userId: senderId,
    metadata: { intro_id: intro.id, side },
  })

  // thread_connected = gate metric 4 (both sides messaged ≥1). Fires exactly
  // once: on the message that first makes this side's count ≥1 while the other
  // side already has ≥1. pnpm metrics counts this event (reveal-handoff.md §8).
  if (myPriorCount === 0 && otherPriorCount >= 1) {
    await logEvent({ type: 'thread_connected', metadata: { intro_id: intro.id } })
  }

  // The anti-nag rule (reveal-handoff.md §6): email the other side only when
  // the ball CROSSES into their court — i.e. their own message was the previous
  // latest and this one answers it. The first hello (empty thread) is covered
  // by revealNotice; consecutive messages from the same side never re-nudge.
  // M9b gate exception (CTO, 2026-07-12): a reconnect (askId present) is a NEW
  // knock carrying a new ask, not a consecutive nag — in a dormant thread the
  // reconnector's own message is usually the latest, and without this the
  // reconnect is silent to an email-only counterpart (the exact unnoticed-
  // intro failure M9d exists to fix). The reconnect tool promises "notified
  // the normal way"; this makes that true.
  if ((prevLatest && prevLatest.side === otherSide) || askId !== undefined) {
    await notifyMessageWaiting(intro, otherSide)
  }

  // M9b: the reconnect landed in the existing thread — count the circle.
  if (askId !== undefined) {
    await logEvent({
      type: 'rematch_reconnected',
      userId: senderId,
      metadata: { intro_id: intro.id, ask_id: askId, side },
    })
  }

  return { view: 'revealed', posted: true }
}

// Identity-free knock: the message body lives on the page, never in the mail.
// No email on file → the user hears it in-session (GET /api/intros/pending).
async function notifyMessageWaiting(intro: IntroRow, targetSide: 'a' | 'b'): Promise<void> {
  const targetId = targetSide === 'a' ? intro.user_a : intro.user_b
  const targetToken = targetSide === 'a' ? intro.token_a : intro.token_b
  if (!targetId) return
  const { rows } = await getDb().query<{ email: string | null; telegram_chat_id: string | null }>(
    'select email, telegram_chat_id from users where id = $1',
    [targetId],
  )
  const target = rows[0]
  if (!target) return
  const url = `${appUrl()}/intro/${targetToken}`
  if (target.email) await sendEmail({ to: target.email, ...messageWaiting(url) })
  // Identity-free like the email: "a message is waiting", never the body or a name.
  if (target.telegram_chat_id) {
    await notifyTelegram({ chatId: target.telegram_chat_id, text: tgMessageWaiting(url) })
  }
}

export async function getIntroMessages(introId: string): Promise<IntroMessage[]> {
  const { rows } = await getDb().query<IntroMessage>(
    'select id, side, body, created_at from intro_messages where intro_id = $1 order by seq asc',
    [introId],
  )
  return rows
}

// ---------------------------------------------------------------------------
// M8 seed-phase review (T6). Matthew's one-click quality floor: agent
// proposals sit in 'held' until approved (→ 'proposed', the target is told)
// or vetoed (→ 'vetoed', silent). Only what the REVIEWER needs is surfaced:
// the exact card the target would see, plus why_for_me for judging intent —
// never the proposer's identity fields.
// ---------------------------------------------------------------------------

export interface HeldProposal {
  id: string
  created_at: string | Date
  card_b: string // exactly what the target will see if approved
  why_for_me: string | null // calibration/intent signal, review-only
}

export async function listHeldProposals(): Promise<HeldProposal[]> {
  const { rows } = await getDb().query<HeldProposal>(
    `select i.id, i.created_at, i.card_b,
       (select e.metadata->>'why_for_me' from events e
         where e.type = 'intro_proposal_held' and e.metadata->>'intro_id' = i.id::text
         limit 1) as why_for_me
     from intros i
     where i.status = 'held' and i.token_expires_at > now()
     order by i.created_at asc`,
  )
  return rows
}

// Approve: the intro becomes a standard 'proposed' — the target gets their
// card (email if on file; otherwise their agent surfaces it via pending).
// The proposer is told nothing here: they already accepted by proposing, and
// their next signal is the reveal, if it ever comes.
export async function approveProposal(id: string): Promise<boolean> {
  const db = getDb()
  const { rows } = await db.query<{ id: string; user_b: string | null; card_b: string; token_b: string }>(
    `update intros set status = 'proposed' where id = $1 and status = 'held' and token_expires_at > now()
     returning id, user_b, card_b, token_b`,
    [id],
  )
  const intro = rows[0]
  if (!intro) return false
  if (intro.user_b) {
    const target = await db.query<{ email: string | null; telegram_chat_id: string | null }>(
      'select email, telegram_chat_id from users where id = $1',
      [intro.user_b],
    )
    const url = `${appUrl()}/intro/${intro.token_b}`
    const email = target.rows[0]?.email
    if (email) {
      await sendEmail({ to: email, ...introCard(intro.card_b, url) })
    }
    const chatId = target.rows[0]?.telegram_chat_id
    if (chatId) {
      // Lock-screen rule: the DM says an introduction waits — the card stays on the page.
      await notifyTelegram({ chatId, text: tgIntroWaiting(url) })
    }
  }
  await logEvent({ type: 'intro_proposed', metadata: { intro_id: id, via: 'agent_approved' } })
  return true
}

// Veto: silent, total. Status 'vetoed' keeps both tokens resolving to nothing
// (findIntroByToken) and the row out of pending — to the target it never
// existed; to the proposer it is indistinguishable from a decline (waiting,
// forever). Nothing is sent to anyone.
export async function vetoProposal(id: string): Promise<boolean> {
  const { rows } = await getDb().query<{ id: string }>(
    `update intros set status = 'vetoed', resolved_at = now() where id = $1 and status = 'held'
     returning id`,
    [id],
  )
  if (!rows[0]) return false
  await logEvent({ type: 'intro_vetoed', metadata: { intro_id: id } })
  return true
}

// The reveal page shows a PERSON: the counterpart's display name (PII store,
// never in the pool/card) with the fallback chain display_name → handle → none
// (reveal-handoff.md §3). ownEmail drives only the no-email copy — the page
// reads its own email, never the other's, and never puts it in a message.
export interface RevealParties {
  counterpartName: string | null
  ownEmail: string | null
}

export async function getRevealParties(intro: IntroRow, side: 'a' | 'b'): Promise<RevealParties> {
  const ownId = side === 'a' ? intro.user_a : intro.user_b
  const otherId = side === 'a' ? intro.user_b : intro.user_a
  const ids = [ownId, otherId].filter((x): x is string => x !== null)
  if (ids.length === 0) return { counterpartName: null, ownEmail: null }
  const { rows } = await getDb().query<{
    id: string
    email: string | null
    handle: string | null
    display_name: string | null
  }>('select id, email, handle, display_name from users where id = any($1)', [ids])
  const own = rows.find((r) => r.id === ownId)
  const other = rows.find((r) => r.id === otherId)
  return {
    counterpartName: other ? (other.display_name ?? other.handle ?? null) : null,
    ownEmail: own?.email ?? null,
  }
}
