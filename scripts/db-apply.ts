// Applies db/schema.sql to DATABASE_URL. Idempotent (schema is IF NOT EXISTS).
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set — copy .env.example to .env and fill it (SETUP-ACCOUNTS.md step 4).')
  process.exit(1)
}

const schema = readFileSync(join(import.meta.dirname, '..', 'db', 'schema.sql'), 'utf8')
const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  await client.query(schema)
  const { rows } = await client.query(
    "select table_name from information_schema.tables where table_schema = 'public' order by table_name",
  )
  console.log('Schema applied. Tables:', rows.map((r) => r.table_name).join(', '))
} finally {
  await client.end()
}
