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
    const pool = new pg.Pool({ connectionString: url, max: 3 })
    db = {
      query: async <T>(text: string, params?: unknown[]) => {
        const res = await pool.query(text, params as unknown[])
        return { rows: res.rows as T[] }
      },
    }
  }
  return db
}
