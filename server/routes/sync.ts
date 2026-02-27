import { Hono } from 'hono'
import db from '../db'
import { scrapeTools, type SyncMode } from '../scraper/findy'

export const syncRouter = new Hono()

let syncRunning = false

// GET /api/sync/status
syncRouter.get('/status', (c) => {
  const latest = db.query('SELECT * FROM sync_log ORDER BY id DESC LIMIT 1').get()
  const toolCount = (db.query('SELECT COUNT(*) as count FROM tools').get() as any)?.count ?? 0
  const reviewCount =
    (db.query('SELECT COUNT(*) as count FROM reviews').get() as any)?.count ?? 0

  return c.json({ running: syncRunning, latest, toolCount, reviewCount })
})

// GET /api/sync/logs
syncRouter.get('/logs', (c) => {
  const logs = db.query('SELECT * FROM sync_log ORDER BY id DESC LIMIT 20').all()
  return c.json({ logs })
})

// POST /api/sync   body: { mode?: "full" | "list_only" | "reviews_only" }
syncRouter.post('/', async (c) => {
  if (syncRunning) {
    return c.json({ error: 'Sync already running' }, 409)
  }

  const body = await c.req.json<{ mode?: SyncMode }>().catch(() => ({}))
  const mode: SyncMode = body.mode ?? 'full'

  const log = db
    .query<{ id: number }, []>(
      `INSERT INTO sync_log (status) VALUES ('running') RETURNING id`,
    )
    .get()!

  syncRunning = true

  // バックグラウンドで実行
  scrapeTools((count) => {
    db.run(
      `UPDATE sync_log
         SET tools_synced = ?, completed_at = datetime('now'), status = 'completed'
       WHERE id = ?`,
      [count, log.id],
    )
    syncRunning = false
    console.log(`✅ Sync #${log.id} completed: ${count} tools`)
  }, mode).catch((err) => {
    db.run(
      `UPDATE sync_log
         SET error = ?, completed_at = datetime('now'), status = 'failed'
       WHERE id = ?`,
      [String(err), log.id],
    )
    syncRunning = false
    console.error(`❌ Sync #${log.id} failed:`, err)
  })

  return c.json({ started: true, logId: log.id, mode })
})
