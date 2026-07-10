import { findIntroByToken, getIntroMessages, getRevealParties, threadTurn, viewFor } from '../../../lib/intros'
import { Composer } from './Composer'

export const dynamic = 'force-dynamic'

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
export default async function IntroPage({ params }: { params: Promise<{ token: string }> }) {
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
        <h1>
          {counterpartName ? (
            <>You both said yes — this is <span className="reveal-name">{counterpartName}</span>.</>
          ) : (
            <>You both said yes.</>
          )}
        </h1>

        <p className="muted recap-label">The card you said yes to:</p>
        <div className="card recap">
          <p>{card}</p>
        </div>

        {messages.length === 0 ? (
          <p className="muted thread-empty">No messages yet. Someone goes first.</p>
        ) : (
          <div className="thread">
            {messages.map((m) => {
              const mine = m.side === side
              return (
                <div key={m.id} className="msg">
                  <p className="msg-meta">
                    <strong className={mine ? undefined : 'reveal-name'}>
                      {mine ? 'You' : (counterpartName ?? 'They')}
                    </strong>{' '}
                    · {formatDay(m.created_at)}
                  </p>
                  <p className="msg-body">{m.body}</p>
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

        <Composer token={token} name={counterpartName} ownEmail={ownEmail} turn={turn} />

        <p className="muted reassure">
          This thread is between you two — it never touches matching, and no one else ever sees it.
          Contact details are shared only if and when you write them yourself. This page doesn&apos;t
          expire.
        </p>

        {turn === 'say-hello' ? (
          <p className="muted">
            The card&apos;s &quot;why&quot; is your agenda — most introductions start with a 30-minute
            call, or trading a look at what you&apos;re each building and one piece of honest feedback.
          </p>
        ) : null}
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
