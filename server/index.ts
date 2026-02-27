import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { logger } from 'hono/logger'
import { toolsRouter } from './routes/tools'
import { syncRouter } from './routes/sync'
import './db' // DB初期化（テーブル作成）

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

// ────────────────────────────────────────
// 起動
// ────────────────────────────────────────
const PORT = Number(process.env.PORT ?? 3000)
console.log(`🚀 Findy Tools Hub API → http://localhost:${PORT}`)

export default { port: PORT, fetch: app.fetch }
