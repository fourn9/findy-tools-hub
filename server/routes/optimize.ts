import { Hono } from 'hono'
import Anthropic from '@anthropic-ai/sdk'

export const optimizeRouter = new Hono()

// ────────────────────────────────────────
// Anthropic クライアント（遅延初期化）
// ────────────────────────────────────────
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません')
  return new Anthropic({ apiKey })
}

// ────────────────────────────────────────
// POST /api/optimize/plan
// Body: {
//   type: 'seat_reduction' | 'overlap_consolidation'
//   // seat_reduction:
//   toolName?: string
//   currentSeats?: number
//   recommendedSeats?: number
//   usedSeats?: number
//   waste?: number
//   // overlap_consolidation:
//   keepToolName?: string
//   cancelToolName?: string
//   cancelToolMonthly?: number
// }
// Response: SSE (text/event-stream)
//   data: {"text": "..."}   ← 差分テキスト
//   data: [DONE]            ← 終端
// ────────────────────────────────────────
optimizeRouter.post('/plan', async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    type?: string
    toolName?: string
    currentSeats?: number
    recommendedSeats?: number
    usedSeats?: number
    waste?: number
    keepToolName?: string
    cancelToolName?: string
    cancelToolMonthly?: number
  }

  if (!body.type) {
    return c.json({ error: 'type は必須です' }, 400)
  }

  let client: Anthropic
  try {
    client = getClient()
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }

  // ── プロンプト生成 ─────────────────────
  let prompt = ''

  if (body.type === 'seat_reduction') {
    const annualSaving = Math.round((body.waste ?? 0) * 12)
    prompt = `あなたはSaaSコスト最適化の専門家です。以下のAIツール契約について、シート削減の最適化プランを日本語で作成してください。

## 対象契約
- ツール名: ${body.toolName ?? '不明'}
- 現在のシート数: ${body.currentSeats ?? 0} 席
- 現在の使用シート数: ${body.usedSeats ?? 0} 席
- 推奨シート数: ${body.recommendedSeats ?? 0} 席（現利用率 × 1.15 バッファ）
- 月次削減効果: ¥${(body.waste ?? 0).toLocaleString()}
- 年次削減効果: ¥${annualSaving.toLocaleString()}

## 出力形式（必ずこの順序で作成してください）

### 変更内容
何を、どのように変更するかを箇条書きで簡潔に（3点以内）

### 変更理由
なぜこの変更が最適か、データに基づいた根拠を2〜3文で記述してください。

### 実行ステップ
1. 〜
2. 〜
3. 〜
4. 〜

### リスク・注意事項
変更に伴う潜在的なリスクと対策を1〜2点`
  } else if (body.type === 'overlap_consolidation') {
    prompt = `あなたはSaaSコスト最適化の専門家です。以下の機能重複AIツールについて、統合・解約のプランを日本語で作成してください。

## 対象ツール
- 継続するツール: ${body.keepToolName ?? '不明'}
- 解約候補ツール: ${body.cancelToolName ?? '不明'}（月額 ¥${(body.cancelToolMonthly ?? 0).toLocaleString()}）
- 月次削減効果: ¥${(body.cancelToolMonthly ?? 0).toLocaleString()}
- 年次削減効果: ¥${Math.round((body.cancelToolMonthly ?? 0) * 12).toLocaleString()}

## 出力形式（必ずこの順序で作成してください）

### 変更内容
何を、どのように変更するかを箇条書きで簡潔に（3点以内）

### 変更理由
なぜ ${body.cancelToolName ?? '解約候補ツール'} を解約し ${body.keepToolName ?? '継続ツール'} に統一するのか、機能・コスト観点から2〜3文で記述してください。

### 実行ステップ
1. 〜
2. 〜
3. 〜
4. 〜

### リスク・注意事項
移行期間中の注意点、利用者への周知方法など1〜2点`
  } else {
    return c.json({ error: '不明な最適化タイプです' }, 400)
  }

  // ── SSE ストリーム ────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const enqueue = (payload: object) => {
        controller.enqueue(
          new TextEncoder().encode(`data: ${JSON.stringify(payload)}\n\n`),
        )
      }

      try {
        const messageStream = client.messages.stream({
          model: 'claude-opus-4-6',
          max_tokens: 2048,
          messages: [{ role: 'user', content: prompt }],
        })

        for await (const event of messageStream) {
          if (
            event.type === 'content_block_delta' &&
            event.delta.type === 'text_delta'
          ) {
            enqueue({ text: event.delta.text })
          }
        }

        controller.enqueue(new TextEncoder().encode('data: [DONE]\n\n'))
      } catch (err) {
        enqueue({ error: String(err) })
      } finally {
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':      'text/event-stream; charset=utf-8',
      'Cache-Control':     'no-cache, no-transform',
      Connection:          'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
})
