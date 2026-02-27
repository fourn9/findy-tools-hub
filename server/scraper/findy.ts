/**
 * Findy Tools スクレイパー
 * https://findy-tools.io/products より製品・レビューデータを取得してSQLiteに保存する
 */
import db from '../db'

const BASE_URL = 'https://findy-tools.io'
const DELAY_MS = 1500 // サーバー負荷軽減のため1.5秒間隔

// ──────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────
interface FindyProduct {
  id: number
  alias: string
  pagePath: string
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
 * Next.js RSC ペイロードから JSON オブジェクト群を抽出する
 * __NEXT_DATA__ と self.__next_f の両方に対応
 */
function extractJsonBlobs(html: string): any[] {
  const blobs: any[] = []

  // __NEXT_DATA__ (Pages Router)
  const ndMatch = html.match(
    /<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/,
  )
  if (ndMatch) {
    try {
      blobs.push(JSON.parse(ndMatch[1]))
    } catch {}
  }

  // self.__next_f.push([1, "..."]) — App Router RSC payload (JSON文字列が入れ子)
  for (const m of html.matchAll(/self\.__next_f\.push\(\[1,"([\s\S]*?)"\]\)/g)) {
    try {
      const decoded = m[1].replace(/\\n/g, '\n').replace(/\\"/g, '"').replace(/\\\\/g, '\\')
      // RSC フォーマット: 行頭に "数字:" がついた JSON
      for (const line of decoded.split('\n')) {
        const jsonPart = line.replace(/^\d+:/, '')
        if (jsonPart.startsWith('{') || jsonPart.startsWith('[')) {
          try {
            blobs.push(JSON.parse(jsonPart))
          } catch {}
        }
      }
    } catch {}
  }

  return blobs
}

/** JSON blob から再帰的に FindyProduct 配列を集める */
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

/** JSON blob から再帰的に FindyReview 配列を集める */
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
// DB 書き込み
// ──────────────────────────────────────────────
function upsertTool(p: FindyProduct) {
  db.run(
    `INSERT INTO tools (
      id, alias, page_path, name, description, logo_url,
      reviews_count, vendor_id, vendor_name,
      is_trial, is_japanese_support, is_customer_success,
      use_company_count, raw_data, updated_at
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,datetime('now'))
    ON CONFLICT(alias) DO UPDATE SET
      name                 = excluded.name,
      description          = COALESCE(excluded.description, description),
      logo_url             = COALESCE(excluded.logo_url, logo_url),
      reviews_count        = excluded.reviews_count,
      vendor_id            = COALESCE(excluded.vendor_id, vendor_id),
      vendor_name          = COALESCE(excluded.vendor_name, vendor_name),
      is_trial             = excluded.is_trial,
      is_japanese_support  = excluded.is_japanese_support,
      is_customer_success  = excluded.is_customer_success,
      use_company_count    = COALESCE(excluded.use_company_count, use_company_count),
      raw_data             = excluded.raw_data,
      updated_at           = datetime('now')`,
    [
      p.id,
      p.alias,
      p.pagePath,
      p.name,
      p.description ?? null,
      p.squareLogoUrl ?? null,
      p.reviewsCount ?? 0,
      p.productVendor?.id ?? null,
      p.productVendor?.name ?? null,
      p.isExistsTrial ? 1 : 0,
      p.isExistsJapaneseSupport ? 1 : 0,
      p.isExistsCustomerSuccess ? 1 : 0,
      p.useCompanyCount ?? null,
      JSON.stringify(p),
    ],
  )
}

function upsertReview(toolId: number, r: FindyReview) {
  db.run(
    `INSERT OR IGNORE INTO reviews (
      tool_id, external_id, page_path, title,
      good_point, growth_point, introduction_background, explanation_within_company,
      reviewer_name, reviewer_avatar_url, reviewer_job_position, reviewer_job_types,
      company_name, employee_size, engineer_employee_size, labels
    ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      toolId,
      String(r.id),
      r.pagePath ?? null,
      r.title ?? null,
      r.goodPoint1 ?? null,
      r.growthPoint1 ?? null,
      r.introductionBackground ?? null,
      r.explanationWithinCompany ?? null,
      r.user?.profile?.name ?? null,
      r.user?.profile?.avatarUrl ?? null,
      r.reviewerJobPositionType ?? null,
      JSON.stringify(r.reviewerJobTypes ?? []),
      r.company?.name ?? null,
      r.employeeSize ?? null,
      r.engineerEmployeeSize ?? null,
      JSON.stringify((r.productReviewLabels ?? []).map((l) => l.name)),
    ],
  )
}

// ──────────────────────────────────────────────
// スクレイプ本体
// ──────────────────────────────────────────────

/** 製品一覧ページ (全159ページ) からツール基本情報を取得 */
async function scrapeProductList(
  onPage: (page: number, count: number) => void,
): Promise<number> {
  let total = 0

  for (let page = 1; page <= 200; page++) {
    const html = await fetchHtml(`${BASE_URL}/products?page=${page}`)
    const blobs = extractJsonBlobs(html)
    const products = blobs.flatMap((b) => collectProducts(b))

    if (products.length === 0) {
      console.log(`  No products on page ${page}, stopping.`)
      break
    }

    for (const p of products) upsertTool(p)
    total += products.length
    onPage(page, total)
    await sleep(DELAY_MS)
  }

  return total
}

/** 製品詳細ページからレビューを取得（reviews_count > 0 の製品のみ） */
async function scrapeProductReviews(
  onProduct: (alias: string, reviewCount: number) => void,
): Promise<void> {
  const tools = db
    .query<{ id: number; alias: string; page_path: string }, []>(
      'SELECT id, alias, page_path FROM tools WHERE reviews_count > 0 ORDER BY reviews_count DESC',
    )
    .all()

  console.log(`  Fetching reviews for ${tools.length} tools...`)

  for (const tool of tools) {
    try {
      const url = `${BASE_URL}${tool.page_path}`
      const html = await fetchHtml(url)
      const blobs = extractJsonBlobs(html)
      const reviews = blobs.flatMap((b) => collectReviews(b))

      for (const r of reviews) upsertReview(tool.id, r)
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

export async function scrapeTools(
  onComplete: (toolsSynced: number) => void,
  mode: SyncMode = 'full',
): Promise<void> {
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
  onComplete(toolsSynced)
}
