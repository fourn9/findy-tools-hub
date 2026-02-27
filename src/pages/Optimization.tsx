import { useState, useMemo } from 'react'
import {
  Sparkles,
  TrendingDown,
  Users,
  Calendar,
  Layers,
  Repeat2,
  ArrowUpCircle,
  ChevronDown,
  ChevronRight,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Info,
  Zap,
  BarChart3,
} from 'lucide-react'
import { contracts } from '../data/mockData'
import { tools } from '../data/tools'
import { runOptimization, Recommendation, RecommendationType, Priority } from '../utils/optimizer'

// ----------------------------------------------------------------
// アイコン・ラベルマッピング
// ----------------------------------------------------------------

const typeConfig: Record<
  RecommendationType,
  { icon: React.ReactNode; label: string; color: string; bg: string }
> = {
  reduce_seats: {
    icon: <Users className="w-4 h-4" />,
    label: 'シート削減',
    color: 'text-blue-600',
    bg: 'bg-blue-50',
  },
  remove_inactive: {
    icon: <XCircle className="w-4 h-4" />,
    label: '非アクティブ解除',
    color: 'text-red-600',
    bg: 'bg-red-50',
  },
  annual_switch: {
    icon: <Calendar className="w-4 h-4" />,
    label: '年次契約切替',
    color: 'text-green-600',
    bg: 'bg-green-50',
  },
  downgrade_plan: {
    icon: <TrendingDown className="w-4 h-4" />,
    label: 'プランダウングレード',
    color: 'text-orange-600',
    bg: 'bg-orange-50',
  },
  upgrade_plan: {
    icon: <ArrowUpCircle className="w-4 h-4" />,
    label: 'プランアップグレード',
    color: 'text-purple-600',
    bg: 'bg-purple-50',
  },
  redundancy: {
    icon: <Layers className="w-4 h-4" />,
    label: '機能重複',
    color: 'text-amber-600',
    bg: 'bg-amber-50',
  },
  alternative_tool: {
    icon: <Repeat2 className="w-4 h-4" />,
    label: '代替ツール',
    color: 'text-indigo-600',
    bg: 'bg-indigo-50',
  },
  usage_spike: {
    icon: <BarChart3 className="w-4 h-4" />,
    label: '利用急増',
    color: 'text-rose-600',
    bg: 'bg-rose-50',
  },
}

const priorityConfig: Record<Priority, { label: string; className: string }> = {
  high: { label: '優先度高', className: 'bg-red-100 text-red-700' },
  medium: { label: '優先度中', className: 'bg-yellow-100 text-yellow-700' },
  low: { label: '優先度低', className: 'bg-gray-100 text-gray-600' },
}

const confidenceConfig = {
  high: { label: '確実性: 高', className: 'text-green-600' },
  medium: { label: '確実性: 中', className: 'text-yellow-600' },
  low: { label: '確実性: 低', className: 'text-gray-400' },
}

// ----------------------------------------------------------------
// HealthScore コンポーネント
// ----------------------------------------------------------------

function HealthGauge({ score }: { score: number }) {
  const color = score >= 70 ? '#10b981' : score >= 40 ? '#f59e0b' : '#ef4444'
  const label = score >= 70 ? '良好' : score >= 40 ? '要改善' : '要対応'
  const circumference = 2 * Math.PI * 40
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-28 h-28">
        <svg className="w-28 h-28 -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="#e5e7eb" strokeWidth="10" />
          <circle
            cx="50"
            cy="50"
            r="40"
            fill="none"
            stroke={color}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold text-gray-900">{score}</span>
          <span className="text-xs text-gray-500">/ 100</span>
        </div>
      </div>
      <span className="mt-1 text-sm font-medium" style={{ color }}>
        {label}
      </span>
    </div>
  )
}

// ----------------------------------------------------------------
// 推奨カード コンポーネント
// ----------------------------------------------------------------

function RecommendationCard({
  rec,
  onAccept,
  onDismiss,
}: {
  rec: Recommendation
  onAccept: (id: string) => void
  onDismiss: (id: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const tc = typeConfig[rec.type]
  const pc = priorityConfig[rec.priority]
  const cc = confidenceConfig[rec.confidence]

  return (
    <div
      className={`card overflow-hidden border-l-4 ${
        rec.priority === 'high'
          ? 'border-l-red-400'
          : rec.priority === 'medium'
          ? 'border-l-yellow-400'
          : 'border-l-gray-300'
      }`}
    >
      {/* Header */}
      <button
        className="w-full p-5 flex items-start gap-4 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        {/* Type icon */}
        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${tc.bg} ${tc.color}`}>
          {tc.icon}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={`badge ${pc.className}`}>{pc.label}</span>
            <span className={`text-xs font-medium ${tc.color} ${tc.bg} px-2 py-0.5 rounded-full`}>
              {tc.label}
            </span>
            <span className={`text-xs ${cc.className}`}>{cc.label}</span>
          </div>
          <p className="font-semibold text-gray-900 mt-1">{rec.title}</p>
          <p className="text-sm text-gray-600 mt-0.5 line-clamp-2">{rec.description}</p>
        </div>

        {/* Saving */}
        <div className="text-right shrink-0 ml-4">
          {rec.type !== 'upgrade_plan' ? (
            <>
              <p className="text-lg font-bold text-green-600">
                -¥{rec.potentialMonthlySaving.toLocaleString()}
              </p>
              <p className="text-xs text-gray-400">/月</p>
              <p className="text-xs text-green-700 mt-0.5 font-medium">
                年間 -¥{Math.round(rec.annualSaving / 10000)}万
              </p>
            </>
          ) : (
            <>
              <p className="text-sm font-medium text-purple-600">超過リスク回避</p>
              <p className="text-xs text-gray-400">コスト増だが推奨</p>
            </>
          )}
        </div>

        <ChevronDown
          className={`w-4 h-4 text-gray-400 shrink-0 mt-1 transition-transform ${expanded ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Expanded detail */}
      {expanded && (
        <div className="border-t border-gray-100 bg-gray-50 p-5 space-y-4">
          {/* 推奨アクション */}
          <div className="flex items-center gap-2 bg-white rounded-lg p-3 border border-indigo-100">
            <Zap className="w-4 h-4 text-indigo-500 shrink-0" />
            <div>
              <p className="text-xs text-gray-500">推奨アクション</p>
              <p className="text-sm font-medium text-gray-900">{rec.action}</p>
            </div>
          </div>

          {/* 根拠 */}
          {rec.details.evidence && rec.details.evidence.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                <Info className="w-3.5 h-3.5" /> 根拠データ
              </p>
              <ul className="space-y-1">
                {rec.details.evidence.map((e, i) => (
                  <li key={i} className="text-sm text-gray-700 flex items-start gap-2">
                    <span className="text-gray-300 mt-1">•</span>
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 非アクティブメンバー */}
          {rec.details.inactiveAccounts && rec.details.inactiveAccounts.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">非アクティブアカウント</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-xs text-gray-400 border-b border-gray-100">
                      <th className="text-left pb-1">名前</th>
                      <th className="text-left pb-1">部署</th>
                      <th className="text-right pb-1">未ログイン日数</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rec.details.inactiveAccounts.map((a) => (
                      <tr key={a.memberId} className="border-b border-gray-50">
                        <td className="py-1.5">
                          <p className="font-medium text-gray-800">{a.memberName}</p>
                          <p className="text-xs text-gray-400">{a.email}</p>
                        </td>
                        <td className="py-1.5 text-gray-600">{a.department}</td>
                        <td className="py-1.5 text-right">
                          <span
                            className={`font-medium ${
                              a.daysInactive > 60 ? 'text-red-600' : 'text-amber-600'
                            }`}
                          >
                            {a.daysInactive}日
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 代替ツール */}
          {rec.details.alternatives && rec.details.alternatives.length > 0 && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-2">代替ツール候補</p>
              <div className="space-y-2">
                {rec.details.alternatives.map((alt, i) => (
                  <div key={i} className="bg-white rounded-lg border border-gray-100 p-3">
                    <div className="flex items-center justify-between">
                      <p className="font-medium text-gray-900">{alt.name}</p>
                      <span className="text-green-600 font-medium text-sm">
                        -¥{alt.monthlySaving.toLocaleString()}/月
                      </span>
                    </div>
                    {alt.findyRating && (
                      <p className="text-xs text-amber-600 mt-0.5">
                        ★ Findy評価: {alt.findyRating}
                      </p>
                    )}
                    <div className="grid grid-cols-2 gap-2 mt-2">
                      <div>
                        <p className="text-xs text-green-600 font-medium mb-1">メリット</p>
                        {alt.features.slice(0, 3).map((f) => (
                          <p key={f} className="text-xs text-gray-600">✓ {f}</p>
                        ))}
                      </div>
                      <div>
                        <p className="text-xs text-red-500 font-medium mb-1">トレードオフ</p>
                        {alt.tradeoffs.slice(0, 3).map((t) => (
                          <p key={t} className="text-xs text-gray-600">△ {t}</p>
                        ))}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* シート利用率バー */}
          {rec.details.currentSeats && rec.details.utilizationRate !== undefined && (
            <div>
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>シート使用率</span>
                <span>
                  {rec.details.usedSeats}/{rec.details.currentSeats}席 ({rec.details.utilizationRate}%)
                </span>
              </div>
              <div className="h-3 bg-gray-100 rounded-full overflow-hidden relative">
                <div
                  className={`h-full rounded-full ${
                    rec.details.utilizationRate > 95
                      ? 'bg-red-400'
                      : rec.details.utilizationRate > 85
                      ? 'bg-amber-400'
                      : 'bg-indigo-400'
                  }`}
                  style={{ width: `${rec.details.utilizationRate}%` }}
                />
                {/* 推奨ライン (85%) */}
                <div
                  className="absolute top-0 bottom-0 w-0.5 bg-gray-400 opacity-50"
                  style={{ left: '85%' }}
                  title="推奨利用率 85%"
                />
              </div>
              <p className="text-xs text-gray-400 mt-0.5 text-right">推奨利用率: 85%</p>
            </div>
          )}

          {/* アクションボタン */}
          <div className="flex gap-2 pt-1">
            <button
              onClick={() => onAccept(rec.id)}
              className="btn-primary flex items-center gap-1.5 text-sm"
            >
              <CheckCircle2 className="w-4 h-4" />
              適用する
            </button>
            <button
              onClick={() => onDismiss(rec.id)}
              className="btn-secondary flex items-center gap-1.5 text-sm"
            >
              <XCircle className="w-4 h-4" />
              却下
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

// ----------------------------------------------------------------
// メインページ
// ----------------------------------------------------------------

export function Optimization() {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set())
  const [acceptedIds, setAcceptedIds] = useState<Set<string>>(new Set())
  const [filterType, setFilterType] = useState<RecommendationType | 'all'>('all')
  const [filterPriority, setFilterPriority] = useState<Priority | 'all'>('all')

  const result = useMemo(() => runOptimization(contracts, tools), [])

  const visibleRecs = result.recommendations.filter((r) => {
    if (acceptedIds.has(r.id)) return false
    if (dismissedIds.has(r.id)) return false
    if (filterType !== 'all' && r.type !== filterType) return false
    if (filterPriority !== 'all' && r.priority !== filterPriority) return false
    return true
  })

  const acceptedRecs = result.recommendations.filter((r) => acceptedIds.has(r.id))
  const acceptedSaving = acceptedRecs.reduce((sum, r) => sum + r.potentialMonthlySaving, 0)

  const handleAccept = (id: string) => {
    setAcceptedIds((prev) => new Set([...prev, id]))
  }
  const handleDismiss = (id: string) => {
    setDismissedIds((prev) => new Set([...prev, id]))
  }

  // タイプ別節約額サマリ
  const typeSummary = Object.entries(typeConfig)
    .map(([type, config]) => {
      const recs = result.recommendations.filter((r) => r.type === type && !acceptedIds.has(r.id) && !dismissedIds.has(r.id))
      const saving = recs.reduce((sum, r) => sum + r.potentialMonthlySaving, 0)
      return { type: type as RecommendationType, config, saving, count: recs.length }
    })
    .filter((s) => s.count > 0)
    .sort((a, b) => b.saving - a.saving)

  return (
    <div className="p-6 space-y-6">
      {/* ヘッダー */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Sparkles className="w-6 h-6 text-indigo-500" />
            支出最適化
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            利用率・部署・プランを分析し、コスト削減の機会を提示します
          </p>
        </div>
        <div className="flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2">
          <TrendingDown className="w-5 h-5 text-green-600" />
          <div>
            <p className="text-xs text-gray-500">削減可能額（月額）</p>
            <p className="text-xl font-bold text-green-600">
              ¥{Math.round(result.totalMonthlySaving / 10000)}万
            </p>
          </div>
        </div>
      </div>

      {/* サマリカード */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* 健全度スコア */}
        <div className="card p-5 flex flex-col items-center justify-center">
          <p className="text-sm font-medium text-gray-700 mb-2">ツール支出健全度</p>
          <HealthGauge score={result.healthScore} />
          <p className="text-xs text-gray-400 mt-2 text-center">
            利用率・最適化余地から算出
          </p>
        </div>

        {/* 月次削減可能額 */}
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-1">削減可能（月額）</p>
          <p className="text-3xl font-bold text-green-600">
            ¥{Math.round(result.totalMonthlySaving / 10000)}万
          </p>
          <p className="text-sm text-gray-500 mt-1">
            年間換算 ¥{Math.round(result.totalAnnualSaving / 10000)}万
          </p>
          {acceptedSaving > 0 && (
            <p className="text-xs text-indigo-600 mt-2 bg-indigo-50 px-2 py-1 rounded-lg">
              適用済み: ¥{Math.round(acceptedSaving / 10000)}万/月
            </p>
          )}
        </div>

        {/* 推奨件数 */}
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-3">推奨件数</p>
          <div className="space-y-1.5">
            {(['high', 'medium', 'low'] as Priority[]).map((p) => {
              const count = visibleRecs.filter((r) => r.priority === p).length
              const config = priorityConfig[p]
              return (
                <div key={p} className="flex items-center justify-between">
                  <span className={`badge ${config.className}`}>{config.label}</span>
                  <span className="text-lg font-bold text-gray-900">{count}件</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* カテゴリ別 */}
        <div className="card p-5">
          <p className="text-xs text-gray-500 mb-3">カテゴリ別節約額</p>
          <div className="space-y-2">
            {typeSummary.slice(0, 4).map(({ type, config, saving }) => (
              <div key={type} className="flex items-center justify-between">
                <div className={`flex items-center gap-1.5 text-xs font-medium ${config.color}`}>
                  {config.icon}
                  {config.label}
                </div>
                <span className="text-sm font-medium text-gray-900">
                  ¥{Math.round(saving / 10000)}万
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* フィルタ */}
      <div className="flex flex-wrap gap-3 items-center">
        <div className="flex gap-1.5 flex-wrap">
          <button
            onClick={() => setFilterType('all')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
              filterType === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            すべて ({visibleRecs.length})
          </button>
          {typeSummary.map(({ type, config, count }) => (
            <button
              key={type}
              onClick={() => setFilterType(type)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors flex items-center gap-1 ${
                filterType === type
                  ? `${config.bg} ${config.color} border border-current`
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {config.icon}
              {config.label} ({count})
            </button>
          ))}
        </div>

        <div className="ml-auto flex gap-1.5">
          {(['all', 'high', 'medium', 'low'] as const).map((p) => (
            <button
              key={p}
              onClick={() => setFilterPriority(p)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
                filterPriority === p
                  ? 'bg-gray-800 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
              }`}
            >
              {p === 'all' ? '全優先度' : priorityConfig[p].label}
            </button>
          ))}
        </div>
      </div>

      {/* High priority alert */}
      {visibleRecs.filter((r) => r.priority === 'high').length > 0 && (
        <div className="card p-4 border-l-4 border-l-red-400 bg-red-50">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-red-500" />
            <p className="text-sm font-medium text-red-800">
              優先度の高い推奨が {visibleRecs.filter((r) => r.priority === 'high').length}件あります。
              早めに対応することをお勧めします。
            </p>
          </div>
        </div>
      )}

      {/* 推奨リスト */}
      <div className="space-y-3">
        {visibleRecs.length === 0 ? (
          <div className="card p-12 text-center">
            <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-3" />
            <p className="text-gray-600 font-medium">すべての推奨を処理しました</p>
            <p className="text-sm text-gray-400 mt-1">フィルタを変更するか、新しい分析を実行してください</p>
          </div>
        ) : (
          visibleRecs.map((rec) => (
            <RecommendationCard
              key={rec.id}
              rec={rec}
              onAccept={handleAccept}
              onDismiss={handleDismiss}
            />
          ))
        )}
      </div>

      {/* 適用済み */}
      {acceptedRecs.length > 0 && (
        <div className="card p-5">
          <h2 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <CheckCircle2 className="w-5 h-5 text-green-500" />
            適用済みの最適化 ({acceptedRecs.length}件)
          </h2>
          <div className="bg-green-50 rounded-xl p-4 mb-3">
            <p className="text-sm text-green-800">
              適用された最適化による削減額:{' '}
              <span className="font-bold text-green-700">
                ¥{acceptedSaving.toLocaleString()}/月（年間¥{Math.round(acceptedSaving * 12 / 10000)}万）
              </span>
            </p>
          </div>
          <ul className="space-y-2">
            {acceptedRecs.map((rec) => (
              <li key={rec.id} className="flex items-center gap-3 text-sm">
                <CheckCircle2 className="w-4 h-4 text-green-500 shrink-0" />
                <span className="text-gray-700 flex-1">{rec.title}</span>
                <span className="text-green-600 font-medium">
                  -¥{rec.potentialMonthlySaving.toLocaleString()}/月
                </span>
                <button
                  onClick={() => setAcceptedIds((prev) => {
                    const next = new Set(prev)
                    next.delete(rec.id)
                    return next
                  })}
                  className="text-xs text-gray-400 hover:text-gray-600"
                >
                  取消
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
