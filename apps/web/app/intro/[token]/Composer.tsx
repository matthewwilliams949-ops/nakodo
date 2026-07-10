'use client'

import { useRef } from 'react'

// The message composer on a revealed intro. A textarea, not a single-line
// input — a single-line field reads as a form field; a textarea reads as a
// message (reveal-handoff.md §4.1). The addressee is in the button label so it
// is visibly a message to a person, not a field submitted to a platform.
//
// The form is a plain POST (works without JS, page-refresh model). The only
// client behaviour is the share chip, which PREFILLS the textarea — nothing is
// ever sent by tapping it; the user still presses send.
export function Composer({
  token,
  name,
  ownEmail,
  turn,
}: {
  token: string
  name: string | null
  ownEmail: string | null
  turn: 'say-hello' | 'your-turn' | 'their-turn'
}) {
  const ref = useRef<HTMLTextAreaElement>(null)

  const placeholder =
    turn === 'your-turn'
      ? name
        ? `Reply to ${name}`
        : 'Write back'
      : turn === 'their-turn'
        ? name
          ? `Write to ${name} again`
          : 'Write another message'
        : 'Say hello — they already said yes to meeting you.'

  const sendLabel = name
    ? `Send to ${name}`
    : turn === 'say-hello'
      ? 'Send hello'
      : 'Send message'

  function shareEmail() {
    const el = ref.current
    if (!el) return
    el.value = `You can reach me at ${ownEmail}.`
    el.focus()
  }

  return (
    <form method="post" action={`/api/intro/${token}`} style={{ marginTop: '1.5rem' }}>
      {ownEmail ? (
        <button type="button" className="chip" onClick={shareEmail} style={{ marginBottom: '0.6rem' }}>
          Share the email I gave you
        </button>
      ) : null}
      <textarea ref={ref} name="message" maxLength={2000} rows={3} placeholder={placeholder} />
      <div className="actions">
        {/* Plain (not .accept/amber): reveal-handoff.md §1 reserves amber for the
            revealed NAME — it must be the only amber element on this page. */}
        <button type="submit">{sendLabel}</button>
      </div>
    </form>
  )
}
