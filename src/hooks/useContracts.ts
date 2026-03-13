import { useEffect, useState, useCallback } from 'react'
import { supabase, DbContract } from '../lib/supabase'
import type { Contract } from '../types/index'

// DB行 → アプリの Contract 型に変換
function toContract(row: DbContract): Contract {
  const seats = row.seats ?? 0
  return {
    id:            row.id,
    toolId:        row.id,  // DB id を toolId として使用
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

export function useContracts() {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    const { data, error } = await supabase
      .from('contracts')
      .select('*')
      .order('monthly_cost', { ascending: false })

    if (error) {
      setError(error.message)
    } else {
      setContracts((data as DbContract[]).map(toContract))
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const upsert = async (c: Partial<DbContract> & { id: string }) => {
    const { error } = await supabase.from('contracts').upsert(c)
    if (!error) load()
    return error
  }

  const remove = async (id: string) => {
    const { error } = await supabase.from('contracts').delete().eq('id', id)
    if (!error) load()
    return error
  }

  return { contracts, loading, error, reload: load, upsert, remove }
}
