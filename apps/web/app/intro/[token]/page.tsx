import { findIntroByToken, viewFor } from '../../../lib/intros'

export const dynamic = 'force-dynamic'

// The accept/decline page — reached from an agent's in-session notice or the
// optional notification email. Renders ONLY from this side's own state — a
// decline by the other party is indistinguishable from waiting (trust rule 4).
// After mutual accept it becomes the connection surface: the two people
// exchange contact details here, themselves; nothing is sent on their behalf.
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
        <p className="muted">Intro links are live for two weeks. If the match is still right, it will come around again.</p>
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
        <p className="muted">If they say yes too, this page becomes your connection — your agent will let you know. If not, you&apos;ll never hear about this again — silence is normal here.</p>
      </main>
    )
  }

  if (view === 'revealed') {
    const ownContact = side === 'a' ? intro.a_contact : intro.b_contact
    const theirContact = side === 'a' ? intro.b_contact : intro.a_contact
    return (
      <main>
        <h1>You both said yes</h1>
        <div className="card">
          <p>{card}</p>
        </div>
        {theirContact ? (
          <p>
            They left you this: <strong>{theirContact}</strong>
          </p>
        ) : (
          <p className="muted">They haven&apos;t left contact details yet — check back, or leave yours first.</p>
        )}
        <form method="post" action={`/api/intro/${token}`}>
          <input
            name="contact"
            maxLength={300}
            defaultValue={ownContact ?? ''}
            placeholder="How should they reach you? Email, X, Discord — whatever you're comfortable with."
          />
          <div className="actions">
            <button className="accept" type="submit">
              {ownContact ? 'Update what they see' : 'Leave it for them'}
            </button>
          </div>
        </form>
        <p className="muted">
          Contact details are exchanged only here, only by the two of you. Nothing is ever sent on your behalf.
        </p>
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
