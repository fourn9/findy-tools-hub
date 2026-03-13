import { Hono } from 'hono'
import Anthropic from '@anthropic-ai/sdk'
import { sql } from '../db'

export const optimizeRouter = new Hono()

// ────────────────────────────────────────
// 型定義
// ────────────────────────────────────────

type FrontendAction =
  | { type: 'update_seats'; contractId: string; seats: number; usageRate: number }
  | { type: 'cancel';       contractId: string }
  | { type: 'update_plan';  contractId: string; plan: string }

// ────────────────────────────────────────
// Anthropic クライアント
// ────────────────────────────────────────

function getClient(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) throw new Error('ANTHROPIC_API_KEY が設定されていません')
  return new Anthropic({ apiKey })
}

// ────────────────────────────────────────
// ツール定義（Claude に渡すツール一覧）
// ────────────────────────────────────────

const AGENT_TOOLS: Anthropic.Tool[] = [
  {
    name: 'get_contract',
    description: '指定したIDの契約情報をデータベースから取得します',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_id: { type: 'string', description: '契約ID（数値文字列）' },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'update_contract_seats',
    description: '契約のシート数を新しい数値に更新します',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_id: { type: 'string', description: '契約ID' },
        seats:       { type: 'number', description: '新しいシート数' },
      },
      required: ['contract_id', 'seats'],
    },
  },
  {
    name: 'cancel_contract',
    description: '契約をキャンセル（解約）ステータスに変更します',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_id: { type: 'string', description: '契約ID' },
        reason:      { type: 'string', description: '解約理由（任意）' },
      },
      required: ['contract_id'],
    },
  },
  {
    name: 'update_contract_plan',
    description: '契約のプランを変更します',
    input_schema: {
      type: 'object' as const,
      properties: {
        contract_id: { type: 'string', description: '契約ID' },
        plan:        { type: 'string', description: '新しいプラン名' },
      },
      required: ['contract_id', 'plan'],
    },
  },
]

// ────────────────────────────────────────
// SSEラベル生成
// ────────────────────────────────────────

function stepLabel(toolName: string, input: Record<string, unknown>, done: boolean): string {
  switch (toolName) {
    case 'get_contract':
      return done
        ? `契約情報を取得 ✓`
        : `契約情報を確認中 (ID: ${input.contract_id})`
    case 'update_contract_seats':
      return done
        ? `シート数を ${input.seats} 席に更新 ✓`
        : `シート数を ${input.seats} 席に更新中...`
    case 'cancel_contract':
      return done
        ? `契約を解約 ✓`
        : `契約解約処理を実行中...`
    case 'update_contract_plan':
      return done
        ? `プランを「${input.plan}」に変更 ✓`
        : `プランを「${input.plan}」に変更中...`
    default:
      return done ? `${toolName} 完了 ✓` : `${toolName} 実行中...`
  }
}

// ────────────────────────────────────────
// ツール実行（PostgreSQL → シミュレートフォールバック）
// ────────────────────────────────────────

async function executeTool(
  toolName: string,
  input: Record<string, unknown>,
): Promise<{ result: unknown; action: FrontendAction | null; simulated: boolean }> {
  let simulated = false
  let action: FrontendAction | null = null
  let result: unknown

  try {
    if (toolName === 'get_contract') {
      const id = Number(input.contract_id)
      const rows = await sql`SELECT id, tool_name, status, seats, used_seats, monthly_amount, plan FROM contracts WHERE id = ${id}`
      result = rows[0] ?? { error: 'Not found', id }

    } else if (toolName === 'update_contract_seats') {
      const id    = Number(input.contract_id)
      const seats = Number(input.seats)
      const rows = await sql`
        UPDATE contracts
        SET seats = ${seats}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, tool_name, seats, used_seats, monthly_amount
      `
      if (rows[0]) {
        const usedSeats  = Number(rows[0].used_seats)
        const usageRate  = seats > 0 ? Math.round(usedSeats * 100 / seats) : 0
        action = { type: 'update_seats', contractId: String(id), seats, usageRate }
        result = { success: true, ...rows[0] }
      } else {
        result = { error: 'Not found', id }
      }

    } else if (toolName === 'cancel_contract') {
      const id = Number(input.contract_id)
      const rows = await sql`
        UPDATE contracts
        SET status = 'cancelled', updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, tool_name, status
      `
      if (rows[0]) {
        action = { type: 'cancel', contractId: String(id) }
        result = { success: true, ...rows[0] }
      } else {
        result = { error: 'Not found', id }
      }

    } else if (toolName === 'update_contract_plan') {
      const id   = Number(input.contract_id)
      const plan = String(input.plan)
      const rows = await sql`
        UPDATE contracts
        SET plan = ${plan}, updated_at = NOW()
        WHERE id = ${id}
        RETURNING id, tool_name, plan
      `
      if (rows[0]) {
        action = { type: 'update_plan', contractId: String(id), plan }
        result = { success: true, ...rows[0] }
      } else {
        result = { error: 'Not found', id }
      }

    } else {
      result = { error: `Unknown tool: ${toolName}` }
    }
  } catch {
    // DB 未設定 / 接続エラー → シミュレート成功
    simulated = true
    if (toolName === 'update_contract_seats') {
      const id    = String(input.contract_id)
      const seats = Number(input.seats)
      action = { type: 'update_seats', contractId: id, seats, usageRate: 0 }
      result = { success: true, simulated: true, id, seats }
    } else if (toolName === 'cancel_contract') {
      const id = String(input.contract_id)
      action = { type: 'cancel', contractId: id }
      result = { success: true, simulated: true, id, status: 'cancelled' }
    } else if (toolName === 'update_contract_plan') {
      const id   = String(input.contract_id)
      const plan = String(input.plan)
      action = { type: 'update_plan', contractId: id, plan }
      result = { success: true, simulated: true, id, plan }
    } else {
      result = { simulated: true }
    }
  }

  return { result, action, simulated }
}

// ────────────────────────────────────────
// POST /api/optimize/run
// Body: OptimizeTarget (+ contractId fields)
// Response: SSE (text/event-stream)
//   data: {"event":"step_start","label":"..."}
//   data: {"event":"step_done","label":"...","simulated":false}
//   data: {"event":"agent_text","text":"..."}
//   data: {"event":"done","frontendActions":[...]}
//   data: [DONE]
// ────────────────────────────────────────

optimizeRouter.post('/run', async (c) => {
  const body = await c.req.json().catch(() => ({})) as {
    type?:              string
    // seat_reduction
    contractId?:        string
    toolName?:          string
    currentSeats?:      number
    recommendedSeats?:  number
    usedSeats?:         number
    waste?:             number
    // overlap_consolidation
    keepContractId?:    string
    cancelContractId?:  string
    keepToolName?:      string
    cancelToolName?:    string
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

  // ── プロンプト生成 ────────────────────
  let userMessage = ''

  if (body.type === 'seat_reduction') {
    userMessage = `以下の契約のシート数最適化を実行してください。

## 対象契約
- 契約ID: ${body.contractId}
- ツール名: ${body.toolName}
- 現在のシート数: ${body.currentSeats} 席
- 実際の使用シート数: ${body.usedSeats} 席
- 推奨シート数（使用数 × 1.15 バッファ）: ${body.recommendedSeats} 席
- 月次削減効果: ¥${(body.waste ?? 0).toLocaleString()}

## 実行手順（この順で必ずツールを呼んでください）
1. get_contract で契約情報を取得・確認する
2. update_contract_seats でシート数を ${body.recommendedSeats} 席に更新する
3. 完了後、結果を1〜2文で簡潔に日本語で報告する`

  } else if (body.type === 'overlap_consolidation') {
    userMessage = `以下の重複ツール統合（解約処理）を実行してください。

## 対象ツール
- 解約する契約ID: ${body.cancelContractId}
- 解約するツール名: ${body.cancelToolName}（月額 ¥${(body.cancelToolMonthly ?? 0).toLocaleString()}）
- 統合先（継続）ツール: ${body.keepToolName}

## 実行手順（この順で必ずツールを呼んでください）
1. get_contract で解約対象の契約情報を確認する
2. cancel_contract で ${body.cancelToolName} の契約を解約する
3. 完了後、結果を1〜2文で簡潔に日本語で報告する`

  } else {
    return c.json({ error: '不明な最適化タイプです' }, 400)
  }

  // ── SSE ストリーム ────────────────────
  const stream = new ReadableStream({
    async start(controller) {
      const enc = new TextEncoder()
      const enqueue = (payload: object) =>
        controller.enqueue(enc.encode(`data: ${JSON.stringify(payload)}\n\n`))

      const frontendActions: FrontendAction[] = []

      try {
        const messages: Anthropic.MessageParam[] = [
          { role: 'user', content: userMessage },
        ]

        // ── エージェントループ ──
        for (let turn = 0; turn < 10; turn++) {
          const response = await client.messages.create({
            model:      'claude-opus-4-5',
            max_tokens: 1024,
            tools:      AGENT_TOOLS,
            messages,
          })

          // テキストブロックを流す
          for (const block of response.content) {
            if (block.type === 'text' && block.text.trim()) {
              enqueue({ event: 'agent_text', text: block.text })
            }
          }

          // end_turn → 完了
          if (response.stop_reason === 'end_turn') break

          // ツール呼び出しを収集
          const toolUses = response.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === 'tool_use',
          )
          if (toolUses.length === 0) break

          // アシスタントメッセージを履歴に追加
          messages.push({ role: 'assistant', content: response.content })

          const toolResults: Anthropic.ToolResultBlockParam[] = []

          for (const toolUse of toolUses) {
            const input = toolUse.input as Record<string, unknown>

            // step_start
            enqueue({ event: 'step_start', label: stepLabel(toolUse.name, input, false) })

            // ツールを実行
            const { result, action, simulated } = await executeTool(toolUse.name, input)
            if (action) frontendActions.push(action)

            // step_done
            enqueue({
              event:     'step_done',
              label:     stepLabel(toolUse.name, input, true),
              simulated,
            })

            toolResults.push({
              type:        'tool_result',
              tool_use_id: toolUse.id,
              content:     JSON.stringify(result),
            })
          }

          // ツール結果を履歴に追加
          messages.push({ role: 'user', content: toolResults })
        }

        // 完了イベント
        enqueue({ event: 'done', frontendActions })
        controller.enqueue(enc.encode('data: [DONE]\n\n'))

      } catch (err) {
        enqueue({ event: 'error', message: String(err) })
        controller.enqueue(enc.encode('data: [DONE]\n\n'))
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
