'use client'

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'

// The message composer on a revealed intro. A textarea, not a single-line
// input — a single-line field reads as a form field; a textarea reads as a
// message (reveal-handoff.md §4.1). The addressee is in the button label so it
// is visibly a message to a person, not a field submitted to a platform.
//
// Sends via fetch (JSON) so the thread updates in place — no full page reload.
// The plain-POST form action remains as the no-JS fallback. Cmd/Ctrl+Enter
// sends, as in every mail client.
export function Composer({
  token,
  name,
  turn,
}: {
  token: string
  name: string | null
  turn: 'say-hello' | 'your-turn' | 'their-turn'
}) {
  const ref = useRef<HTMLTextAreaElement>(null)
  const router = useRouter()
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  async function send() {
    const el = ref.current
    const message = el?.value.trim()
    if (!message || sending) return
    setSending(true)
    setError(null)
    try {
      const res = await fetch(`/api/intro/${token}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ message }),
      })
      if (!res.ok) throw new Error(`send failed (${res.status})`)
      if (el) el.value = ''
      router.refresh()
    } catch {
      setError("That didn't send — try again.")
    } finally {
      setSending(false)
    }
  }

  return (
    <form
      method="post"
      action={`/api/intro/${token}`}
      style={{ marginTop: '1.5rem' }}
      onSubmit={(e) => {
        e.preventDefault()
        void send()
      }}
    >
      <textarea
        ref={ref}
        name="message"
        maxLength={2000}
        rows={3}
        placeholder={placeholder}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
            e.preventDefault()
            void send()
          }
        }}
      />
      <div className="actions">
        {/* Plain (not .accept/amber): reveal-handoff.md §1 reserves amber for the
            revealed NAME — it must be the only amber element on this page. */}
        <button type="submit" disabled={sending}>
          {sending ? 'Sending…' : sendLabel}
        </button>
      </div>
      {error ? <p className="muted">{error}</p> : null}
    </form>
  )
}
