import { Hono } from 'hono'
import { sql } from '../db'

export const contractsRouter = new Hono()

// ────────────────────────────────────────
// 型定義
// ────────────────────────────────────────

interface ContractRow {
  id: number
  tool_alias: string | null
  tool_name: string
  tool_logo_url: string | null
  status: string
  plan: string | null
  seats: number
  used_seats: number
  monthly_amount: number
  billing_cycle: string
  start_date: string | null
  renewal_date: string | null
  owner: string | null
  department: string | null
  notes: string | null
  created_at: string
  updated_at: string
}

interface ContractInput {
  tool_alias?: string
  tool_name: string
  tool_logo_url?: string
  status?: string
  plan?: string
  seats?: number
  used_seats?: number
  monthly_amount?: number
  billing_cycle?: string
  start_date?: string
  renewal_date?: string
  owner?: string
  department?: string
  notes?: string
}

// ────────────────────────────────────────
// GET /api/contracts/stats  ← ダッシュボード用サマリー
// ────────────────────────────────────────
contractsRouter.get('/stats', async (c) => {
  const [statusCounts] = await sql<[{
    active: string
    trial: string
    pending: string
    expired: string
    cancelled: string
  }]>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'active')    AS active,
      COUNT(*) FILTER (WHERE status = 'trial')     AS trial,
      COUNT(*) FILTER (WHERE status = 'pending')   AS pending,
      COUNT(*) FILTER (WHERE status = 'expired')   AS expired,
      COUNT(*) FILTER (WHERE status = 'cancelled') AS cancelled
    FROM contracts
  `

  // 月次支出合計（active + trial のみ）
  const [spendRow] = await sql<[{ total: string }]>`
    SELECT COALESCE(SUM(monthly_amount), 0) AS total
    FROM contracts
    WHERE status IN ('active', 'trial')
  `

  // 更新アラート（60日以内）
  const renewalAlerts = await sql<ContractRow[]>`
    SELECT * FROM contracts
    WHERE renewal_date IS NOT NULL
      AND status IN ('active', 'trial')
      AND renewal_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '60 days'
    ORDER BY renewal_date ASC
    LIMIT 10
  `

  return c.json({
    statusCounts: {
      active: Number(statusCounts.active),
      trial: Number(statusCounts.trial),
      pending: Number(statusCounts.pending),
      expired: Number(statusCounts.expired),
      cancelled: Number(statusCounts.cancelled),
    },
    totalMonthlySpend: Number(spendRow.total),
    renewalAlerts,
  })
})

// ────────────────────────────────────────
// GET /api/contracts  ← 一覧
// ────────────────────────────────────────
contractsRouter.get('/', async (c) => {
  const status = c.req.query('status')
  const q = c.req.query('q')

  const statusFilter = status && status !== 'all'
    ? sql`AND status = ${status}`
    : sql``

  const qFilter = q
    ? sql`AND (tool_name ILIKE ${'%' + q + '%'} OR department ILIKE ${'%' + q + '%'} OR owner ILIKE ${'%' + q + '%'})`
    : sql``

  const contracts = await sql<ContractRow[]>`
    SELECT * FROM contracts
    WHERE 1=1 ${statusFilter} ${qFilter}
    ORDER BY
      CASE status
        WHEN 'active'  THEN 1
        WHEN 'trial'   THEN 2
        WHEN 'pending' THEN 3
        WHEN 'expired' THEN 4
        ELSE 5
      END,
      renewal_date ASC NULLS LAST
  `

  return c.json({ contracts })
})

// ────────────────────────────────────────
// GET /api/contracts/:id  ← 詳細
// ────────────────────────────────────────
contractsRouter.get('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const [contract] = await sql<ContractRow[]>`SELECT * FROM contracts WHERE id = ${id}`
  if (!contract) return c.json({ error: 'Not found' }, 404)
  return c.json({ contract })
})

// ────────────────────────────────────────
// POST /api/contracts  ← 新規作成
// ────────────────────────────────────────
contractsRouter.post('/', async (c) => {
  const body = await c.req.json<ContractInput>()

  if (!body.tool_name) {
    return c.json({ error: 'tool_name is required' }, 400)
  }

  const [contract] = await sql<ContractRow[]>`
    INSERT INTO contracts (
      tool_alias, tool_name, tool_logo_url, status, plan,
      seats, used_seats, monthly_amount, billing_cycle,
      start_date, renewal_date, owner, department, notes
    ) VALUES (
      ${body.tool_alias ?? null},
      ${body.tool_name},
      ${body.tool_logo_url ?? null},
      ${body.status ?? 'active'},
      ${body.plan ?? null},
      ${body.seats ?? 0},
      ${body.used_seats ?? 0},
      ${body.monthly_amount ?? 0},
      ${body.billing_cycle ?? 'monthly'},
      ${body.start_date ?? null},
      ${body.renewal_date ?? null},
      ${body.owner ?? null},
      ${body.department ?? null},
      ${body.notes ?? null}
    )
    RETURNING *
  `

  return c.json({ contract }, 201)
})

// ────────────────────────────────────────
// PUT /api/contracts/:id  ← 更新
// ────────────────────────────────────────
contractsRouter.put('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<Partial<ContractInput>>()

  const [contract] = await sql<ContractRow[]>`
    UPDATE contracts SET
      tool_alias    = COALESCE(${body.tool_alias    ?? null}, tool_alias),
      tool_name     = COALESCE(${body.tool_name     ?? null}, tool_name),
      tool_logo_url = COALESCE(${body.tool_logo_url ?? null}, tool_logo_url),
      status        = COALESCE(${body.status        ?? null}, status),
      plan          = COALESCE(${body.plan          ?? null}, plan),
      seats         = COALESCE(${body.seats         ?? null}, seats),
      used_seats    = COALESCE(${body.used_seats    ?? null}, used_seats),
      monthly_amount = COALESCE(${body.monthly_amount ?? null}, monthly_amount),
      billing_cycle = COALESCE(${body.billing_cycle ?? null}, billing_cycle),
      start_date    = COALESCE(${body.start_date    ?? null}, start_date),
      renewal_date  = COALESCE(${body.renewal_date  ?? null}, renewal_date),
      owner         = COALESCE(${body.owner         ?? null}, owner),
      department    = COALESCE(${body.department    ?? null}, department),
      notes         = COALESCE(${body.notes         ?? null}, notes),
      updated_at    = NOW()
    WHERE id = ${id}
    RETURNING *
  `

  if (!contract) return c.json({ error: 'Not found' }, 404)
  return c.json({ contract })
})

// ────────────────────────────────────────
// DELETE /api/contracts/:id  ← 削除
// ────────────────────────────────────────
contractsRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await sql`DELETE FROM contracts WHERE id = ${id}`
  return c.json({ deleted: true })
})

// ────────────────────────────────────────
// POST /api/contracts/import/csv  ← CSV インポート
// ────────────────────────────────────────
contractsRouter.post('/import/csv', async (c) => {
  const body = await c.req.parseBody()
  const file = body['file']

  if (!file || typeof file === 'string') {
    return c.json({ error: 'CSV file is required (multipart field: file)' }, 400)
  }

  const text = await (file as File).text()
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)

  if (lines.length < 2) {
    return c.json({ error: 'CSV must have a header row and at least one data row' }, 400)
  }

  // ヘッダー行を正規化（BOM 除去 + 小文字変換）
  const rawHeaders = lines[0].replace(/^\uFEFF/, '').split(',').map((h) => h.trim().toLowerCase())

  // 列名の正規化マッピング（日本語・英語どちらでも対応）
  const headerMap: Record<string, string> = {
    'ツール名': 'tool_name', 'tool name': 'tool_name', 'toolname': 'tool_name', 'tool_name': 'tool_name', 'name': 'tool_name',
    'ステータス': 'status', 'status': 'status', '状態': 'status',
    'プラン': 'plan', 'plan': 'plan', 'プラン名': 'plan',
    'シート数': 'seats', 'seats': 'seats', 'ライセンス数': 'seats', 'ライセンス': 'seats',
    '使用シート': 'used_seats', 'used_seats': 'used_seats', '使用数': 'used_seats',
    '月額': 'monthly_amount', 'monthly_amount': 'monthly_amount', '月額費用': 'monthly_amount', '月額（円）': 'monthly_amount',
    '支払い': 'billing_cycle', 'billing_cycle': 'billing_cycle', '支払いサイクル': 'billing_cycle',
    '開始日': 'start_date', 'start_date': 'start_date', '契約開始日': 'start_date',
    '更新日': 'renewal_date', 'renewal_date': 'renewal_date', '契約更新日': 'renewal_date', '更新期限': 'renewal_date',
    '担当者': 'owner', 'owner': 'owner', '担当': 'owner',
    '部署': 'department', 'department': 'department', '部門': 'department',
    'メモ': 'notes', 'notes': 'notes', '備考': 'notes',
    'ロゴurl': 'tool_logo_url', 'logo_url': 'tool_logo_url', 'tool_logo_url': 'tool_logo_url',
    'alias': 'tool_alias', 'tool_alias': 'tool_alias',
  }

  const headers = rawHeaders.map((h) => headerMap[h] ?? h)

  const imported: ContractRow[] = []
  const errors: string[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i])
    const row: Record<string, string> = {}
    headers.forEach((h, j) => { row[h] = values[j]?.trim() ?? '' })

    if (!row.tool_name) {
      errors.push(`行 ${i + 1}: tool_name が空のためスキップ`)
      continue
    }

    // 数値変換（カンマ区切り・¥記号を除去）
    const monthly = Number(row.monthly_amount?.replace(/[¥,￥\s]/g, '') || 0)
    const seats = Number(row.seats?.replace(/[,\s]/g, '') || 0)
    const usedSeats = Number(row.used_seats?.replace(/[,\s]/g, '') || 0)

    // ステータスの正規化
    const statusMap: Record<string, string> = {
      '利用中': 'active', 'active': 'active', '有効': 'active',
      'トライアル': 'trial', 'trial': 'trial',
      '手続き中': 'pending', 'pending': 'pending',
      '期限切れ': 'expired', 'expired': 'expired',
      'キャンセル': 'cancelled', 'cancelled': 'cancelled',
    }
    const status = statusMap[row.status?.toLowerCase() ?? ''] ?? 'active'

    // 支払いサイクル正規化
    const billingCycleMap: Record<string, string> = {
      '月次': 'monthly', 'monthly': 'monthly', '月額': 'monthly',
      '年次': 'yearly', 'yearly': 'yearly', '年額': 'yearly', 'annual': 'yearly',
    }
    const billingCycle = billingCycleMap[row.billing_cycle?.toLowerCase() ?? ''] ?? 'monthly'

    try {
      const [contract] = await sql<ContractRow[]>`
        INSERT INTO contracts (
          tool_alias, tool_name, tool_logo_url, status, plan,
          seats, used_seats, monthly_amount, billing_cycle,
          start_date, renewal_date, owner, department, notes
        ) VALUES (
          ${row.tool_alias || null},
          ${row.tool_name},
          ${row.tool_logo_url || null},
          ${status},
          ${row.plan || null},
          ${seats},
          ${usedSeats},
          ${monthly},
          ${billingCycle},
          ${row.start_date || null},
          ${row.renewal_date || null},
          ${row.owner || null},
          ${row.department || null},
          ${row.notes || null}
        )
        RETURNING *
      `
      imported.push(contract)
    } catch (err) {
      errors.push(`行 ${i + 1} (${row.tool_name}): ${String(err)}`)
    }
  }

  return c.json({
    imported: imported.length,
    errors,
    contracts: imported,
  }, errors.length > 0 && imported.length === 0 ? 400 : 200)
})

// ────────────────────────────────────────
// CSV パーサー（ダブルクォート対応）
// ────────────────────────────────────────
function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (ch === ',' && !inQuotes) {
      result.push(current)
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current)
  return result
}
