import { getDb } from './db'

// Every funnel-relevant action lands here. If it isn't logged, it didn't
// happen — this project exists to measure a funnel (BUILD-PLAN.md).
export async function logEvent(e: {
  type: string
  userId?: string | null
  installId?: string | null
  metadata?: Record<string, unknown>
}): Promise<void> {
  await getDb().query(
    'insert into events (install_id, user_id, type, metadata) values ($1, $2, $3, $4)',
    [e.installId ?? null, e.userId ?? null, e.type, JSON.stringify(e.metadata ?? {})],
  )
}
