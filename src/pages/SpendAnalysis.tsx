import { useState } from 'react'
import { TrendingUp, TrendingDown, DollarSign, PieChart as PieChartIcon } from 'lucide-react'
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  BarChart,
  Bar,
} from 'recharts'
import { spendRecords } from '../data/mockData'

const COLORS = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6']

export function SpendAnalysis() {
  const [view, setView] = useState<'trend' | 'breakdown' | 'forecast'>('trend')

  const trendData = spendRecords.map((r) => ({
    month: r.month.replace('2025-', '').replace('2026-', '') + '月',
    amount: r.amount,
    万円: Math.round(r.amount / 10000),
  }))

  const latestBreakdown = spendRecords[spendRecords.length - 1].breakdown
  const pieData = latestBreakdown.map((b, i) => ({
    name: b.toolName,
    value: b.amount,
    color: COLORS[i % COLORS.length],
  }))

  const monthOverMonth = spendRecords[spendRecords.length - 1].amount - spendRecords[spendRecords.length - 2].amount
  const momPct = ((monthOverMonth / spendRecords[spendRecords.length - 2].amount) * 100).toFixed(1)

  // Tool trend data
  const toolNames = Array.from(
    new Set(spendRecords.flatMap((r) => r.breakdown.map((b) => b.toolName)))
  )
  const toolTrendData = spendRecords.map((r) => {
    const row: Record<string, number | string> = {
      month: r.month.replace('2025-', '').replace('2026-', '') + '月',
    }
    toolNames.forEach((name) => {
      const found = r.breakdown.find((b) => b.toolName === name)
      row[name] = found ? Math.round(found.amount / 10000) : 0
    })
    return row
  })

  // Forecast (simple linear projection)
  const forecastData = [...trendData]
  const lastTwo = spendRecords.slice(-2)
  const growth = lastTwo[1].amount - lastTwo[0].amount
  for (let i = 1; i <= 3; i++) {
    forecastData.push({
      month: `+${i}月`,
      amount: spendRecords[spendRecords.length - 1].amount + growth * i,
      万円: Math.round((spendRecords[spendRecords.length - 1].amount + growth * i) / 10000),
    })
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">支出分析</h1>
        <p className="text-sm text-gray-500 mt-1">ツール関連コストの可視化と最適化</p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">今月の支出</p>
            <DollarSign className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ¥{Math.round(spendRecords[spendRecords.length - 1].amount / 10000)}万
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">前月比</p>
            {monthOverMonth > 0 ? (
              <TrendingUp className="w-4 h-4 text-red-400" />
            ) : (
              <TrendingDown className="w-4 h-4 text-green-400" />
            )}
          </div>
          <p className={`text-2xl font-bold ${monthOverMonth > 0 ? 'text-red-500' : 'text-green-500'}`}>
            {monthOverMonth > 0 ? '+' : ''}{momPct}%
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">年換算</p>
            <PieChartIcon className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-gray-900">
            ¥{Math.round(spendRecords[spendRecords.length - 1].amount * 12 / 10000)}万
          </p>
        </div>
        <div className="card p-4">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs text-gray-500">最大コスト</p>
            <TrendingUp className="w-4 h-4 text-gray-400" />
          </div>
          <p className="text-2xl font-bold text-indigo-600">AWS</p>
          <p className="text-xs text-gray-400 mt-0.5">総支出の63%</p>
        </div>
      </div>

      {/* View selector */}
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
            {v === 'trend' ? '支出推移' : v === 'breakdown' ? '内訳' : '予測'}
          </button>
        ))}
      </div>

      {view === 'trend' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="card p-5 lg:col-span-2">
            <h2 className="font-semibold text-gray-900 mb-4">月次支出推移</h2>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={trendData}>
                <defs>
                  <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                />
                <Tooltip
                  formatter={(v: number) => [`¥${Math.round(v / 10000)}万`, '支出']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  fill="url(#colorSpend)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">ツール別推移（万円）</h2>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={toolTrendData} barSize={8}>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <YAxis tickLine={false} axisLine={false} tick={{ fontSize: 10, fill: '#9ca3af' }} />
                <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8 }} />
                {toolNames.slice(0, 5).map((name, i) => (
                  <Bar key={name} dataKey={name} stackId="a" fill={COLORS[i % COLORS.length]} radius={i === 4 ? [2, 2, 0, 0] : [0, 0, 0, 0]} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {view === 'breakdown' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">今月の支出内訳</h2>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={70}
                  outerRadius={110}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {pieData.map((entry, index) => (
                    <Cell key={index} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  formatter={(v: number) => [`¥${Math.round(v / 10000)}万`, '']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">ツール別支出</h2>
            <div className="space-y-3">
              {latestBreakdown
                .sort((a, b) => b.amount - a.amount)
                .map((item, i) => {
                  const pct = Math.round((item.amount / spendRecords[spendRecords.length - 1].amount) * 100)
                  return (
                    <div key={item.toolId}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm text-gray-700 flex items-center gap-2">
                          <span
                            className="w-2.5 h-2.5 rounded-full shrink-0"
                            style={{ background: COLORS[i % COLORS.length] }}
                          />
                          {item.toolName}
                        </span>
                        <div className="text-right">
                          <span className="text-sm font-medium text-gray-900">
                            ¥{Math.round(item.amount / 10000)}万
                          </span>
                          <span className="text-xs text-gray-400 ml-2">{pct}%</span>
                        </div>
                      </div>
                      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full"
                          style={{
                            width: `${pct}%`,
                            background: COLORS[i % COLORS.length],
                          }}
                        />
                      </div>
                    </div>
                  )
                })}
            </div>
          </div>
        </div>
      )}

      {view === 'forecast' && (
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-2">支出予測（3ヶ月先）</h2>
            <p className="text-sm text-gray-500 mb-4">過去2ヶ月の増加傾向をもとに予測しています</p>
            <ResponsiveContainer width="100%" height={280}>
              <AreaChart data={forecastData}>
                <defs>
                  <linearGradient id="colorForecast" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#4f46e5" stopOpacity={0.2} />
                    <stop offset="95%" stopColor="#4f46e5" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fontSize: 12, fill: '#9ca3af' }} />
                <YAxis
                  tickLine={false}
                  axisLine={false}
                  tick={{ fontSize: 12, fill: '#9ca3af' }}
                  tickFormatter={(v) => `${Math.round(v / 10000)}万`}
                />
                <Tooltip
                  formatter={(v: number) => [`¥${Math.round(v / 10000)}万`, '支出']}
                  contentStyle={{ fontSize: 12, borderRadius: 8 }}
                />
                <Area
                  type="monotone"
                  dataKey="amount"
                  stroke="#4f46e5"
                  strokeWidth={2}
                  strokeDasharray="0 0 4 4"
                  fill="url(#colorForecast)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <div className="card p-5 bg-indigo-50 border-indigo-200">
            <h3 className="font-semibold text-indigo-900 mb-2">最適化の提案</h3>
            <ul className="space-y-2 text-sm text-indigo-800">
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">•</span>
                <span><span className="font-medium">AWS コスト最適化：</span> 未使用のEC2インスタンスが3台検出されました。削減可能コスト: 約¥8万/月</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">•</span>
                <span><span className="font-medium">Figma シート見直し：</span> 過去30日間ログインなし5アカウントあり。シート削減でコスト削減可能</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="font-bold mt-0.5">•</span>
                <span><span className="font-medium">年間契約への切替：</span> SlackとLinearを年間契約にすると最大20%割引が適用されます</span>
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  )
}
