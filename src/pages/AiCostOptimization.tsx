import { useState, useMemo } from 'react'
import {
  Brain,
  TrendingUp,
  TrendingDown,
  Users,
  Zap,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Layers,
  DollarSign,
  BarChart3,
  Info,
  Ghost,
  Building2,
  Cpu,
  Activity,
  ArrowDown,
  ArrowUp,
} from 'lucide-react'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { contracts } from '../data/mockData'
import { teamAiUsage, modelUsageData, shadowAiSignals, adoptionMetrics } from '../data/aiMockData'

// ──────────────────────────────────────────────────────────────
// 定数
// ──────────────────────────────────────────────────────────────

const EFFICIENCY_GAINS: Record<string, number> = {
  'github-copilot': 0.20,
  cursor: 0.25,
  'claude-api': 0.15,
  'chatgpt-team': 0.10,
}
const TOTAL_ENGINEERS = 40
const ENGINEER_MONTHLY_COST = 1200000

const AI_TOOL_GROUPS = [
  {
    label: 'AIコーディング支援',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    toolIds: ['cursor', 'github-copilot'],
    overlapWarning: 'AIコード補完ツールが2つ契約されています',
  },
  {
    label: 'LLM / チャットAI',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    toolIds: ['claude-api', 'chatgpt-team'],
    overlapWarning: 'LLM系ツールが複数契約：用途の棲み分けを確認してください',
  },
]

const MODEL_COLORS = ['#7c3aed', '#4f46e5', '#0ea5e9', '#10b981']

const TABS = [
  { id: 'overview', label: '概要', icon: Brain },
  { id: 'teams', label: 'チーム別分析', icon: Building2 },
  { id: 'tokens', label: 'トークン最適化', icon: Cpu },
  { id: 'shadow', label: '野良AI検出', icon: Ghost },
  { id: 'impact', label: '効果測定', icon: Activity },
] as const

type TabId = typeof TABS[number]['id']

// ──────────────────────────────────────────────────────────────
// 共通コンポーネント
// ──────────────────────────────────────────────────────────────

function MetricCard({
  icon, label, value, sub, color = 'text-gray-900', bgColor = 'bg-white',
}: {
  icon: React.ReactNode; label: string; value: string; sub?: string
  color?: string; bgColor?: string
}) {
  return (
    <div className={`card p-5 ${bgColor}`}>
      <div className="flex items-center gap-2 mb-2">{icon}<p className="text-xs text-gray-500">{label}</p></div>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// タブ1：概要
// ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const aiContracts = contracts.filter((c) => c.category === 'ai_tool')
  const totalAiMonthly = aiContracts.reduce((s, c) => s + c.monthlyAmount, 0)
  const totalMonthly = contracts.reduce((s, c) => s + c.monthlyAmount, 0)
  const aiRatio = Math.round((totalAiMonthly / totalMonthly) * 100)
  const perEngineerCost = Math.round(totalAiMonthly / TOTAL_ENGINEERS)

  const totalRoiSaving = useMemo(() => aiContracts.reduce((sum, c) => {
    const gain = EFFICIENCY_GAINS[c.toolId] ?? 0
    return sum + (c.engineerCount ?? c.seats) * ENGINEER_MONTHLY_COST * gain
  }, 0), [aiContracts])

  const roiMultiple = totalAiMonthly > 0 ? Math.round((totalRoiSaving / totalAiMonthly) * 10) / 10 : 0

  const overlappingGroups = AI_TOOL_GROUPS.filter((g) =>
    g.toolIds.filter((id) => aiContracts.some((c) => c.toolId === id)).length >= 2
  )
  const underutilized = aiContracts.filter(
    (c) => c.usageType === 'seat' && c.seats > 0 && c.usedSeats / c.seats < 0.7
  )
  const underutilizedWaste = underutilized.reduce((sum, c) =>
    sum + Math.round(c.monthlyAmount * (1 - c.usedSeats / c.seats)), 0
  )

  const [openIds, setOpenIds] = useState<Set<string>>(new Set())
  const toggle = (id: string) =>
    setOpenIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  return (
    <div className="space-y-6">
      {/* サマリカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard icon={<DollarSign className="w-4 h-4 text-violet-500" />} label="AI月次支出合計"
          value={`¥${Math.round(totalAiMonthly / 10000)}万`} sub={`年間 ¥${Math.round(totalAiMonthly * 12 / 10000)}万`}
          color="text-violet-700" bgColor="bg-violet-50" />
        <MetricCard icon={<BarChart3 className="w-4 h-4 text-blue-500" />} label="SaaS支出に占めるAI比率"
          value={`${aiRatio}%`} sub={`全体 ¥${Math.round(totalMonthly / 10000)}万/月`} />
        <MetricCard icon={<Users className="w-4 h-4 text-indigo-500" />} label="エンジニア1人あたり"
          value={`¥${perEngineerCost.toLocaleString()}`} sub={`対象 ${TOTAL_ENGINEERS}名`} />
        <MetricCard icon={<Zap className="w-4 h-4 text-green-500" />} label="推定工数削減効果（月）"
          value={`¥${Math.round(totalRoiSaving / 10000)}万`} sub={`ROI x${roiMultiple}`}
          color="text-green-700" bgColor="bg-green-50" />
      </div>

      {/* アラート */}
      {(overlappingGroups.length > 0 || underutilized.length > 0) && (
        <div className="space-y-2">
          {overlappingGroups.map((g) => (
            <div key={g.label} className="card p-4 border-l-4 border-l-amber-400 bg-amber-50 flex items-start gap-3">
              <Layers className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-amber-900">{g.label} — 機能重複を検出</p>
                <p className="text-sm text-amber-700">{g.overlapWarning}</p>
              </div>
            </div>
          ))}
          {underutilized.length > 0 && (
            <div className="card p-4 border-l-4 border-l-red-400 bg-red-50 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-semibold text-red-900">
                  低利用率のAIツール {underutilized.length}件 — 月間 ¥{underutilizedWaste.toLocaleString()} の無駄
                </p>
                <p className="text-sm text-red-700">{underutilized.map((c) => c.toolName).join('、')} のシート利用率が70%を下回っています</p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* AIツール一覧 */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Brain className="w-4 h-4 text-violet-500" />AIツール契約一覧
          <span className="text-xs font-normal text-gray-500">（{aiContracts.length}件）</span>
        </h2>
        <div className="space-y-2">
          {aiContracts.map((c) => {
            const utilizationRate = c.seats > 0 ? Math.round((c.usedSeats / c.seats) * 100) : null
            const gain = EFFICIENCY_GAINS[c.toolId] ?? 0
            const engineers = c.engineerCount ?? c.seats
            const roi = c.monthlyAmount > 0 ? Math.round((engineers * ENGINEER_MONTHLY_COST * gain / c.monthlyAmount) * 10) / 10 : 0
            const open = openIds.has(c.id)
            return (
              <div key={c.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => toggle(c.id)}>
                  <img src={c.toolLogo} alt={c.toolName} className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 p-0.5 shrink-0"
                    onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/32x32?text=AI' }} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-gray-900 text-sm">{c.toolName}</p>
                      {c.usageType === 'token' && <span className="text-xs bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded-full">トークン課金</span>}
                      {c.status === 'pending' && <span className="text-xs bg-yellow-100 text-yellow-700 px-1.5 py-0.5 rounded-full">申請中</span>}
                    </div>
                    <p className="text-xs text-gray-500">{c.plan} · {c.department}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-bold text-gray-900">¥{c.monthlyAmount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">/月</p>
                  </div>
                  {utilizationRate !== null && (
                    <div className="text-right shrink-0 w-16 hidden sm:block">
                      <p className={`text-sm font-semibold ${utilizationRate < 70 ? 'text-amber-600' : 'text-green-600'}`}>{utilizationRate}%</p>
                      <p className="text-xs text-gray-400">利用率</p>
                    </div>
                  )}
                  <div className="text-right shrink-0 w-16 hidden md:block">
                    <p className="text-sm font-semibold text-indigo-600">{roi}x</p>
                    <p className="text-xs text-gray-400">ROI</p>
                  </div>
                  {open ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                </button>
                {open && (
                  <div className="border-t border-gray-100 bg-gray-50 p-4 grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4 text-sm">
                    {c.seats > 0 && utilizationRate !== null && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">シート使用状況</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-200 rounded-full overflow-hidden">
                            <div className={`h-full rounded-full ${utilizationRate < 70 ? 'bg-amber-400' : 'bg-green-400'}`} style={{ width: `${utilizationRate}%` }} />
                          </div>
                          <span className="text-xs font-medium text-gray-700">{c.usedSeats}/{c.seats}席</span>
                        </div>
                        {utilizationRate < 70 && (
                          <p className="text-xs text-amber-600 mt-1">
                            未使用 {c.seats - c.usedSeats}席 — ¥{Math.round(c.monthlyAmount * (1 - utilizationRate / 100)).toLocaleString()}/月の無駄
                          </p>
                        )}
                      </div>
                    )}
                    {c.usageType === 'token' && c.monthlyTokens && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">月間トークン</p>
                        <p className="font-semibold text-gray-900">{(c.monthlyTokens / 1_000_000).toFixed(1)}M tokens</p>
                        <p className="text-xs text-gray-500">¥{Math.round(c.monthlyAmount / (c.monthlyTokens / 1_000_000)).toLocaleString()}/1Mトークン</p>
                      </div>
                    )}
                    <div>
                      <p className="text-xs text-gray-500 mb-1">ROI試算</p>
                      <p className="font-semibold text-indigo-600">x{roi}</p>
                      <p className="text-xs text-gray-500">効率改善 {Math.round(gain * 100)}% × {engineers}人 → ¥{Math.round(engineers * ENGINEER_MONTHLY_COST * gain / 10000)}万/月 削減効果</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">オーナー</p>
                      <p className="font-semibold text-gray-900">{c.owner}</p>
                      <p className="text-xs text-gray-500">{c.department}</p>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* 最適化提案 */}
      <div>
        <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-green-500" />最適化提案
        </h2>
        <div className="space-y-3">
          {underutilized.map((c) => {
            const rate = Math.round((c.usedSeats / c.seats) * 100)
            const waste = Math.round(c.monthlyAmount * (1 - c.usedSeats / c.seats))
            const recommended = Math.ceil(c.usedSeats * 1.15)
            return (
              <div key={c.id} className="card p-4 border-l-4 border-l-red-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-1">
                      <span className="badge bg-red-100 text-red-700">優先度高</span>
                      <span className="badge bg-blue-100 text-blue-700">シート削減</span>
                    </div>
                    <p className="font-semibold text-gray-900">{c.toolName} のシートを {c.seats}→{recommended} 席に削減</p>
                    <p className="text-sm text-gray-600 mt-1">現在利用率 {rate}%（{c.usedSeats}/{c.seats}席）。推奨席数 {recommended} 席（現利用数×1.15バッファ）に縮小を推奨。</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-green-600">-¥{waste.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">/月</p>
                    <p className="text-xs text-green-700 font-medium">年間 -¥{Math.round(waste * 12 / 10000)}万</p>
                  </div>
                </div>
              </div>
            )
          })}
          {overlappingGroups.map((g) => {
            const gc = contracts.filter((c) => g.toolIds.includes(c.toolId) && c.category === 'ai_tool')
            const expensiveTool = gc.reduce((a, b) => a.monthlyAmount > b.monthlyAmount ? a : b)
            const cheaperTool = gc.reduce((a, b) => a.monthlyAmount < b.monthlyAmount ? a : b)
            return (
              <div key={g.label} className="card p-4 border-l-4 border-l-amber-300">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex gap-2 mb-1">
                      <span className="badge bg-yellow-100 text-yellow-700">優先度中</span>
                      <span className="badge bg-amber-100 text-amber-700">機能重複</span>
                    </div>
                    <p className="font-semibold text-gray-900">{g.label}：{expensiveTool.toolName} の解約を検討</p>
                    <p className="text-sm text-gray-600 mt-1">
                      {cheaperTool.toolName}（¥{cheaperTool.monthlyAmount.toLocaleString()}/月）と同機能カテゴリ。用途を統一して解約可能。
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-lg font-bold text-green-600">-¥{expensiveTool.monthlyAmount.toLocaleString()}</p>
                    <p className="text-xs text-gray-400">/月（最大）</p>
                    <p className="text-xs text-green-700 font-medium">年間 -¥{Math.round(expensiveTool.monthlyAmount * 12 / 10000)}万</p>
                  </div>
                </div>
              </div>
            )
          })}
          {overlappingGroups.length === 0 && underutilized.length === 0 && (
            <div className="card p-8 text-center">
              <CheckCircle2 className="w-10 h-10 text-green-400 mx-auto mb-2" />
              <p className="text-gray-600 font-medium">現時点で主要な最適化提案はありません</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// タブ2：チーム別分析
// ──────────────────────────────────────────────────────────────

function TeamsTab() {
  const totalSpend = teamAiUsage.reduce((s, t) => s + t.monthlySpend, 0)
  const avgAdoption = Math.round(teamAiUsage.reduce((s, t) => s + t.adoptionRate, 0) / teamAiUsage.length)

  const chartData = teamAiUsage
    .sort((a, b) => b.monthlySpend - a.monthlySpend)
    .map((t) => ({
      name: t.department,
      spend: t.monthlySpend,
      perPerson: Math.round(t.monthlySpend / t.memberCount),
    }))

  const adoptionChartData = teamAiUsage
    .sort((a, b) => a.adoptionRate - b.adoptionRate)
    .map((t) => ({
      name: t.department,
      adoptionRate: t.adoptionRate,
      fill: t.adoptionRate >= 80 ? '#10b981' : t.adoptionRate >= 50 ? '#f59e0b' : '#ef4444',
    }))

  return (
    <div className="space-y-6">
      {/* サマリ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard icon={<DollarSign className="w-4 h-4 text-violet-500" />} label="AI支出合計（月）"
          value={`¥${Math.round(totalSpend / 10000)}万`} color="text-violet-700" bgColor="bg-violet-50" />
        <MetricCard icon={<Users className="w-4 h-4 text-blue-500" />} label="平均AI活用率"
          value={`${avgAdoption}%`} sub="全部署平均" />
        <MetricCard icon={<TrendingDown className="w-4 h-4 text-red-500" />} label="低活用部署"
          value={`${teamAiUsage.filter((t) => t.adoptionRate < 50).length}部署`}
          sub="活用率50%未満" color="text-red-600" />
      </div>

      {/* 部署別支出グラフ */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">部署別 AI 支出（月額）</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={chartData} margin={{ top: 0, right: 16, left: 0, bottom: 0 }}>
            <XAxis dataKey="name" tick={{ fontSize: 12 }} />
            <YAxis tickFormatter={(v) => `¥${(v / 10000).toFixed(0)}万`} tick={{ fontSize: 11 }} width={55} />
            <Tooltip formatter={(v: number) => [`¥${v.toLocaleString()}`, '月額']} />
            <Bar dataKey="spend" fill="#7c3aed" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* AI活用率グラフ */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">部署別 AI 活用率</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={adoptionChartData} layout="vertical" margin={{ top: 0, right: 40, left: 40, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v: number) => [`${v}%`, '活用率']} />
            <Bar dataKey="adoptionRate" radius={[0, 4, 4, 0]}>
              {adoptionChartData.map((entry, i) => (
                <Cell key={i} fill={entry.fill} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 詳細テーブル */}
      <div className="card overflow-hidden">
        <div className="p-4 border-b border-gray-100">
          <h3 className="font-semibold text-gray-900">部署別詳細</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-xs text-gray-500 border-b border-gray-100">
                <th className="text-left px-4 py-3">部署</th>
                <th className="text-right px-4 py-3">人数</th>
                <th className="text-right px-4 py-3">AI利用者</th>
                <th className="text-right px-4 py-3">活用率</th>
                <th className="text-right px-4 py-3">月次支出</th>
                <th className="text-right px-4 py-3">1人あたり</th>
                <th className="text-right px-4 py-3">週利用時間</th>
              </tr>
            </thead>
            <tbody>
              {teamAiUsage.sort((a, b) => b.monthlySpend - a.monthlySpend).map((t) => (
                <tr key={t.department} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{t.department}</p>
                    <p className="text-xs text-gray-400">{t.tools.join(' · ')}</p>
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{t.memberCount}名</td>
                  <td className="px-4 py-3 text-right text-gray-700">{t.activeAiUsers}名</td>
                  <td className="px-4 py-3 text-right">
                    <span className={`font-semibold ${t.adoptionRate >= 80 ? 'text-green-600' : t.adoptionRate >= 50 ? 'text-amber-600' : 'text-red-600'}`}>
                      {t.adoptionRate}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">¥{t.monthlySpend.toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600">
                    ¥{Math.round(t.monthlySpend / t.memberCount).toLocaleString()}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-600">{t.avgWeeklyHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* 低活用部署へのアクション提案 */}
      {teamAiUsage.filter((t) => t.adoptionRate < 50).length > 0 && (
        <div className="card p-4 border-l-4 border-l-amber-400 bg-amber-50">
          <p className="text-sm font-semibold text-amber-900 mb-1">低活用部署への展開で投資対効果を向上できます</p>
          <ul className="space-y-1">
            {teamAiUsage.filter((t) => t.adoptionRate < 50).map((t) => (
              <li key={t.department} className="text-sm text-amber-700 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-amber-500 shrink-0" />
                {t.department}（活用率 {t.adoptionRate}% · {t.memberCount - t.activeAiUsers}名が未活用）— 社内研修・ユースケース共有を推奨
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// タブ3：トークン最適化
// ──────────────────────────────────────────────────────────────

function TokensTab() {
  const totalCost = modelUsageData.reduce((s, m) => s + m.monthlyCost, 0)
  const totalTokens = modelUsageData.reduce((s, m) => s + m.monthlyTokens, 0)

  const potentialSaving = modelUsageData.reduce((sum, m) => {
    if (!m.recommendedDowngrade) return sum
    return sum + Math.round(m.monthlyCost * (1 - m.recommendedDowngrade.costRatio) * 0.3)
  }, 0)

  const pieData = modelUsageData.map((m) => ({ name: m.model, value: m.monthlyCost }))

  return (
    <div className="space-y-6">
      {/* サマリ */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard icon={<Cpu className="w-4 h-4 text-violet-500" />} label="API月次費用"
          value={`¥${Math.round(totalCost / 10000)}万`} color="text-violet-700" bgColor="bg-violet-50" />
        <MetricCard icon={<BarChart3 className="w-4 h-4 text-blue-500" />} label="月間総トークン"
          value={`${(totalTokens / 1_000_000).toFixed(1)}M`} sub="入力＋出力の合計" />
        <MetricCard icon={<TrendingDown className="w-4 h-4 text-green-500" />} label="モデル最適化で削減可能"
          value={`¥${Math.round(potentialSaving / 10000)}万`} sub="Opusの30%をSonnetに移行した場合"
          color="text-green-700" bgColor="bg-green-50" />
      </div>

      {/* モデル別コスト円グラフ */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">モデル別コスト分布</h3>
        <div className="flex flex-col md:flex-row items-center gap-6">
          <ResponsiveContainer width="100%" height={220}>
            <PieChart>
              <Pie data={pieData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                {pieData.map((_, i) => <Cell key={i} fill={MODEL_COLORS[i % MODEL_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v: number) => [`¥${v.toLocaleString()}`, 'コスト']} />
              <Legend formatter={(v) => <span className="text-xs text-gray-600">{v}</span>} />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* モデル別詳細 + 最適化提案 */}
      <div className="space-y-3">
        {modelUsageData.map((m, i) => (
          <div key={m.model} className="card overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: MODEL_COLORS[i] }} />
                  <div>
                    <p className="font-semibold text-gray-900">{m.model}</p>
                    <p className="text-xs text-gray-500">{m.provider}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">¥{m.monthlyCost.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">月額 ({m.percentage}%)</p>
                </div>
              </div>

              {/* 利用量バー */}
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>月間 {(m.monthlyTokens / 1_000_000).toFixed(1)}M tokens</span>
                  <span>¥{Math.round(m.monthlyCost / (m.monthlyTokens / 1_000_000)).toLocaleString()}/1M</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.percentage}%`, backgroundColor: MODEL_COLORS[i] }} />
                </div>
              </div>

              {/* ユースケース */}
              <div className="mt-2 flex flex-wrap gap-1">
                {m.useCases.map((u) => (
                  <span key={u} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{u}</span>
                ))}
              </div>
            </div>

            {/* ダウングレード提案 */}
            {m.recommendedDowngrade && (
              <div className="border-t border-gray-100 bg-green-50 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-start gap-2">
                    <TrendingDown className="w-4 h-4 text-green-600 shrink-0 mt-0.5" />
                    <div>
                      <p className="text-sm font-medium text-green-800">
                        一部のタスクを {m.recommendedDowngrade.model} に移行することを推奨
                      </p>
                      <p className="text-xs text-green-700 mt-0.5">
                        コストは約{Math.round(m.recommendedDowngrade.costRatio * 100)}%（{Math.round((1 - m.recommendedDowngrade.costRatio) * 100)}%削減可能）
                      </p>
                      <p className="text-xs text-amber-700 mt-0.5 flex items-center gap-1">
                        <Info className="w-3 h-3" />注意: {m.recommendedDowngrade.caveat}
                      </p>
                    </div>
                  </div>
                  <p className="text-sm font-bold text-green-700 shrink-0">
                    -¥{Math.round(m.monthlyCost * (1 - m.recommendedDowngrade.costRatio) * 0.3 / 10000)}万/月
                  </p>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// タブ4：野良AI検出
// ──────────────────────────────────────────────────────────────

function ShadowTab() {
  const totalEstimatedCost = shadowAiSignals.reduce((s, sig) => s + sig.estimatedMonthlyCost, 0)
  const totalEstimatedUsers = shadowAiSignals.reduce((s, sig) => s + sig.estimatedUsers, 0)
  const highRiskCount = shadowAiSignals.filter((s) => s.risk === 'high').length

  const riskConfig = {
    high: { label: '高リスク', className: 'bg-red-100 text-red-700' },
    medium: { label: '中リスク', className: 'bg-yellow-100 text-yellow-700' },
    low: { label: '低リスク', className: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div className="space-y-6">
      {/* 説明 */}
      <div className="card p-4 bg-gray-50 border-l-4 border-l-indigo-400 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700">
          経費申請データ・クレジットカード明細・Slack 投稿から、<strong>組織で申請されていない個人契約 AI ツール</strong>を検出します。
          セキュリティリスク（データ漏洩・利用規約違反）の排除と、法人一括契約への統合によるコスト削減が目的です。
        </p>
      </div>

      {/* サマリ */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard icon={<Ghost className="w-4 h-4 text-red-500" />} label="検出ツール数"
          value={`${shadowAiSignals.length}件`} color="text-red-700" bgColor="bg-red-50" />
        <MetricCard icon={<Users className="w-4 h-4 text-amber-500" />} label="推定利用者数"
          value={`${totalEstimatedUsers}名`} sub="複数ツール利用者を含む" />
        <MetricCard icon={<DollarSign className="w-4 h-4 text-orange-500" />} label="推定月次コスト（社外）"
          value={`¥${Math.round(totalEstimatedCost / 10000)}万`} sub="個人経費 or 自費" color="text-orange-700" bgColor="bg-orange-50" />
      </div>

      {/* 高リスクアラート */}
      {highRiskCount > 0 && (
        <div className="card p-4 border-l-4 border-l-red-400 bg-red-50 flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
          <div>
            <p className="text-sm font-semibold text-red-900">高リスクの野良AI {highRiskCount}件 — データガバナンス上の対応が必要です</p>
            <p className="text-sm text-red-700">個人契約LLMへの業務データ入力は情報漏洩リスクがあります。利用ガイドライン策定と法人契約への移行を推奨します。</p>
          </div>
        </div>
      )}

      {/* 検出リスト */}
      <div className="space-y-3">
        {shadowAiSignals.sort((a, b) => b.estimatedMonthlyCost - a.estimatedMonthlyCost).map((sig) => {
          const rc = riskConfig[sig.risk]
          return (
            <div key={sig.toolName} className="card p-4">
              <div className="flex items-start gap-4">
                <img src={sig.toolLogo} alt={sig.toolName} className="w-10 h-10 rounded-xl object-contain bg-white border border-gray-100 p-1 shrink-0"
                  onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40?text=AI' }} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-gray-900">{sig.toolName}</p>
                    <span className={`badge ${rc.className}`}>{rc.label}</span>
                    <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{sig.category}</span>
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">検出日: {sig.detectedAt}</p>
                  <ul className="mt-2 space-y-1">
                    {sig.signals.map((s) => (
                      <li key={s} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-gray-300 shrink-0 mt-1">•</span>{s}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className="text-right shrink-0">
                  <p className="font-bold text-gray-900">¥{sig.estimatedMonthlyCost.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">/月（推定）</p>
                  <p className="text-xs text-gray-500 mt-1">推定 {sig.estimatedUsers}名</p>
                </div>
              </div>
              <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                  <Zap className="w-3.5 h-3.5" />
                  推奨アクション: 法人契約への統合 or 利用ガイドライン通知
                </p>
                <p className="text-xs text-green-600 font-medium">
                  統合時の節約: ¥{Math.round(sig.estimatedMonthlyCost * 0.3).toLocaleString()}/月（ボリューム割引込）
                </p>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// タブ5：効果測定
// ──────────────────────────────────────────────────────────────

function ImpactTab() {
  const aiContracts = contracts.filter((c) => c.category === 'ai_tool')
  const totalAiMonthly = aiContracts.reduce((s, c) => s + c.monthlyAmount, 0)

  const categories = [...new Set(adoptionMetrics.map((m) => m.category))]

  const totalRoiSaving = useMemo(() => aiContracts.reduce((sum, c) => {
    const gain = EFFICIENCY_GAINS[c.toolId] ?? 0
    return sum + (c.engineerCount ?? c.seats) * ENGINEER_MONTHLY_COST * gain
  }, 0), [aiContracts])

  const roiMultiple = totalAiMonthly > 0 ? Math.round((totalRoiSaving / totalAiMonthly) * 10) / 10 : 0

  return (
    <div className="space-y-6">
      {/* 総合ROI */}
      <div className="card p-5 bg-gradient-to-r from-indigo-50 to-violet-50 border border-indigo-100">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-indigo-700 font-medium">AI投資 総合ROI試算</p>
            <p className="text-4xl font-bold text-indigo-900 mt-1">x{roiMultiple}</p>
            <p className="text-sm text-gray-600 mt-1">
              月次投資 ¥{Math.round(totalAiMonthly / 10000)}万 → 推定削減効果 ¥{Math.round(totalRoiSaving / 10000)}万/月
            </p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-green-600">¥{Math.round(totalRoiSaving * 12 / 10000)}万</p>
              <p className="text-xs text-gray-500">年間工数削減効果</p>
            </div>
            <div className="bg-white rounded-xl p-3 text-center">
              <p className="text-2xl font-bold text-indigo-600">{adoptionMetrics.length}指標</p>
              <p className="text-xs text-gray-500">改善を確認</p>
            </div>
          </div>
        </div>
      </div>

      {/* カテゴリ別メトリクス */}
      {categories.map((cat) => {
        const metrics = adoptionMetrics.filter((m) => m.category === cat)
        return (
          <div key={cat} className="card overflow-hidden">
            <div className="px-5 py-3 bg-gray-50 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900">{cat}</h3>
            </div>
            <div className="divide-y divide-gray-50">
              {metrics.map((m) => {
                const improved = m.lowerIsBetter ? m.after < m.before : m.after > m.before
                const change = Math.abs(m.improvementPct)
                return (
                  <div key={m.id} className="p-4">
                    <div className="flex items-start justify-between gap-4 mb-3">
                      <div>
                        <p className="font-medium text-gray-900">{m.metric}</p>
                        <p className="text-xs text-gray-400 mt-0.5">{m.period}</p>
                        <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full mt-1 inline-block">
                          {m.tool}
                        </span>
                      </div>
                      <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl ${improved ? 'bg-green-50' : 'bg-red-50'}`}>
                        {improved
                          ? <ArrowDown className="w-4 h-4 text-green-600" />
                          : <ArrowUp className="w-4 h-4 text-red-500" />}
                        <span className={`text-lg font-bold ${improved ? 'text-green-600' : 'text-red-500'}`}>
                          {improved ? '-' : '+'}{change}%
                        </span>
                      </div>
                    </div>
                    {/* Before / After バー比較 */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <p className="text-xs text-gray-500 mb-1">導入前</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                            <div className="h-full bg-gray-400 rounded-full" style={{ width: '100%' }} />
                          </div>
                          <span className="text-xs font-medium text-gray-600 w-20 text-right">
                            {m.before}{m.unit}
                          </span>
                        </div>
                      </div>
                      <div>
                        <p className="text-xs text-gray-500 mb-1">導入後</p>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-400 rounded-full"
                              style={{ width: `${Math.min((m.after / m.before) * 100, 100)}%` }}
                            />
                          </div>
                          <span className="text-xs font-medium text-green-700 w-20 text-right">
                            {m.after}{m.unit}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )
      })}

      {/* 前提注記 */}
      <div className="card p-4 bg-gray-50 border border-gray-200">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            効果測定データはGitHub / Jira の実績値（社内計測）をベースとしたモック値です。
            ROI試算は効率改善率×エンジニア月次コスト（¥{ENGINEER_MONTHLY_COST.toLocaleString()}）で算出。
            実際の効果はチームの習熟度・利用頻度によって異なります。
          </p>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// メインページ
// ──────────────────────────────────────────────────────────────

export function AiCostOptimization() {
  const [activeTab, setActiveTab] = useState<TabId>('overview')

  const aiContracts = contracts.filter((c) => c.category === 'ai_tool')
  const totalAiMonthly = aiContracts.reduce((s, c) => s + c.monthlyAmount, 0)

  const totalRoiSaving = aiContracts.reduce((sum, c) => {
    const gain = EFFICIENCY_GAINS[c.toolId] ?? 0
    return sum + (c.engineerCount ?? c.seats) * ENGINEER_MONTHLY_COST * gain
  }, 0)

  const roiMultiple = totalAiMonthly > 0 ? Math.round((totalRoiSaving / totalAiMonthly) * 10) / 10 : 0

  return (
    <div className="p-6 space-y-5">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Brain className="w-6 h-6 text-violet-500" />
            AI ガバナンス
          </h1>
          <p className="text-sm text-gray-500 mt-1">Shadow AI 検出・コスト最適化・APPI コンプライアンス・ROI 測定</p>
        </div>
        <div className="flex items-center gap-2 bg-violet-50 border border-violet-200 rounded-xl px-4 py-2">
          <TrendingUp className="w-5 h-5 text-violet-600" />
          <div>
            <p className="text-xs text-gray-500">AI投資ROI試算</p>
            <p className="text-xl font-bold text-violet-600">x{roiMultiple}</p>
          </div>
        </div>
      </div>

      {/* タブ */}
      <div className="flex gap-1 border-b border-gray-200 overflow-x-auto">
        {TABS.map((tab) => {
          const Icon = tab.icon
          const active = activeTab === tab.id
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                active
                  ? 'border-violet-600 text-violet-700'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
              {tab.id === 'shadow' && (
                <span className="ml-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {shadowAiSignals.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'teams' && <TeamsTab />}
      {activeTab === 'tokens' && <TokensTab />}
      {activeTab === 'shadow' && <ShadowTab />}
      {activeTab === 'impact' && <ImpactTab />}
    </div>
  )
}
