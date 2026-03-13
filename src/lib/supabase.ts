import { createClient } from '@supabase/supabase-js'

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL     as string | undefined
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined

// 環境変数が未設定でもアプリが起動できるようにする（認証・Supabase 機能は無効化）
const DUMMY_URL = 'https://placeholder.supabase.co'
const DUMMY_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.placeholder'

export const supabaseConfigured = !!(supabaseUrl && supabaseAnonKey)

export const supabase = createClient(
  supabaseUrl     ?? DUMMY_URL,
  supabaseAnonKey ?? DUMMY_KEY,
)

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
