import { useState, useRef } from 'react'
import {
  X,
  Bot,
  Loader2,
  Play,
  CheckCircle,
  AlertCircle,
  RefreshCw,
} from 'lucide-react'

// ──────────────────────────────────────────────────────────────
// 型定義（エクスポート）
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

export type FrontendAction =
  | { type: 'update_seats'; contractId: string; seats: number; usageRate: number }
  | { type: 'cancel';       contractId: string }
  | { type: 'update_plan';  contractId: string; plan: string }

interface AgentStep {
  label:  string
  status: 'running' | 'done'
}

interface OptimizationAgentProps {
  target:    OptimizeTarget
  onExecute: (actions: FrontendAction[]) => Promise<void>
  onClose:   () => void
}

type Phase = 'idle' | 'running' | 'done' | 'error'

// ──────────────────────────────────────────────────────────────
// API ベース URL
// ──────────────────────────────────────────────────────────────
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''

// ──────────────────────────────────────────────────────────────
// コンポーネント
// ──────────────────────────────────────────────────────────────
export function OptimizationAgent({ target, onExecute, onClose }: OptimizationAgentProps) {
  const [phase,     setPhase]     = useState<Phase>('idle')
  const [steps,     setSteps]     = useState<AgentStep[]>([])
  const [agentText, setAgentText] = useState('')
  const [errorMsg,  setErrorMsg]  = useState('')
  const stepsEndRef               = useRef<HTMLDivElement>(null)

  const savings = target.type === 'seat_reduction'
    ? target.waste
    : target.cancelToolMonthly

  const title = target.type === 'seat_reduction'
    ? `${target.toolName} のシートを削減`
    : `${target.cancelToolName} の解約`

  // ── エージェント実行 ─────────────────────
  async function runAgent() {
    setPhase('running')
    setSteps([])
    setAgentText('')
    setErrorMsg('')

    const runBody =
      target.type === 'seat_reduction'
        ? {
            type:             'seat_reduction',
            contractId:       target.contractId,
            toolName:         target.toolName,
            currentSeats:     target.currentSeats,
            recommendedSeats: target.recommendedSeats,
            usedSeats:        target.usedSeats,
            waste:            target.waste,
          }
        : {
            type:              'overlap_consolidation',
            cancelContractId:  target.cancelContractId,
            keepContractId:    target.keepContractId,
            keepToolName:      target.keepToolName,
            cancelToolName:    target.cancelToolName,
            cancelToolMonthly: target.cancelToolMonthly,
          }

    try {
      const res = await fetch(`${BASE}/api/optimize/run`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify(runBody),
      })
      if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`)

      const reader  = res.body!.getReader()
      const decoder = new TextDecoder()
      let buffer    = ''
      let frontendActions: FrontendAction[] = []

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
            await onExecute(frontendActions)
            setPhase('done')
            return
          }

          try {
            const parsed = JSON.parse(payload) as {
              event?:          string
              label?:          string
              text?:           string
              message?:        string
              simulated?:      boolean
              frontendActions?: FrontendAction[]
            }

            if (parsed.event === 'step_start') {
              setSteps((prev) => [...prev, { label: parsed.label ?? '', status: 'running' }])
              setTimeout(() => stepsEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 50)

            } else if (parsed.event === 'step_done') {
              setSteps((prev) => {
                const next = [...prev]
                // 最後の running ステップを done に更新
                for (let i = next.length - 1; i >= 0; i--) {
                  if (next[i].status === 'running') {
                    next[i] = { label: parsed.label ?? next[i].label, status: 'done' }
                    break
                  }
                }
                return next
              })

            } else if (parsed.event === 'agent_text') {
              setAgentText((prev) => prev + (parsed.text ?? ''))

            } else if (parsed.event === 'done') {
              frontendActions = parsed.frontendActions ?? []

            } else if (parsed.event === 'error') {
              throw new Error(parsed.message ?? 'エージェントエラーが発生しました')
            }
          } catch (e) {
            // エージェントエラーは上に伝播
            const msg = (e as Error).message
            if (msg.includes('エージェントエラー') || msg.includes('HTTP ')) throw e
            // JSON パースエラーは無視
          }
        }
      }
      // [DONE] を受け取れなかった場合も完了扱い
      await onExecute(frontendActions)
      setPhase('done')

    } catch (err) {
      setErrorMsg(String(err))
      setPhase('error')
    }
  }

  function reset() {
    setPhase('idle')
    setSteps([])
    setAgentText('')
    setErrorMsg('')
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
                <Bot className="w-8 h-8 text-violet-400" />
              </div>
              <p className="text-sm font-medium text-gray-700">AIエージェントが実際の作業を行います</p>
              <p className="text-xs text-gray-400 max-w-xs mx-auto">
                契約データの確認・シート変更・解約処理をAIが自律的に実行します
              </p>
            </div>
          )}

          {/* 実行ステップ */}
          {(phase === 'running' || phase === 'done') && steps.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1.5">
                <Bot className="w-3.5 h-3.5 text-violet-500" />
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">エージェント実行ログ</p>
                {phase === 'running' && <Loader2 className="w-3 h-3 animate-spin text-violet-500 ml-1" />}
              </div>
              <div className="bg-gray-50 rounded-xl border border-gray-200 p-4 space-y-3">
                {steps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2.5 text-sm transition-all duration-500">
                    {step.status === 'done' ? (
                      <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                    ) : (
                      <Loader2 className="w-4 h-4 text-violet-500 animate-spin shrink-0" />
                    )}
                    <span className={
                      step.status === 'done'
                        ? 'text-gray-900 font-medium'
                        : 'text-violet-700 font-medium'
                    }>
                      {step.label}
                    </span>
                  </div>
                ))}
                <div ref={stepsEndRef} />
              </div>
            </div>
          )}

          {/* エージェントのテキスト出力 */}
          {agentText && (
            <div className="rounded-xl border border-gray-200 bg-white p-4 space-y-2">
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">エージェントレポート</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap leading-relaxed">{agentText}</p>
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
              onClick={runAgent}
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-600 hover:bg-violet-700 text-white font-semibold text-sm transition-colors"
            >
              <Play className="w-4 h-4" />
              エージェントを実行
            </button>
          )}

          {phase === 'running' && (
            <button
              disabled
              className="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-violet-200 text-violet-400 font-semibold text-sm cursor-not-allowed"
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
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-2 px-4 rounded-xl bg-gray-100 hover:bg-gray-200 text-gray-600 font-medium text-sm transition-colors"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              やり直す
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
