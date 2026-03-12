import { Hono } from 'hono'
import { sql } from '../db'

export const toolsRouter = new Hono()

// GET /api/tools?page=1&limit=20&q=github&vendor=HashiCorp
toolsRouter.get('/', async (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)))
  const q = c.req.query('q')?.trim()
  const vendor = c.req.query('vendor')?.trim()
  const offset = (page - 1) * limit

  // WHERE 1=1 に続けて条件フラグメントを AND で追加する
  const qFilter = q
    ? sql`AND (name ILIKE ${'%' + q + '%'} OR description ILIKE ${'%' + q + '%'} OR vendor_name ILIKE ${'%' + q + '%'})`
    : sql``
  const vendorFilter = vendor ? sql`AND vendor_name = ${vendor}` : sql``

  const [{ count }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) AS count FROM tools WHERE 1=1 ${qFilter} ${vendorFilter}
  `
  const tools = await sql`
    SELECT * FROM tools
    WHERE 1=1 ${qFilter} ${vendorFilter}
    ORDER BY reviews_count DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  const total = Number(count)
  return c.json({ tools, total, page, totalPages: Math.ceil(total / limit) })
})

// GET /api/tools/:alias
toolsRouter.get('/:alias', async (c) => {
  const { alias } = c.req.param()

  const [tool] = await sql`SELECT * FROM tools WHERE alias = ${alias}`
  if (!tool) return c.json({ error: 'Not found' }, 404)

  const reviews = await sql`
    SELECT * FROM reviews WHERE tool_id = ${tool.id}
    ORDER BY scraped_at DESC
  `

  return c.json({ ...tool, reviews })
})

// GET /api/tools/:alias/reviews
toolsRouter.get('/:alias/reviews', async (c) => {
  const { alias } = c.req.param()

  const [tool] = await sql<{ id: number }[]>`SELECT id FROM tools WHERE alias = ${alias}`
  if (!tool) return c.json({ error: 'Not found' }, 404)

  const reviews = await sql`
    SELECT * FROM reviews WHERE tool_id = ${tool.id}
    ORDER BY scraped_at DESC
  `

  return c.json({ reviews })
})
