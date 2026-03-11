import { Hono } from 'hono'
import Anthropic from '@anthropic-ai/sdk'

export const negotiateRouter = new Hono()

// ────────────────────────────────────────
// Anthropic クライアント（遅延初期化）
// ────────────────────────────────────────
function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません')
  return new Anthropic({ apiKey })
}

// ────────────────────────────────────────
// POST /api/negotiate/script
// Body: { contract: ApiContract }
// Response: SSE (text/event-stream)
//   data: {"text": "..."}   ← 差分テキスト
//   data: [DONE]            ← 終端
// ────────────────────────────────────────
negotiateRouter.post('/script', async (c) => {
  const body = await c.req.json().catch(() => ({}))

  const contract = body?.contract as {
    tool_name?: string
    monthly_amount?: number
    seats?: number
    used_seats?: number
    renewal_date?: string | null
    billing_cycle?: string
    plan?: string | null
  } | undefined

  if (!contract?.tool_name) {
    return c.json({ error: 'contract.tool_name は必須です' }, 400)
  }

  let client: Anthropic
  try {
    client = getClient()
  } catch (err) {
    return c.json({ error: String(err) }, 500)
  }

  // ── メトリクス計算 ──────────────────────
  const monthlyAmount   = contract.monthly_amount ?? 0
  const seats           = contract.seats ?? 0
  const usedSeats       = contract.used_seats ?? 0
  const seatUtil        = seats > 0 ? Math.round((usedSeats / seats) * 100) : null
  const billingCycle    = contract.billing_cycle === 'yearly' ? '年次' : '月次'

  let daysUntilRenewal: number | null = null
  if (contract.renewal_date) {
    daysUntilRenewal = Math.ceil(
      (new Date(contract.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
    )
  }

  // ── 交渉ポイント（条件付き） ──────────
  const negotiationPoints: string[] = []
  if (seatUtil !== null && seatUtil < 70) {
    negotiationPoints.push(
      `・シート使用率が ${seatUtil}% と低い → 不要シートの削減交渉が可能`,
    )
  }
  if (contract.billing_cycle === 'monthly') {
    negotiationPoints.push(
      `・現在月次課金 → 年次一括払いに切り替えることで通常 10〜20% 削減できる`,
    )
  }
  if (daysUntilRenewal !== null && daysUntilRenewal <= 90 && daysUntilRenewal > 0) {
    negotiationPoints.push(
      `・更新まであと ${daysUntilRenewal} 日 → 更新前が最も交渉力の高いタイミング`,
    )
  }
  if (monthlyAmount >= 100_000) {
    negotiationPoints.push(
      `・高額契約（月額 ¥${monthlyAmount.toLocaleString()}）→ エンタープライズ割引・カスタム価格の余地あり`,
    )
  }
  if (negotiationPoints.length === 0) {
    negotiationPoints.push('・定期的な価格見直しを提案し、長期利用実績をアピール')
  }

  // ── プロンプト ────────────────────────
  const prompt = `あなたはSaaS調達・ベンダー交渉の専門家です。以下の契約データをもとに、ベンダーとの価格交渉で即使える実践的な交渉スクリプトを日本語で作成してください。

## 契約情報
- ツール名: ${contract.tool_name}
- プラン: ${contract.plan ?? '不明'}
- 月額費用: ¥${monthlyAmount.toLocaleString()}（年額換算: ¥${(monthlyAmount * 12).toLocaleString()}）
- シート数: ${seats > 0 ? `${seats} 席（使用中 ${usedSeats} 席 / 使用率 ${seatUtil}%）` : '—'}
- 課金サイクル: ${billingCycle}
- 次回更新日: ${contract.renewal_date ?? '未設定'}${daysUntilRenewal !== null ? `（あと ${daysUntilRenewal} 日）` : ''}

## 活用すべき交渉ポイント
${negotiationPoints.join('\n')}

## 出力形式（必ずこの順序で書いてください）

### 1. 交渉戦略サマリー
このケースで使える主要な交渉根拠を箇条書きで 3〜5 点。

### 2. メール交渉スクリプト
件名・本文を含む完成形のメール文。コピペしてすぐ送れるレベルで書く。
宛先は「〇〇株式会社 ご担当者様」などのプレースホルダーでよい。

### 3. 電話・商談での話し方（会話スクリプト）
担当者との会話を想定した台本形式で書く。「我々（買い手）」と「ベンダー担当者」のやり取りを 5〜8 ターン。

### 4. 期待できる削減目標
現実的な割引率（%）と削減後の月額・年額の試算。

### 5. BATNA（交渉決裂時の代替案）
交渉が失敗した場合の次の選択肢を 2〜3 点。

スクリプトは具体的かつ丁寧なビジネス敬語で書いてください。`

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
          max_tokens: 4096,
          thinking: { type: 'adaptive' },
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
      'Content-Type':  'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection:      'keep-alive',
      'X-Accel-Buffering': 'no',  // nginx バッファリング無効
    },
  })
})
