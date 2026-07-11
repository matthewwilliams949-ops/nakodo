// Admin feedback digest (M9-0). Run: pnpm feedback
// The ONLY read surface for the feedback table — feedback is internal
// (read by the humans building Nakodo), never displayed to users or agents,
// never used for matching. Bodies print here and nowhere else.
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set — copy .env.example to .env (SETUP-ACCOUNTS.md).')
  process.exit(1)
}

const client = new pg.Client({ connectionString: url })
await client.connect()
try {
  const totals = await client.query<{ moment: string; sentiment: string; n: number }>(
    'select moment, sentiment, count(*)::int as n from feedback group by moment, sentiment order by moment, sentiment',
  )
  if (totals.rows.length === 0) {
    console.log('No feedback yet.')
  } else {
    console.log('Feedback by moment × sentiment:')
    for (const r of totals.rows) console.log(`  ${r.moment.padEnd(14)} ${r.sentiment.padEnd(9)} ${r.n}`)

    const recent = await client.query<{ moment: string; sentiment: string; body: string; created_at: Date }>(
      'select moment, sentiment, body, created_at from feedback order by created_at desc limit 30',
    )
    console.log(`\nLatest ${recent.rows.length}:`)
    for (const r of recent.rows) {
      console.log(`\n[${r.created_at.toISOString().slice(0, 10)}] ${r.moment} · ${r.sentiment}`)
      console.log(`  ${r.body.split('\n').join('\n  ')}`)
    }
  }
} finally {
  await client.end()
}
