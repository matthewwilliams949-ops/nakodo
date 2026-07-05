import { getDb } from './db'
import { hashToken } from './tokens'

export interface AuthedUser {
  id: string
  email: string
  handle: string | null
  location: string | null
}

// Bearer token → user, or null. Tokens are stored hashed; a leak of the db
// never leaks credentials.
export async function authenticate(req: Request): Promise<AuthedUser | null> {
  const header = req.headers.get('authorization')
  if (!header?.startsWith('Bearer ')) return null
  const token = header.slice('Bearer '.length).trim()
  if (!token) return null
  const { rows } = await getDb().query<AuthedUser>(
    'select id, email, handle, location from users where token_hash = $1',
    [hashToken(token)],
  )
  return rows[0] ?? null
}

export function unauthorized(): Response {
  return Response.json({ error: 'unauthorized' }, { status: 401 })
}
