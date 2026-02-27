import { Link } from 'react-router-dom'
import {
  TrendingUp,
  FileText,
  AlertTriangle,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Package,
  Users,
  DollarSign,
  RefreshCw,
} from 'lucide-react'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { contracts, procurementRequests, spendRecords } from '../data/mockData'
import { ContractStatusBadge, RequestStatusBadge } from '../components/StatusBadge'

export function Dashboard() {
  const activeContracts = contracts.filter((c) => c.status === 'active').length
  const trialContracts = contracts.filter((c) => c.status === 'trial').length
  const pendingRequests = procurementRequests.filter((r) => r.status === 'reviewing').length
  const currentMonthSpend = spendRecords[spendRecords.length - 1].amount

  // Renewal alerts (within 60 days)
  const renewalAlerts = contracts.filter((c) => {
    if (!c.renewalDate) return false
    const renewal = new Date(c.renewalDate)
    const today = new Date('2026-02-27')
    const diff = (renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 60
  })

  const spendChartData = spendRecords.map((r) => ({
    month: r.month.replace('2025-', '').replace('2026-', ''),
    amount: Math.round(r.amount / 10000),
  }))

  const topTools = spendRecords[spendRecords.length - 1].breakdown
    .sort((a, b) => b.amount - a.amount)
    .slice(0, 5)

  const recentRequests = procurementRequests.slice(0, 4)

  return (
    <div className="p-6 space-y-6">
      {/* Page title */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">ダッシュボード</h1>
        <p className="text-sm text-gray-500 mt-1">2026年2月27日 現在</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">契約中ツール</p>
            <div className="w-9 h-9 bg-indigo-50 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-indigo-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{activeContracts}</p>
          <p className="text-xs text-gray-500 mt-1">
            <span className="text-blue-600">{trialContracts}件</span> トライアル中
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">今月の支出</p>
            <div className="w-9 h-9 bg-green-50 rounded-lg flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">
            ¥{(currentMonthSpend / 10000).toFixed(0)}<span className="text-lg">万</span>
          </p>
          <p className="text-xs text-gray-500 mt-1">
            <span className="text-red-500">↑2.8%</span> 先月比
          </p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">申請中</p>
            <div className="w-9 h-9 bg-yellow-50 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-yellow-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">{pendingRequests}</p>
          <p className="text-xs text-gray-500 mt-1">承認待ちの調達申請</p>
        </div>

        <div className="card p-5">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-gray-500">アカウント数</p>
            <div className="w-9 h-9 bg-purple-50 rounded-lg flex items-center justify-center">
              <Users className="w-5 h-5 text-purple-600" />
            </div>
          </div>
          <p className="text-3xl font-bold text-gray-900">87</p>
          <p className="text-xs text-gray-500 mt-1">アクティブユーザー</p>
        </div>
      </div>

      {/* Alerts */}
      {renewalAlerts.length > 0 && (
        <div className="card p-4 border-l-4 border-l-amber-400">
          <div className="flex items-start gap-3">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-gray-900">更新期限が近づいています</p>
              <ul className="mt-1 space-y-1">
                {renewalAlerts.map((c) => (
                  <li key={c.id} className="text-sm text-gray-600">
                    <span className="font-medium">{c.toolName}</span> — {c.renewalDate} 更新
                    <span className="ml-2 text-xs text-amber-600">
                      ({Math.ceil((new Date(c.renewalDate).getTime() - new Date('2026-02-27').getTime()) / (1000 * 60 * 60 * 24))}日後)
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Spend Trend */}
        <div className="card p-5 lg:col-span-2">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">月次支出推移</h2>
            <Link to="/spend" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              詳細 <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={spendChartData} barSize={28}>
              <XAxis
                dataKey="month"
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                tickFormatter={(v) => `${v}月`}
              />
              <YAxis
                tickLine={false}
                axisLine={false}
                tick={{ fontSize: 12, fill: '#9ca3af' }}
                tickFormatter={(v) => `${v}万`}
              />
              <Tooltip
                formatter={(v: number) => [`¥${v}万`, '支出']}
                labelFormatter={(l) => `${l}月`}
                contentStyle={{ fontSize: 12, borderRadius: 8 }}
              />
              <Bar dataKey="amount" radius={[4, 4, 0, 0]}>
                {spendChartData.map((_, i) => (
                  <Cell
                    key={i}
                    fill={i === spendChartData.length - 1 ? '#4f46e5' : '#e0e7ff'}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Top Spend Tools */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">支出TOP5</h2>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <ul className="space-y-3">
            {topTools.map((tool, i) => {
              const percentage = Math.round((tool.amount / currentMonthSpend) * 100)
              return (
                <li key={tool.toolId}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-gray-700 flex items-center gap-2">
                      <span className="text-xs text-gray-400 font-mono w-4">{i + 1}</span>
                      {tool.toolName}
                    </span>
                    <span className="text-sm font-medium text-gray-900">
                      ¥{(tool.amount / 10000).toFixed(0)}万
                    </span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-indigo-400 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                  <p className="text-xs text-gray-400 text-right mt-0.5">{percentage}%</p>
                </li>
              )
            })}
          </ul>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Requests */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">最近の調達申請</h2>
            <Link to="/procurement" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              すべて見る <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <ul className="space-y-3">
            {recentRequests.map((req) => (
              <li key={req.id} className="flex items-center gap-3">
                <img
                  src={req.toolLogo}
                  alt={req.toolName}
                  className="w-8 h-8 rounded-lg object-contain border border-gray-100"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://ui-avatars.com/api/?name=${req.toolName}&background=6366f1&color=fff&size=32`
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{req.toolName}</p>
                  <p className="text-xs text-gray-500 truncate">{req.requesterName} · {req.createdAt}</p>
                </div>
                <RequestStatusBadge status={req.status} />
              </li>
            ))}
          </ul>
        </div>

        {/* Contract Status */}
        <div className="card p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-semibold text-gray-900">契約ステータス</h2>
            <Link to="/contracts" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
              すべて見る <ArrowUpRight className="w-3 h-3" />
            </Link>
          </div>
          <ul className="space-y-3">
            {contracts.slice(0, 5).map((c) => (
              <li key={c.id} className="flex items-center gap-3">
                <img
                  src={c.toolLogo}
                  alt={c.toolName}
                  className="w-8 h-8 rounded-lg object-contain border border-gray-100"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://ui-avatars.com/api/?name=${c.toolName}&background=6366f1&color=fff&size=32`
                  }}
                />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{c.toolName}</p>
                  <p className="text-xs text-gray-500">{c.seats > 0 ? `${c.usedSeats}/${c.seats}席` : `¥${(c.monthlyAmount / 10000).toFixed(0)}万/月`}</p>
                </div>
                <ContractStatusBadge status={c.status} />
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Quick Actions */}
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
            <RefreshCw className="w-6 h-6 text-amber-600 group-hover:scale-110 transition-transform" />
            <span className="text-sm font-medium text-amber-700">更新確認</span>
          </Link>
        </div>
      </div>
    </div>
  )
}
