/**
 * Findy Tools スクレイパー
 * https://findy-tools.io/products より製品・レビューデータを取得してPostgreSQLに保存する
 */
import { sql } from '../db'

const BASE_URL = 'https://findy-tools.io'
const DELAY_MS = 1500 // サーバー負荷軽減のため1.5秒間隔

// ──────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────
interface FindyProduct {
  id: number
  alias: string
  pagePath?: string
  name: string
  description?: string
  squareLogoUrl?: string
  reviewsCount?: number
  productVendor?: { id: number; name: string }
  isExistsTrial?: boolean
  isExistsJapaneseSupport?: boolean
  isExistsCustomerSuccess?: boolean
  useCompanyCount?: number
}

interface FindyReview {
  id: number
  pagePath?: string
  title?: string
  goodPoint1?: string
  growthPoint1?: string
  introductionBackground?: string
  explanationWithinCompany?: string
  reviewerJobPositionType?: string
  reviewerJobTypes?: string[]
  employeeSize?: string
  engineerEmployeeSize?: string
  productReviewLabels?: Array<{ name: string }>
  user?: { profile?: { name?: string; avatarUrl?: string } }
  company?: { name?: string }
}

// ──────────────────────────────────────────────
// ユーティリティ
// ──────────────────────────────────────────────
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

async function fetchHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
      'Accept-Language': 'ja,en;q=0.9',
    },
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${url}`)
  return res.text()
}

// ──────────────────────────────────────────────
// HTML パーサー
// ──────────────────────────────────────────────

/**
 * JavaScript文字列リテラルを文字単位でパースして正確にデコードする
 * 正規表現だと "])" が文字列途中にある場合に誤終端する問題を回避
 */
function parseJsStringAt(src: string, quoteIdx: number): string | null {
  if (src[quoteIdx] !== '"') return null
  let i = quoteIdx + 1
  let result = ''

  while (i < src.length) {
    const ch = src[i]
    if (ch === '\\') {
      const next = src[i + 1]
      switch (next) {
        case '"':  result += '"';  i += 2; break
        case '\\': result += '\\'; i += 2; break
        case 'n':  result += '\n'; i += 2; break
        case 'r':  result += '\r'; i += 2; break
        case 't':  result += '\t'; i += 2; break
        case 'u': {
          const hex = src.slice(i + 2, i + 6)
          if (/^[0-9a-fA-F]{4}$/.test(hex)) {
            result += String.fromCharCode(parseInt(hex, 16))
            i += 6
          } else {
            result += next
            i += 2
          }
          break
        }
        default: result += next; i += 2; break
      }
    } else if (ch === '"') {
      return result
    } else {
      result += ch
      i++
    }
  }
  return null
}

function parseRscLines(text: string, blobs: any[]): void {
  for (const line of text.split('\n')) {
    const jsonPart = line.replace(/^\d+:[TI]?\d*,?/, '').trim()
    if (jsonPart.startsWith('{') || jsonPart.startsWith('[')) {
      try {
        blobs.push(JSON.parse(jsonPart))
      } catch {
        // parse失敗は無視（不完全行など）
      }
    }
  }
}

/**
 * Next.js RSC ペイロードから JSON オブジェクト群を抽出する
 */
function extractJsonBlobs(html: string): any[] {
  const blobs: any[] = []

  // 1) __NEXT_DATA__ (Pages Router フォールバック)
  const ndMatch = html.match(
    /<script[^>]*id="__NEXT_DATA__"[^>]*>([\s\S]*?)<\/script>/,
  )
  if (ndMatch) {
    try { blobs.push(JSON.parse(ndMatch[1])) } catch {}
  }

  // 2) App Router: self.__next_f.push([1, "...RSCペイロード..."])
  const pushMarker = 'self.__next_f.push([1,"'
  let searchFrom = 0
  while (true) {
    const markerIdx = html.indexOf(pushMarker, searchFrom)
    if (markerIdx === -1) break
    const quoteIdx = markerIdx + pushMarker.length - 1
    const content = parseJsStringAt(html, quoteIdx)
    if (content !== null) parseRscLines(content, blobs)
    searchFrom = markerIdx + pushMarker.length
  }

  return blobs
}

function collectProducts(obj: any, results: FindyProduct[] = []): FindyProduct[] {
  if (!obj || typeof obj !== 'object') return results
  if (obj.__typename === 'Product' && typeof obj.id === 'number' && obj.alias) {
    if (!results.find((p) => p.id === obj.id)) results.push(obj as FindyProduct)
    return results
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectProducts(item, results)
  } else {
    for (const val of Object.values(obj)) collectProducts(val, results)
  }
  return results
}

function collectReviews(obj: any, results: FindyReview[] = []): FindyReview[] {
  if (!obj || typeof obj !== 'object') return results
  if (obj.__typename === 'ProductReview' && typeof obj.id === 'number') {
    if (!results.find((r) => r.id === obj.id)) results.push(obj as FindyReview)
    return results
  }
  if (Array.isArray(obj)) {
    for (const item of obj) collectReviews(item, results)
  } else {
    for (const val of Object.values(obj)) collectReviews(val, results)
  }
  return results
}

// ──────────────────────────────────────────────
// DB 書き込み（async / PostgreSQL）
// ──────────────────────────────────────────────
async function upsertTool(p: FindyProduct): Promise<void> {
  const pagePath = p.pagePath ?? `/products/${p.alias}/${p.id}`

  await sql`
    INSERT INTO tools (
      id, alias, page_path, name, description, logo_url,
      reviews_count, vendor_id, vendor_name,
      is_trial, is_japanese_support, is_customer_success,
      use_company_count, raw_data, updated_at
    ) VALUES (
      ${p.id}, ${p.alias}, ${pagePath}, ${p.name},
      ${p.description ?? null}, ${p.squareLogoUrl ?? null},
      ${p.reviewsCount ?? 0},
      ${p.productVendor?.id ?? null}, ${p.productVendor?.name ?? null},
      ${p.isExistsTrial ? 1 : 0}, ${p.isExistsJapaneseSupport ? 1 : 0}, ${p.isExistsCustomerSuccess ? 1 : 0},
      ${p.useCompanyCount ?? null}, ${JSON.stringify(p)}, NOW()
    )
    ON CONFLICT (alias) DO UPDATE SET
      name                = EXCLUDED.name,
      page_path           = COALESCE(EXCLUDED.page_path, tools.page_path),
      description         = COALESCE(EXCLUDED.description, tools.description),
      logo_url            = COALESCE(EXCLUDED.logo_url, tools.logo_url),
      reviews_count       = EXCLUDED.reviews_count,
      vendor_id           = COALESCE(EXCLUDED.vendor_id, tools.vendor_id),
      vendor_name         = COALESCE(EXCLUDED.vendor_name, tools.vendor_name),
      is_trial            = EXCLUDED.is_trial,
      is_japanese_support = EXCLUDED.is_japanese_support,
      is_customer_success = EXCLUDED.is_customer_success,
      use_company_count   = COALESCE(EXCLUDED.use_company_count, tools.use_company_count),
      raw_data            = EXCLUDED.raw_data,
      updated_at          = NOW()
  `
}

async function upsertReview(toolId: number, r: FindyReview): Promise<void> {
  await sql`
    INSERT INTO reviews (
      tool_id, external_id, page_path, title,
      good_point, growth_point, introduction_background, explanation_within_company,
      reviewer_name, reviewer_avatar_url, reviewer_job_position, reviewer_job_types,
      company_name, employee_size, engineer_employee_size, labels
    ) VALUES (
      ${toolId}, ${String(r.id)}, ${r.pagePath ?? null}, ${r.title ?? null},
      ${r.goodPoint1 ?? null}, ${r.growthPoint1 ?? null},
      ${r.introductionBackground ?? null}, ${r.explanationWithinCompany ?? null},
      ${r.user?.profile?.name ?? null}, ${r.user?.profile?.avatarUrl ?? null},
      ${r.reviewerJobPositionType ?? null}, ${JSON.stringify(r.reviewerJobTypes ?? [])},
      ${r.company?.name ?? null}, ${r.employeeSize ?? null}, ${r.engineerEmployeeSize ?? null},
      ${JSON.stringify((r.productReviewLabels ?? []).map((l) => l.name))}
    )
    ON CONFLICT (tool_id, external_id) DO NOTHING
  `
}

// ──────────────────────────────────────────────
// スクレイプ本体
// ──────────────────────────────────────────────

async function scrapeProductList(
  onPage: (page: number, count: number) => void,
): Promise<number> {
  let total = 0
  let emptyStreak = 0

  for (let page = 1; page <= 300; page++) {
    const url = `${BASE_URL}/products?page=${page}`
    let html: string

    try {
      html = await fetchHtml(url)
    } catch (err) {
      console.warn(`  Warning: failed to fetch page ${page}:`, err)
      emptyStreak++
      if (emptyStreak >= 3) {
        console.log(`  3 consecutive fetch errors, stopping.`)
        break
      }
      await sleep(DELAY_MS)
      continue
    }

    const blobs = extractJsonBlobs(html)
    const products = blobs.flatMap((b) => collectProducts(b))

    if (products.length === 0) {
      emptyStreak++
      console.log(`  No products on page ${page} (streak: ${emptyStreak})`)
      if (emptyStreak >= 3) {
        console.log(`  3 consecutive empty pages, stopping.`)
        break
      }
    } else {
      emptyStreak = 0
      for (const p of products) await upsertTool(p)
      total += products.length
      onPage(page, total)
    }

    await sleep(DELAY_MS)
  }

  return total
}

async function scrapeProductReviews(
  onProduct: (alias: string, reviewCount: number) => void,
): Promise<void> {
  const tools = await sql<{ id: number; alias: string; page_path: string | null }[]>`
    SELECT id, alias, page_path FROM tools
    WHERE reviews_count > 0
    ORDER BY reviews_count DESC
  `

  console.log(`  Fetching reviews for ${tools.length} tools...`)

  for (const tool of tools) {
    try {
      const path = tool.page_path ?? `/products/${tool.alias}/${tool.id}`
      const url = `${BASE_URL}${path}`
      const html = await fetchHtml(url)
      const blobs = extractJsonBlobs(html)
      const reviews = blobs.flatMap((b) => collectReviews(b))

      for (const r of reviews) await upsertReview(tool.id, r)
      onProduct(tool.alias, reviews.length)
      await sleep(DELAY_MS)
    } catch (err) {
      console.warn(`  Warning: failed to fetch reviews for ${tool.alias}:`, err)
    }
  }
}

// ──────────────────────────────────────────────
// 公開 API
// ──────────────────────────────────────────────

export type SyncMode = 'full' | 'list_only' | 'reviews_only'

/**
 * スクレイプを実行して取得したツール数を返す。
 * 完了後の sync_log 更新は呼び出し元（sync.ts）が行う。
 */
export async function scrapeTools(mode: SyncMode = 'full'): Promise<number> {
  console.log(`🔄 Findy Tools sync started (mode: ${mode})`)

  let toolsSynced = 0

  if (mode === 'full' || mode === 'list_only') {
    toolsSynced = await scrapeProductList((page, total) => {
      console.log(`  [list] page ${page} done, total: ${total}`)
    })
  }

  if (mode === 'full' || mode === 'reviews_only') {
    await scrapeProductReviews((alias, count) => {
      console.log(`  [reviews] ${alias}: ${count} reviews`)
    })
  }

  console.log(`✅ Sync complete — ${toolsSynced} tools`)
  return toolsSynced
}
