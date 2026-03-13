import { useState, useRef } from 'react'
import {
  X,
  Bot,
  Loader2,
  Play,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react'

// ──────────────────────────────────────────────────────────────
// 型定義
// ──────────────────────────────────────────────────────────────

export type OptimizeTarget =
  | {
      type: 'seat_reduction'
      contractId: string
      toolName: string
      currentSeats: number
      recommendedSeats: number
      usedSeats: number
      waste: number
    }
  | {
      type: 'overlap_consolidation'
      keepContractId: string
      cancelContractId: string
      keepToolName: string
      cancelToolName: string
      cancelToolMonthly: number
    }

interface OptimizationAgentProps {
  target: OptimizeTarget
  onExecute: () => Promise<void>
  onClose: () => void
  onDone?: () => void
}

type Phase = 'idle' | 'planning' | 'ready' | 'executing' | 'done' | 'error'

// ──────────────────────────────────────────────────────────────
// 実行ステップ定義
// ──────────────────────────────────────────────────────────────
const STEPS_SEAT = [
  '最適化プランを確認中...',
  '対象契約の情報を取得中...',
  `シート数を更新中...`,
  '月次コストを再計算中...',
  '変更を保存しました ✓',
]

const STEPS_OVERLAP = [
  '最適化プランを確認中...',
  '重複ツールの使用状況を確認中...',
  '解約対象ツールのステータスを更新中...',
  '月次コストを再計算中...',
  '変更を保存しました ✓',
]

// ──────────────────────────────────────────────────────────────
// API ベース URL（negotiate と同じ方式）
// ──────────────────────────────────────────────────────────────
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

// ──────────────────────────────────────────────────────────────
// コンポーネント
// ──────────────────────────────────────────────────────────────
export function OptimizationAgent({
  target,
  onExecute,
  onClose,
  onDone,
}: OptimizationAgentProps) {
  const [phase, setPhase]           = useState<Phase>('idle')
  const [planText, setPlanText]     = useState('')
  const [currentStep, setCurrentStep] = useState(-1)
  const [errorMsg, setErrorMsg]     = useState('')
  const planRef                     = useRef<HTMLDivElement>(null)

  const steps   = target.type === 'seat_reduction' ? STEPS_SEAT : STEPS_OVERLAP
  const savings = target.type === 'seat_reduction'
    ? target.waste
    : target.cancelToolMonthly

  const title = target.type === 'seat_reduction'
    ? `${target.toolName} のシートを削減`
    : `${target.cancelToolName} の解約`

  // ── SSE でプランを生成 ──────────────────
  async function generatePlan() {
    setPhase('planning')
    setPlanText('')
    setErrorMsg('')

    const planBody =
      target.type === 'seat_reduction'
        ? {
            type:             'seat_reduction',
            toolName:         target.toolName,
            currentSeats:     target.currentSeats,
            recommendedSeats: target.recommendedSeats,
            usedSeats:        target.usedSeats,
            waste:            target.waste,
          }
        : {
            type:               'overlap_consolidation',
            keepToolName:       target.keepToolName,
            cancelToolName:     target.cancelToolName,
            cancelToolMonthly:  target.cancelToolMonthly,
          }

    try {
      const res = await fetch(`${BASE}/api/optimize/plan`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(planBody),
      })

      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const payload = line.slice(6)
          if (payload === '[DONE]') {
            setPhase('ready')
            return
          }
          try {
            const parsed = JSON.parse(payload) as { text?: string; error?: string }
            if (parsed.error) throw new Error(parsed.error)
            if (parsed.text) {
              setPlanText((prev) => {
                const next = prev + parsed.text
                setTimeout(() => {
                  planRef.current?.scrollTo({ top: planRef.current.scrollHeight, behavior: 'smooth' })
                }, 10)
                return next
              })
            }
          } catch (e) {
            if ((e as Error).message !== 'SyntaxError') {
              throw e
            }
          }
        }
      }
      setPhase('ready')
    } catch (err) {
      setErrorMsg(String(err))
      setPhase('error')
    }
  }

  // ── 実行（ステップアニメーション + DB 更新）──
  async function executeOptimization() {
    setPhase('executing')
    setCurrentStep(0)

    // ステップ 0〜2 をアニメーション
    for (let i = 0; i < steps.length - 2; i++) {
      await new Promise<void>((r) => setTimeout(r, 700))
      setCurrentStep(i + 1)
    }

    // 実際の更新
    try {
      await onExecute()
      await new Promise<void>((r) => setTimeout(r, 500))
      setCurrentStep(steps.length - 1)
      setPhase('done')
      onDone?.()
    } catch (err) {
      setErrorMsg(String(err))
      setPhase('error')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* バックドロップ */}
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />

      {/* ドロワー（右から） */}
      <div className="relative ml-auto w-full max-w-lg bg-white h-full flex flex-col shadow-2xl">

        {/* ヘッダー */}
        <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-200 shrink-0 bg-gradient-to-r from-violet-50 to-indigo-50">
          <div className="w-9 h-9 bg-violet-600 rounded-xl flex items-center justify-center shrink-0">
            <Bot className="w-5 h-5 text-white" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-gray-900 text-sm">AI最適化エージェント</p>
            <p className="text-xs text-gray-500 truncate">{title}</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-white/80 rounded-lg text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* ボディ */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">

          {/* 最適化概要カード */}
          <div className="rounded-xl border border-violet-200 bg-violet-50 p-4 space-y-2.5">
            <p className="text-xs font-bold text-violet-600 uppercase tracking-wider">最適化概要</p>
            {target.type === 'seat_reduction' ? (
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔧</span>
                  <span className="font-semibold text-gray-900">{target.toolName}</span>
                  <span className="text-gray-500">のシート数を削減</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="text-lg">📉</span>
                  <span>{target.currentSeats} 席</span>
                  <span className="text-gray-400">→</span>
                  <span className="font-bold text-violet-700">{target.recommendedSeats} 席</span>
                  <span className="text-xs text-gray-400">（現利用×1.15バッファ）</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <span className="text-gray-600">月次削減:</span>
                  <span className="font-bold text-green-600 text-base">-¥{target.waste.toLocaleString()}</span>
                  <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                    年間 -¥{Math.round(target.waste * 12 / 10000)}万
                  </span>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-lg">🔀</span>
                  <span className="text-gray-500">機能重複ツールを統合</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="text-lg">✅</span>
                  <span className="font-semibold text-gray-900">{target.keepToolName}</span>
                  <span className="text-gray-400">に統一</span>
                </div>
                <div className="flex items-center gap-2 text-gray-700">
                  <span className="text-lg">❌</span>
                  <span className="font-semibold text-gray-900">{target.cancelToolName}</span>
                  <span className="text-gray-500">を解約</span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-lg">💰</span>
                  <span className="text-gray-600">月次削減:</span>
                  <span className="font-bold text-green-600 text-base">-¥{target.cancelToolMonthly.toLocaleString()}</span>
                  <span className="text-xs text-green-700 bg-green-100 px-1.5 py-0.5 rounded-full">
                    年間 -¥{Math.round(target.cancelToolMonthly * 12 / 10000)}万
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* アイドル状態 */}
          {phase === 'idle' && (
            <div className="text-center py-10 space-y-3">
              <div className="w-16 h-16 bg-violet-100 rounded-2xl flex items-center justify-center mx-auto">
                <Sparkles className="w-8 h-8 text-violet-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">AIが最適化プランを生成します</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                変更内容・その理由・実行ステップを確認してから、実際に契約データを更新できます
              </p>
            </div>
          )}

          {/* プランテキスト（生成中・完了後） */}
          {(phase === 'planning' || phase === 'ready' || phase === 'executing' || phase === 'done') && planText && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-violet-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">最適化プラン</p>
                {phase === 'planning' && (
                  <Loader2 className="w-3 h-3 animate-spin text-violet-500 ml-1" />
                )}
              </div>
              <div
                ref={planRef}
                className="bg-gray-50 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto border border-gray-200 font-mono"
              >
                {planText}
                {phase === 'planning' && (
                  <span className="inline-block w-1.5 h-4 bg-violet-500 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
                )}
              </div>
            </div>
          )}

          {/* 実行ステップ */}
          {(phase === 'executing' || phase === 'done') && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">実行ステップ</p>
              <div className="space-y-2.5">
                {steps.map((step, i) => {
                  const isCompleted = i < currentStep || (phase === 'done' && i === steps.length - 1)
                  const isActive    = i === currentStep && phase === 'executing'
                  const isPending   = i > currentStep
                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-2.5 text-sm transition-all duration-500 ${isPending ? 'opacity-30' : 'opacity-100'}`}
                    >
                      {isCompleted ? (
                        <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                      ) : isActive ? (
                        <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />
                      ) : (
                        <div className="w-4 h-4 rounded-full border-2 border-gray-300 shrink-0" />
                      )}
                      <span className={isCompleted || isActive ? 'text-gray-900 font-medium' : 'text-gray-400'}>
                        {step}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* エラー */}
          {phase === 'error' && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 flex gap-3">
              <AlertCircle className="w-5 h-5 text-red-500 shrink-0 mt-0.5" />
              <div className="space-y-1">
                <p className="text-sm font-semibold text-red-700">エラーが発生しました</p>
                <p className="text-xs text-red-600">{errorMsg}</p>
                <p className="text-xs text-red-400 mt-1">
                  バックエンドサーバーと ANTHROPIC_API_KEY の設定を確認してください
                </p>
              </div>
            </div>
          )}

          {/* 完了 */}
          {phase === 'done' && (
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 flex gap-3">
              <CheckCircle className="w-5 h-5 text-green-500 shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <p className="text-sm font-semibold text-green-700">最適化が完了しました！</p>
                <p className="text-xs text-green-600">
                  月次 <span className="font-bold">¥{savings.toLocaleString()}</span> のコスト削減が適用されました
                </p>
              </div>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 shrink-0 space-y-2">
          {phase === 'idle' && (
            <button
              onClick={generatePlan}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors"
            >
              <Sparkles className="w-4 h-4" />
              AIプランを生成
            </button>
          )}

          {phase === 'planning' && (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-200 text-violet-400 font-semibold text-sm cursor-not-allowed"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              プランを生成中...
            </button>
          )}

          {phase === 'ready' && (
            <>
              <button
                onClick={executeOptimization}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-green-600 hover:bg-green-700 text-white font-semibold text-sm transition-colors"
              >
                <Play className="w-4 h-4" />
                最適化を実行する
              </button>
              <button
                onClick={() => { setPhase('idle'); setPlanText('') }}
                className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gray-200 hover:bg-gray-300 text-gray-600 font-medium text-sm transition-colors"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                プランを再生成
              </button>
            </>
          )}

          {phase === 'executing' && (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-green-200 text-green-400 font-semibold text-sm cursor-not-allowed"
            >
              <Loader2 className="w-4 h-4 animate-spin" />
              実行中...
            </button>
          )}

          {(phase === 'done' || phase === 'error') && (
            <button
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-gray-900 hover:bg-gray-800 text-white font-semibold text-sm transition-colors"
            >
              閉じる
            </button>
          )}

          {phase === 'error' && (
            <button
              onClick={() => { setPhase('idle'); setPlanText(''); setErrorMsg('') }}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium text-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              最初からやり直す
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
