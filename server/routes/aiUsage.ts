import { Hono } from 'hono'
import { createClient } from '@supabase/supabase-js'

const router = new Hono()

// Supabase クライアント（サーバーサイド：service_role キー使用）
function getSupabase() {
  const url     = process.env.SUPABASE_URL
  const svcKey  = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !svcKey) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY が未設定')
  return createClient(url, svcKey)
}

// APIキーを DB から取得
async function getApiKey(provider: string): Promise<string | null> {
  const sb = getSupabase()
  const { data } = await sb
    .from('api_keys')
    .select('key_value')
    .eq('provider', provider)
    .single()
  return (data as any)?.key_value ?? null
}

// USD → JPY 変換（簡易固定レート。本番では為替APIを使うこと）
const USD_TO_JPY = 150

// ──────────────────────────────────────────────────────────────
// POST /api/ai-usage/sync
// Anthropic・OpenAI の Usage API を叩いてスナップショットを保存
// ──────────────────────────────────────────────────────────────
router.post('/sync', async (c) => {
  const sb      = getSupabase()
  const results: { provider: string; model: string; date: string; cost_jpy: number }[] = []
  const errors:  { provider: string; error: string }[] = []

  // ── Anthropic ──────────────────────────────────────────────
  const anthropicKey = await getApiKey('anthropic')
  if (anthropicKey) {
    try {
      const today  = new Date()
      const since  = new Date(today)
      since.setDate(since.getDate() - 30)

      const res = await fetch('https://api.anthropic.com/v1/usage', {
        headers: {
          'x-api-key':         anthropicKey,
          'anthropic-version': '2023-06-01',
        },
      })

      if (res.ok) {
        const data: any = await res.json()
        // Anthropic Usage API のレスポンス構造に合わせて解析
        // data.data: [ { date, model, usage: { input_tokens, output_tokens } } ]
        const usageList: any[] = data?.data ?? data?.usage ?? []

        for (const entry of usageList) {
          const model         = entry.model ?? 'unknown'
          const date          = entry.date ?? today.toISOString().slice(0, 10)
          const inputTokens   = entry.input_tokens  ?? entry.usage?.input_tokens  ?? 0
          const outputTokens  = entry.output_tokens ?? entry.usage?.output_tokens ?? 0

          // Anthropic の価格（2025年時点の概算）
          const prices: Record<string, { input: number; output: number }> = {
            'claude-opus-4-5':    { input: 15,   output: 75   },  // $/MTok
            'claude-sonnet-4-5':  { input: 3,    output: 15   },
            'claude-haiku-4-5':   { input: 0.25, output: 1.25 },
          }
          const price    = prices[model] ?? { input: 3, output: 15 }
          const costUsd  = (inputTokens / 1_000_000) * price.input
                         + (outputTokens / 1_000_000) * price.output
          const costJpy  = Math.round(costUsd * USD_TO_JPY)

          const { error } = await sb.from('ai_usage_snapshots').upsert({
            provider:      'anthropic',
            model,
            date,
            input_tokens:  inputTokens,
            output_tokens: outputTokens,
            cost_usd:      costUsd,
            cost_jpy:      costJpy,
          }, { onConflict: 'provider,model,date' })

          if (!error) results.push({ provider: 'anthropic', model, date, cost_jpy: costJpy })
        }
      } else {
        errors.push({ provider: 'anthropic', error: `HTTP ${res.status}` })
      }
    } catch (e) {
      errors.push({ provider: 'anthropic', error: String(e) })
    }
  }

  // ── OpenAI ────────────────────────────────────────────────
  const openaiKey = await getApiKey('openai')
  if (openaiKey) {
    try {
      const res = await fetch('https://api.openai.com/v1/usage?date=' + new Date().toISOString().slice(0, 10), {
        headers: { Authorization: `Bearer ${openaiKey}` },
      })

      if (res.ok) {
        const data: any = await res.json()
        const usageList: any[] = data?.data ?? []

        for (const entry of usageList) {
          const model        = entry.snapshot_id ?? entry.model ?? 'gpt-4o'
          const date         = entry.aggregation_timestamp
            ? new Date(entry.aggregation_timestamp * 1000).toISOString().slice(0, 10)
            : new Date().toISOString().slice(0, 10)
          const inputTokens  = entry.n_context_tokens_total  ?? 0
          const outputTokens = entry.n_generated_tokens_total ?? 0

          const prices: Record<string, { input: number; output: number }> = {
            'gpt-4o':          { input: 2.5,  output: 10 },
            'gpt-4o-mini':     { input: 0.15, output: 0.6 },
            'o1':              { input: 15,   output: 60 },
          }
          const price   = prices[model] ?? { input: 2.5, output: 10 }
          const costUsd = (inputTokens / 1_000_000) * price.input
                        + (outputTokens / 1_000_000) * price.output
          const costJpy = Math.round(costUsd * USD_TO_JPY)

          const { error } = await sb.from('ai_usage_snapshots').upsert({
            provider:     'openai',
            model,
            date,
            input_tokens:  inputTokens,
            output_tokens: outputTokens,
            cost_usd:     costUsd,
            cost_jpy:     costJpy,
          }, { onConflict: 'provider,model,date' })

          if (!error) results.push({ provider: 'openai', model, date, cost_jpy: costJpy })
        }
      } else {
        errors.push({ provider: 'openai', error: `HTTP ${res.status}` })
      }
    } catch (e) {
      errors.push({ provider: 'openai', error: String(e) })
    }
  }

  return c.json({ ok: true, synced: results.length, results, errors })
})

// GET /api/ai-usage/summary — 直近30日の集計を返す
router.get('/summary', async (c) => {
  const sb    = getSupabase()
  const since = new Date()
  since.setDate(since.getDate() - 30)

  const { data, error } = await sb
    .from('ai_usage_snapshots')
    .select('*')
    .gte('date', since.toISOString().slice(0, 10))
    .order('date', { ascending: false })

  if (error) return c.json({ error: error.message }, 500)
  return c.json({ data })
})

export { router as aiUsageRouter }
