import type { Metadata } from 'next'
import { findIntroByToken, getIntroMessages, getRevealParties, threadTurn, viewFor } from '../../../lib/intros'
import { logEvent } from '../../../lib/events'
import { Composer } from './Composer'
import { EnableNotifications } from './EnableNotifications'

// M9d tier 1: the public VAPID key is safe to hand the client (public by
// definition). Empty when unset = channel off, and EnableNotifications renders
// nothing without it.
const VAPID_PUBLIC_KEY = process.env.VAPID_PUBLIC_KEY ?? ''

export const dynamic = 'force-dynamic'

// Belt to the next.config X-Robots-Tag braces: a page-level noindex so no
// rendering crawler ever files a token URL. This surface is capability-gated,
// never meant to be discoverable.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// Day precision is all the thread tracks (reveal-handoff.md §4.2) — this is a
// correspondence, not a chat app.
function formatDay(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

// The intro page — reached from an agent's in-session notice or the optional
// notification email. Renders ONLY from this side's own state, so a decline by
// the other party is indistinguishable from waiting (trust rule 4). After a
// mutual yes it becomes the handoff: it must make obvious that a PERSON, not
// the platform, is now on the other side (reveal-handoff.md §1).
export default async function IntroPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ via?: string }>
}) {
  const { token } = await params
  const found = await findIntroByToken(token)

  if (!found) {
    return (
      <main>
        <h1>Nothing here</h1>
        <p className="muted">This link isn&apos;t valid. If you got it from your agent or one of our emails, write to hello@nakodo.dev and a human will sort it out.</p>
      </main>
    )
  }

  const { intro, side } = found
  const view = viewFor(intro, side)
  const card = side === 'a' ? intro.card_a : intro.card_b

  // Seed leading indicator: the moment a card is first SEEN, pre-response —
  // lets metrics split "never noticed the intro" from "saw it, hesitating"
  // (unnoticed intros read as silent declines inside the 14-day window).
  // Fires on every card-state render; metrics takes MIN per (intro, side).
  // Known noise: email-client link prefetchers can trigger it — treat the
  // metric as an upper bound on noticing speed.
  if (view === 'card') {
    // via = which notification channel delivered this view (whitelist — the
    // query string is caller-controlled text, never stored raw).
    const rawVia = (await searchParams).via
    const via =
      rawVia === 'email' || rawVia === 'telegram' || rawVia === 'push' || rawVia === 'session' ? rawVia : undefined
    await logEvent({ type: 'card_viewed', metadata: { intro_id: intro.id, side, ...(via ? { via } : {}) } })
  }

  if (view === 'expired') {
    return (
      <main>
        <h1>This introduction has lapsed</h1>
        <p className="muted">Intro pages stay open for two weeks, and this one has closed quietly — the other person was never told anything. New introductions arrive the same way this one did.</p>
      </main>
    )
  }

  if (view === 'closed') {
    return (
      <main>
        <h1>Closed</h1>
        <p className="muted">You passed on this introduction. The other person will never know it was proposed.</p>
      </main>
    )
  }

  if (view === 'waiting') {
    return (
      <main>
        <h1>You said yes</h1>
        <p className="muted">If they say yes too, this page opens into your introduction — your agent will tell you, and if you left an email, so will we. If not, you&apos;ll never hear about this again — silence is normal here.</p>
        {VAPID_PUBLIC_KEY ? <EnableNotifications token={token} vapidKey={VAPID_PUBLIC_KEY} moment="waiting" /> : null}
      </main>
    )
  }

  if (view === 'revealed') {
    // The yes buys personhood (reveal-handoff.md §1): a name where there was a
    // card, a channel where there was silence. The name is the ONLY amber
    // element on the page. It comes from the PII store — never the card/pool.
    const messages = await getIntroMessages(intro.id)
    const { counterpartName, ownEmail } = await getRevealParties(intro, side)
    const turn = threadTurn(messages, side)

    return (
      <main>
        <h1 className={counterpartName ? undefined : 'glow'}>
          {counterpartName ? (
            <>You both said yes — this is <span className="person">{counterpartName}</span>.</>
          ) : (
            <>You both said yes.</>
          )}
        </h1>

        <p className="muted">The card you said yes to:</p>
        <div className="card recap">
          <p>{card}</p>
        </div>

        {messages.length === 0 ? (
          <p className="thread-empty">No messages yet. Someone goes first.</p>
        ) : (
          <div className="thread">
            {messages.map((m) => {
              const mine = m.side === side
              return (
                <div key={m.id} className="msg">
                  <p className="msg-meta">
                    <strong className={mine ? undefined : 'person'}>
                      {mine ? 'You' : (counterpartName ?? 'They')}
                    </strong>{' '}
                    · {formatDay(m.created_at)}
                  </p>
                  <p className="msg-body" style={{ margin: 0 }}>{m.body}</p>
                </div>
              )
            })}
          </div>
        )}

        {turn === 'their-turn' ? (
          <>
            <p className="muted">
              Sent. {counterpartName ? `${counterpartName} will` : "They'll"} be told a message is
              waiting — by their agent, or by email if they left one.
            </p>
            {ownEmail ? null : (
              <p className="muted">No email on file — your agent will tell you when they write back.</p>
            )}
          </>
        ) : null}

        <Composer token={token} name={counterpartName} turn={turn} />

        {turn === 'say-hello' ? (
          <p className="muted">
            The card&apos;s &quot;why&quot; is your agenda — most introductions start with a 30-minute
            call, or trading a look at what you&apos;re each building and one piece of honest feedback.
          </p>
        ) : null}

        {VAPID_PUBLIC_KEY ? <EnableNotifications token={token} vapidKey={VAPID_PUBLIC_KEY} moment="revealed" /> : null}
      </main>
    )
  }

  return (
    <main>
      <h1>Someone worth meeting</h1>
      <div className="card">
        <p>{card}</p>
      </div>
      <p className="muted">
        They see nothing unless you both say yes. If you pass, they&apos;ll never know this existed.
      </p>
      <form method="post" action={`/api/intro/${token}`}>
        <div className="actions">
          <button className="accept" name="respond" value="accept" type="submit">
            Accept the introduction
          </button>
          <button className="decline" name="respond" value="decline" type="submit">
            Pass
          </button>
        </div>
      </form>
    </main>
  )
}
