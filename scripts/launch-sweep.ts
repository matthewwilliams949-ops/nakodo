// Launch-morning baseline sweep (CEO ruling, 2026-07-11): personas go, real
// users STAY. Deletes the `test-bo` walkthrough persona (+ any e2e-harness
// leftovers as a safety net), ALL intros, and zeroes the events table —
// Matthew's real profile remains, deliberately the first card in the pool.
// His walkthrough intro dies in the intros sweep automatically.
//
//   pnpm sweep              dry run — prints exactly what would die and what remains
//   pnpm sweep --execute    does it, in one transaction
//
// Runs ONCE, launch morning, right before post #1 (Distribution owns the
// timing). It is NOT the e2e cleanup (`pnpm e2e cleanup` stays surgical);
// this is the deliberate baseline-zeroing step so the funnel metrics start
// honest. Guard rails: refuses to run if it would leave zero users, and the
// persona filter is an explicit allowlist (handle/source match), never
// "everyone but Matthew".
import pg from 'pg'

const url = process.env.DATABASE_URL
if (!url) {
  console.error('DATABASE_URL is not set — copy .env.example to .env (SETUP-ACCOUNTS.md).')
  process.exit(1)
}

const EXECUTE = process.argv.includes('--execute')
const PERSONA_HANDLES = ['test-bo']
const PERSONA_SOURCES = ['e2e-harness']

const db = new pg.Client({ connectionString: url })

async function main(): Promise<void> {
  await db.connect()

  const personas = (
    await db.query<{ id: string; handle: string | null; source: string | null }>(
      'select id, handle, source from users where handle = any($1) or source = any($2)',
      [PERSONA_HANDLES, PERSONA_SOURCES],
    )
  ).rows
  const survivors = (
    await db.query<{ id: string; handle: string | null; email: string | null }>(
      // IS NOT TRUE, not NOT(...): a NULL handle (e.g. user #1, email-only) makes the
      // OR evaluate NULL, and NOT NULL drops the row — survivors read 0 and the
      // zero-users guard rail refuses a sweep that is actually safe.
      'select id, handle, email from users where (handle = any($1) or source = any($2)) is not true',
      [PERSONA_HANDLES, PERSONA_SOURCES],
    )
  ).rows
  const intros = (await db.query<{ n: number }>('select count(*)::int as n from intros')).rows[0]!.n
  const messages = (await db.query<{ n: number }>('select count(*)::int as n from intro_messages')).rows[0]!.n
  const events = (await db.query<{ n: number }>('select count(*)::int as n from events')).rows[0]!.n

  console.log(`${EXECUTE ? 'SWEEPING' : 'DRY RUN — nothing deleted'} (baseline zero, CEO ruling 2026-07-11)\n`)
  console.log(`  personas to delete (cascades profile/snippets/asks): ${personas.length}`)
  for (const p of personas) console.log(`    - ${p.handle ?? p.id} (source: ${p.source ?? 'none'})`)
  console.log(`  intros to delete (ALL, incl. walkthrough): ${intros} (+ ${messages} thread messages)`)
  console.log(`  events to zero (ALL): ${events}`)
  console.log(`  users REMAINING after sweep: ${survivors.length}`)
  for (const s of survivors) console.log(`    - ${s.handle ?? s.id}${s.email ? ` <${s.email}>` : ''}`)

  if (survivors.length === 0) {
    console.error('\nREFUSING: sweep would leave zero users — user #1 must remain. Check the persona filter.')
    process.exitCode = 1
    return
  }
  if (!EXECUTE) {
    console.log('\nDry run only. Re-run with --execute launch morning, right before post #1.')
    return
  }

  await db.query('begin')
  try {
    await db.query('delete from intro_messages') // explicit — intros user FKs are SET NULL, not cascade
    await db.query('delete from intros')
    await db.query('delete from events')
    if (personas.length > 0)
      await db.query('delete from users where id = any($1)', [personas.map((p) => p.id)])
    await db.query('commit')
  } catch (e) {
    await db.query('rollback')
    throw e
  }

  const remainingUsers = (await db.query<{ n: number }>('select count(*)::int as n from users')).rows[0]!.n
  const remainingEvents = (await db.query<{ n: number }>('select count(*)::int as n from events')).rows[0]!.n
  const remainingIntros = (await db.query<{ n: number }>('select count(*)::int as n from intros')).rows[0]!.n
  console.log(
    `\nSwept. Baseline now: ${remainingUsers} user(s), ${remainingIntros} intros, ${remainingEvents} events. Run pnpm metrics to confirm the clean slate.`,
  )
}

main()
  .catch((e) => {
    console.error(e)
    process.exitCode = 1
  })
  .finally(() => db.end())
