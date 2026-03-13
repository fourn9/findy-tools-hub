import { useEffect, useState, useCallback } from 'react'
import { supabase, DbExpenseItem } from '../lib/supabase'

// Shadow AI として検出するキーワードリスト
const SHADOW_AI_KEYWORDS: { keyword: string; tool: string; risk: 'high' | 'medium' | 'low' }[] = [
  { keyword: 'openai',       tool: 'ChatGPT Plus（個人契約）', risk: 'high' },
  { keyword: 'chatgpt',      tool: 'ChatGPT Plus（個人契約）', risk: 'high' },
  { keyword: 'anthropic',    tool: 'Claude Pro（個人契約）',   risk: 'high' },
  { keyword: 'claude.ai',    tool: 'Claude Pro（個人契約）',   risk: 'high' },
  { keyword: 'perplexity',   tool: 'Perplexity Pro',          risk: 'medium' },
  { keyword: 'midjourney',   tool: 'Midjourney',              risk: 'medium' },
  { keyword: 'runway',       tool: 'Runway ML',               risk: 'medium' },
  { keyword: 'elevenlabs',   tool: 'ElevenLabs',              risk: 'medium' },
  { keyword: 'copilot',      tool: 'GitHub Copilot Individual', risk: 'low' },
  { keyword: 'gemini',       tool: 'Gemini Advanced',         risk: 'low' },
]

export function useExpenses() {
  const [items, setItems]         = useState<DbExpenseItem[]>([])
  const [shadowAi, setShadowAi]   = useState<DbExpenseItem[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('expense_items')
      .select('*')
      .order('date', { ascending: false })
      .limit(500)

    if (error) {
      setError(error.message)
    } else {
      const rows = (data ?? []) as DbExpenseItem[]
      setItems(rows)
      setShadowAi(rows.filter(r => r.flagged_as_shadow_ai))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // CSV を解析して DB に保存
  const uploadCsv = async (csvText: string): Promise<{ inserted: number; flagged: number }> => {
    const lines = csvText.trim().split('\n')
    if (lines.length < 2) return { inserted: 0, flagged: 0 }

    const rows: Omit<DbExpenseItem, 'id' | 'uploaded_at'>[] = []

    for (const line of lines.slice(1)) {
      // freee / マネーフォワード の一般的なCSV形式
      // 日付,説明/摘要,金額,カテゴリ
      const cols = line.split(',').map(c => c.replace(/^"|"$/g, '').trim())
      if (cols.length < 3) continue

      const date   = cols[0] || new Date().toISOString().slice(0, 10)
      const desc   = cols[1] || ''
      const amount = parseInt(cols[2].replace(/[^0-9-]/g, '')) || 0

      // Shadow AI キーワードチェック
      const lower = desc.toLowerCase()
      const hit   = SHADOW_AI_KEYWORDS.find(k => lower.includes(k.keyword))

      rows.push({
        date,
        description:          desc,
        amount:               Math.abs(amount),
        vendor:               cols[3] ?? null,
        flagged_as_shadow_ai: !!hit,
        shadow_ai_tool:       hit?.tool ?? null,
        risk_level:           hit?.risk ?? null,
      })
    }

    if (rows.length === 0) return { inserted: 0, flagged: 0 }

    const { error } = await supabase.from('expense_items').insert(rows)
    if (error) throw new Error(error.message)

    await load()
    return {
      inserted: rows.length,
      flagged:  rows.filter(r => r.flagged_as_shadow_ai).length,
    }
  }

  return { items, shadowAi, loading, error, reload: load, uploadCsv }
}
