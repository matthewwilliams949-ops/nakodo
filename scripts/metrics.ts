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

// M9b CIRCLE line: the retention backbone — rematches proposed by agents
// (client_rematch_proposed: fired via /api/events, hence the client_ prefix)
// vs. reconnects that actually landed in an old thread (rematch_reconnected,
// server-fired in the message path). Founder exclusion, same rule as gate 4.
const circleCount = async (type: string): Promise<number> =>
  Number(
    (
      await db.query(
        `select count(*) n from events e
         where e.type = $1
           ${founderId ? `and not exists (
             select 1 from intros i
             where i.id::text = e.metadata->>'intro_id'
               and (i.user_a = $2 or i.user_b = $2))` : ''}`,
        founderId ? [type, founderId] : [type],
      )
    ).rows[0]?.n ?? 0,
  )
const rematchesProposed = await circleCount('client_rematch_proposed')
const rematchesReconnected = await circleCount('rematch_reconnected')

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
console.log(`CIRCLE      rematches proposed: ${rematchesProposed} · reconnected (message landed in an old thread): ${rematchesReconnected}`)
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
