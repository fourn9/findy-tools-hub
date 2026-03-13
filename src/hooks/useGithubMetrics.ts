import { useEffect, useState, useCallback } from 'react'
import { supabase } from '../lib/supabase'

export type GithubMetricRow = {
  id: string
  repo: string
  week_start: string
  pr_cycle_hours: number | null
  commits: number | null
  prs_merged: number | null
  collected_at: string
}

export type MetricComparison = {
  metric: string
  unit: string
  before: number
  after: number
  improvementPct: number
  tool: string
}

export function useGithubMetrics(repo: string | null) {
  const [rows, setRows]           = useState<GithubMetricRow[]>([])
  const [comparison, setComparison] = useState<MetricComparison[]>([])
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState<string | null>(null)
  const [syncing, setSyncing]     = useState(false)

  const load = useCallback(async () => {
    if (!repo) return
    setLoading(true)
    const { data, error } = await supabase
      .from('github_metrics')
      .select('*')
      .eq('repo', repo)
      .order('week_start', { ascending: true })

    if (error) {
      setError(error.message)
    } else {
      const r = (data ?? []) as GithubMetricRow[]
      setRows(r)
      buildComparison(r)
    }
    setLoading(false)
  }, [repo])

  useEffect(() => { load() }, [load])

  function buildComparison(r: GithubMetricRow[]) {
    if (r.length < 4) { setComparison([]); return }
    const half    = Math.floor(r.length / 2)
    const before  = r.slice(0, half)
    const after   = r.slice(half)

    const avg = (arr: GithubMetricRow[], key: keyof GithubMetricRow) => {
      const vals = arr.map(row => row[key] as number | null).filter(v => v !== null) as number[]
      return vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0
    }

    const pct = (b: number, a: number) => b === 0 ? 0 : Math.round((b - a) / b * 100)

    setComparison([
      {
        metric: 'PRマージまでの平均時間',
        unit: '時間',
        before: Math.round(avg(before, 'pr_cycle_hours') * 10) / 10,
        after:  Math.round(avg(after,  'pr_cycle_hours') * 10) / 10,
        improvementPct: pct(avg(before, 'pr_cycle_hours'), avg(after, 'pr_cycle_hours')),
        tool: 'GitHub Copilot',
      },
      {
        metric: '週あたりコミット数（平均）',
        unit: 'コミット',
        before: Math.round(avg(before, 'commits')),
        after:  Math.round(avg(after,  'commits')),
        improvementPct: pct(avg(after, 'commits'), avg(before, 'commits')), // 増加が改善
        tool: 'GitHub Copilot',
      },
      {
        metric: '週あたりマージ PR 数',
        unit: 'PR',
        before: Math.round(avg(before, 'prs_merged')),
        after:  Math.round(avg(after,  'prs_merged')),
        improvementPct: pct(avg(after, 'prs_merged'), avg(before, 'prs_merged')),
        tool: 'GitHub Copilot',
      },
    ])
  }

  // GitHub API からメトリクスを同期
  const syncFromGithub = async (token: string, repoFull: string) => {
    setSyncing(true)
    setError(null)
    try {
      const headers = {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
      }

      // 週次コミット統計
      const statsRes = await fetch(
        `https://api.github.com/repos/${repoFull}/stats/participation`,
        { headers }
      )
      if (!statsRes.ok) throw new Error(`GitHub API error: ${statsRes.status}`)
      const stats = await statsRes.json()

      // PRマージ時間（直近100件）
      const prRes = await fetch(
        `https://api.github.com/repos/${repoFull}/pulls?state=closed&per_page=100`,
        { headers }
      )
      if (!prRes.ok) throw new Error(`GitHub PR API error: ${prRes.status}`)
      const prs: any[] = await prRes.json()
      const mergedPrs = prs.filter(p => p.merged_at)

      // 週ごとにグループ化（直近12週）
      const records: Omit<GithubMetricRow, 'id' | 'collected_at'>[] = []
      const allCommits: number[] = stats.all ?? []

      for (let i = Math.max(0, allCommits.length - 12); i < allCommits.length; i++) {
        const weekStart = new Date()
        weekStart.setDate(weekStart.getDate() - (allCommits.length - i) * 7)
        const weekStr = weekStart.toISOString().slice(0, 10)

        // その週にマージされた PR の平均サイクルタイム（時間）
        const weekEnd = new Date(weekStart)
        weekEnd.setDate(weekEnd.getDate() + 7)
        const weekPrs = mergedPrs.filter(pr => {
          const merged = new Date(pr.merged_at)
          return merged >= weekStart && merged < weekEnd
        })

        let avgCycleHours: number | null = null
        if (weekPrs.length > 0) {
          const totalMs = weekPrs.reduce((sum, pr) => {
            return sum + (new Date(pr.merged_at).getTime() - new Date(pr.created_at).getTime())
          }, 0)
          avgCycleHours = Math.round(totalMs / weekPrs.length / 3600000 * 10) / 10
        }

        records.push({
          repo: repoFull,
          week_start:    weekStr,
          pr_cycle_hours: avgCycleHours,
          commits:       allCommits[i],
          prs_merged:    weekPrs.length,
        })
      }

      // Upsert
      const { error } = await supabase
        .from('github_metrics')
        .upsert(records, { onConflict: 'repo,week_start' })

      if (error) throw new Error(error.message)
      await load()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setSyncing(false)
    }
  }

  return { rows, comparison, loading, error, syncing, reload: load, syncFromGithub }
}
