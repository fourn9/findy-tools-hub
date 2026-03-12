// ──────────────────────────────────────────────────────────────
// チーム別 AI 利用データ
// ──────────────────────────────────────────────────────────────
export interface TeamAiUsage {
  department: string
  memberCount: number
  activeAiUsers: number
  monthlySpend: number
  tools: string[]
  adoptionRate: number   // 0-100
  avgWeeklyHours: number // 週あたり平均利用時間（推定）
}

export const teamAiUsage: TeamAiUsage[] = [
  {
    department: 'エンジニアリング',
    memberCount: 20,
    activeAiUsers: 18,
    monthlySpend: 245000,
    tools: ['GitHub Copilot', 'Claude API', 'Cursor'],
    adoptionRate: 90,
    avgWeeklyHours: 12,
  },
  {
    department: 'プロダクト',
    memberCount: 8,
    activeAiUsers: 5,
    monthlySpend: 75000,
    tools: ['ChatGPT Team'],
    adoptionRate: 63,
    avgWeeklyHours: 5,
  },
  {
    department: 'SRE',
    memberCount: 4,
    activeAiUsers: 4,
    monthlySpend: 60000,
    tools: ['GitHub Copilot', 'Claude API'],
    adoptionRate: 100,
    avgWeeklyHours: 8,
  },
  {
    department: 'デザイン',
    memberCount: 5,
    activeAiUsers: 2,
    monthlySpend: 10000,
    tools: ['ChatGPT Team'],
    adoptionRate: 40,
    avgWeeklyHours: 3,
  },
  {
    department: 'インフラ',
    memberCount: 3,
    activeAiUsers: 1,
    monthlySpend: 5000,
    tools: ['ChatGPT Team'],
    adoptionRate: 33,
    avgWeeklyHours: 2,
  },
  {
    department: 'セキュリティ',
    memberCount: 2,
    activeAiUsers: 1,
    monthlySpend: 5000,
    tools: ['ChatGPT Team'],
    adoptionRate: 50,
    avgWeeklyHours: 2,
  },
]

// ──────────────────────────────────────────────────────────────
// モデル別トークン使用データ
// ──────────────────────────────────────────────────────────────
export interface ModelUsage {
  model: string
  provider: string
  monthlyTokens: number
  monthlyCost: number
  percentage: number
  useCases: string[]
  recommendedDowngrade?: {
    model: string
    costRatio: number   // 代替モデルの単価比 (0–1)
    caveat: string
  }
}

export const modelUsageData: ModelUsage[] = [
  {
    model: 'claude-opus-4-5',
    provider: 'Anthropic',
    monthlyTokens: 1200000,
    monthlyCost: 95000,
    percentage: 51,
    useCases: ['複雑なコード生成', 'アーキテクチャレビュー', '高度な分析'],
    recommendedDowngrade: {
      model: 'claude-sonnet-4-5',
      costRatio: 0.2,
      caveat: '複雑なコード生成の一部で精度が下がる可能性があります',
    },
  },
  {
    model: 'claude-sonnet-4-5',
    provider: 'Anthropic',
    monthlyTokens: 6500000,
    monthlyCost: 65000,
    percentage: 35,
    useCases: ['ドキュメント生成', 'コードレビュー', 'テスト作成'],
    recommendedDowngrade: {
      model: 'claude-haiku-4-5',
      costRatio: 0.1,
      caveat: '長文ドキュメント生成ではSonnetの品質が高い',
    },
  },
  {
    model: 'claude-haiku-4-5',
    provider: 'Anthropic',
    monthlyTokens: 4300000,
    monthlyCost: 25000,
    percentage: 14,
    useCases: ['自動補完', '短文変換', 'バッチ処理'],
  },
]

// ──────────────────────────────────────────────────────────────
// 野良 AI 検出データ
// ──────────────────────────────────────────────────────────────
export interface ShadowAiSignal {
  toolName: string
  toolLogo: string
  category: string
  signals: string[]
  estimatedUsers: number
  estimatedMonthlyCost: number
  risk: 'high' | 'medium' | 'low'
  detectedAt: string
}

export const shadowAiSignals: ShadowAiSignal[] = [
  {
    toolName: 'ChatGPT Plus（個人契約）',
    toolLogo: 'https://openai.com/favicon.ico',
    category: 'LLM',
    signals: [
      '経費申請に "OpenAI" の記載が 7件（2026年2月）',
      'クレジットカード明細に月額 $20 の定期支払いが複数',
    ],
    estimatedUsers: 7,
    estimatedMonthlyCost: 21000,
    risk: 'high',
    detectedAt: '2026-02-28',
  },
  {
    toolName: 'Claude Pro（個人契約）',
    toolLogo: 'https://claude.ai/favicon.ico',
    category: 'LLM',
    signals: [
      'クレジットカード明細に "ANTHROPIC" の記載が 4件',
      '経費申請に "Claude" の記載が 2件',
    ],
    estimatedUsers: 4,
    estimatedMonthlyCost: 16000,
    risk: 'high',
    detectedAt: '2026-02-15',
  },
  {
    toolName: 'Perplexity Pro',
    toolLogo: 'https://www.perplexity.ai/favicon.ico',
    category: 'AI検索',
    signals: [
      '経費申請に "Perplexity" の記載が 3件',
      'Slack に perplexity.ai のリンクが月30件以上共有されている',
    ],
    estimatedUsers: 3,
    estimatedMonthlyCost: 6000,
    risk: 'medium',
    detectedAt: '2026-02-20',
  },
  {
    toolName: 'Midjourney',
    toolLogo: 'https://cdn.midjourney.com/site-assets/midjourney-logomark.png',
    category: '画像生成AI',
    signals: [
      '経費申請に "Midjourney" の記載が 2件',
    ],
    estimatedUsers: 2,
    estimatedMonthlyCost: 9600,
    risk: 'medium',
    detectedAt: '2026-01-15',
  },
]

// ──────────────────────────────────────────────────────────────
// AI 導入効果測定データ
// ──────────────────────────────────────────────────────────────
export interface AdoptionMetric {
  id: string
  category: string
  metric: string
  before: number
  after: number
  unit: string
  period: string
  tool: string
  improvementPct: number   // 正=改善, 負=悪化
  lowerIsBetter: boolean
}

export const adoptionMetrics: AdoptionMetric[] = [
  {
    id: 'm1',
    category: 'コーディング速度',
    metric: 'PRマージまでの平均時間',
    before: 52,
    after: 38,
    unit: '時間',
    period: 'GitHub Copilot導入前後（2025 Q3 vs Q4）',
    tool: 'GitHub Copilot',
    improvementPct: 27,
    lowerIsBetter: true,
  },
  {
    id: 'm2',
    category: 'コーディング速度',
    metric: '週あたりコミット数（平均）',
    before: 18,
    after: 24,
    unit: 'コミット',
    period: 'GitHub Copilot導入前後（2025 Q3 vs Q4）',
    tool: 'GitHub Copilot',
    improvementPct: 33,
    lowerIsBetter: false,
  },
  {
    id: 'm3',
    category: 'コード品質',
    metric: 'バグ修正の平均所要時間',
    before: 4.2,
    after: 2.8,
    unit: '時間',
    period: 'Cursor導入前後（2026 Q1比較）',
    tool: 'Cursor',
    improvementPct: 33,
    lowerIsBetter: true,
  },
  {
    id: 'm4',
    category: 'ドキュメント',
    metric: 'ドキュメント作成時間（1ページ）',
    before: 120,
    after: 45,
    unit: '分',
    period: 'Claude API導入前後（2025 Q4 vs Q1）',
    tool: 'Claude API',
    improvementPct: 63,
    lowerIsBetter: true,
  },
  {
    id: 'm5',
    category: 'コードレビュー',
    metric: 'コードレビュー所要時間',
    before: 85,
    after: 55,
    unit: '分/PR',
    period: 'Claude API導入前後',
    tool: 'Claude API',
    improvementPct: 35,
    lowerIsBetter: true,
  },
  {
    id: 'm6',
    category: 'テスト',
    metric: 'テストカバレッジ',
    before: 62,
    after: 78,
    unit: '%',
    period: 'AI導入後（2025 Q3 vs 2026 Q1）',
    tool: 'GitHub Copilot + Claude API',
    improvementPct: 26,
    lowerIsBetter: false,
  },
]
