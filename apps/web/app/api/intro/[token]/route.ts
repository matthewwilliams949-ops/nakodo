import { respondToIntro, postIntroMessage } from '../../../../lib/intros'

// Accepts from the /intro/[token] page (HTML form) or as JSON:
//   * a response — JSON {"response": "accepted"|"declined"} or form field
//     "respond" = accept|decline
//   * a thread message (only valid once revealed) — JSON {"message": "..."}
//     or form field "message". "contact" is accepted as a legacy alias for
//     the v1.1 contact-share form and becomes a plain message.
//   * M9b: JSON message may carry "ask_id" — attributes a reconnect to the
//     posting user's own open ask (rematch_reconnected event). A bad ask_id
//     rejects the whole post (400): loud, so the CIRCLE metric stays honest.
//     The form path never sends it.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params

  let response: 'accepted' | 'declined' | null = null
  let message: string | null = null
  let askId: string | undefined
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as {
      response?: string
      message?: string
      contact?: string
      ask_id?: string
    } | null
    if (body?.response === 'accepted' || body?.response === 'declined') response = body.response
    const m = body?.message ?? body?.contact
    if (typeof m === 'string' && m.trim()) message = m.trim().slice(0, 2000)
    if (typeof body?.ask_id === 'string' && body.ask_id.trim()) askId = body.ask_id.trim()
  } else {
    const form = await req.formData().catch(() => null)
    const v = form?.get('respond')
    if (v === 'accept') response = 'accepted'
    if (v === 'decline') response = 'declined'
    const m = form?.get('message') ?? form?.get('contact')
    if (typeof m === 'string' && m.trim()) message = m.trim().slice(0, 2000)
  }

  if (message !== null) {
    const result = await postIntroMessage(token, message, askId)
    if (!result) return Response.json({ error: 'not_found' }, { status: 404 })
    if (contentType.includes('application/json')) {
      if (result.badAsk) return Response.json({ error: 'invalid_body', hint: 'ask_id must be an open ask of your own' }, { status: 400 })
      if (!result.posted) return Response.json({ error: 'not_revealed', view: result.view }, { status: 409 })
      return Response.json({ view: result.view, message_sent: true })
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
