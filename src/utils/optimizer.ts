import { Contract, Tool } from '../types'
import { members } from '../data/mockData'

// ----------------------------------------------------------------
// 型定義
// ----------------------------------------------------------------

export type RecommendationType =
  | 'reduce_seats'      // 未使用シートを削減
  | 'upgrade_plan'      // プランアップグレード（追加費用で超過回避）
  | 'downgrade_plan'    // プランダウングレード（機能過剰）
  | 'annual_switch'     // 月次→年次契約へ切替
  | 'remove_inactive'   // 非アクティブアカウント削除
  | 'redundancy'        // 他ツールと機能重複
  | 'alternative_tool'  // より安価な代替ツール
  | 'usage_spike'       // 利用急増（上位プランの事前検討）

export type Priority = 'high' | 'medium' | 'low'
export type Confidence = 'high' | 'medium' | 'low'

export interface InactiveAccount {
  memberId: string
  memberName: string
  email: string
  department: string
  lastActive: string
  daysInactive: number
}

export interface AlternativeTool {
  name: string
  monthlySaving: number
  features: string[]
  tradeoffs: string[]
  findyRating?: number
}

export interface Recommendation {
  id: string
  type: RecommendationType
  priority: Priority
  confidence: Confidence
  toolId: string
  toolName: string
  title: string
  description: string
  currentMonthlyCost: number
  potentialMonthlySaving: number
  annualSaving: number
  action: string
  details: {
    currentSeats?: number
    usedSeats?: number
    unusedSeats?: number
    utilizationRate?: number
    inactiveAccounts?: InactiveAccount[]
    currentPlan?: string
    suggestedPlan?: string
    planDiscount?: number
    redundantWith?: string[]
    alternatives?: AlternativeTool[]
    evidence?: string[]
  }
  isDismissed?: boolean
}

export interface OptimizationResult {
  totalMonthlySaving: number
  totalAnnualSaving: number
  recommendations: Recommendation[]
  summaryByType: Record<RecommendationType, number>
  healthScore: number // 0-100: ツール支出の健全度スコア
}

// ----------------------------------------------------------------
// ユーティリティ
// ----------------------------------------------------------------

const TODAY = new Date('2026-02-27')

function daysSince(dateStr: string): number {
  return Math.floor((TODAY.getTime() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24))
}

function utilizationRate(used: number, total: number): number {
  if (total === 0) return 100
  return Math.round((used / total) * 100)
}

// ----------------------------------------------------------------
// 個別チェック関数
// ----------------------------------------------------------------

/** 未使用シートの検出 */
function checkUnusedSeats(contract: Contract): Recommendation | null {
  if (contract.seats === 0) return null
  const unused = contract.seats - contract.usedSeats
  const rate = utilizationRate(contract.usedSeats, contract.seats)
  if (unused < 2 || rate > 88) return null // 2席未満 or 88%以上は対象外

  const savingPerSeat = contract.monthlyAmount / contract.seats
  // 10%バッファを残した最適シート数
  const optimalSeats = Math.ceil(contract.usedSeats * 1.1)
  const reducible = contract.seats - optimalSeats
  if (reducible <= 0) return null

  const monthlySaving = Math.round(savingPerSeat * reducible)

  return {
    id: `reduce_seats_${contract.toolId}`,
    type: 'reduce_seats',
    priority: unused >= 10 ? 'high' : unused >= 5 ? 'medium' : 'low',
    confidence: 'high',
    toolId: contract.toolId,
    toolName: contract.toolName,
    title: `${contract.toolName}: ${unused}席が未使用`,
    description: `現在${contract.seats}席契約中、${contract.usedSeats}席しか使われていません。10%バッファを残した${optimalSeats}席に削減することで月額コストを削減できます。`,
    currentMonthlyCost: contract.monthlyAmount,
    potentialMonthlySaving: monthlySaving,
    annualSaving: monthlySaving * 12,
    action: `${contract.seats}席 → ${optimalSeats}席に変更`,
    details: {
      currentSeats: contract.seats,
      usedSeats: contract.usedSeats,
      unusedSeats: unused,
      utilizationRate: rate,
      currentPlan: contract.plan,
      evidence: [
        `利用率: ${rate}%（推奨: 85〜90%）`,
        `未使用シート: ${unused}席`,
        `削減可能席数: ${reducible}席（10%バッファ確保後）`,
      ],
    },
  }
}

/** 非アクティブアカウントの検出 */
function checkInactiveAccounts(contract: Contract): Recommendation | null {
  if (contract.seats === 0) return null

  const assignedMembers = members.filter((m) => m.assignedTools.includes(contract.toolId))
  const INACTIVE_THRESHOLD = 30 // 30日以上未ログイン

  const inactive: InactiveAccount[] = assignedMembers
    .filter((m) => daysSince(m.lastActive) >= INACTIVE_THRESHOLD)
    .map((m) => ({
      memberId: m.id,
      memberName: m.name,
      email: m.email,
      department: m.department,
      lastActive: m.lastActive,
      daysInactive: daysSince(m.lastActive),
    }))

  if (inactive.length === 0) return null

  const costPerSeat = contract.monthlyAmount / contract.seats
  const monthlySaving = Math.round(costPerSeat * inactive.length)

  return {
    id: `remove_inactive_${contract.toolId}`,
    type: 'remove_inactive',
    priority: inactive.length >= 5 ? 'high' : 'medium',
    confidence: 'high',
    toolId: contract.toolId,
    toolName: contract.toolName,
    title: `${contract.toolName}: ${inactive.length}名が30日以上未ログイン`,
    description: `${inactive.map((i) => i.memberName).join('、')} が30日以上ログインしていません。アカウントを解除することでシートを解放できます。`,
    currentMonthlyCost: contract.monthlyAmount,
    potentialMonthlySaving: monthlySaving,
    annualSaving: monthlySaving * 12,
    action: `${inactive.length}名のアカウントを解除`,
    details: {
      currentSeats: contract.seats,
      usedSeats: contract.usedSeats,
      inactiveAccounts: inactive,
      evidence: inactive.map(
        (i) => `${i.memberName}（${i.department}）: ${i.daysInactive}日間未ログイン`
      ),
    },
  }
}

/** 月次→年次契約切替の検出 */
function checkAnnualSwitch(contract: Contract): Recommendation | null {
  if (contract.billingCycle === 'yearly') return null
  if (contract.status !== 'active') return null
  // 年額換算で20%割引と仮定（一般的なSaaSの割引率）
  const ANNUAL_DISCOUNT = 0.20
  const monthlySaving = Math.round(contract.monthlyAmount * ANNUAL_DISCOUNT)
  if (monthlySaving < 1000) return null // 1000円未満は対象外

  return {
    id: `annual_switch_${contract.toolId}`,
    type: 'annual_switch',
    priority: monthlySaving >= 30000 ? 'high' : monthlySaving >= 10000 ? 'medium' : 'low',
    confidence: 'medium',
    toolId: contract.toolId,
    toolName: contract.toolName,
    title: `${contract.toolName}: 年間契約で約20%節約`,
    description: `現在月次契約です。年間一括払いに切り替えることで通常20%の割引が適用されます。月額¥${monthlySaving.toLocaleString()}の節約が見込めます。`,
    currentMonthlyCost: contract.monthlyAmount,
    potentialMonthlySaving: monthlySaving,
    annualSaving: monthlySaving * 12,
    action: '年間契約へ切り替え',
    details: {
      currentPlan: `${contract.plan}（月次）`,
      suggestedPlan: `${contract.plan}（年次）`,
      planDiscount: ANNUAL_DISCOUNT * 100,
      evidence: [
        `現在の月額: ¥${contract.monthlyAmount.toLocaleString()}`,
        `年間コスト（現在）: ¥${(contract.monthlyAmount * 12).toLocaleString()}`,
        `年間コスト（切替後）: ¥${Math.round(contract.monthlyAmount * 12 * (1 - ANNUAL_DISCOUNT)).toLocaleString()}`,
        `割引率: ${ANNUAL_DISCOUNT * 100}%（一般的なSaaS年次割引）`,
      ],
    },
  }
}

/** ツール間の機能重複検出 */
function checkRedundancy(contracts: Contract[]): Recommendation[] {
  const results: Recommendation[] = []

  const activeTools = contracts.filter(
    (c) => c.status === 'active' || c.status === 'trial'
  )

  // 重複パターンの定義
  const redundancyPatterns: {
    tools: string[]
    description: string
    savingTool: string // 削除候補ツール
    keepTool: string   // 残すツール
    overlap: string[]
  }[] = [
    {
      tools: ['sentry', 'datadog'],
      description: 'SentryとDatadogはどちらもエラー監視機能を持ちます。DatadogのAPMを活用することでSentryを代替できる可能性があります。',
      savingTool: 'sentry',
      keepTool: 'datadog',
      overlap: ['エラー監視', 'アラート', 'スタックトレース'],
    },
  ]

  for (const pattern of redundancyPatterns) {
    const matchedContracts = pattern.tools
      .map((id) => activeTools.find((c) => c.toolId === id))
      .filter(Boolean) as Contract[]

    if (matchedContracts.length < 2) continue

    const savingContract = matchedContracts.find((c) => c.toolId === pattern.savingTool)
    if (!savingContract) continue

    results.push({
      id: `redundancy_${pattern.tools.join('_')}`,
      type: 'redundancy',
      priority: 'medium',
      confidence: 'medium',
      toolId: savingContract.toolId,
      toolName: savingContract.toolName,
      title: `${pattern.tools.map((id) => matchedContracts.find((c) => c.toolId === id)?.toolName ?? id).join(' と ')} の機能が重複`,
      description: pattern.description,
      currentMonthlyCost: savingContract.monthlyAmount,
      potentialMonthlySaving: savingContract.monthlyAmount,
      annualSaving: savingContract.monthlyAmount * 12,
      action: `${savingContract.toolName} の契約を見直す`,
      details: {
        redundantWith: [pattern.keepTool],
        evidence: [
          `重複機能: ${pattern.overlap.join('、')}`,
          `${pattern.keepTool} で代替可能な機能をレビュー推奨`,
        ],
      },
    })
  }

  return results
}

/** 代替ツール提案 */
function checkAlternatives(contract: Contract): Recommendation | null {
  const alternativeMap: Record<string, AlternativeTool[]> = {
    'datadog': [
      {
        name: 'Grafana + Prometheus',
        monthlySaving: 30000,
        features: ['メトリクス監視', 'カスタムダッシュボード', 'アラート', 'OSSで無料'],
        tradeoffs: ['セットアップ工数が必要', 'SaaSほどのサポートなし', 'APMは別途要設定'],
        findyRating: 4.2,
      },
      {
        name: 'New Relic',
        monthlySaving: 8000,
        features: ['APM', 'インフラ監視', 'ログ管理', 'フルスタック可観測性'],
        tradeoffs: ['移行コストあり', '設定の学習コスト'],
        findyRating: 4.3,
      },
    ],
    'notion': [
      {
        name: 'Confluence',
        monthlySaving: 20000,
        features: ['Wiki', 'ドキュメント管理', 'Jira連携', '豊富なテンプレート'],
        tradeoffs: ['UI/UXはNotionより古め', 'Jira依存'],
        findyRating: 3.9,
      },
    ],
  }

  const alternatives = alternativeMap[contract.toolId]
  if (!alternatives || alternatives.length === 0) return null
  if (contract.monthlyAmount < 20000) return null // 2万円未満は対象外

  const bestAlt = alternatives.reduce((best, alt) =>
    alt.monthlySaving > best.monthlySaving ? alt : best
  )

  return {
    id: `alternative_${contract.toolId}`,
    type: 'alternative_tool',
    priority: 'low',
    confidence: 'low',
    toolId: contract.toolId,
    toolName: contract.toolName,
    title: `${contract.toolName}: コスト効率の良い代替ツールあり`,
    description: `${contract.toolName} の代替として費用対効果の高いオプションがあります。機能要件に応じて検討できます。`,
    currentMonthlyCost: contract.monthlyAmount,
    potentialMonthlySaving: bestAlt.monthlySaving,
    annualSaving: bestAlt.monthlySaving * 12,
    action: '代替ツールを評価する',
    details: {
      alternatives,
      evidence: [
        `最大節約額: ¥${bestAlt.monthlySaving.toLocaleString()}/月`,
        '※移行コストを含めたROI計算が必要',
      ],
    },
  }
}

/** プランのアップグレード推奨（使用率が高すぎる場合） */
function checkPlanUpgrade(contract: Contract, tool: Tool | undefined): Recommendation | null {
  if (contract.seats === 0) return null
  const rate = utilizationRate(contract.usedSeats, contract.seats)
  if (rate < 95) return null // 95%以下は対象外

  // 現在より上のプランを探す
  if (!tool) return null
  const currentPlanIdx = tool.pricingPlans.findIndex(
    (p) => p.name.toLowerCase() === contract.plan.toLowerCase()
  )
  if (currentPlanIdx < 0 || currentPlanIdx >= tool.pricingPlans.length - 1) return null

  const nextPlan = tool.pricingPlans[currentPlanIdx + 1]

  return {
    id: `upgrade_plan_${contract.toolId}`,
    type: 'upgrade_plan',
    priority: rate >= 98 ? 'high' : 'medium',
    confidence: 'high',
    toolId: contract.toolId,
    toolName: contract.toolName,
    title: `${contract.toolName}: 利用率${rate}% — 上位プランへの移行を推奨`,
    description: `シート利用率が${rate}%に達しています。このまま増員が続くと超過が発生します。上位プランへの移行で追加機能も活用できます。`,
    currentMonthlyCost: contract.monthlyAmount,
    potentialMonthlySaving: 0, // アップグレードはコスト増だが超過費用回避
    annualSaving: 0,
    action: `${contract.plan} → ${nextPlan.name} にアップグレード`,
    details: {
      currentSeats: contract.seats,
      usedSeats: contract.usedSeats,
      utilizationRate: rate,
      currentPlan: contract.plan,
      suggestedPlan: nextPlan.name,
      evidence: [
        `現在の利用率: ${rate}%（警告ライン: 95%）`,
        `次プランの追加機能: ${nextPlan.features.slice(0, 2).join('、')}`,
        '超過時のシート追加より上位プランが割安な場合あり',
      ],
    },
  }
}

// ----------------------------------------------------------------
// メイン最適化エンジン
// ----------------------------------------------------------------

export function runOptimization(
  contracts: Contract[],
  tools: Tool[]
): OptimizationResult {
  const recommendations: Recommendation[] = []

  for (const contract of contracts) {
    if (contract.status === 'cancelled' || contract.status === 'expired') continue
    const tool = tools.find((t) => t.id === contract.toolId)

    const unusedSeats = checkUnusedSeats(contract)
    if (unusedSeats) recommendations.push(unusedSeats)

    const inactiveAccounts = checkInactiveAccounts(contract)
    if (inactiveAccounts) recommendations.push(inactiveAccounts)

    const annualSwitch = checkAnnualSwitch(contract)
    if (annualSwitch) recommendations.push(annualSwitch)

    const alternative = checkAlternatives(contract)
    if (alternative) recommendations.push(alternative)

    const upgrade = checkPlanUpgrade(contract, tool)
    if (upgrade) recommendations.push(upgrade)
  }

  // 重複チェック（全契約に対して）
  const redundancies = checkRedundancy(contracts)
  recommendations.push(...redundancies)

  // 優先度でソート（高→中→低、同優先度内は節約額順）
  const priorityOrder: Record<Priority, number> = { high: 0, medium: 1, low: 2 }
  recommendations.sort((a, b) => {
    const pDiff = priorityOrder[a.priority] - priorityOrder[b.priority]
    if (pDiff !== 0) return pDiff
    return b.potentialMonthlySaving - a.potentialMonthlySaving
  })

  // 集計
  const totalMonthlySaving = recommendations
    .filter((r) => r.type !== 'upgrade_plan') // コスト増は除く
    .reduce((sum, r) => sum + r.potentialMonthlySaving, 0)

  const summaryByType = recommendations.reduce((acc, r) => {
    acc[r.type] = (acc[r.type] ?? 0) + r.potentialMonthlySaving
    return acc
  }, {} as Record<RecommendationType, number>)

  // 健全度スコア計算
  // 基準: 全契約の平均利用率、コスト最適化率
  const seatedContracts = contracts.filter((c) => c.seats > 0 && c.status === 'active')
  const avgUtilization =
    seatedContracts.length > 0
      ? seatedContracts.reduce((sum, c) => sum + utilizationRate(c.usedSeats, c.seats), 0) /
        seatedContracts.length
      : 100

  const totalCurrentCost = contracts
    .filter((c) => c.status === 'active')
    .reduce((sum, c) => sum + c.monthlyAmount, 0)

  const savingRatio = totalCurrentCost > 0 ? totalMonthlySaving / totalCurrentCost : 0

  // スコア: 利用率が85%前後が最適、コスト削減余地が少ないほど高スコア
  const utilizationScore = Math.max(0, 100 - Math.abs(avgUtilization - 85) * 2)
  const optimizationScore = Math.max(0, 100 - savingRatio * 200)
  const highPriorityPenalty = recommendations.filter((r) => r.priority === 'high').length * 10

  const healthScore = Math.max(
    0,
    Math.min(100, Math.round((utilizationScore * 0.4 + optimizationScore * 0.6) - highPriorityPenalty))
  )

  return {
    totalMonthlySaving,
    totalAnnualSaving: totalMonthlySaving * 12,
    recommendations,
    summaryByType,
    healthScore,
  }
}
