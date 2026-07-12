import pg from 'pg'

// Minimal query interface satisfied by both pg.Pool (prod) and PGlite (tests).
export interface DbClient {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>
}

let db: DbClient | null = null

// Tests inject a PGlite-backed client here.
export function setDb(client: DbClient): void {
  db = client
}

export function getDb(): DbClient {
  if (!db) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL is not set')
    // max 1 (CTO ruling, 2026-07-12, after the 09:10 client-slot incident):
    // Supabase's session-mode pooler caps at 15 clients and N warm Vercel
    // instances × max 3 ate it. Handlers are single-query (the rare
    // Promise.all serializes harmlessly), so 1 per instance + the
    // transaction-mode pooler (port 6543, multiplexes server-side) is the
    // capacity fix. PG_POOL_MAX exists for measured retuning, not vibes.
    const pool = new pg.Pool({ connectionString: url, max: Number(process.env.PG_POOL_MAX ?? 1) })
    db = {
      query: async <T>(text: string, params?: unknown[]) => {
        const res = await pool.query(text, params as unknown[])
        return { rows: res.rows as T[] }
      },
    }
  }
  return db
}
