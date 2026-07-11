// Weekly funnel snapshot (BUILD-PLAN M6). Run: pnpm metrics
// Prints the four funnel stages against the SCOPE.md gate numbers.
// Gate metric 4 ("real exchange") is now OBSERVABLE, not manual: a
// `thread_connected` event fires the moment both sides of a revealed intro have
// each posted ≥1 message (lib/intros.ts). No more Studio follow-up.
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set — copy .env.example to .env (SETUP-ACCOUNTS.md).')
  process.exit(1)
}

async function npmDownloads(): Promise<{ lastWeek: number; total: number }> {
  try {
    const week = (await (await fetch('https://api.npmjs.org/downloads/point/last-week/nakodo')).json()) as {
      downloads?: number
    }
    // npm's range API caps at 18 months — fine for a v1 experiment window.
    const start = '2026-07-05' // first publish
    const end = new Date().toISOString().slice(0, 10)
    const range = (await (
      await fetch(`https://api.npmjs.org/downloads/range/${start}:${end}/nakodo`)
    ).json()) as { downloads?: Array<{ downloads: number }> }
    const total = (range.downloads ?? []).reduce((s, d) => s + d.downloads, 0)
    return { lastWeek: week.downloads ?? 0, total }
  } catch {
    return { lastWeek: -1, total: -1 } // npm API down; don't fail the whole report
  }
}

async function githubStars(): Promise<number | null> {
  try {
    const r = await fetch('https://api.github.com/repos/matthewwilliams949-ops/nakodo')
    if (!r.ok) return null // private repo pre-launch → 404; fine
    return ((await r.json()) as { stargazers_count: number }).stargazers_count
  } catch {
    return null
  }
}

const db = new pg.Client({ connectionString: url })
await db.connect()

const one = async (sql: string): Promise<number> =>
  Number((await db.query(sql)).rows[0]?.n ?? 0)

const users = await one('select count(*) n from users')
const activated = await one(`
  select count(*) n from users u
  where exists (select 1 from profiles p where p.user_id = u.id)
    and exists (select 1 from snippets s where s.user_id = u.id)`)
const snippets = await one('select count(*) n from snippets')
const openAsks = await one("select count(*) n from asks where status = 'open'")
// "Proposed" = delivered to a target. Agent proposals sit in 'held' until
// Matthew approves and are 'vetoed' if he says no — neither ever reached a
// target, so neither counts as a proposal. (held/vetoed exist post-M8-merge;
// the NOT IN is a no-op on the pre-merge schema.)
const introsProposed = await one("select count(*) n from intros where status not in ('held', 'vetoed')")
// held awaiting Matthew's weekly review — operational, not a funnel stage.
const introsHeld = await one("select count(*) n from intros where status = 'held'")
// "Accepted" = the TARGET said yes → the intro reveals. We deliberately do NOT
// count a_response/b_response here: agent proposals set the proposer's side to
// 'accepted' at birth (their proposing IS their opt-in), so "≥1 side accepted"
// would read ~100% and lie. Mutual yes (revealed) is the honest signal.
const introsRevealed = await one("select count(*) n from intros where status = 'revealed'")
const introsAccepted = introsRevealed
// Gate #4 counts PEER-TO-PEER exchanges only. The founder-welcome mechanic
// (concierge-playbook: every activated user gets a concierge intro to Matthew
// first) is our feedback channel, not the network working — those exchanges must
// not inflate the gate. Founder identified by email (env-overridable); if his row
// is absent (e.g. after a baseline zero) founderId is null and the filter no-ops.
const founderEmail = process.env.FOUNDER_EMAIL ?? 'matthew.williams949@gmail.com'
const founderId =
  (await db.query<{ id: string }>('select id from users where email = $1', [founderEmail])).rows[0]?.id ?? null

// Only called when founderId is non-null. founderSide=false → peer-to-peer
// (founder on neither side); true → founder-welcome intros.
const exchangeCount = async (founderSide: boolean): Promise<number> =>
  Number(
    (
      await db.query(
        `select count(*) n from events e
         where e.type = 'thread_connected'
           and ${founderSide ? '' : 'not '}exists (
             select 1 from intros i
             where i.id::text = e.metadata->>'intro_id'
               and (i.user_a = $1 or i.user_b = $1))`,
        [founderId],
      )
    ).rows[0]?.n ?? 0,
  )
// Both sides messaged in-thread (≥1 each) — the gate-4 "real exchange" signal.
const exchanges = founderId
  ? await exchangeCount(false)
  : await one("select count(*) n from events where type = 'thread_connected'")
const founderExchanges = founderId ? await exchangeCount(true) : 0
// Founder-welcome intro count — the CEO's "own line" ask covers intros too.
const founderIntros = founderId
  ? Number(
      (
        await db.query(
          "select count(*) n from intros where (user_a = $1 or user_b = $1) and status not in ('held', 'vetoed')",
          [founderId],
        )
      ).rows[0]?.n ?? 0,
    )
  : 0

// Founder-welcome pass (concierge-playbook §23): every activated user's first
// intro is Matthew. It's a MANUAL send (pnpm intro:send) — so the reliable
// trigger is surfacing WHO still needs one. Activated (profile + ≥1 snippet),
// not the founder, and no existing intro linking them to the founder.
const founderPassDue = founderId
  ? (
      await db.query<{ handle: string | null; location: string | null; created_at: string | Date }>(
        `select u.handle, u.location, u.created_at
         from users u
         where u.id <> $1
           and exists (select 1 from profiles p where p.user_id = u.id)
           and exists (select 1 from snippets s where s.user_id = u.id)
           and not exists (
             select 1 from intros i
             where (i.user_a = u.id and i.user_b = $1) or (i.user_b = u.id and i.user_a = $1))
         order by u.created_at`,
        [founderId],
      )
    ).rows
  : []

// Seed-window leading indicator (CEO ask, 2026-07-11): how fast do people
// NOTICE and ANSWER intros? Unnoticed intros read as silent declines inside
// the 14-day window — this line is the daily early warning for gates #3/#4.
// proposed→seen uses the card_viewed event (MIN per intro/side; email-prefetch
// noise makes it an upper bound on noticing speed); proposed→response uses the
// intros table's own responded_at. Window: last 14 days of proposals.
const medianHours = async (sql: string): Promise<string> => {
  const v = (await db.query<{ h: string | null }>(sql)).rows[0]?.h
  return v == null ? '—' : `${Number(v).toFixed(1)}h`
}
const seenLatency = await medianHours(`
  select percentile_cont(0.5) within group (order by extract(epoch from first_seen - i.created_at) / 3600) h
  from intros i
  join lateral (
    select min(e.created_at) first_seen from events e
    where e.type = 'card_viewed' and e.metadata->>'intro_id' = i.id::text
  ) s on s.first_seen is not null
  where i.created_at > now() - interval '14 days' and i.status not in ('held', 'vetoed')`)
const responseLatency = await medianHours(`
  select percentile_cont(0.5) within group (order by extract(epoch from r.responded - i.created_at) / 3600) h
  from intros i
  cross join lateral unnest(array[i.a_responded_at, i.b_responded_at]) as r(responded)
  where r.responded is not null
    and i.created_at > now() - interval '14 days' and i.status not in ('held', 'vetoed')`)

const bySource = (
  await db.query<{ source: string | null; n: string }>(
    'select source, count(*) n from users group by source order by n desc',
  )
).rows
const eventsWeek = (
  await db.query<{ type: string; n: string }>(
    "select type, count(*) n from events where created_at > now() - interval '7 days' group by type order by n desc",
  )
).rows

await db.end()

const npm = await npmDownloads()
const stars = await githubStars()

const pct = (a: number, b: number) => (b === 0 ? '—' : `${Math.round((a / b) * 100)}%`)
const fmt = (v: number) => (v < 0 ? 'n/a' : String(v))

console.log(`Nakodo funnel — ${new Date().toISOString().slice(0, 10)}
`)
console.log(`INSTALL     npm downloads: ${fmt(npm.total)} total, ${fmt(npm.lastWeek)} last week` +
  (stars === null ? '  (repo private — stars n/a)' : `  · GitHub stars: ${stars}`))
console.log(`ACTIVATION  users: ${users} · activated (profile + ≥1 snippet): ${activated} (${pct(activated, users)} of users)`)
console.log(`            snippets: ${snippets} · open asks: ${openAsks}`)
console.log(`INTROS      proposed (delivered): ${introsProposed} · accepted — both said yes (revealed): ${introsAccepted} (${pct(introsAccepted, introsProposed)} of proposed)` +
  (introsHeld > 0 ? ` · ${introsHeld} held awaiting review` : ''))
console.log(`EXCHANGE    real exchanges (peer-to-peer, both sides messaged): ${exchanges}` +
  (founderId ? `  ·  founder-welcome (excluded from gate): ${founderIntros} intros, ${founderExchanges} exchanges` : ''))
console.log(`LATENCY     median proposed→card-seen: ${seenLatency} · proposed→response: ${responseLatency}  (14-day window, per side)`)
if (founderId) {
  console.log(`\n▶ FOUNDER-WELCOME PASS — activated, no founder intro yet (send each via \`pnpm intro:send\`):`)
  if (founderPassDue.length === 0) console.log('  (none — every activated user has been welcomed)')
  for (const r of founderPassDue)
    console.log(`  ${r.handle ?? '(no handle)'}${r.location ? ` · ${r.location}` : ''} · activated ${new Date(r.created_at).toISOString().slice(0, 10)}`)
} else {
  console.log(`\n▶ FOUNDER-WELCOME PASS — founder not yet onboarded; no founder card in the pool (set FOUNDER_EMAIL / onboard user #1).`)
}

console.log(`\nAttribution (users.source):`)
for (const r of bySource) console.log(`  ${r.source ?? '(none)'}: ${r.n}`)
if (bySource.length === 0) console.log('  (no users yet)')
console.log(`\nEvents, last 7 days:`)
for (const r of eventsWeek) console.log(`  ${r.type}: ${r.n}`)
if (eventsWeek.length === 0) console.log('  (none)')

console.log(`\nGates (SCOPE.md — calibrate week 1, then frozen):
  Seed (end of wk 2):  ≥15 of ~25 recruited installs activated       → now: ${activated}
  Launch (+4 wks):     ≥150 installs                                 → now: ${fmt(npm.total)}
                       ≥40% activation of installs                   → now: ${pct(activated, Math.max(npm.total, 0))}
                       ≥10 intros proposed, ≥50% accepted            → now: ${introsProposed} proposed, ${pct(introsAccepted, introsProposed)} accepted
                       ≥3 revealed pairs with a real exchange        → now: ${exchanges}`)
