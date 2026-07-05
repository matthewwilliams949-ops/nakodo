import { findIntroByToken, viewFor } from '../../../lib/intros'

export const dynamic = 'force-dynamic'

// The accept/decline page linked from the anonymous-card email. Renders ONLY
// from this side's own state — a decline by the other party is
// indistinguishable from waiting (trust rule 4).
export default async function IntroPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  const found = await findIntroByToken(token)

  if (!found) {
    return (
      <main>
        <h1>Nothing here</h1>
        <p className="muted">This link isn&apos;t valid. If you got it from one of our emails, reply to that email and a human will sort it out.</p>
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
        <p className="muted">If they say yes too, you&apos;ll both get an email with names. If not, you&apos;ll never hear about this again — silence is normal here.</p>
      </main>
    )
  }

  if (view === 'revealed') {
    return (
      <main>
        <h1>You both said yes</h1>
        <p className="muted">Check your inbox — the introduction email with their name is on its way (or already there).</p>
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
