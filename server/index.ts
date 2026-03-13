import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { toolsRouter } from './routes/tools'
import { syncRouter, triggerSync } from './routes/sync'
import { contractsRouter } from './routes/contracts'
import { procurementRouter } from './routes/procurement'
import { negotiateRouter } from './routes/negotiate'
import { aiUsageRouter } from './routes/aiUsage'
import { sql, initDb, seedDb } from './db'

const app = new Hono()

// ────────────────────────────────────────
// ミドルウェア
// ────────────────────────────────────────
app.use('*', logger())

// 環境変数 ALLOWED_ORIGINS (カンマ区切り) で追加オリジンを指定可能
const extraOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
  : []

const allowedOrigins = [
  'http://localhost:5173',
  'http://127.0.0.1:5173',
  'http://localhost:4173',
  'https://fourn9.github.io',
  ...extraOrigins,
]

app.use(
  '*',
  cors({
    origin: allowedOrigins,
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
  }),
)

// ────────────────────────────────────────
// ルート
// ────────────────────────────────────────
app.get('/api/health', (c) =>
  c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
  }),
)

app.route('/api/tools', toolsRouter)
app.route('/api/sync', syncRouter)
app.route('/api/contracts', contractsRouter)
app.route('/api/procurement', procurementRouter)
app.route('/api/negotiate', negotiateRouter)
app.route('/api/ai-usage', aiUsageRouter)

// ────────────────────────────────────────
// DB 初期化 & 起動時自動同期
// テーブル作成後、ツールが 0 件なら自動スクレイプを開始する。
// PostgreSQL は外部ホストなのでコンテナ再起動でもデータが保持される。
// ────────────────────────────────────────
await initDb()
await seedDb()

const [{ count }] = await sql<[{ count: string }]>`SELECT COUNT(*) AS count FROM tools`
if (Number(count) === 0) {
  console.log('📦 DB empty on startup — triggering auto-sync (list_only)')
  triggerSync('list_only') // fire and forget
}

// ────────────────────────────────────────
// 起動
// ────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000)
console.log(`🚀 Findy Tools Hub API → http://localhost:${PORT}`)

export default { port: PORT, fetch: app.fetch }
