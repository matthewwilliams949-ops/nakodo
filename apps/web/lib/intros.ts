import { getDb } from './db'
import { generateToken } from './tokens'
import { sendEmail } from './email'
import { logEvent } from './events'
import { introCard, reveal } from '../emails/templates'

const TOKEN_TTL_DAYS = 14

export interface IntroRow {
  id: string
  user_a: string | null
  user_b: string | null
  card_a: string
  card_b: string
  a_response: 'accepted' | 'declined' | null
  b_response: 'accepted' | 'declined' | null
  status: 'proposed' | 'revealed' | 'declined'
  token_a: string
  token_b: string
  token_expires_at: string | Date
}

function appUrl(): string {
  return (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
}

// Concierge entry point (used by scripts/send-intro.ts and tests): creates the
// intro row and emails both anonymous cards with tokenized accept/decline links.
export async function createIntro(input: {
  userAEmail: string
  userBEmail: string
  cardA: string // shown TO user A, describes user B
  cardB: string
}): Promise<{ id: string }> {
  const db = getDb()
  const users = (
    await db.query<{ id: string; email: string }>(
      'select id, email from users where email = any($1)',
      [[input.userAEmail, input.userBEmail]],
    )
  ).rows
  const userA = users.find((u) => u.email === input.userAEmail)
  const userB = users.find((u) => u.email === input.userBEmail)
  if (!userA || !userB) throw new Error('both users must exist (by email)')

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
    const base = `${appUrl()}/intro/${token}`
    const mail = introCard(card, `${base}?respond=accept`, `${base}?respond=decline`)
    await sendEmail({ to: user.email, ...mail })
  }
  await logEvent({ type: 'intro_proposed', metadata: { intro_id: id } })
  return { id }
}

export async function findIntroByToken(
  token: string,
): Promise<{ intro: IntroRow; side: 'a' | 'b' } | null> {
  const { rows } = await getDb().query<IntroRow>(
    'select * from intros where token_a = $1 or token_b = $1',
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
    await db.query(
      `update intros set status = 'revealed', resolved_at = now() where id = $1`,
      [intro.id],
    )
    await sendRevealEmails(fresh)
    await logEvent({ type: 'intro_revealed', metadata: { intro_id: intro.id } })
    return { view: 'revealed' }
  }
  return { view: 'waiting' }
}

async function sendRevealEmails(intro: IntroRow): Promise<void> {
  const db = getDb()
  const ids = [intro.user_a, intro.user_b].filter((x): x is string => x !== null)
  if (ids.length < 2) return // a party deleted their account mid-intro; close silently
  const { rows } = await db.query<{ id: string; email: string; handle: string | null }>(
    'select id, email, handle from users where id = any($1)',
    [ids],
  )
  const a = rows.find((u) => u.id === intro.user_a)
  const b = rows.find((u) => u.id === intro.user_b)
  if (!a || !b) return
  const nameOf = (u: { email: string; handle: string | null }) => u.handle ?? u.email
  // card_a described B to A, so A's reveal names B alongside that same card
  await sendEmail({ to: a.email, ...reveal(nameOf(b), b.email, intro.card_a) })
  await sendEmail({ to: b.email, ...reveal(nameOf(a), a.email, intro.card_b) })
}
