import { Hono } from 'hono'
import type { Context, Next } from 'hono'
import { sql } from '../db'
import { scrapeTools, type SyncMode } from '../scraper/findy'

export const syncRouter = new Hono()

let syncRunning = false

// ────────────────────────────────────────
// 認証ミドルウェア (POST のみ適用)
// SYNC_SECRET 環境変数が必須。未設定の場合は 503 を返す。
// ────────────────────────────────────────
function requireSecret(c: Context, next: Next) {
  const secret = process.env.SYNC_SECRET?.trim()
  if (!secret) {
    return c.json(
      { error: 'SYNC_SECRET is not configured on the server' },
      503,
    )
  }
  const auth = c.req.header('Authorization') ?? ''
  if (auth !== `Bearer ${secret}`) {
    return c.json({ error: 'Unauthorized' }, 401)
  }
  return next()
}

// ────────────────────────────────────────
// 共通の同期実行ロジック
// server/index.ts の起動時自動同期からも呼べるよう export する
// ────────────────────────────────────────
export async function triggerSync(mode: SyncMode = 'full'): Promise<number | null> {
  if (syncRunning) return null

  const [log] = await sql<[{ id: number }]>`
    INSERT INTO sync_log (status) VALUES ('running') RETURNING id
  `
  syncRunning = true

  // バックグラウンドで実行（await しない）
  scrapeTools(mode)
    .then(async (count) => {
      await sql`
        UPDATE sync_log
        SET tools_synced = ${count}, completed_at = NOW(), status = 'completed'
        WHERE id = ${log.id}
      `
      syncRunning = false
      console.log(`✅ Sync #${log.id} completed: ${count} tools`)
    })
    .catch(async (err) => {
      await sql`
        UPDATE sync_log
        SET error = ${String(err)}, completed_at = NOW(), status = 'failed'
        WHERE id = ${log.id}
      `
      syncRunning = false
      console.error(`❌ Sync #${log.id} failed:`, err)
    })

  return log.id
}

// ────────────────────────────────────────
// ルート
// ────────────────────────────────────────

// GET /api/sync/status  ← 認証不要（読み取り専用）
syncRouter.get('/status', async (c) => {
  const [latest] = await sql`SELECT * FROM sync_log ORDER BY id DESC LIMIT 1`
  const [{ count: toolCount }] = await sql<[{ count: string }]>`SELECT COUNT(*) AS count FROM tools`
  const [{ count: reviewCount }] = await sql<[{ count: string }]>`SELECT COUNT(*) AS count FROM reviews`

  return c.json({
    running: syncRunning,
    latest: latest ?? null,
    toolCount: Number(toolCount),
    reviewCount: Number(reviewCount),
  })
})

// GET /api/sync/logs  ← 認証不要（読み取り専用）
syncRouter.get('/logs', async (c) => {
  const logs = await sql`SELECT * FROM sync_log ORDER BY id DESC LIMIT 20`
  return c.json({ logs })
})

// POST /api/sync  ← SYNC_SECRET 必須
syncRouter.post('/', requireSecret, async (c) => {
  if (syncRunning) {
    return c.json({ error: 'Sync already running' }, 409)
  }

  const body = await c.req.json<{ mode?: SyncMode }>().catch(() => ({}))
  const mode: SyncMode = body.mode ?? 'full'

  const logId = await triggerSync(mode)
  if (logId === null) {
    return c.json({ error: 'Sync already running' }, 409)
  }

  return c.json({ started: true, logId, mode })
})
