import { authenticate, unauthorized } from '../../../lib/auth'
import { getDb } from '../../../lib/db'
import { logEvent } from '../../../lib/events'

// GET /api/pool — the whole anonymous pool for the caller's agent to judge
// in-context (contract: documentation/api-contract-m8.md). v1 is deliberately
// algorithm-free: no params, no ranking, no pagination (N < 50).
//
// THE INVARIANT (guarantee 2, regression-pinned): this response is assembled
// ONLY from profiles + snippets. The query below never selects a users column;
// if a field you want lives on users, the answer is no.
//
// The access log doubles as the rate limiter: a fetch that isn't logged can't
// happen, and the log is what the limit is computed from.

const HOURLY_LIMIT = 10
const DAILY_LIMIT = 40
const SNIPPETS_PER_CARD = 5

export async function GET(req: Request): Promise<Response> {
  const user = await authenticate(req)
  if (!user) return unauthorized()
  const db = getDb()

  // Search follows a declared need — no open ask, no pool (anti-scrape floor).
  const ask = await db.query(
    "select 1 from asks where user_id = $1 and status = 'open' limit 1",
    [user.id],
  )
  if (!ask.rows[0]) {
    return Response.json(
      { error: 'no_open_ask', hint: "Declare what you're looking for first — search follows a need." },
      { status: 403 },
    )
  }

  const usage = await db.query<{ hourly: number; daily: number }>(
    `select
       count(*) filter (where created_at > now() - interval '1 hour')::int as hourly,
       count(*) filter (where created_at > now() - interval '24 hours')::int as daily
     from events where type = 'pool_fetched' and user_id = $1`,
    [user.id],
  )
  const { hourly, daily } = usage.rows[0]!
  if (hourly >= HOURLY_LIMIT || daily >= DAILY_LIMIT) {
    return Response.json(
      { error: 'rate_limited', retry_after: hourly >= HOURLY_LIMIT ? 3600 : 86400 },
      { status: 429 },
    )
  }

  const { rows } = await db.query<{ card_id: string; profile: string; snippets: unknown }>(
    `select p.card_id, p.body as profile,
       coalesce(
         (select json_agg(s2) from (
            select s.body, s.created_at from snippets s
            where s.user_id = p.user_id
            order by s.created_at desc limit ${SNIPPETS_PER_CARD}
          ) s2),
         '[]'::json
       ) as snippets
     from profiles p
     where p.user_id <> $1
     order by p.card_id`,
    [user.id],
  )

  await logEvent({ type: 'pool_fetched', userId: user.id, metadata: { pool_size: rows.length } })
  // CTO tripwire (2026-07-10 ruling): whole-pool responses are load-bearing at
  // seed scale but must not silently outgrow it — server-side bounding+ranking
  // becomes mandatory past this size. One event per crossing fetch; metrics watch it.
  if (rows.length >= 40) {
    await logEvent({ type: 'pool_size_tripwire', metadata: { pool_size: rows.length } })
  }
  return Response.json({ pool: rows, generated_at: new Date().toISOString() })
}
