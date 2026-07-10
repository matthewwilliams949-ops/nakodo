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
const introsProposed = await one('select count(*) n from intros')
const introsRevealed = await one("select count(*) n from intros where status = 'revealed'")
const introsAccepted = await one(`
  select count(*) n from intros
  where a_response = 'accepted' or b_response = 'accepted'`)
// Both sides messaged in-thread (≥1 each) — the gate-4 "real exchange" signal.
const exchanges = await one("select count(*) n from events where type = 'thread_connected'")

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
console.log(`INTROS      proposed: ${introsProposed} · ≥1 side accepted: ${introsAccepted} (${pct(introsAccepted, introsProposed)}) · revealed: ${introsRevealed}`)
console.log(`EXCHANGE    real exchanges (both sides messaged): ${exchanges}`)
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
