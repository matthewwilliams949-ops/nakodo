// M9d tier 1 — the notification doorbell. Exactly two duties: show a push,
// open its page on click. No fetch handler, no caching, no analytics.
// Payload contract (api-contract-m9d-push.md): { title, body, url } — the
// lock-screen rule is enforced server-side; a payload that fails to parse
// falls back to a generic knock rather than crashing into silence.

self.addEventListener('push', (event) => {
  let payload = null
  try {
    payload = event.data ? event.data.json() : null
  } catch {
    payload = null
  }
  const title = (payload && payload.title) || 'Nakodo'
  const body = (payload && payload.body) || 'Something is waiting for you.'
  const url = (payload && payload.url) || self.location.origin
  event.waitUntil(
    self.registration.showNotification(title, { body, data: { url } }),
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || self.location.origin
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((tabs) => {
      const open = tabs.find((t) => t.url === url)
      return open ? open.focus() : clients.openWindow(url)
    }),
  )
})
