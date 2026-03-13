import { useState, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
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
  RefreshCw,
  Upload,
  GitBranch,
  Database,
  Settings,
  Wand2,
} from 'lucide-react'
import { OptimizationAgent, type OptimizeTarget } from '../components/OptimizationAgent'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, Legend,
} from 'recharts'
import { teamAiUsage } from '../data/aiMockData'
import { useContracts } from '../hooks/useContracts'
import { useAiUsage } from '../hooks/useAiUsage'
import { useExpenses } from '../hooks/useExpenses'
import { useGithubMetrics } from '../hooks/useGithubMetrics'
import type { DbExpenseItem } from '../lib/supabase'

// ──────────────────────────────────────────────────────────────
// 定数
// ──────────────────────────────────────────────────────────────

const EFFICIENCY_GAINS: Record<string, number> = {
  'github copilot':           0.20,
  'cursor':                   0.25,
  'claude api (anthropic)':   0.15,
  'chatgpt team':             0.10,
}

const TOTAL_ENGINEERS = 40
const ENGINEER_MONTHLY_COST = 1200000

const AI_TOOL_GROUPS = [
  {
    label: 'AIコーディング支援',
    color: 'text-violet-600',
    bg: 'bg-violet-50',
    border: 'border-violet-200',
    toolNames: ['cursor', 'github copilot'],
    overlapWarning: 'AIコード補完ツールが2つ契約されています',
  },
  {
    label: 'LLM / チャットAI',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
    border: 'border-blue-200',
    toolNames: ['claude api (anthropic)', 'chatgpt team'],
    overlapWarning: 'LLM系ツールが複数契約：用途の棲み分けを確認してください',
  },
]

const MODEL_COLORS = ['#7c3aed', '#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444']

const MODEL_USE_CASES: Record<string, string[]> = {
  'claude-opus-4-5':    ['複雑なコード生成', 'アーキテクチャレビュー', '高度な分析'],
  'claude-opus-4':      ['複雑なコード生成', 'アーキテクチャレビュー', '高度な分析'],
  'claude-sonnet-4-5':  ['ドキュメント生成', 'コードレビュー', 'テスト作成'],
  'claude-sonnet-4':    ['ドキュメント生成', 'コードレビュー', 'テスト作成'],
  'claude-haiku-4-5':   ['自動補完', '短文変換', 'バッチ処理'],
  'claude-haiku-4':     ['自動補完', '短文変換', 'バッチ処理'],
  'gpt-4o':             ['汎用タスク', '画像解析', 'マルチモーダル'],
  'gpt-4o-mini':        ['簡易タスク', 'テキスト分類', '短文生成'],
  'gpt-4-turbo':        ['複雑な推論', '長文処理', 'コード生成'],
}

const MODEL_DOWNGRADE_MAP: Record<string, { model: string; costRatio: number; caveat: string }> = {
  'claude-opus-4-5':   { model: 'claude-sonnet-4-5', costRatio: 0.2,  caveat: '複雑なコード生成の一部で精度が下がる可能性があります' },
  'claude-opus-4':     { model: 'claude-sonnet-4',   costRatio: 0.2,  caveat: '複雑なコード生成の一部で精度が下がる可能性があります' },
  'claude-sonnet-4-5': { model: 'claude-haiku-4-5',  costRatio: 0.1,  caveat: '長文ドキュメント生成ではSonnetの品質が高い' },
  'claude-sonnet-4':   { model: 'claude-haiku-4',    costRatio: 0.1,  caveat: '長文ドキュメント生成ではSonnetの品質が高い' },
  'gpt-4o':            { model: 'gpt-4o-mini',       costRatio: 0.15, caveat: 'シンプルなタスクに限定して移行してください' },
  'gpt-4-turbo':       { model: 'gpt-4o-mini',       costRatio: 0.1,  caveat: '高精度が必要なタスクには使用しないでください' },
}

const TABS = [
  { id: 'overview', label: '概要',         icon: Brain },
  { id: 'teams',   label: 'チーム別分析', icon: Building2 },
  { id: 'tokens',  label: 'トークン最適化', icon: Cpu },
  { id: 'shadow',  label: '野良AI検出',   icon: Ghost },
  { id: 'impact',  label: '効果測定',     icon: Activity },
] as const

type TabId = typeof TABS[number]['id']

// ──────────────────────────────────────────────────────────────
// 共通コンポーネント
// ──────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex items-center justify-center h-32">
      <div className="w-8 h-8 border-4 border-violet-200 border-t-violet-600 rounded-full animate-spin" />
    </div>
  )
}

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
// タブ1：概要（実データ）
// ──────────────────────────────────────────────────────────────

function OverviewTab() {
  const { contracts, loading, upsert, reload } = useContracts()
  const [openIds, setOpenIds]         = useState<Set<string>>(new Set())
  const [agentTarget, setAgentTarget] = useState<OptimizeTarget | null>(null)

  // ── 全フックを早期 return より前に宣言（Rules of Hooks 準拠）──────
  const aiContracts = useMemo(
    () => contracts.filter((c) => c.category === 'ai_tool'),
    [contracts],
  )
  const totalRoiSaving = useMemo(() => aiContracts.reduce((sum, c) => {
    const gain      = EFFICIENCY_GAINS[c.toolName.toLowerCase()] ?? 0
    const engineers = c.engineerCount ?? c.seats
    return sum + engineers * ENGINEER_MONTHLY_COST * gain
  }, 0), [aiContracts])

  if (loading) return <Spinner />

  const totalAiMonthly  = aiContracts.reduce((s, c) => s + c.monthlyAmount, 0)
  const totalMonthly    = contracts.reduce((s, c) => s + c.monthlyAmount, 0)
  const aiRatio         = totalMonthly > 0 ? Math.round((totalAiMonthly / totalMonthly) * 100) : 0
  const perEngineerCost = Math.round(totalAiMonthly / TOTAL_ENGINEERS)

  const getGain = (toolName: string) => EFFICIENCY_GAINS[toolName.toLowerCase()] ?? 0

  const roiMultiple = totalAiMonthly > 0 ? Math.round((totalRoiSaving / totalAiMonthly) * 10) / 10 : 0

  const overlappingGroups = AI_TOOL_GROUPS.filter((g) =>
    g.toolNames.filter((n) => aiContracts.some((c) => c.toolName.toLowerCase() === n)).length >= 2
  )
  const underutilized = aiContracts.filter(
    (c) => c.usageType === 'seat' && c.seats > 0 && c.usedSeats / c.seats < 0.7
  )
  const underutilizedWaste = underutilized.reduce((sum, c) =>
    sum + Math.round(c.monthlyAmount * (1 - c.usedSeats / c.seats)), 0
  )

  const toggle = (id: string) =>
    setOpenIds((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n })

  if (aiContracts.length === 0) {
    return (
      <div className="card p-8 text-center">
        <Database className="w-10 h-10 text-gray-300 mx-auto mb-3" />
        <p className="font-semibold text-gray-600">AIツール契約データなし</p>
        <p className="text-sm text-gray-400 mt-1 mb-4">
          Supabase の contracts テーブルにデータを追加してください（schema.sql に初期データあり）
        </p>
        <Link to="/contracts" className="text-sm text-indigo-600 hover:underline">契約管理 →</Link>
      </div>
    )
  }

  // ── AI最適化エージェントの実行コールバック ──
  async function handleExecute() {
    if (!agentTarget) return
    if (agentTarget.type === 'seat_reduction') {
      const newUsageRate = Math.round(agentTarget.usedSeats * 100 / agentTarget.recommendedSeats)
      await upsert({
        id:         agentTarget.contractId,
        seats:      agentTarget.recommendedSeats,
        usage_rate: newUsageRate,
      })
    } else {
      await upsert({
        id:     agentTarget.cancelContractId,
        status: 'cancelled',
      })
    }
    reload()
  }

  return (
    <>
    {/* AI最適化エージェント ドロワー */}
    {agentTarget && (
      <OptimizationAgent
        target={agentTarget}
        onExecute={handleExecute}
        onClose={() => setAgentTarget(null)}
        onDone={() => setAgentTarget(null)}
      />
    )}

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
            const gain      = getGain(c.toolName)
            const engineers = c.engineerCount ?? c.seats
            const roi       = c.monthlyAmount > 0
              ? Math.round((engineers * ENGINEER_MONTHLY_COST * gain / c.monthlyAmount) * 10) / 10
              : 0
            const open = openIds.has(c.id)
            return (
              <div key={c.id} className="border border-gray-200 rounded-xl overflow-hidden">
                <button className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors text-left"
                  onClick={() => toggle(c.id)}>
                  <img src={c.toolLogo} alt={c.toolName}
                    className="w-8 h-8 rounded-lg object-contain bg-white border border-gray-100 p-0.5 shrink-0"
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
                    {c.department && (
                      <div>
                        <p className="text-xs text-gray-500 mb-1">部署</p>
                        <p className="font-semibold text-gray-900">{c.department}</p>
                      </div>
                    )}
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
            const rate        = Math.round((c.usedSeats / c.seats) * 100)
            const waste       = Math.round(c.monthlyAmount * (1 - c.usedSeats / c.seats))
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
                    <p className="text-sm text-gray-600 mt-1">現在利用率 {rate}%（{c.usedSeats}/{c.seats}席）。推奨 {recommended} 席（現利用×1.15バッファ）に縮小を推奨。</p>
                  </div>
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">-¥{waste.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">/月</p>
                      <p className="text-xs text-green-700 font-medium">年間 -¥{Math.round(waste * 12 / 10000)}万</p>
                    </div>
                    <button
                      onClick={() => setAgentTarget({
                        type:             'seat_reduction',
                        contractId:       c.id,
                        toolName:         c.toolName,
                        currentSeats:     c.seats,
                        recommendedSeats: recommended,
                        usedSeats:        c.usedSeats,
                        waste,
                      })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      AIで最適化
                    </button>
                  </div>
                </div>
              </div>
            )
          })}
          {overlappingGroups.map((g) => {
            const gc = aiContracts.filter((c) => g.toolNames.includes(c.toolName.toLowerCase()))
            if (gc.length < 2) return null
            const expensiveTool = gc.reduce((a, b) => a.monthlyAmount > b.monthlyAmount ? a : b)
            const cheaperTool   = gc.reduce((a, b) => a.monthlyAmount < b.monthlyAmount ? a : b)
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
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">-¥{expensiveTool.monthlyAmount.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">/月（最大）</p>
                      <p className="text-xs text-green-700 font-medium">年間 -¥{Math.round(expensiveTool.monthlyAmount * 12 / 10000)}万</p>
                    </div>
                    <button
                      onClick={() => setAgentTarget({
                        type:               'overlap_consolidation',
                        keepContractId:     cheaperTool.id,
                        cancelContractId:   expensiveTool.id,
                        keepToolName:       cheaperTool.toolName,
                        cancelToolName:     expensiveTool.toolName,
                        cancelToolMonthly:  expensiveTool.monthlyAmount,
                      })}
                      className="flex items-center gap-1.5 px-3 py-1.5 bg-violet-600 hover:bg-violet-700 text-white text-xs font-semibold rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Wand2 className="w-3.5 h-3.5" />
                      AIで最適化
                    </button>
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
    </>
  )
}

// ──────────────────────────────────────────────────────────────
// タブ2：チーム別分析（デモデータ）
// ──────────────────────────────────────────────────────────────

function TeamsTab() {
  const totalSpend  = teamAiUsage.reduce((s, t) => s + t.monthlySpend, 0)
  const avgAdoption = Math.round(teamAiUsage.reduce((s, t) => s + t.adoptionRate, 0) / teamAiUsage.length)

  const chartData = [...teamAiUsage]
    .sort((a, b) => b.monthlySpend - a.monthlySpend)
    .map((t) => ({ name: t.department, spend: t.monthlySpend }))

  const adoptionChartData = [...teamAiUsage]
    .sort((a, b) => a.adoptionRate - b.adoptionRate)
    .map((t) => ({
      name: t.department,
      adoptionRate: t.adoptionRate,
      fill: t.adoptionRate >= 80 ? '#10b981' : t.adoptionRate >= 50 ? '#f59e0b' : '#ef4444',
    }))

  return (
    <div className="space-y-6">
      <div className="card p-3 bg-blue-50 border-l-4 border-l-blue-400 flex items-center gap-2">
        <Info className="w-4 h-4 text-blue-500 shrink-0" />
        <p className="text-xs text-blue-700">このタブはデモデータを表示しています。実際の部署別データはSSOや社内BIシステムとの連携で取得できます。</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard icon={<DollarSign className="w-4 h-4 text-violet-500" />} label="AI支出合計（月）"
          value={`¥${Math.round(totalSpend / 10000)}万`} color="text-violet-700" bgColor="bg-violet-50" />
        <MetricCard icon={<Users className="w-4 h-4 text-blue-500" />} label="平均AI活用率"
          value={`${avgAdoption}%`} sub="全部署平均" />
        <MetricCard icon={<TrendingDown className="w-4 h-4 text-red-500" />} label="低活用部署"
          value={`${teamAiUsage.filter((t) => t.adoptionRate < 50).length}部署`}
          sub="活用率50%未満" color="text-red-600" />
      </div>

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

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">部署別 AI 活用率</h3>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={adoptionChartData} layout="vertical" margin={{ top: 0, right: 40, left: 40, bottom: 0 }}>
            <XAxis type="number" domain={[0, 100]} tickFormatter={(v) => `${v}%`} tick={{ fontSize: 11 }} />
            <YAxis dataKey="name" type="category" tick={{ fontSize: 12 }} width={80} />
            <Tooltip formatter={(v: number) => [`${v}%`, '活用率']} />
            <Bar dataKey="adoptionRate" radius={[0, 4, 4, 0]}>
              {adoptionChartData.map((entry, i) => <Cell key={i} fill={entry.fill} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

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
              {[...teamAiUsage].sort((a, b) => b.monthlySpend - a.monthlySpend).map((t) => (
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
                  <td className="px-4 py-3 text-right text-gray-600">¥{Math.round(t.monthlySpend / t.memberCount).toLocaleString()}</td>
                  <td className="px-4 py-3 text-right text-gray-600">{t.avgWeeklyHours}h</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// タブ3：トークン最適化（実データ）
// ──────────────────────────────────────────────────────────────

function TokensTab() {
  const { summary, loading, lastFetched, reload } = useAiUsage(30)

  if (loading) return <Spinner />

  if (summary.length === 0) {
    return (
      <div className="space-y-4">
        <div className="card p-8 text-center">
          <Cpu className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">API使用量データなし</p>
          <p className="text-sm text-gray-400 mt-1 mb-4">
            設定ページでAPIキーを登録し、「今すぐ同期」を実行してください
          </p>
          <Link
            to="/settings"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 transition-colors"
          >
            <Settings className="w-4 h-4" />設定ページへ
          </Link>
        </div>
        <div className="card p-4 bg-gray-50">
          <div className="flex items-start gap-2">
            <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
            <p className="text-xs text-gray-500">
              Anthropic / OpenAI の APIキーを設定ページで登録後、「今すぐ同期」ボタンを押すと
              Usage API からデータを取得します。以降は30日分のトークン使用量を可視化します。
            </p>
          </div>
        </div>
      </div>
    )
  }

  const totalCost   = summary.reduce((s, m) => s + m.totalCostJpy, 0)
  const totalTokens = summary.reduce((s, m) => s + m.totalInputTokens + m.totalOutputTokens, 0)

  const modelData = summary.map((m, i) => ({
    model:              m.model,
    provider:           m.provider,
    monthlyTokens:      m.totalInputTokens + m.totalOutputTokens,
    monthlyCost:        m.totalCostJpy,
    percentage:         totalCost > 0 ? Math.round(m.totalCostJpy / totalCost * 100) : 0,
    useCases:           MODEL_USE_CASES[m.model] ?? ['汎用タスク'],
    recommendedDowngrade: MODEL_DOWNGRADE_MAP[m.model],
    color:              MODEL_COLORS[i % MODEL_COLORS.length],
  }))

  const potentialSaving = modelData.reduce((sum, m) => {
    if (!m.recommendedDowngrade) return sum
    return sum + Math.round(m.monthlyCost * (1 - m.recommendedDowngrade.costRatio) * 0.3)
  }, 0)

  const pieData = modelData.map((m) => ({ name: m.model, value: m.monthlyCost }))

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <p className="text-xs text-gray-400">
          最終同期: {lastFetched ? new Date(lastFetched).toLocaleString('ja-JP') : '—'}
        </p>
        <button onClick={reload}
          className="flex items-center gap-1.5 text-xs text-indigo-600 hover:text-indigo-800 transition-colors">
          <RefreshCw className="w-3.5 h-3.5" />再読み込み
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <MetricCard icon={<Cpu className="w-4 h-4 text-violet-500" />} label="API月次費用（30日）"
          value={`¥${Math.round(totalCost / 10000)}万`} color="text-violet-700" bgColor="bg-violet-50" />
        <MetricCard icon={<BarChart3 className="w-4 h-4 text-blue-500" />} label="月間総トークン"
          value={`${(totalTokens / 1_000_000).toFixed(1)}M`} sub="入力＋出力の合計" />
        <MetricCard icon={<TrendingDown className="w-4 h-4 text-green-500" />} label="モデル最適化で削減可能"
          value={`¥${Math.round(potentialSaving / 10000)}万`} sub="30%をダウングレードした場合"
          color="text-green-700" bgColor="bg-green-50" />
      </div>

      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-4">モデル別コスト分布</h3>
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

      <div className="space-y-3">
        {modelData.map((m) => (
          <div key={`${m.provider}:${m.model}`} className="card overflow-hidden">
            <div className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: m.color }} />
                  <div>
                    <p className="font-semibold text-gray-900">{m.model}</p>
                    <p className="text-xs text-gray-500">{m.provider}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-gray-900">¥{m.monthlyCost.toLocaleString()}</p>
                  <p className="text-xs text-gray-400">30日 ({m.percentage}%)</p>
                </div>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>月間 {(m.monthlyTokens / 1_000_000).toFixed(1)}M tokens</span>
                  <span>¥{m.monthlyTokens > 0 ? Math.round(m.monthlyCost / (m.monthlyTokens / 1_000_000)).toLocaleString() : 0}/1M</span>
                </div>
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div className="h-full rounded-full" style={{ width: `${m.percentage}%`, backgroundColor: m.color }} />
                </div>
              </div>
              <div className="mt-2 flex flex-wrap gap-1">
                {m.useCases.map((u) => (
                  <span key={u} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{u}</span>
                ))}
              </div>
            </div>
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
// タブ4：野良AI検出（実データ + CSV アップロード）
// ──────────────────────────────────────────────────────────────

type ShadowGroup = {
  tool: string
  risk: 'high' | 'medium' | 'low'
  items: DbExpenseItem[]
  totalAmount: number
  latestDate: string
}

const RISK_LOGO: Record<string, string> = {
  'ChatGPT Plus（個人契約）':   'https://openai.com/favicon.ico',
  'Claude Pro（個人契約）':     'https://claude.ai/favicon.ico',
  'Perplexity Pro':             'https://www.perplexity.ai/favicon.ico',
  'Midjourney':                 'https://cdn.midjourney.com/site-assets/midjourney-logomark.png',
  'Runway ML':                  'https://runwayml.com/favicon.ico',
  'ElevenLabs':                 'https://elevenlabs.io/favicon.ico',
  'GitHub Copilot Individual':  'https://github.githubassets.com/assets/GitHub-Mark-ea2971cee799.png',
  'Gemini Advanced':            'https://www.google.com/favicon.ico',
}

function ShadowTab() {
  const { shadowAi, loading, uploadCsv } = useExpenses()
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null)

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadMsg(null)
    try {
      const text   = await file.text()
      const result = await uploadCsv(text)
      setUploadMsg({ ok: true, text: `${result.inserted}件取り込み完了。野良AI検出 ${result.flagged}件。` })
    } catch (err) {
      setUploadMsg({ ok: false, text: err instanceof Error ? err.message : 'アップロードエラー' })
    }
    setUploading(false)
    if (fileRef.current) fileRef.current.value = ''
  }

  if (loading) return <Spinner />

  // shadow_ai_tool でグルーピング
  const groupMap: Record<string, ShadowGroup> = {}
  for (const item of shadowAi) {
    const key  = item.shadow_ai_tool ?? '不明なAIツール'
    const risk = (item.risk_level as 'high' | 'medium' | 'low') ?? 'low'
    if (!groupMap[key]) {
      groupMap[key] = { tool: key, risk, items: [], totalAmount: 0, latestDate: item.date }
    }
    groupMap[key].items.push(item)
    groupMap[key].totalAmount += item.amount
    if (item.date > groupMap[key].latestDate) groupMap[key].latestDate = item.date
  }
  const groups = Object.values(groupMap).sort((a, b) => b.totalAmount - a.totalAmount)

  const highRiskCount  = groups.filter((g) => g.risk === 'high').length
  const totalEstimated = groups.reduce((s, g) => s + g.totalAmount, 0)
  const totalItems     = groups.reduce((s, g) => s + g.items.length, 0)

  const riskConfig = {
    high:   { label: '高リスク', className: 'bg-red-100 text-red-700' },
    medium: { label: '中リスク', className: 'bg-yellow-100 text-yellow-700' },
    low:    { label: '低リスク', className: 'bg-gray-100 text-gray-600' },
  }

  return (
    <div className="space-y-6">
      <div className="card p-4 bg-gray-50 border-l-4 border-l-indigo-400 flex items-start gap-3">
        <Info className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <p className="text-sm text-gray-700">
          経費申請データ・クレジットカード明細から、<strong>組織で申請されていない個人契約AIツール</strong>を検出します。
          freee / マネーフォワードからCSVをエクスポートしてアップロードしてください。
        </p>
      </div>

      {/* CSV アップロード */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Upload className="w-4 h-4 text-gray-500" />経費CSVをアップロード
        </h3>
        <p className="text-xs text-gray-500 mb-3">
          対応フォーマット: 日付,摘要,金額,カテゴリ（freee / マネーフォワード 標準CSV）
        </p>
        <div className="flex items-center gap-3 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".csv"
            onChange={handleFile}
            className="hidden"
            id="csv-upload"
          />
          <label
            htmlFor="csv-upload"
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-lg cursor-pointer transition-colors ${
              uploading
                ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <Upload className="w-4 h-4" />
            {uploading ? 'アップロード中...' : 'CSVファイルを選択'}
          </label>
          {uploadMsg && (
            <p className={`flex items-center gap-1.5 text-sm ${uploadMsg.ok ? 'text-green-600' : 'text-red-600'}`}>
              {uploadMsg.ok
                ? <CheckCircle2 className="w-4 h-4" />
                : <AlertTriangle className="w-4 h-4" />}
              {uploadMsg.text}
            </p>
          )}
        </div>
      </div>

      {groups.length === 0 ? (
        <div className="card p-8 text-center">
          <Ghost className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="font-semibold text-gray-600">野良AIツールは検出されていません</p>
          <p className="text-sm text-gray-400 mt-1">
            経費CSVをアップロードすると、個人契約AIツールを自動検出します
          </p>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-4">
            <MetricCard icon={<Ghost className="w-4 h-4 text-red-500" />} label="検出ツール数"
              value={`${groups.length}件`} color="text-red-700" bgColor="bg-red-50" />
            <MetricCard icon={<Users className="w-4 h-4 text-amber-500" />} label="経費申請件数"
              value={`${totalItems}件`} sub="複数明細含む" />
            <MetricCard icon={<DollarSign className="w-4 h-4 text-orange-500" />} label="累計コスト（社外）"
              value={`¥${totalEstimated.toLocaleString()}`} sub="個人経費 or 自費"
              color="text-orange-700" bgColor="bg-orange-50" />
          </div>

          {highRiskCount > 0 && (
            <div className="card p-4 border-l-4 border-l-red-400 bg-red-50 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-red-500 shrink-0" />
              <div>
                <p className="text-sm font-semibold text-red-900">高リスクの野良AI {highRiskCount}件 — データガバナンス上の対応が必要です</p>
                <p className="text-sm text-red-700">個人契約LLMへの業務データ入力は情報漏洩リスクがあります。法人契約への移行を推奨します。</p>
              </div>
            </div>
          )}

          <div className="space-y-3">
            {groups.map((g) => {
              const rc   = riskConfig[g.risk]
              const logo = RISK_LOGO[g.tool] ?? `https://placehold.co/40x40?text=${encodeURIComponent(g.tool.slice(0, 2))}`
              return (
                <div key={g.tool} className="card p-4">
                  <div className="flex items-start gap-4">
                    <img src={logo} alt={g.tool}
                      className="w-10 h-10 rounded-xl object-contain bg-white border border-gray-100 p-1 shrink-0"
                      onError={(e) => { (e.target as HTMLImageElement).src = 'https://placehold.co/40x40?text=AI' }} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900">{g.tool}</p>
                        <span className={`badge ${rc.className}`}>{rc.label}</span>
                      </div>
                      <p className="text-xs text-gray-400 mt-0.5">最終検出: {g.latestDate} · {g.items.length}件の経費明細</p>
                      <ul className="mt-2 space-y-1">
                        {g.items.slice(0, 3).map((item, i) => (
                          <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                            <span className="text-gray-300 shrink-0 mt-1">•</span>
                            {item.date} — {item.description}（¥{item.amount.toLocaleString()}）
                          </li>
                        ))}
                        {g.items.length > 3 && <li className="text-xs text-gray-400">他 {g.items.length - 3} 件...</li>}
                      </ul>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-bold text-gray-900">¥{g.totalAmount.toLocaleString()}</p>
                      <p className="text-xs text-gray-400">/累計</p>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    <p className="text-xs text-indigo-600 font-medium flex items-center gap-1">
                      <Zap className="w-3.5 h-3.5" />推奨アクション: 法人契約への統合 or 利用ガイドライン通知
                    </p>
                    <p className="text-xs text-green-600 font-medium">
                      統合時節約: ¥{Math.round(g.totalAmount * 0.3).toLocaleString()}（ボリューム割引込）
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────────────────────
// タブ5：効果測定（実データ + GitHub 同期）
// ──────────────────────────────────────────────────────────────

function ImpactTab() {
  const { contracts } = useContracts()
  const [repo,      setRepo]      = useState('')
  const [token,     setToken]     = useState('')
  const [showToken, setShowToken] = useState(false)

  const aiContracts    = contracts.filter((c) => c.category === 'ai_tool')
  const totalAiMonthly = aiContracts.reduce((s, c) => s + c.monthlyAmount, 0)

  const totalRoiSaving = useMemo(() => aiContracts.reduce((sum, c) => {
    const gain      = EFFICIENCY_GAINS[c.toolName.toLowerCase()] ?? 0
    const engineers = c.engineerCount ?? c.seats
    return sum + engineers * ENGINEER_MONTHLY_COST * gain
  }, 0), [aiContracts])

  const roiMultiple = totalAiMonthly > 0 ? Math.round((totalRoiSaving / totalAiMonthly) * 10) / 10 : 0

  const { comparison, rows, loading: ghLoading, syncing, syncFromGithub, error: ghError } = useGithubMetrics(repo || null)

  const handleSync = () => {
    if (repo && token) syncFromGithub(token, repo)
  }

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
              <p className="text-2xl font-bold text-indigo-600">{rows.length}週</p>
              <p className="text-xs text-gray-500">GitHub実績データ</p>
            </div>
          </div>
        </div>
      </div>

      {/* GitHub 同期パネル */}
      <div className="card p-5">
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <GitBranch className="w-4 h-4 text-gray-500" />GitHub リポジトリからデータ同期
        </h3>
        <p className="text-xs text-gray-500 mb-4">
          PR サイクルタイム・週次コミット数を取得して AI 導入前後を比較します（直近12週を前半/後半で比較）。
        </p>
        <div className="space-y-3">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">リポジトリ（owner/repo）</label>
            <input
              type="text"
              value={repo}
              onChange={(e) => setRepo(e.target.value)}
              placeholder="例: your-org/your-repo"
              className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">
              GitHub Personal Access Token
              <span className="text-gray-400 font-normal ml-1">（repo スコープ必要）</span>
            </label>
            <div className="relative">
              <input
                type={showToken ? 'text' : 'password'}
                value={token}
                onChange={(e) => setToken(e.target.value)}
                placeholder="ghp_..."
                className="w-full px-3 py-2 pr-20 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
              />
              <button
                onClick={() => setShowToken(!showToken)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400 hover:text-gray-600 px-2"
              >
                {showToken ? '隠す' : '表示'}
              </button>
            </div>
            <p className="text-xs text-gray-400 mt-1">※ トークンはブラウザ内でのみ使用。Supabaseには保存されません。</p>
          </div>
          <button
            onClick={handleSync}
            disabled={!repo || !token || syncing}
            className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? '同期中...' : 'GitHub からデータを同期'}
          </button>
          {ghError && (
            <p className="text-sm text-red-600 flex items-center gap-1.5">
              <AlertTriangle className="w-4 h-4" />{ghError}
            </p>
          )}
        </div>
      </div>

      {/* GitHub 実績データ */}
      {ghLoading ? <Spinner /> : comparison.length > 0 && (
        <div className="card overflow-hidden">
          <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-indigo-500" />
            <h3 className="font-semibold text-gray-900">GitHub 実績 — {repo}</h3>
            <span className="text-xs text-gray-400">（直近12週 前半 vs 後半）</span>
          </div>
          <div className="divide-y divide-gray-50">
            {comparison.map((m) => {
              const improved = m.improvementPct > 0
              return (
                <div key={m.metric} className="p-4">
                  <div className="flex items-start justify-between gap-4 mb-3">
                    <div>
                      <p className="font-medium text-gray-900">{m.metric}</p>
                      <span className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full mt-1 inline-block">
                        {m.tool}
                      </span>
                    </div>
                    <div className={`flex items-center gap-1 px-3 py-1.5 rounded-xl ${improved ? 'bg-green-50' : 'bg-red-50'}`}>
                      {improved
                        ? <ArrowDown className="w-4 h-4 text-green-600" />
                        : <ArrowUp className="w-4 h-4 text-red-500" />}
                      <span className={`text-lg font-bold ${improved ? 'text-green-600' : 'text-red-500'}`}>
                        {Math.abs(m.improvementPct)}%
                      </span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <p className="text-xs text-gray-500 mb-1">前半平均</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-gray-400 rounded-full" style={{ width: '100%' }} />
                        </div>
                        <span className="text-xs font-medium text-gray-600 w-20 text-right">{m.before}{m.unit}</span>
                      </div>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">後半平均</p>
                      <div className="flex items-center gap-2">
                        <div className="flex-1 h-3 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full bg-green-400 rounded-full"
                            style={{ width: `${Math.min(m.before > 0 ? (m.after / m.before) * 100 : 0, 100)}%` }} />
                        </div>
                        <span className="text-xs font-medium text-green-700 w-20 text-right">{m.after}{m.unit}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* 注記 */}
      <div className="card p-4 bg-gray-50 border border-gray-200">
        <div className="flex items-start gap-2">
          <Info className="w-4 h-4 text-gray-400 shrink-0 mt-0.5" />
          <p className="text-xs text-gray-500">
            ROI試算は効率改善率×エンジニア月次コスト（¥{ENGINEER_MONTHLY_COST.toLocaleString()}）で算出。
            GitHub実績データはリポジトリ統計APIから取得（直近12週）。
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
  const { contracts }  = useContracts()
  const { shadowAi }   = useExpenses()

  const aiContracts    = contracts.filter((c) => c.category === 'ai_tool')
  const totalAiMonthly = aiContracts.reduce((s, c) => s + c.monthlyAmount, 0)

  const totalRoiSaving = aiContracts.reduce((sum, c) => {
    const gain      = EFFICIENCY_GAINS[c.toolName.toLowerCase()] ?? 0
    const engineers = c.engineerCount ?? c.seats
    return sum + engineers * ENGINEER_MONTHLY_COST * gain
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
          const Icon   = tab.icon
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
              {tab.id === 'shadow' && shadowAi.length > 0 && (
                <span className="ml-1 w-5 h-5 bg-red-500 text-white text-xs rounded-full flex items-center justify-center font-bold">
                  {shadowAi.length}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* タブコンテンツ */}
      {activeTab === 'overview' && <OverviewTab />}
      {activeTab === 'teams'    && <TeamsTab />}
      {activeTab === 'tokens'   && <TokensTab />}
      {activeTab === 'shadow'   && <ShadowTab />}
      {activeTab === 'impact'   && <ImpactTab />}
    </div>
  )
}
