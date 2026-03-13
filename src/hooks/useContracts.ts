import { useEffect, useState, useCallback } from 'react'
import { supabase, supabaseConfigured, DbContract } from '../lib/supabase'
import { getContracts, type ApiContract } from '../lib/api'
import type { Contract, ContractCategory } from '../types/index'

// ──────────────────────────────────────────────────────────────
// 変換ヘルパー
// ──────────────────────────────────────────────────────────────

/** バックエンド/モック ApiContract → アプリ Contract */
function apiContractToContract(row: ApiContract): Contract {
  const seats     = row.seats ?? 0
  const usedSeats = row.used_seats ?? 0
  // シート0のAIツールはトークン課金とみなす
  const usageType: 'seat' | 'token' | 'usage' =
    row.category === 'ai_tool' && seats === 0 ? 'token' : 'seat'
  return {
    id:            String(row.id),
    toolId:        row.tool_alias ?? String(row.id),
    toolName:      row.tool_name,
    toolLogo:      row.tool_logo_url ?? '',
    status:        row.status,
    plan:          row.plan ?? '',
    seats,
    usedSeats,
    monthlyAmount: row.monthly_amount,
    billingCycle:  row.billing_cycle,
    startDate:     row.start_date ?? '',
    renewalDate:   row.renewal_date ?? '',
    owner:         row.owner ?? '',
    department:    row.department ?? '',
    category:      row.category as ContractCategory,
    usageType,
  }
}

/** Supabase DbContract → アプリ Contract */
function toContract(row: DbContract): Contract {
  const seats = row.seats ?? 0
  return {
    id:            row.id,
    toolId:        row.id,
    toolName:      row.name,
    toolLogo:      row.logo_url ?? '',
    status:        row.status as Contract['status'],
    plan:          row.plan ?? '',
    seats,
    usedSeats:     row.usage_rate != null
                     ? Math.round(seats * row.usage_rate / 100)
                     : seats,
    monthlyAmount: row.monthly_cost,
    billingCycle:  'monthly',
    startDate:     row.created_at.slice(0, 10),
    renewalDate:   row.contract_end ?? '',
    owner:         '',
    department:    row.department ?? '',
    category:      (row.category as Contract['category']) ?? 'other',
    usageType:     (row.usage_type as Contract['usageType']) ?? 'seat',
    monthlyTokens: row.monthly_tokens ?? undefined,
    engineerCount: row.engineer_count ?? undefined,
  }
}

// ──────────────────────────────────────────────────────────────
// フック
// ──────────────────────────────────────────────────────────────

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)

    // ① Supabase が設定済みの場合は Supabase から取得
    if (supabaseConfigured) {
      const { data, error: sbError } = await supabase
        .from('contracts')
        .select('*')
        .order('monthly_cost', { ascending: false })

      if (!sbError && data?.length) {
        setContracts((data as DbContract[]).map(toContract))
        setLoading(false)
        return
      }
      if (sbError) setError(sbError.message)
    }

    // ② Supabase 未設定 / エラー → バックエンドAPI（またはモック）にフォールバック
    try {
      const { contracts: apiList } = await getContracts()
      setContracts(apiList.map(apiContractToContract))
    } catch {
      setContracts([])
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  // ── upsert ────────────────────────────────────────────────────
  const upsert = async (c: Partial<DbContract> & { id: string }) => {
    if (!supabaseConfigured) {
      // Supabase未設定時: ローカルステートのみ更新（デモ実行モード）
      setContracts((prev) =>
        prev.map((contract) => {
          if (contract.id !== c.id) return contract
          const updated = { ...contract }
          if (c.seats      != null) updated.seats  = c.seats
          if (c.usage_rate != null) {
            const baseSets = c.seats ?? contract.seats
            updated.usedSeats = Math.round(baseSets * c.usage_rate / 100)
          }
          if (c.status != null) updated.status = c.status as Contract['status']
          if (c.plan   != null) updated.plan   = c.plan
          return updated
        }),
      )
      return null
    }
    const { error } = await supabase.from('contracts').upsert(c)
    if (!error) load()
    return error
  }

  // ── remove ────────────────────────────────────────────────────
  const remove = async (id: string) => {
    if (!supabaseConfigured) {
      setContracts((prev) => prev.filter((c) => c.id !== id))
      return null
    }
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (!error) load()
    return error
  }

  return { contracts, loading, error, reload: load, upsert, remove }
}
