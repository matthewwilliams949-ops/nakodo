import { cookies } from 'next/headers'
import { sessionUser } from '../../lib/session'
import { inboxData, type NeedsYouItem } from '../../lib/inbox'
import { logEvent } from '../../lib/events'

export const dynamic = 'force-dynamic'

// /inbox — the product's first persistent human surface (M9c). A DESK, not a
// feed (design brief §1): you come to act or to check your standing; it never
// manufactures a reason to return and is at peace with being empty. The
// anti-feed contract (§6) is load-bearing: no counts, no badges, no state in
// the chrome, no activity of other humans, nothing finer than the day, and the
// only free-text input in the whole product stays the thread composer — this
// page has NO input fields, ever (a login form here would rebuild the v1.1
// flinch on a sign-in screen).

function formatDay(d: string | Date): string {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function NeedsYouRow({ item }: { item: NeedsYouItem }) {
  if (item.kind === 'card') {
    // An anonymous card awaiting an answer — amber-edged like everywhere.
    return (
      <a className="row-link" href={`${item.url}?from=inbox`}>
        <div className="card">
          <p style={{ margin: 0 }}>{item.card}</p>
        </div>
      </a>
    )
  }
  if (item.kind === 'say_hello') {
    return (
      <a className="row-link" href={`${item.url}?from=inbox`}>
        <div className="msg">
          <p className="msg-meta">
            {item.name ? <strong className="person">{item.name}</strong> : <strong>An introduction</strong>} · open
          </p>
          <p style={{ margin: 0 }}>You both said yes — say hello.</p>
        </div>
      </a>
    )
  }
  // message_waiting — their word is the latest
  return (
    <a className="row-link" href={`${item.url}?from=inbox`}>
      <div className="msg">
        <p className="msg-meta">
          {item.name ? <strong className="person">{item.name}</strong> : <strong>They</strong>}
          {item.day ? <> · {formatDay(item.day)}</> : null}
        </p>
        {item.preview ? <p style={{ margin: 0 }}>{item.preview}</p> : null}
      </div>
    </a>
  )
}

export default async function InboxPage() {
  const user = await sessionUser(await cookies())

  if (!user) {
    // Signed-out: agent-ward, NO input fields (brief §4). Points at exactly the
    // sentence Trust's /auth lapsed-link page will show.
    return (
      <main>
        <p className="inbox-label">your inbox</p>
        <h1>This page opens with a key from your agent.</h1>
        <p className="muted">
          Ask it — <em>&quot;sign me in to nakodo&quot;</em> — and it hands you a one-click link. If you left an
          email, the sign-in links in our emails work too. There&apos;s no password, because there&apos;s nothing
          to remember.
        </p>
      </main>
    )
  }

  await logEvent({ type: 'inbox_viewed', userId: user.id })
  const data = await inboxData(user.id)
  const brandNew = data.needsYou.length === 0 && data.asks.length === 0 && data.intros.length === 0

  const recordZone = (
    <section className="zone">
      <h2>Your record</h2>
      <p className="muted" style={{ margin: 0 }}>
        {data.record.profileFirst ?? 'Your profile stands in the pool.'} · {data.record.snippetCount}{' '}
        {data.record.snippetCount === 1 ? 'snippet' : 'snippets'} on record.
      </p>
      <p className="muted" style={{ marginBottom: 0 }}>
        Your agent edits this — and &quot;delete me&quot; removes everything, any time.
      </p>
    </section>
  )

  if (brandNew) {
    return (
      <main>
        <p className="inbox-label">your inbox</p>
        <h1>You&apos;re early.</h1>
        <p className="muted">
          Your profile stands in the pool — it carries no identity, and your agent is the one searching. This
          page only ever fills with introductions, and silence is what most days here look like. That&apos;s the
          design, not a problem.
        </p>
        {recordZone}
      </main>
    )
  }

  return (
    <main>
      <p className="inbox-label">your inbox</p>

      <section className="zone">
        <h2>Needs you</h2>
        {data.needsYou.length === 0 ? (
          <>
            <p className="muted" style={{ margin: 0 }}>Nothing needs you.</p>
            {data.asks.length > 0 ? (
              <p className="muted" style={{ marginBottom: 0 }}>
                Your agent will knock when there&apos;s a person worth your yes.
              </p>
            ) : null}
          </>
        ) : (
          data.needsYou.map((item, i) => <NeedsYouRow key={i} item={item} />)
        )}
      </section>

      <section className="zone">
        <h2>Your asks</h2>
        {data.asks.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>
            No open asks. When something&apos;s missing — a designer&apos;s eye, a second pair of hands — tell your
            agent.
          </p>
        ) : (
          data.asks.map((a, i) => (
            <div key={i} className="msg">
              <p style={{ margin: 0 }}>{a.need}</p>
              <p className="msg-meta" style={{ marginBottom: 0 }}>standing since {formatDay(a.created_at)}</p>
            </div>
          ))
        )}
      </section>

      <section className="zone">
        <h2>Your introductions</h2>
        {data.intros.length === 0 ? (
          <p className="muted" style={{ margin: 0 }}>No introductions yet — they arrive here after a mutual yes.</p>
        ) : (
          data.intros.map((it, i) => (
            <a className="row-link" key={i} href={it.url}>
              <div className="msg">
                <p className="msg-meta" style={{ margin: 0 }}>
                  {it.name ? <strong className="person">{it.name}</strong> : <strong>Introduction</strong>}
                  {it.day ? <> · {formatDay(it.day)}</> : null} ·{' '}
                  {it.turn === 'their-turn' ? 'their turn' : it.turn === 'your-turn' ? 'your turn' : 'say hello'}
                </p>
              </div>
            </a>
          ))
        )}
      </section>

      {recordZone}
    </main>
  )
}
