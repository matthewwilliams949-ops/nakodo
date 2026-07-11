// e2e-harness.ts — hands-on end-to-end testing tool for Nakodo.
//
// Sets up test profiles, wires a match between two of them, hands you the real
// intro links to click through in the browser (accept → reveal → thread), and
// deletes every test row cleanly when you're done.
//
//   pnpm e2e <command>          (reads .env → DATABASE_URL; APP_URL for links)
//
//   seed [n]                    create n test profiles (default 4) — profile + snippet + open ask
//   match [handleA] [handleB]   create an intro between two test users; prints both accept links
//   status                      show every test user + intro, their state, and their links
//   accept  <token>             accept an invitation from the CLI (needs the app running)
//   decline <token>             decline an invitation from the CLI
//   say    <token> "<message>"  post a thread message after a mutual yes (tests the completion loop)
//   demo                        seed + match the two obvious fits + print links (the one-shot path)
//   cleanup                     delete ALL test rows — real users are never touched
//
// HYGIENE (non-negotiable): every row this creates carries source='e2e-harness'
// on the user, so `cleanup` is surgical and the metrics baseline stays honest.
// It never reads, writes, or deletes a row that isn't e2e-tagged.
import pg from 'pg'
import { randomBytes, createHash } from 'node:crypto'

const TAG = 'e2e-harness'
const APP_URL = (process.env.APP_URL ?? 'http://localhost:3000').replace(/\/$/, '')
const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set — run `vercel env pull` or copy .env.example to .env.')
  process.exit(1)
}

// Mirror the app's token functions (apps/web/lib/tokens.ts) so anything this
// tool mints is valid against the real API.
const generateToken = (): string => randomBytes(32).toString('hex')
const hashToken = (t: string): string => createHash('sha256').update(t).digest('hex')

const db = new pg.Client({ connectionString: url })

// Four PII-free personas with two obvious mutual fits (Mira↔Dio, Sol↔Nao).
// Profiles read like real pool content: the work, not the person.
const PERSONAS = [
  {
    handle: 'test-mira',
    display_name: 'Mira (test)',
    location: 'Berlin',
    profile:
      'Building an agent-memory layer for coding assistants, three weeks in. Strong at backend and retrieval evals. The config surface works but looks like a hostage note — needs someone with real design instincts.',
    snippet: 'Shipped the retrieval eval harness this week; recall up 12 points on the internal set.',
    ask: 'a designer who has taken a developer tool from ugly-but-works to something people trust on sight.',
  },
  {
    handle: 'test-dio',
    display_name: 'Dio (test)',
    location: 'Lisbon',
    profile:
      'Design engineer, ex-fintech. I take rough internal tools and make them feel trustworthy and calm. Want to learn how agent-native products are actually built under the hood.',
    snippet: 'Rebuilt a fintech onboarding flow; first-week drop-off down by a third.',
    ask: 'a builder working on agent tooling who would trade design help for teaching me the stack.',
  },
  {
    handle: 'test-sol',
    display_name: 'Sol (test)',
    location: 'Berlin',
    profile:
      'Solo founder on a scheduling tool for physio clinics. Technical enough to ship, but stretched thin. Distribution is the wall — cold outreach feels wrong for this audience.',
    snippet: 'First ten clinics onboarded by hand; two already renewed for a second month.',
    ask: 'someone who has done content-led or community distribution for a vertical SaaS.',
  },
  {
    handle: 'test-nao',
    display_name: 'Nao (test)',
    location: 'Amsterdam',
    profile:
      'Grew the community for a dev tool to 20k with a weekly ritual, not ads. Curious about matching products and where trust comes from. Open to advising or getting hands-on.',
    snippet: 'Ran a weekly build-in-public thread that became the top acquisition channel.',
    ask: 'a founder who wants hands-on help turning early users into a community that compounds.',
  },
]

type UserRow = {
  id: string
  handle: string | null
  display_name: string | null
  location: string | null
  email: string | null
  snippets: number
  asks: number
}

function targetBanner(): void {
  let host = 'unknown'
  try {
    host = new URL(url!.replace(/^postgres(ql)?:\/\//, 'http://')).host
  } catch {
    /* best-effort only */
  }
  const prod = /nakodo\.dev/.test(APP_URL) || !/localhost|127\.0\.0\.1/.test(APP_URL)
  console.log(`\n▶ TARGET  app: ${APP_URL}   db: ${host}${prod ? '   ⚠ NON-LOCAL' : ''}`)
  console.log(`  tag: source='${TAG}'  (only e2e-tagged rows are ever touched)\n`)
}

async function e2eUsers(): Promise<UserRow[]> {
  const { rows } = await db.query<UserRow>(
    `select u.id, u.handle, u.display_name, u.location, u.email,
       (select count(*)::int from snippets s where s.user_id = u.id) as snippets,
       (select count(*)::int from asks a where a.user_id = u.id) as asks
     from users u where u.source = $1 order by u.handle`,
    [TAG],
  )
  return rows
}

async function seed(n: number): Promise<void> {
  const chosen = PERSONAS.slice(0, Math.max(1, Math.min(n, PERSONAS.length)))
  for (const p of chosen) {
    const existing = await db.query('select id from users where source = $1 and handle = $2', [TAG, p.handle])
    if (existing.rows.length > 0) {
      console.log(`  · ${p.handle} already exists — skipping`)
      continue
    }
    const token = generateToken()
    const { rows } = await db.query<{ id: string }>(
      `insert into users (handle, display_name, location, token_hash, source)
       values ($1, $2, $3, $4, $5) returning id`,
      [p.handle, p.display_name, p.location, hashToken(token), TAG],
    )
    const id = rows[0]!.id
    await db.query('insert into profiles (user_id, body) values ($1, $2)', [id, p.profile])
    await db.query('insert into snippets (user_id, body) values ($1, $2)', [id, p.snippet])
    await db.query("insert into asks (user_id, need, status) values ($1, $2, 'open')", [id, p.ask])
    await db.query(
      `insert into events (user_id, type, metadata) values ($1, 'registered', $2)`,
      [id, JSON.stringify({ source: TAG, has_email: false })],
    )
    console.log(`  ✓ ${p.handle}  (${p.display_name}, ${p.location})`)
  }
  console.log(`\nSeeded. Run \`pnpm e2e status\` to see them, or \`pnpm e2e match\` to wire a match.`)
}

// An anonymous card: relevant facts about the *other* person, no identity.
// display_name is deliberately NOT used here — that is the reveal's job.
function cardFor(other: UserRow, otherProfile: string, otherAsk: string): string {
  const near = other.location ? `Someone in ${other.location}. ` : 'Someone building nearby. '
  return `${near}${otherProfile}\n\nLooking for: ${otherAsk}`
}

async function match(handleA?: string, handleB?: string): Promise<void> {
  const users = await e2eUsers()
  if (users.length < 2) {
    console.error('Need at least two test users — run `pnpm e2e seed` first.')
    return
  }
  const pick = (h?: string, fallback?: UserRow): UserRow | undefined =>
    h ? users.find((u) => u.handle === h || u.handle === `test-${h}`) : fallback
  const a = pick(handleA, users[0])
  const b = pick(handleB, users.find((u) => u.id !== a?.id))
  if (!a || !b || a.id === b.id) {
    console.error(`Could not resolve two distinct users. Available: ${users.map((u) => u.handle).join(', ')}`)
    return
  }
  const bodies = await db.query<{ user_id: string; profile: string; ask: string }>(
    `select p.user_id, p.body as profile,
       (select need from asks x where x.user_id = p.user_id and x.status = 'open' limit 1) as ask
     from profiles p where p.user_id = any($1)`,
    [[a.id, b.id]],
  )
  const byId = new Map(bodies.rows.map((r) => [r.user_id, r]))
  const bd = byId.get(b.id)
  const ad = byId.get(a.id)
  const cardA = cardFor(b, bd?.profile ?? '(no profile)', bd?.ask ?? '(no open ask)')
  const cardB = cardFor(a, ad?.profile ?? '(no profile)', ad?.ask ?? '(no open ask)')
  const tokenA = generateToken()
  const tokenB = generateToken()
  const { rows } = await db.query<{ id: string }>(
    `insert into intros (user_a, user_b, card_a, card_b, status, token_a, token_b, token_expires_at)
     values ($1, $2, $3, $4, 'proposed', $5, $6, now() + interval '14 days') returning id`,
    [a.id, b.id, cardA, cardB, tokenA, tokenB],
  )
  const introId = rows[0]!.id
  await db.query(`insert into events (type, metadata) values ('intro_proposed', $1)`, [
    JSON.stringify({ intro_id: introId, via: 'e2e-harness' }),
  ])
  console.log(`✓ Match created between ${a.handle} and ${b.handle}  (intro ${introId.slice(0, 8)})\n`)
  console.log('Open each link in a browser and accept — this is the real product surface:')
  console.log(`  ${a.handle}:  ${APP_URL}/intro/${tokenA}`)
  console.log(`  ${b.handle}:  ${APP_URL}/intro/${tokenB}`)
  console.log(`\nAccept BOTH → the reveal shows the counterpart's name and opens the thread.`)
  console.log(`Decline either → the other side stays on "waiting", forever (that's the guarantee).`)
  console.log(`Prefer the CLI?  pnpm e2e accept ${tokenA.slice(0, 12)}…  (full token from \`pnpm e2e status\`)`)
}

async function status(): Promise<void> {
  const users = await e2eUsers()
  console.log(`TEST USERS (${users.length}):`)
  if (users.length === 0) console.log('  (none — run `pnpm e2e seed`)')
  for (const u of users) {
    console.log(
      `  ${u.handle}  ·  "${u.display_name ?? '—'}"  ·  ${u.location ?? '—'}  ·  ` +
        `${u.email ? u.email : 'no email'}  ·  ${u.snippets} snippet, ${u.asks} ask`,
    )
  }
  const intros = await db.query<{
    id: string
    status: string
    a_response: string | null
    b_response: string | null
    token_a: string
    token_b: string
    ha: string | null
    hb: string | null
  }>(
    `select i.id, i.status, i.a_response, i.b_response, i.token_a, i.token_b,
       ua.handle as ha, ub.handle as hb
     from intros i
       left join users ua on ua.id = i.user_a
       left join users ub on ub.id = i.user_b
     where ua.source = $1 or ub.source = $1
     order by i.created_at desc`,
    [TAG],
  )
  console.log(`\nTEST INTROS (${intros.rows.length}):`)
  if (intros.rows.length === 0) console.log('  (none — run `pnpm e2e match`)')
  for (const i of intros.rows) {
    console.log(
      `  ${i.id.slice(0, 8)}  [${i.status}]  ${i.ha ?? '?'}:${i.a_response ?? 'no-reply'}  ↔  ` +
        `${i.hb ?? '?'}:${i.b_response ?? 'no-reply'}`,
    )
    console.log(`      A → ${APP_URL}/intro/${i.token_a}`)
    console.log(`      B → ${APP_URL}/intro/${i.token_b}`)
  }
}

// Drive the real accept/decline/message endpoints over HTTP (needs the app running).
async function respond(token: string, response: 'accepted' | 'declined'): Promise<void> {
  const res = await fetch(`${APP_URL}/api/intro/${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ response }),
  }).catch((e) => {
    console.error(`Request failed — is the app running at ${APP_URL}?  (${String(e)})`)
    return null
  })
  if (!res) return
  const body = (await res.json().catch(() => ({}))) as { view?: string; error?: string }
  if (!res.ok) console.error(`  ${res.status}: ${body.error ?? 'error'}`)
  else console.log(`  ${response} → the responding side now sees: "${body.view}"`)
}

async function say(token: string, message: string): Promise<void> {
  if (!message) return console.error('Usage: pnpm e2e say <token> "your message"')
  const res = await fetch(`${APP_URL}/api/intro/${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ message }),
  }).catch((e) => {
    console.error(`Request failed — is the app running at ${APP_URL}?  (${String(e)})`)
    return null
  })
  if (!res) return
  const body = (await res.json().catch(() => ({}))) as { view?: string; error?: string; message_sent?: boolean }
  if (!res.ok) console.error(`  ${res.status}: ${body.error ?? 'error'}${body.view ? ` (view: ${body.view})` : ''}`)
  else console.log(`  message posted → view: "${body.view}"`)
}

async function cleanup(): Promise<void> {
  const ids = (await db.query<{ id: string }>('select id from users where source = $1', [TAG])).rows.map((r) => r.id)
  if (ids.length === 0) {
    console.log('Nothing to clean — no e2e-tagged rows found.')
    return
  }
  const introIds = (
    await db.query<{ id: string }>(
      'select id from intros where user_a = any($1) or user_b = any($1) or proposed_by = any($1)',
      [ids],
    )
  ).rows.map((r) => r.id)

  await db.query('begin')
  try {
    // Order matters: clear intros (and their events) while the user refs are
    // still intact, then the users (which cascade profiles/snippets/asks).
    const msgs = introIds.length
      ? await db.query('delete from intro_messages where intro_id = any($1)', [introIds])
      : { rowCount: 0 }
    const evByIntro = introIds.length
      ? await db.query(`delete from events where metadata->>'intro_id' = any($1)`, [introIds])
      : { rowCount: 0 }
    const evByUser = await db.query('delete from events where user_id = any($1)', [ids])
    const intros = introIds.length
      ? await db.query('delete from intros where id = any($1)', [introIds])
      : { rowCount: 0 }
    const users = await db.query('delete from users where id = any($1)', [ids])
    await db.query('commit')
    console.log('Cleaned up (e2e-tagged only):')
    console.log(`  users ${users.rowCount} · intros ${intros.rowCount} · messages ${msgs.rowCount} · ` +
      `events ${(evByIntro.rowCount ?? 0) + (evByUser.rowCount ?? 0)}`)
    console.log('  profiles / snippets / asks cascaded with their users.')
  } catch (e) {
    await db.query('rollback')
    console.error('Cleanup rolled back — no changes made:', e)
    process.exitCode = 1
  }
}

async function main(): Promise<void> {
  const [cmd, ...args] = process.argv.slice(2)
  await db.connect()
  try {
    targetBanner()
    switch (cmd) {
      case 'seed':
        await seed(args[0] ? parseInt(args[0], 10) : 4)
        break
      case 'match':
        await match(args[0], args[1])
        break
      case 'status':
        await status()
        break
      case 'accept':
        await respond(args[0]!, 'accepted')
        break
      case 'decline':
        await respond(args[0]!, 'declined')
        break
      case 'say':
        await say(args[0]!, args.slice(1).join(' ').replace(/^["']|["']$/g, ''))
        break
      case 'demo':
        await seed(4)
        console.log('')
        await match('test-mira', 'test-dio')
        break
      case 'cleanup':
        await cleanup()
        break
      default:
        console.log(
          'Commands: seed [n] · match [A] [B] · status · accept <token> · decline <token> · ' +
            'say <token> "msg" · demo · cleanup',
        )
    }
  } finally {
    await db.end()
  }
}

void main()
