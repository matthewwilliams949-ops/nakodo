import { respondToIntro, setContact } from '../../../../lib/intros'

// Accepts from the /intro/[token] page (HTML form) or as JSON:
//   * a response — JSON {"response": "accepted"|"declined"} or form field
//     "respond" = accept|decline
//   * a contact share (only valid once revealed) — JSON {"contact": "..."} or
//     form field "contact"
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params

  let response: 'accepted' | 'declined' | null = null
  let contact: string | null = null
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as { response?: string; contact?: string } | null
    if (body?.response === 'accepted' || body?.response === 'declined') response = body.response
    if (typeof body?.contact === 'string' && body.contact.trim()) contact = body.contact.trim().slice(0, 300)
  } else {
    const form = await req.formData().catch(() => null)
    const v = form?.get('respond')
    if (v === 'accept') response = 'accepted'
    if (v === 'decline') response = 'declined'
    const c = form?.get('contact')
    if (typeof c === 'string' && c.trim()) contact = c.trim().slice(0, 300)
  }

  if (contact !== null) {
    const result = await setContact(token, contact)
    if (!result) return Response.json({ error: 'not_found' }, { status: 404 })
    if (contentType.includes('application/json')) {
      if (result.view !== 'revealed') return Response.json({ error: 'not_revealed', view: result.view }, { status: 409 })
      return Response.json({ view: result.view, contact_saved: true })
    }
    return new Response(null, { status: 303, headers: { location: `/intro/${token}` } })
  }

  if (!response) return Response.json({ error: 'invalid_body' }, { status: 400 })

  const result = await respondToIntro(token, response)
  if (!result) return Response.json({ error: 'not_found' }, { status: 404 })

  if (contentType.includes('application/json')) {
    return Response.json({ view: result.view })
  }
  // Form post: back to the page, which renders the new state.
  return new Response(null, {
    status: 303,
    headers: { location: `/intro/${token}` },
  })
}
