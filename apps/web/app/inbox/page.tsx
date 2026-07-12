import type { Metadata } from 'next'
import { cookies } from 'next/headers'
import { sessionUser } from '../../lib/session'
import { inboxData, type PersonItem } from '../../lib/inbox'
import { logEvent } from '../../lib/events'

export const dynamic = 'force-dynamic'

// Capability-gated, never discoverable — same noindex belt as the intro page.
export const metadata: Metadata = {
  robots: { index: false, follow: false },
}

// /inbox — the logged-in home (M9c). Matthew's framing: your people threads,
// listed by last updated, with the few things needing a decision above them.
// A DESK, not a feed (design brief): only your own correspondence — people you
// mutually said yes to, and introductions proposed to you. No strangers, no
// declines (invisible, always), no counts to chase, no input fields (the thread
// composer stays the only free-text surface). The only bright thing on the page
// is a person, or an introduction landing.

function formatDay(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function turnLabel(turn: PersonItem['turn']): string {
  return turn === 'their-turn' ? 'their turn' : turn === 'your-turn' ? 'your turn' : 'say hello'
}

export default async function InboxPage() {
  const user = await sessionUser(await cookies())

  if (!user) {
    // Signed-out: agent-ward, NO input fields — a login form here would rebuild
    // the v1.1 flinch on a sign-in screen. Trust's real /auth lapsed-link page
    // will show this same sentence.
    return (
      <main>
        <p className="inbox-label">your inbox</p>
        <h1>This page opens with a key from your agent.</h1>
        <p className="muted">
          Ask it — <em>&quot;sign me in to nakodo&quot;</em> — and it hands you a one-click link. If you left an
          email, the sign-in links in our emails work too. There&apos;s no password, because there&apos;s nothing to
          remember.
        </p>
      </main>
    )
  }

  await logEvent({ type: 'inbox_viewed', userId: user.id })
  const data = await inboxData(user.id)
  const empty =
    data.needsYou.length === 0 && data.people.length === 0 && data.waitingOnThem === 0 && data.asks.length === 0

  return (
    <main>
      <p className="inbox-label">your inbox</p>

      {empty ? (
        <>
          <h1>You&apos;re early.</h1>
          <p className="muted">
            Your profile stands in the pool — it carries no identity, and your agent is the one searching. This page
            fills with people as introductions land, and silence is what most days here look like. That&apos;s the
            design, not a problem.
          </p>
        </>
      ) : (
        <>
          {data.needsYou.length > 0 ? (
            <section className="ibx-section">
              <p className="ibx-head">
                Needs you <span className="ibx-n">· {data.needsYou.length}</span>
              </p>
              {data.needsYou.map((c, i) => (
                <a className="ibx-intro" key={i} href={`${c.url}?from=inbox`}>
                  <span className="ibx-intro-tag">an introduction is waiting</span>
                  <p className="ibx-intro-body">{c.card}</p>
                  <span className="ibx-intro-cta">See the card and decide →</span>
                </a>
              ))}
            </section>
          ) : null}

          <section className="ibx-section">
            <p className="ibx-head">
              Your people {data.people.length > 0 ? <span className="ibx-n">· {data.people.length}</span> : null}
            </p>

            {data.people.length === 0 ? (
              <p className="muted" style={{ margin: 0 }}>
                No one yet — people arrive here after a mutual yes.
              </p>
            ) : (
              <div className="ibx-people">
                {data.people.map((p, i) => (
                  <a className="ibx-person" key={i} href={p.url}>
                    <span className="ibx-name">
                      {p.name ?? 'Someone'}
                      {p.turn === 'your-turn' ? <span className="ibx-dot" title="waiting on you" /> : null}
                      {p.reconnected ? <span className="ibx-recon">reconnected</span> : null}
                    </span>
                    <span className={`ibx-state${p.turn !== 'their-turn' ? ' turn' : ''}`}>{turnLabel(p.turn)}</span>
                    {p.why ? <span className="ibx-why">{p.why}</span> : <span className="ibx-why" />}
                    <span className="ibx-when">{formatDay(p.lastActivity)}</span>
                  </a>
                ))}
              </div>
            )}

            {data.waitingOnThem > 0 ? (
              <div className="ibx-waiting">
                <span>
                  {data.waitingOnThem === 1
                    ? 'One introduction is waiting on their yes'
                    : `${data.waitingOnThem} introductions are waiting on their yes`}{' '}
                  — silence is normal here.
                </span>
              </div>
            ) : null}
          </section>

          <div className="ibx-foot">
            <section>
              <h3>What your agent is searching on</h3>
              {data.asks.length === 0 ? (
                <p className="muted" style={{ margin: 0 }}>
                  No open asks. When something&apos;s missing — a designer&apos;s eye, a second pair of hands — tell
                  your agent.
                </p>
              ) : (
                <div className="ibx-asks">
                  {data.asks.map((a, i) => (
                    <span className="ibx-ask" key={i}>
                      {a.need}
                    </span>
                  ))}
                </div>
              )}
            </section>

            <section>
              <h3>How you hear about a person</h3>
              <div className="ibx-channels">
                <span className={`ibx-chan${data.channels.email ? ' on' : ''}`}>
                  <span className="led" />
                  {data.channels.email ? 'email' : 'email — not set'}
                </span>
                <span className={`ibx-chan${data.channels.telegram ? ' on' : ''}`}>
                  <span className="led" />
                  {data.channels.telegram ? 'telegram' : 'telegram — not connected'}
                </span>
              </div>
              <p className="muted" style={{ fontSize: '0.8rem', margin: '0.5rem 0 0' }}>
                Your agent connects a channel — so a person reaching you is never missed.
              </p>
            </section>

            <section>
              <h3>Your record</h3>
              <p className="muted" style={{ margin: 0 }}>
                {data.record.profileFirst ?? 'Your profile stands in the pool.'} · {data.record.snippetCount}{' '}
                {data.record.snippetCount === 1 ? 'snippet' : 'snippets'} on record — what agents match you on, never
                your identity.
              </p>
            </section>

            <section>
              <h3>Leaving</h3>
              <p className="muted" style={{ margin: 0 }}>
                <strong style={{ color: 'var(--fg)', fontWeight: 500 }}>One command deletes everything.</strong> Ask
                your agent any time — your people, your record, every trace. No confirmation email, no retention grace.
              </p>
            </section>
          </div>
        </>
      )}
    </main>
  )
}
