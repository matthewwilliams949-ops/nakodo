'use client'

import { useEffect, useState } from 'react'

// M9d tier 1 — the enable-notifications prompt. Appears ONLY on post-decision
// views (waiting: "the moment they say yes" · revealed: "the moment they
// reply") — never beside the accept/pass buttons, so enabling notifications
// can never read as pressure toward accepting. Renders nothing when the
// browser can't push, permission was denied, this device already subscribed,
// or the server didn't pass a VAPID key (channel off).
//
// Quiet by design: one muted line with a plain button. This is a doorbell
// being offered, not a feature being sold.
export function EnableNotifications({
  token,
  vapidKey,
  moment,
}: {
  token: string
  vapidKey: string
  moment: 'waiting' | 'revealed'
}) {
  const [state, setState] = useState<'checking' | 'offer' | 'working' | 'enabled' | 'hidden'>('checking')

  useEffect(() => {
    let cancelled = false
    void (async () => {
      if (!('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission === 'denied') {
        if (!cancelled) setState('hidden')
        return
      }
      const reg = await navigator.serviceWorker.getRegistration()
      const sub = await reg?.pushManager.getSubscription()
      if (!cancelled) setState(sub ? 'hidden' : 'offer')
    })()
    return () => {
      cancelled = true
    }
  }, [])

  async function enable() {
    setState('working')
    try {
      const reg = await navigator.serviceWorker.register('/sw.js')
      const permission = await Notification.requestPermission()
      if (permission !== 'granted') {
        setState('hidden')
        return
      }
      const sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(vapidKey),
      })
      const res = await fetch(`/api/intro/${token}/push`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      })
      if (!res.ok) throw new Error(`subscribe failed (${res.status})`)
      setState('enabled')
    } catch {
      // A failed enable is a shrug, not an error state — the page and the
      // in-session floor still work; the user can try again on next visit.
      setState('hidden')
    }
  }

  if (state === 'hidden' || state === 'checking') return null
  if (state === 'enabled') {
    return <p className="muted">Done — this device will know the moment something happens.</p>
  }

  return (
    <p className="muted">
      {moment === 'waiting'
        ? 'Want to know the moment they say yes? '
        : 'Want to know the moment they reply? '}
      <button type="button" onClick={() => void enable()} disabled={state === 'working'}>
        {state === 'working' ? 'Enabling…' : 'Notify me on this device'}
      </button>
    </p>
  )
}

// Standard base64url → Uint8Array for the VAPID application server key.
// Built over an explicit ArrayBuffer so the type is a plain (non-shared)
// Uint8Array, which is what pushManager.subscribe's BufferSource wants.
function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  const buffer = new ArrayBuffer(raw.length)
  const out = new Uint8Array(buffer)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
