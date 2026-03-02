import { useState, useEffect } from 'react'
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon, Loader2 } from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend, BarChart, Bar,
} from 'recharts'
import { getContracts, type ApiContract } from '../lib/api'

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

// ──────────────────────────────────────────────
// contracts データからグラフ用データを生成
// ──────────────────────────────────────────────
function deriveSpendData(contracts: ApiContract[]) {
  const active = contracts.filter((c) => c.status === 'active' || c.status === 'trial')
  const totalMonthly = active.reduce((sum, c) => sum + c.monthly_amount, 0)

  // ツール別内訳（月額上位10件）
  const byTool = active
    .sort((a, b) => b.monthly_amount - a.monthly_amount)
    .slice(0, 10)
    .map((c) => ({ toolName: c.tool_name, amount: c.monthly_amount }))

  // 部署別内訳
  const byDept: Record<string, number> = {}
  active.forEach((c) => {
    const key = c.department || '未分類'
    byDept[key] = (byDept[key] ?? 0) + c.monthly_amount
  })
  const deptData = Object.entries(byDept)
    .sort(([, a], [, b]) => b - a)
    .map(([name, value]) => ({ name, value }))

  // 支払いサイクル別
  const monthlyCount = active.filter((c) => c.billing_cycle === 'monthly').length
  const yearlyCount = active.filter((c) => c.billing_cycle === 'yearly').length

  // ステータス別
  const statusSpend: Record<string, number> = {}
  contracts.forEach((c) => {
    statusSpend[c.status] = (statusSpend[c.status] ?? 0) + c.monthly_amount
  })

  // 月次トレンド（契約の start_date ベースで過去6ヶ月の仮想推移を生成）
  const today = new Date()
  const months: { month: string; amount: number }[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(today.getFullYear(), today.getMonth() - i, 1)
    const label = `${d.getMonth() + 1}月`
    // その月までに開始した契約の合計（起点として活用）
    const monthActive = active.filter((c) => {
      if (!c.start_date) return true
      return new Date(c.start_date) <= d
    })
    const amount = monthActive.reduce((sum, c) => sum + c.monthly_amount, 0)
    months.push({ month: label, amount })
  }

  // 更新予定コスト（60日以内）
  const renewalCost = active.filter((c) => {
    if (!c.renewal_date) return false
    const diff = (new Date(c.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
    return diff >= 0 && diff <= 60
  }).reduce((sum, c) => sum + c.monthly_amount, 0)

  // 最大コストツール
  const topTool = byTool[0]

  return {
    totalMonthly,
    byTool,
    deptData,
    months,
    monthlyCount,
    yearlyCount,
    statusSpend,
    renewalCost,
    topTool,
  }
}

// ──────────────────────────────────────────────
// メインページ
// ──────────────────────────────────────────────
export function SpendAnalysis() {
  const [view, setView] = useState<'trend' | 'breakdown' | 'forecast'>('trend')
  const [contracts, setContracts] = useState<ApiContract[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    getContracts()
      .then((res) => setContracts(res.contracts))
      .catch((err) => setError(String(err)))
      .finally(() => setLoading(false))
  }, [])

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center py-24">
        <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
        <span className="ml-2 text-sm text-gray-500">支出データを読み込み中...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
          ⚠️ API 接続エラー: {error}
        </div>
      </div>
    )
  }

  const {
    totalMonthly, byTool, deptData, months, renewalCost, topTool,
  } = deriveSpendData(contracts)

  const hasData = contracts.length > 0

  // 前月比（仮想値: months[4] vs months[5]）
  const prevMonth = months[4]?.amount ?? 0
  const currMonth = months[5]?.amount ?? 0
  const momDiff = currMonth - prevMonth
  const momPct = prevMonth > 0 ? ((momDiff / prevMonth) * 100).toFixed(1) : '0.0'

  // 簡易予測（現在の月次 × 1.03）
  const forecastData = [
    ...months,
    { month: '+1月', amount: Math.round(currMonth * 1.03) },
    { month: '+2月', amount: Math.round(currMonth * 1.06) },
    { month: '+3月', amount: Math.round(currMonth * 1.09) },
  ]

  // 最適化提案
  const suggestions: string[] = []
  const highSeat = contracts.filter((c) => c.seats > 0 && c.used_seats / c.seats < 0.7 && c.status === 'active')
  if (highSeat.length > 0) {
    suggestions.push(
      `シート使用率70%未満のツールが${highSeat.length}件あります（${highSeat.map((c) => c.tool_name).join('・')}）。シート削減で年間¥${Math.round(highSeat.reduce((s, c) => s + (c.seats - c.used_seats) * (c.monthly_amount / Math.max(c.seats, 1)), 0) * 12 / 10000)}万の削減が見込めます。`
    )
  }
  const monthlyBilling = contracts.filter((c) => c.billing_cycle === 'monthly' && c.monthly_amount >= 30000 && c.status === 'active')
  if (monthlyBilling.length > 0) {
    const saving = Math.round(monthlyBilling.reduce((s, c) => s + c.monthly_amount * 12 * 0.2, 0) / 10000)
    suggestions.push(`月次課金ツールを年次に切り替えると、最大20%割引（${monthlyBilling.length}件・約¥${saving}万/年の削減）が見込めます。`)
  }
  if (renewalCost > 0) {
    suggestions.push(`60日以内に更新予定の契約（合計月額¥${Math.round(renewalCost / 10000)}万）の交渉タイミングです。契約ページから交渉スクリプトを生成できます。`)
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">支出分析</h1>
        <p className="text-sm text-gray-500 mt-1">ツール関連コストの可視化と最適化</p>
      </div>

      {!hasData && (
        <div className="card p-8 text-center">
          <DollarSign className="w-12 h-12 text-gray-200 mx-auto mb-3" />
          <p className="text-gray-500 font-medium">契約データがありません</p>
          <p className="text-sm text-gray-400 mt-1">契約管理ページから CSV をインポートすると支出データが表示されます</p>
        </div>
      )}

      {hasData && (
        <>
          {/* KPI */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">今月の支出</p>
                <DollarSign className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ¥{Math.round(totalMonthly / 10000)}万
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">前月比</p>
                {momDiff >= 0
                  ? <TrendingUp className="w-4 h-4 text-red-400" />
                  : <TrendingDown className="w-4 h-4 text-green-400" />}
              </div>
              <p className={`text-2xl font-bold ${momDiff >= 0 ? 'text-red-500' : 'text-green-500'}`}>
                {momDiff >= 0 ? '+' : ''}{momPct}%
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">年換算</p>
                <PieChartIcon className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ¥{Math.round(totalMonthly * 12 / 10000)}万
              </p>
            </div>
            <div className="card p-4">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-gray-500">最大コスト</p>
                <TrendingUp className="w-4 h-4 text-gray-400" />
              </div>
              <p className="text-xl font-bold text-indigo-600 truncate">
                {topTool?.toolName ?? '—'}
              </p>
              {topTool && totalMonthly > 0 && (
                <p className="text-xs text-gray-400 mt-0.5">
                  総支出の{Math.round((topTool.amount / totalMonthly) * 100)}%
                </p>
              )}
            </div>
          </div>

          {/* ビュー切替 */}
          <div className="flex gap-2">
            {(['trend', 'breakdown', 'forecast'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setView(v)}
                className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                  view === v
                    ? 'bg-indigo-600 text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}
              >
                {v === 'trend' ? '支出推移' : v === 'breakdown' ? '内訳' : '予測・提案'}
              </button>
            ))}
          </div>

          {/* 支出推移 */}
          {view === 'trend' && (
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="card p-5 lg:col-span-2">
                <h2 className="font-semibold text-gray-900 mb-4">月次支出推移（契約開始日ベース）</h2>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={months}>
                    <defs>
                      <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis
                      tickLine={false} axisLine={false}
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                    />
                    <Tooltip
                      formatter={(v: number) => [`¥${Math.round(v / 10000)}万`, '支出']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} fill="url(#colorSpend)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-4">支出TOP5</h2>
                <div className="space-y-3">
                  {byTool.slice(0, 5).map((item, i) => {
                    const pct = totalMonthly > 0 ? Math.round((item.amount / totalMonthly) * 100) : 0
                    return (
                      <div key={item.toolName}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i] }} />
                            {item.toolName}
                          </span>
                          <span className="text-sm font-medium text-gray-900">¥{Math.round(item.amount / 10000)}万</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 内訳 */}
          {view === 'breakdown' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* 部署別 */}
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-4">部署別支出</h2>
                {deptData.length > 0 ? (
                  <ResponsiveContainer width="100%" height={280}>
                    <PieChart>
                      <Pie
                        data={deptData}
                        cx="50%"
                        cy="50%"
                        innerRadius={70}
                        outerRadius={110}
                        paddingAngle={2}
                        dataKey="value"
                      >
                        {deptData.map((_, i) => (
                          <Cell key={i} fill={COLORS[i % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(v: number) => [`¥${Math.round(v / 10000)}万`, '']}
                        contentStyle={{ fontSize: 12, borderRadius: 8 }}
                      />
                      <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <p className="text-sm text-gray-400 text-center py-8">部署データがありません（CSVに「部署」列を含めてください）</p>
                )}
              </div>

              {/* ツール別一覧 */}
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-4">ツール別支出</h2>
                <div className="space-y-3 max-h-72 overflow-y-auto">
                  {byTool.map((item, i) => {
                    const pct = totalMonthly > 0 ? Math.round((item.amount / totalMonthly) * 100) : 0
                    return (
                      <div key={item.toolName}>
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-gray-700 flex items-center gap-2">
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: COLORS[i % COLORS.length] }} />
                            {item.toolName}
                          </span>
                          <div className="text-right">
                            <span className="text-sm font-medium text-gray-900">¥{Math.round(item.amount / 10000)}万</span>
                            <span className="text-xs text-gray-400 ml-2">{pct}%</span>
                          </div>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: COLORS[i % COLORS.length] }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* 予測・提案 */}
          {view === 'forecast' && (
            <div className="space-y-4">
              <div className="card p-5">
                <h2 className="font-semibold text-gray-900 mb-2">支出予測（3ヶ月先）</h2>
                <p className="text-sm text-gray-500 mb-4">現在の支出から月次3%増加として試算</p>
                <ResponsiveContainer width="100%" height={260}>
                  <AreaChart data={forecastData}>
                    <defs>
                      <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                        <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                    <YAxis
                      tickLine={false} axisLine={false}
                      tick={{ fontSize: 12, fill: '#9ca3af' }}
                      tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                    />
                    <Tooltip
                      formatter={(v: number) => [`¥${Math.round(v / 10000)}万`, '支出']}
                      contentStyle={{ fontSize: 12, borderRadius: 8 }}
                    />
                    <Area type="monotone" dataKey="amount" stroke="#4f46e5" strokeWidth={2} fill="url(#colorForecast)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>

              {/* 最適化提案（実データベース） */}
              <div className="card p-5 bg-indigo-50 border-indigo-200">
                <h3 className="font-semibold text-indigo-900 mb-3">🤖 最適化の提案</h3>
                {suggestions.length > 0 ? (
                  <ul className="space-y-3">
                    {suggestions.map((s, i) => (
                      <li key={i} className="flex items-start gap-2 text-sm text-indigo-800">
                        <span className="font-bold mt-0.5 shrink-0">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-sm text-indigo-700">現時点では最適化の提案はありません。契約データを追加すると自動分析されます。</p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
