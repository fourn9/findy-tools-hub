/**
 * API クライアント
 *
 * - 開発時: VITE_API_URL 未設定 → Vite プロキシ経由で /api/* → localhost:3000
 * - 本番時: VITE_API_URL=https://xxx.railway.app を設定 → 直接リクエスト
 * - バックエンド未起動時: モックデータにフォールバック
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
// モックデータ（バックエンド未起動時のフォールバック）
// ──────────────────────────────────────────────
const MOCK_CONTRACTS: ApiContract[] = [
  { id:1,  tool_alias:'github',    tool_name:'GitHub',                tool_logo_url:'https://cdn.simpleicons.org/github/181717',    status:'active',  plan:'Enterprise',   seats:30, used_seats:26, monthly_amount:45000,  billing_cycle:'monthly', start_date:'2023-04-01', renewal_date:'2025-03-31', owner:'田中 一郎', department:'エンジニアリング', notes:null, category:'dev_tool',      created_at:'2023-04-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' },
  { id:2,  tool_alias:'slack',     tool_name:'Slack',                 tool_logo_url:'https://cdn.simpleicons.org/slack/4A154B',     status:'active',  plan:'Pro',          seats:50, used_seats:46, monthly_amount:38000,  billing_cycle:'monthly', start_date:'2023-01-01', renewal_date:'2025-12-31', owner:'鈴木 花子', department:'全社',             notes:null, category:'communication', created_at:'2023-01-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' },
  { id:3,  tool_alias:'datadog',   tool_name:'Datadog',               tool_logo_url:'https://cdn.simpleicons.org/datadog/632CA6',   status:'active',  plan:'Pro',          seats:10, used_seats:8,  monthly_amount:62000,  billing_cycle:'monthly', start_date:'2024-01-01', renewal_date:'2025-12-31', owner:'佐藤 次郎', department:'SRE',              notes:null, category:'dev_tool',      created_at:'2024-01-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' },
  { id:4,  tool_alias:'figma',     tool_name:'Figma',                 tool_logo_url:'https://cdn.simpleicons.org/figma/F24E1E',     status:'active',  plan:'Organization', seats:15, used_seats:11, monthly_amount:28000,  billing_cycle:'monthly', start_date:'2023-07-01', renewal_date:'2025-06-30', owner:'高橋 美咲', department:'デザイン',         notes:null, category:'dev_tool',      created_at:'2023-07-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' },
  { id:5,  tool_alias:'notion',    tool_name:'Notion',                tool_logo_url:'https://cdn.simpleicons.org/notion/000000',    status:'active',  plan:'Business',     seats:40, used_seats:26, monthly_amount:32000,  billing_cycle:'monthly', start_date:'2022-10-01', renewal_date:'2025-09-30', owner:'伊藤 健司', department:'全社',             notes:null, category:'productivity',  created_at:'2022-10-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' },
  { id:6,  tool_alias:'zoom',      tool_name:'Zoom',                  tool_logo_url:'https://cdn.simpleicons.org/zoom/2D8CFF',      status:'active',  plan:'Business',     seats:50, used_seats:28, monthly_amount:18000,  billing_cycle:'monthly', start_date:'2022-04-01', renewal_date:'2025-03-31', owner:'渡辺 明',   department:'全社',             notes:null, category:'communication', created_at:'2022-04-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' },
  { id:7,  tool_alias:'aws',       tool_name:'AWS',                   tool_logo_url:'https://cdn.simpleicons.org/amazonaws/FF9900', status:'active',  plan:'PayAsYouGo',   seats:0,  used_seats:0,  monthly_amount:280000, billing_cycle:'monthly', start_date:'2020-01-01', renewal_date:null,          owner:'小林 隆',   department:'インフラ',         notes:null, category:'other',         created_at:'2020-01-01T00:00:00Z', updated_at:'2024-01-01T00:00:00Z' },
  { id:8,  tool_alias:'cursor',    tool_name:'Cursor',                tool_logo_url:'https://cdn.simpleicons.org/cursor/000000',    status:'pending', plan:'Pro',          seats:30, used_seats:0,  monthly_amount:60000,  billing_cycle:'monthly', start_date:'2025-04-01', renewal_date:'2026-03-31', owner:'田中 一郎', department:'エンジニアリング', notes:null, category:'ai_tool',       created_at:'2025-01-01T00:00:00Z', updated_at:'2025-01-01T00:00:00Z' },
  { id:9,  tool_alias:'copilot',   tool_name:'GitHub Copilot',        tool_logo_url:'https://cdn.simpleicons.org/github/181717',    status:'active',  plan:'Business',     seats:40, used_seats:28, monthly_amount:160000, billing_cycle:'monthly', start_date:'2024-04-01', renewal_date:'2025-03-31', owner:'田中 一郎', department:'エンジニアリング', notes:null, category:'ai_tool',       created_at:'2024-04-01T00:00:00Z', updated_at:'2024-04-01T00:00:00Z' },
  { id:10, tool_alias:'claude',    tool_name:'Claude API (Anthropic)',tool_logo_url:'https://cdn.simpleicons.org/anthropic/D97757', status:'active',  plan:'API従量課金',  seats:0,  used_seats:0,  monthly_amount:185000, billing_cycle:'monthly', start_date:'2024-06-01', renewal_date:'2025-05-31', owner:'山田 竜也', department:'エンジニアリング', notes:null, category:'ai_tool',       created_at:'2024-06-01T00:00:00Z', updated_at:'2024-06-01T00:00:00Z' },
  { id:11, tool_alias:'chatgpt',   tool_name:'ChatGPT Team',          tool_logo_url:'https://cdn.simpleicons.org/openai/412991',    status:'active',  plan:'Team',         seats:15, used_seats:9,  monthly_amount:75000,  billing_cycle:'monthly', start_date:'2024-03-01', renewal_date:'2025-02-28', owner:'中村 奈々', department:'プロダクト',       notes:null, category:'ai_tool',       created_at:'2024-03-01T00:00:00Z', updated_at:'2024-03-01T00:00:00Z' },
]

const MOCK_PROCUREMENT: ApiProcurementRequest[] = [
  { id:1, tool_alias:'cursor',      tool_name:'Cursor',         tool_logo_url:'https://cdn.simpleicons.org/cursor/000000',  requester_name:'田中 一郎', requester_email:'tanaka@example.com',    status:'reviewing',  reason:'GitHub Copilot と比較してコード補完の精度が高く、エンジニア30名の生産性向上が見込まれます。', expected_seats:30, monthly_budget:60000, priority:'high',   approver_name:null,        approver_comment:null,                                              approved_at:null,          created_at:'2025-01-15T00:00:00Z', updated_at:'2025-01-15T00:00:00Z' },
  { id:2, tool_alias:null,          tool_name:'Perplexity Pro', tool_logo_url:'',                                           requester_name:'中村 奈々', requester_email:'nakamura@example.com',  status:'approved',   reason:'リサーチ業務の効率化。競合調査・技術調査の時間を50%削減できる見込みです。',                    expected_seats:5,  monthly_budget:15000, priority:'medium', approver_name:'山本 部長', approver_comment:'試験導入として承認。3ヶ月後に効果測定を実施してください。', approved_at:'2026-03-08T00:00:00Z', created_at:'2025-02-01T00:00:00Z', updated_at:'2026-03-08T00:00:00Z' },
  { id:3, tool_alias:null,          tool_name:'Dify',           tool_logo_url:'',                                           requester_name:'山田 竜也', requester_email:'yamada@example.com',    status:'reviewing',  reason:'LLM アプリ開発基盤として。プロンプト管理を一元化したい。',                                      expected_seats:10, monthly_budget:45000, priority:'high',   approver_name:null,        approver_comment:null,                                              approved_at:null,          created_at:'2025-02-20T00:00:00Z', updated_at:'2025-02-20T00:00:00Z' },
  { id:4, tool_alias:'linear',      tool_name:'Linear',         tool_logo_url:'https://cdn.simpleicons.org/linear/5E6AD2',  requester_name:'田中 一郎', requester_email:'tanaka@example.com',    status:'contracted', reason:'Jira から移行。エンジニアチームの Issue 管理・スプリント計画の改善。',                           expected_seats:25, monthly_budget:35000, priority:'medium', approver_name:'山本 部長', approver_comment:'承認。来月から移行プロジェクト開始。',                    approved_at:'2026-02-11T00:00:00Z', created_at:'2025-01-05T00:00:00Z', updated_at:'2026-02-11T00:00:00Z' },
  { id:5, tool_alias:'figma',       tool_name:'Figma Dev Mode', tool_logo_url:'https://cdn.simpleicons.org/figma/F24E1E',  requester_name:'高橋 美咲', requester_email:'takahashi@example.com', status:'rejected',   reason:'デザイン・エンジニア間のハンドオフ効率化のために Dev Mode アドオンが必要。',                      expected_seats:15, monthly_budget:20000, priority:'low',   approver_name:'山本 部長', approver_comment:'既存契約に含まれているため却下。IT部門に確認を。',         approved_at:null,          created_at:'2024-12-10T00:00:00Z', updated_at:'2024-12-15T00:00:00Z' },
]

function mockContractStats(): ContractStats {
  const active    = MOCK_CONTRACTS.filter(c => c.status === 'active').length
  const trial     = MOCK_CONTRACTS.filter(c => c.status === 'trial').length
  const pending   = MOCK_CONTRACTS.filter(c => c.status === 'pending').length
  const expired   = MOCK_CONTRACTS.filter(c => c.status === 'expired').length
  const cancelled = MOCK_CONTRACTS.filter(c => c.status === 'cancelled').length
  const total     = MOCK_CONTRACTS.filter(c => c.status === 'active' || c.status === 'trial')
    .reduce((s, c) => s + c.monthly_amount, 0)
  const aiTools   = MOCK_CONTRACTS.filter(c => c.category === 'ai_tool' && c.status === 'active')
  const renewalAlerts = MOCK_CONTRACTS.filter(c => {
    if (!c.renewal_date) return false
    const diff = (new Date(c.renewal_date).getTime() - Date.now()) / 86400000
    return diff >= 0 && diff <= 60
  })
  return {
    statusCounts: { active, trial, pending, expired, cancelled },
    totalMonthlySpend: total,
    renewalAlerts,
    aiToolsStats: {
      count: aiTools.length,
      monthlySpend: aiTools.reduce((s, c) => s + c.monthly_amount, 0),
      unusedCost: aiTools.reduce((s, c) => s + (c.monthly_amount * Math.max(0, c.seats - c.used_seats) / Math.max(c.seats, 1)), 0),
    },
  }
}

async function requestWithFallback<T>(path: string, fallback: T, init?: RequestInit): Promise<T> {
  try {
    return await request<T>(path, init)
  } catch {
    console.info(`[api] バックエンド未起動 → モックデータを使用: ${path}`)
    return fallback
  }
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
  const filtered = MOCK_CONTRACTS.filter(c => {
    if (params?.status && params.status !== 'all' && c.status !== params.status) return false
    if (params?.q && !c.tool_name.toLowerCase().includes(params.q.toLowerCase())) return false
    return true
  })
  return requestWithFallback<{ contracts: ApiContract[] }>(
    `/api/contracts${query}`,
    { contracts: filtered },
  )
}

export const getContractStats = () =>
  requestWithFallback<ContractStats>('/api/contracts/stats', mockContractStats())

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
  const filtered = MOCK_PROCUREMENT.filter(r =>
    !params?.status || params.status === 'all' || r.status === params.status
  )
  return requestWithFallback<{ requests: ApiProcurementRequest[] }>(
    `/api/procurement${query}`,
    { requests: filtered },
  )
}

export const getProcurementStats = () =>
  requestWithFallback<{ reviewing: number; approved: number; rejected: number; total: number }>(
    '/api/procurement/stats',
    {
      reviewing: MOCK_PROCUREMENT.filter(r => r.status === 'reviewing').length,
      approved:  MOCK_PROCUREMENT.filter(r => r.status === 'approved').length,
      rejected:  MOCK_PROCUREMENT.filter(r => r.status === 'rejected').length,
      total:     MOCK_PROCUREMENT.length,
    },
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

