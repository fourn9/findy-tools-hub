/**
 * API クライアント
 *
 * - 開発時: VITE_API_URL 未設定 → Vite プロキシ経由で /api/* → localhost:3000
 * - 本番時: VITE_API_URL=https://xxx.railway.app を設定 → 直接リクエスト
 */
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json', ...init?.headers },
    ...init,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`API ${res.status}: ${text || res.statusText}`)
  }
  return res.json() as Promise<T>
}

// ──────────────────────────────────────────────
// ヘルス
// ──────────────────────────────────────────────
export const getHealth = () =>
  request<{ status: string; timestamp: string; version: string }>('/api/health')

// ──────────────────────────────────────────────
// ツール一覧 / 詳細
// ──────────────────────────────────────────────
export interface ApiTool {
  id: number
  alias: string
  page_path: string
  name: string
  description: string | null
  logo_url: string | null
  reviews_count: number
  vendor_name: string | null
  is_trial: number
  is_japanese_support: number
  is_customer_success: number
  use_company_count: number | null
  updated_at: string
}

export interface ApiReview {
  id: number
  tool_id: number
  title: string | null
  good_point: string | null
  growth_point: string | null
  introduction_background: string | null
  reviewer_job_position: string | null
  company_name: string | null
  employee_size: string | null
  engineer_employee_size: string | null
  labels: string // JSON array string
}

export interface ToolsResponse {
  tools: ApiTool[]
  total: number
  page: number
  totalPages: number
}

export const getTools = (params?: {
  page?: number
  limit?: number
  q?: string
  vendor?: string
}) => {
  const qs = new URLSearchParams()
  if (params?.page) qs.set('page', String(params.page))
  if (params?.limit) qs.set('limit', String(params.limit))
  if (params?.q) qs.set('q', params.q)
  if (params?.vendor) qs.set('vendor', params.vendor)
  const query = qs.toString() ? `?${qs}` : ''
  return request<ToolsResponse>(`/api/tools${query}`)
}

export const getTool = (alias: string) =>
  request<ApiTool & { reviews: ApiReview[] }>(`/api/tools/${alias}`)

// ──────────────────────────────────────────────
// 同期
// ──────────────────────────────────────────────
export type SyncMode = 'full' | 'list_only' | 'reviews_only'

export interface SyncStatus {
  running: boolean
  toolCount: number
  reviewCount: number
  latest: {
    id: number
    started_at: string
    completed_at: string | null
    tools_synced: number
    status: 'running' | 'completed' | 'failed'
    error: string | null
  } | null
}

export const getSyncStatus = () => request<SyncStatus>('/api/sync/status')

export const startSync = (mode: SyncMode = 'full') =>
  request<{ started: boolean; logId: number; mode: SyncMode }>('/api/sync', {
    method: 'POST',
    body: JSON.stringify({ mode }),
  })
