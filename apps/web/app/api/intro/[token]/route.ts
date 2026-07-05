import { respondToIntro } from '../../../../lib/intros'

// Accepts either a JSON body {"response": "accepted"|"declined"} or an HTML
// form post (field "respond" = accept|decline) from the /intro/[token] page.
export async function POST(
  req: Request,
  { params }: { params: Promise<{ token: string }> },
): Promise<Response> {
  const { token } = await params

  let response: 'accepted' | 'declined' | null = null
  const contentType = req.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const body = (await req.json().catch(() => null)) as { response?: string } | null
    if (body?.response === 'accepted' || body?.response === 'declined') response = body.response
  } else {
    const form = await req.formData().catch(() => null)
    const v = form?.get('respond')
    if (v === 'accept') response = 'accepted'
    if (v === 'decline') response = 'declined'
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
