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
// 同期のトリガーはサーバー起動時の自動実行のみ。
// フロントエンドはステータスの読み取りのみ行う。
// ──────────────────────────────────────────────
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

// ──────────────────────────────────────────────
// 契約管理 (Contracts)
// ──────────────────────────────────────────────
export type ContractCategory =
  | 'ai_tool' | 'dev_tool' | 'productivity'
  | 'communication' | 'security' | 'hr' | 'finance' | 'other'

export interface ApiContract {
  id: number
  tool_alias: string | null
  tool_name: string
  tool_logo_url: string | null
  status: 'active' | 'trial' | 'pending' | 'expired' | 'cancelled'
  plan: string | null
  seats: number
  used_seats: number
  monthly_amount: number
  billing_cycle: 'monthly' | 'yearly'
  start_date: string | null
  renewal_date: string | null
  owner: string | null
  department: string | null
  notes: string | null
  category: ContractCategory
  created_at: string
  updated_at: string
}

export interface ContractStats {
  statusCounts: {
    active: number
    trial: number
    pending: number
    expired: number
    cancelled: number
  }
  totalMonthlySpend: number
  renewalAlerts: ApiContract[]
  aiToolsStats: {
    count: number
    monthlySpend: number
    unusedCost: number
  }
}

export const getContracts = (params?: { status?: string; q?: string }) => {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  if (params?.q) qs.set('q', params.q)
  const query = qs.toString() ? `?${qs}` : ''
  return request<{ contracts: ApiContract[] }>(`/api/contracts${query}`)
}

export const getContractStats = () =>
  request<ContractStats>('/api/contracts/stats')

export const createContract = (data: Partial<ApiContract>) =>
  request<{ contract: ApiContract }>('/api/contracts', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const updateContract = (id: number, data: Partial<ApiContract>) =>
  request<{ contract: ApiContract }>(`/api/contracts/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data),
  })

export const deleteContract = (id: number) =>
  request<{ deleted: boolean }>(`/api/contracts/${id}`, { method: 'DELETE' })

export const importContractsCsv = (file: File) => {
  const form = new FormData()
  form.append('file', file)
  return fetch(`${(import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''}/api/contracts/import/csv`, {
    method: 'POST',
    body: form,
  }).then(async (res) => {
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`API ${res.status}: ${text || res.statusText}`)
    }
    return res.json() as Promise<{ imported: number; errors: string[]; contracts: ApiContract[] }>
  })
}

// ──────────────────────────────────────────────
// 調達申請 (Procurement)
// ──────────────────────────────────────────────
export interface ApiProcurementRequest {
  id: number
  tool_alias: string | null
  tool_name: string
  tool_logo_url: string | null
  requester_name: string
  requester_email: string | null
  status: 'draft' | 'reviewing' | 'approved' | 'rejected' | 'contracted'
  reason: string | null
  expected_seats: number
  monthly_budget: number
  priority: 'low' | 'medium' | 'high'
  approver_name: string | null
  approver_comment: string | null
  approved_at: string | null
  created_at: string
  updated_at: string
}

export const getProcurementRequests = (params?: { status?: string }) => {
  const qs = new URLSearchParams()
  if (params?.status) qs.set('status', params.status)
  const query = qs.toString() ? `?${qs}` : ''
  return request<{ requests: ApiProcurementRequest[] }>(`/api/procurement${query}`)
}

export const getProcurementStats = () =>
  request<{ reviewing: number; approved: number; rejected: number; total: number }>(
    '/api/procurement/stats'
  )

export const createProcurementRequest = (data: Partial<ApiProcurementRequest>) =>
  request<{ request: ApiProcurementRequest }>('/api/procurement', {
    method: 'POST',
    body: JSON.stringify(data),
  })

export const approveProcurementRequest = (id: number, approverName: string, comment?: string) =>
  request<{ request: ApiProcurementRequest }>(`/api/procurement/${id}/approve`, {
    method: 'PUT',
    body: JSON.stringify({ approver_name: approverName, comment }),
  })

export const rejectProcurementRequest = (id: number, approverName: string, comment?: string) =>
  request<{ request: ApiProcurementRequest }>(`/api/procurement/${id}/reject`, {
    method: 'PUT',
    body: JSON.stringify({ approver_name: approverName, comment }),
  })

// ──────────────────────────────────────────────
// 交渉スクリプト生成 (Negotiate)
// SSE ストリーミング: POST /api/negotiate/script
// ──────────────────────────────────────────────

/**
 * Claude API を使って交渉スクリプトをストリーミング生成する。
 * @param contract  対象の契約データ
 * @param onChunk   テキスト差分を受け取るコールバック
 * @param onDone    完了時コールバック
 * @param onError   エラー時コールバック
 */
export async function generateNegotiationScript(
  contract: Partial<ApiContract>,
  onChunk: (text: string) => void,
  onDone: () => void,
  onError: (err: string) => void,
): Promise<void> {
  const url = `${BASE}/api/negotiate/script`
  let res: Response
  try {
    res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ contract }),
    })
  } catch (err) {
    onError(`ネットワークエラー: ${String(err)}`)
    return
  }

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    onError(`API ${res.status}: ${text || res.statusText}`)
    return
  }

  const reader = res.body?.getReader()
  if (!reader) {
    onError('レスポンスストリームを取得できませんでした')
    return
  }

  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break

      buffer += decoder.decode(value, { stream: true })
      const lines = buffer.split('\n')
      buffer = lines.pop() ?? ''

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue
        const data = line.slice(6).trim()
        if (data === '[DONE]') {
          onDone()
          return
        }
        try {
          const parsed = JSON.parse(data) as { text?: string; error?: string }
          if (parsed.text)  onChunk(parsed.text)
          if (parsed.error) onError(parsed.error)
        } catch {
          // parse 失敗は無視
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
  onDone()
}
