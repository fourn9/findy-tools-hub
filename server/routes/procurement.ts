import { Hono } from 'hono'
import { sql } from '../db'

export const procurementRouter = new Hono()

interface RequestRow {
  id: number
  tool_alias: string | null
  tool_name: string
  tool_logo_url: string | null
  requester_name: string
  requester_email: string | null
  status: string
  reason: string | null
  expected_seats: number
  monthly_budget: number
  priority: string
  approver_name: string | null
  approver_comment: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

interface RequestInput {
  tool_alias?: string
  tool_name: string
  tool_logo_url?: string
  requester_name: string
  requester_email?: string
  reason?: string
  expected_seats?: number
  monthly_budget?: number
  priority?: string
}

// GET /api/procurement  ← 一覧
procurementRouter.get('/', async (c) => {
  const status = c.req.query('status')
  const statusFilter = status && status !== 'all'
    ? sql`AND status = ${status}`
    : sql``

  const requests = await sql<RequestRow[]>`
    SELECT * FROM procurement_requests
    WHERE 1=1 ${statusFilter}
    ORDER BY
      CASE priority WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END,
      created_at DESC
  `
  return c.json({ requests })
})

// GET /api/procurement/stats  ← ダッシュボード用
procurementRouter.get('/stats', async (c) => {
  const [counts] = await sql<[{
    reviewing: string
    approved: string
    rejected: string
    total: string
  }]>`
    SELECT
      COUNT(*) FILTER (WHERE status = 'reviewing') AS reviewing,
      COUNT(*) FILTER (WHERE status = 'approved')  AS approved,
      COUNT(*) FILTER (WHERE status = 'rejected')  AS rejected,
      COUNT(*) AS total
    FROM procurement_requests
  `
  return c.json({
    reviewing: Number(counts.reviewing),
    approved: Number(counts.approved),
    rejected: Number(counts.rejected),
    total: Number(counts.total),
  })
})

// POST /api/procurement  ← 申請作成
procurementRouter.post('/', async (c) => {
  const body = await c.req.json<RequestInput>()
  if (!body.tool_name || !body.requester_name) {
    return c.json({ error: 'tool_name and requester_name are required' }, 400)
  }

  const [req] = await sql<RequestRow[]>`
    INSERT INTO procurement_requests (
      tool_alias, tool_name, tool_logo_url,
      requester_name, requester_email, status,
      reason, expected_seats, monthly_budget, priority
    ) VALUES (
      ${body.tool_alias ?? null},
      ${body.tool_name},
      ${body.tool_logo_url ?? null},
      ${body.requester_name},
      ${body.requester_email ?? null},
      'reviewing',
      ${body.reason ?? null},
      ${body.expected_seats ?? 0},
      ${body.monthly_budget ?? 0},
      ${body.priority ?? 'medium'}
    )
    RETURNING *
  `
  return c.json({ request: req }, 201)
})

// PUT /api/procurement/:id/approve  ← 承認
procurementRouter.put('/:id/approve', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ approver_name: string; comment?: string }>()

  const [req] = await sql<RequestRow[]>`
    UPDATE procurement_requests
    SET status = 'approved',
        approver_name = ${body.approver_name},
        approver_comment = ${body.comment ?? null},
        approved_at = NOW(),
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  if (!req) return c.json({ error: 'Not found' }, 404)
  return c.json({ request: req })
})

// PUT /api/procurement/:id/reject  ← 却下
procurementRouter.put('/:id/reject', async (c) => {
  const id = Number(c.req.param('id'))
  const body = await c.req.json<{ approver_name: string; comment?: string }>()

  const [req] = await sql<RequestRow[]>`
    UPDATE procurement_requests
    SET status = 'rejected',
        approver_name = ${body.approver_name},
        approver_comment = ${body.comment ?? null},
        updated_at = NOW()
    WHERE id = ${id}
    RETURNING *
  `
  if (!req) return c.json({ error: 'Not found' }, 404)
  return c.json({ request: req })
})

// DELETE /api/procurement/:id
procurementRouter.delete('/:id', async (c) => {
  const id = Number(c.req.param('id'))
  await sql`DELETE FROM procurement_requests WHERE id = ${id}`
  return c.json({ deleted: true })
})
