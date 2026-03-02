import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import {
  TrendingUp, FileText, AlertTriangle, CheckCircle2,
  Clock, ArrowUpRight, Package, Users, DollarSign, Loader2,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import {
  getContractStats,
  getProcurementStats,
  getContracts,
  getProcurementRequests,
  type ApiContract,
  type ApiProcurementRequest,
  type ContractStats,
} from '../lib/api'

// ──────────────────────────────────────────────
// ステータスバッジ
// ──────────────────────────────────────────────
function ContractStatusBadge({ status }: { status: ApiContract['status'] }) {
  const map: Record<ApiContract['status'], string> = {
    active:    'bg-green-100 text-green-700',
    trial:     'bg-blue-100 text-blue-700',
    pending:   'bg-yellow-100 text-yellow-700',
    expired:   'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  const label: Record<ApiContract['status'], string> = {
    active: '利用中', trial: 'トライアル', pending: '手続き中',
    expired: '期限切れ', cancelled: 'キャンセル',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {label[status]}
    </span>
  )
}

function RequestStatusBadge({ status }: { status: ApiProcurementRequest['status'] }) {
  const map: Record<ApiProcurementRequest['status'], string> = {
    draft:      'bg-gray-100 text-gray-500',
    reviewing:  'bg-yellow-100 text-yellow-700',
    approved:   'bg-green-100 text-green-700',
    rejected:   'bg-red-100 text-red-700',
    contracted: 'bg-indigo-100 text-indigo-700',
  }
  const label: Record<ApiProcurementRequest['status'], string> = {
    draft: '下書き', reviewing: '審査中', approved: '承認済',
    rejected: '却下', contracted: '契約済',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {label[status]}
    </span>
  )
}

// ──────────────────────────────────────────────
// ダッシュボードメイン
// ──────────────────────────────────────────────
export function Dashboard() {
  const [contractStats, setContractStats] = useState<ContractStats | null>(null)
  const [procStats, setProcStats] = useState<{ reviewing: number; total: number } | null>(null)
  const [recentContracts, setRecentContracts] = useState<ApiContract[]>([])
  const [recentRequests, setRecentRequests] = useState<ApiProcurementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [apiError, setApiError] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true)
        setApiError(false)
        const [cStats, pStats, contractsRes, requestsRes] = await Promise.all([
          getContractStats(),
          getProcurementStats(),
          getContracts(),
          getProcurementRequests({ status: 'reviewing' }),
        ])
        setContractStats(cStats)
        setProcStats(pStats)
        setRecentContracts(contractsRes.contracts.slice(0, 5))
        setRecentRequests(requestsRes.requests.slice(0, 4))
      } catch {
        setApiError(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  const today = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric', month: 'long', day: 'numeric'
  })

  // ダッシュボード KPI
  const totalMonthlySpend = contractStats?.totalMonthlySpend ?? 0
  const activeCount = contractStats?.statusCounts.active ?? 0
  const trialCount = contractStats?.statusCounts.trial ?? 0
  const reviewingCount = procStats?.reviewing ?? 0
  const renewalAlerts = contractStats?.renewalAlerts ?? []

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">{today} 現在</p>
      </div>

      {/* API エラーバナー */}
      {apiError && !loading && (
        <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl p-4">
          ⚠️ バックエンドに接続できません。サーバーが起動しているか確認してください。
          <br />
          <span className="text-xs text-amber-600">
            CSV インポートでデータを追加すると、ここにリアルタイムで反映されます。
          </span>
        </div>
      )}

      {/* KPI カード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">契約中ツール</p>
            <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse w-16" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{activeCount}</p>
              <p className="text-xs text-gray-500 mt-1">
                <span className="text-blue-600">{trialCount}件</span> トライアル中
              </p>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">今月の支出</p>
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse w-24" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">
                {totalMonthlySpend > 0
                  ? `¥${(totalMonthlySpend / 10000).toFixed(0)}`
                  : '¥0'}
                <span className="text-lg">万</span>
              </p>
              <p className="text-xs text-gray-500 mt-1">アクティブ + トライアル合計</p>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">申請中</p>
            <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse w-12" />
          ) : (
            <>
              <p className="text-3xl font-bold text-gray-900">{reviewingCount}</p>
              <p className="text-xs text-gray-500 mt-1">承認待ちの調達申請</p>
            </>
          )}
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">更新アラート</p>
            <div className="w-9 h-9 bg-red-50 rounded-lg flex items-center justify-center">
              <AlertTriangle className="w-5 h-5 text-red-500" />
            </div>
          </div>
          {loading ? (
            <div className="h-8 bg-gray-100 rounded animate-pulse w-12" />
          ) : (
            <>
              <p className={`text-3xl font-bold ${renewalAlerts.length > 0 ? 'text-red-500' : 'text-gray-900'}`}>
                {renewalAlerts.length}
              </p>
              <p className="text-xs text-gray-500 mt-1">60日以内に更新が必要</p>
            </>
          )}
        </div>
      </div>

      {/* 更新アラート */}
      {renewalAlerts.length > 0 && (
        <div className="card p-4 border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">更新期限が近づいています</p>
              <ul className="mt-1 space-y-1">
                {renewalAlerts.map((c) => (
                  <li key={c.id} className="text-sm text-gray-600">
                    <span className="font-medium">{c.tool_name}</span> — {c.renewal_date} 更新
                    <span className="ml-2 text-xs text-amber-600">
                      ({Math.ceil((new Date(c.renewal_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24))}日後)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* データなし状態 */}
      {!loading && !apiError && activeCount === 0 && trialCount === 0 && (
        <div className="card p-8 text-center">
          <Package className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">まだ契約データがありません</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            契約管理ページから CSV をインポートして始めましょう
          </p>
          <Link
            to="/contracts"
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            契約管理へ <ArrowUpRight className="w-4 h-4" />
          </Link>
        </div>
      )}

      {/* コンテンツグリッド（データがある場合のみ表示） */}
      {!loading && (activeCount > 0 || trialCount > 0) && (
        <>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* 最近の調達申請 */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">最近の調達申請</h2>
                <Link to="/procurement" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                  すべて見る <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {recentRequests.length > 0 ? (
                <ul className="space-y-3">
                  {recentRequests.map((req) => {
                    const logo = req.tool_logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.tool_name)}&background=6366f1&color=fff&size=32`
                    return (
                      <li key={req.id} className="flex items-center gap-3">
                        <img
                          src={logo}
                          alt={req.tool_name}
                          className="w-8 h-8 rounded-lg object-contain border border-gray-100"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement
                            t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(req.tool_name)}&background=6366f1&color=fff&size=32`
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{req.tool_name}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {req.requester_name} · {new Date(req.created_at).toLocaleDateString('ja-JP')}
                          </p>
                        </div>
                        <RequestStatusBadge status={req.status} />
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 py-4 text-center">申請はありません</p>
              )}
            </div>

            {/* 契約ステータス */}
            <div className="card p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold text-gray-900">契約ステータス</h2>
                <Link to="/contracts" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                  すべて見る <ArrowUpRight className="w-3 h-3" />
                </Link>
              </div>
              {recentContracts.length > 0 ? (
                <ul className="space-y-3">
                  {recentContracts.map((c) => {
                    const logo = c.tool_logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.tool_name)}&background=6366f1&color=fff&size=32`
                    return (
                      <li key={c.id} className="flex items-center gap-3">
                        <img
                          src={logo}
                          alt={c.tool_name}
                          className="w-8 h-8 rounded-lg object-contain border border-gray-100"
                          onError={(e) => {
                            const t = e.target as HTMLImageElement
                            t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.tool_name)}&background=6366f1&color=fff&size=32`
                          }}
                        />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900">{c.tool_name}</p>
                          <p className="text-xs text-gray-500">
                            {c.seats > 0
                              ? `${c.used_seats}/${c.seats}席`
                              : `¥${(c.monthly_amount / 10000).toFixed(0)}万/月`}
                          </p>
                        </div>
                        <ContractStatusBadge status={c.status} />
                      </li>
                    )
                  })}
                </ul>
              ) : (
                <p className="text-sm text-gray-400 py-4 text-center">契約データがありません</p>
              )}
            </div>
          </div>

          {/* 支出内訳（契約データから計算） */}
          {contractStats && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-4">ステータス別契約数</h2>
              <div className="grid grid-cols-5 gap-3">
                {Object.entries(contractStats.statusCounts).map(([key, count]) => {
                  const labels: Record<string, string> = {
                    active: '利用中', trial: 'トライアル', pending: '手続き中',
                    expired: '期限切れ', cancelled: 'キャンセル'
                  }
                  const colors: Record<string, string> = {
                    active: 'text-green-600 bg-green-50',
                    trial: 'text-blue-600 bg-blue-50',
                    pending: 'text-yellow-600 bg-yellow-50',
                    expired: 'text-red-600 bg-red-50',
                    cancelled: 'text-gray-500 bg-gray-50',
                  }
                  return (
                    <div key={key} className={`rounded-xl p-3 text-center ${colors[key]}`}>
                      <p className="text-2xl font-bold">{count}</p>
                      <p className="text-xs mt-1">{labels[key]}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}

      {/* クイックアクション */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4">クイックアクション</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Link
            to="/catalog"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-indigo-50 hover:bg-indigo-100 transition-colors group"
          >
            <Package className="w-6 h-6 text-indigo-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-indigo-700">ツールを探す</span>
          </Link>
          <Link
            to="/procurement"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-green-50 hover:bg-green-100 transition-colors group"
          >
            <CheckCircle2 className="w-6 h-6 text-green-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-green-700">調達申請</span>
          </Link>
          <Link
            to="/contracts"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-purple-50 hover:bg-purple-100 transition-colors group"
          >
            <FileText className="w-6 h-6 text-purple-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-purple-700">契約確認</span>
          </Link>
          <Link
            to="/versions"
            className="flex flex-col items-center gap-2 p-4 rounded-xl bg-amber-50 hover:bg-amber-100 transition-colors group"
          >
            <TrendingUp className="w-6 h-6 text-amber-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-amber-700">更新確認</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
