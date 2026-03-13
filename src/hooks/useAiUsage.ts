import { useEffect, useState, useCallback } from 'react'
import { supabase, DbAiUsageSnapshot } from '../lib/supabase'

export type AiUsageSummary = {
  provider: string
  model: string
  totalInputTokens: number
  totalOutputTokens: number
  totalCostJpy: number
  days: number
}

export function useAiUsage(days = 30) {
  const [snapshots, setSnapshots] = useState<DbAiUsageSnapshot[]>([])
  const [summary, setSummary]     = useState<AiUsageSummary[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)
  const [lastFetched, setLastFetched] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const since = new Date()
    since.setDate(since.getDate() - days)

    const { data, error } = await supabase
      .from('ai_usage_snapshots')
      .select('*')
      .gte('date', since.toISOString().slice(0, 10))
      .order('date', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      const rows = (data ?? []) as DbAiUsageSnapshot[]
      setSnapshots(rows)

      // モデル別に集計
      const map = new Map<string, AiUsageSummary>()
      for (const row of rows) {
        const key = `${row.provider}:${row.model}`
        const cur = map.get(key) ?? {
          provider: row.provider,
          model: row.model,
          totalInputTokens: 0,
          totalOutputTokens: 0,
          totalCostJpy: 0,
          days: 0,
        }
        cur.totalInputTokens  += row.input_tokens
        cur.totalOutputTokens += row.output_tokens
        cur.totalCostJpy      += row.cost_jpy
        cur.days              += 1
        map.set(key, cur)
      }
      setSummary(Array.from(map.values()).sort((a, b) => b.totalCostJpy - a.totalCostJpy))
      setLastFetched(rows[0]?.created_at ?? null)
    }
    setLoading(false)
  }, [days])

  useEffect(() => { load() }, [load])

  return { snapshots, summary, loading, error, lastFetched, reload: load }
}
