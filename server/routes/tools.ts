import { Hono } from 'hono'
import db from '../db'

export const toolsRouter = new Hono()

// GET /api/tools?page=1&limit=20&q=github&vendor=HashiCorp
toolsRouter.get('/', (c) => {
  const page = Math.max(1, Number(c.req.query('page') ?? 1))
  const limit = Math.min(100, Math.max(1, Number(c.req.query('limit') ?? 20)))
  const q = c.req.query('q')?.trim()
  const vendor = c.req.query('vendor')?.trim()
  const offset = (page - 1) * limit

  const conditions: string[] = []
  const params: (string | number)[] = []

  if (q) {
    conditions.push('(name LIKE ? OR description LIKE ? OR vendor_name LIKE ?)')
    params.push(`%${q}%`, `%${q}%`, `%${q}%`)
  }
  if (vendor) {
    conditions.push('vendor_name = ?')
    params.push(vendor)
  }

  const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : ''

  const total =
    (
      db
        .query<{ count: number }, (string | number)[]>(
          `SELECT COUNT(*) as count FROM tools ${where}`,
        )
        .get(...params) as { count: number }
    )?.count ?? 0

  const tools = db
    .query(`SELECT * FROM tools ${where} ORDER BY reviews_count DESC LIMIT ? OFFSET ?`)
    .all(...params, limit, offset)

  return c.json({ tools, total, page, totalPages: Math.ceil(total / limit) })
})

// GET /api/tools/:alias
toolsRouter.get('/:alias', (c) => {
  const { alias } = c.req.param()

  const tool = db.query('SELECT * FROM tools WHERE alias = ?').get(alias)
  if (!tool) return c.json({ error: 'Not found' }, 404)

  const reviews = db
    .query(
      `SELECT * FROM reviews WHERE tool_id = ?
       ORDER BY scraped_at DESC`,
    )
    .all((tool as any).id)

  return c.json({ ...tool, reviews })
})

// GET /api/tools/:alias/reviews
toolsRouter.get('/:alias/reviews', (c) => {
  const { alias } = c.req.param()

  const tool = db.query('SELECT id FROM tools WHERE alias = ?').get(alias) as
    | { id: number }
    | undefined
  if (!tool) return c.json({ error: 'Not found' }, 404)

  const reviews = db
    .query(
      `SELECT * FROM reviews WHERE tool_id = ?
       ORDER BY scraped_at DESC`,
    )
    .all(tool.id)

  return c.json({ reviews })
})
