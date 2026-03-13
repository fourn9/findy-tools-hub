import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

// ─── DB 型定義 ────────────────────────────────────────────────

export type DbContract = {
  id: string
  name: string
  vendor: string | null
  category: string | null
  plan: string | null
  status: string
  monthly_cost: number
  seats: number | null
  usage_rate: number | null
  contract_end: string | null
  department: string | null
  usage_type: string | null
  monthly_tokens: number | null
  engineer_count: number | null
  logo_url: string | null
  created_at: string
}

export type DbApiKey = {
  id: string
  provider: string   // 'anthropic' | 'openai' | 'github'
  key_masked: string // 表示用マスク (sk-...xxxx)
  created_at: string
}

export type DbAiUsageSnapshot = {
  id: string
  provider: string
  model: string
  date: string
  input_tokens: number
  output_tokens: number
  cost_jpy: number
  created_at: string
}

export type DbExpenseItem = {
  id: string
  date: string
  description: string
  amount: number
  vendor: string | null
  flagged_as_shadow_ai: boolean
  shadow_ai_tool: string | null
  risk_level: string | null
  uploaded_at: string
}
