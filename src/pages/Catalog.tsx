import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  Search, Star, Globe2, Users, CheckCircle2,
  ChevronLeft, ChevronRight, RefreshCw, AlertCircle,
} from 'lucide-react'
import { getTools, type ApiTool } from '../lib/api'

const FINDY_BASE = 'https://findy-tools.io'

function ToolLogo({ tool }: { tool: ApiTool }) {
  const src = tool.logo_url ? `${FINDY_BASE}${tool.logo_url}` : null
  return (
    <img
      src={src ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(tool.name)}&background=6366f1&color=fff&size=48`}
      alt={tool.name}
      className="w-12 h-12 rounded-xl object-contain border border-gray-100 bg-white p-1 shrink-0"
      onError={(e) => {
        const t = e.target as HTMLImageElement
        t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tool.name)}&background=6366f1&color=fff&size=48`
      }}
    />
  )
}

export function Catalog() {
  const [tools, setTools] = useState<ApiTool[]>([])
  const [total, setTotal] = useState(0)
  const [totalPages, setTotalPages] = useState(1)
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [inputValue, setInputValue] = useState('')
  const [sortBy, setSortBy] = useState<'reviews' | 'name'>('reviews')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const LIMIT = 24

  const fetchTools = useCallback(async (p: number, q: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await getTools({ page: p, limit: LIMIT, q: q || undefined })
      setTools(res.tools)
      setTotal(res.total)
      setTotalPages(res.totalPages)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'データ取得エラー')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchTools(page, search)
  }, [page, search, fetchTools])

  // 検索: Enterキーで確定
  const handleSearch = () => {
    setSearch(inputValue)
    setPage(1)
  }

  // ソートはフロント側でのみ適用（ページ内）
  const sorted = [...tools].sort((a, b) => {
    if (sortBy === 'reviews') return b.reviews_count - a.reviews_count
    return a.name.localeCompare(b.name)
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ツールカタログ</h1>
          <p className="text-sm text-gray-500 mt-1">
            Findy Tools のデータを同期 · {total.toLocaleString()}件のツール
          </p>
        </div>
        <Link
          to="/versions"
          className="flex items-center gap-1.5 text-sm text-indigo-600 hover:text-indigo-800"
        >
          <RefreshCw className="w-4 h-4" />
          データ同期
        </Link>
      </div>

      {/* Search & Sort */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            placeholder="ツール名で検索… (Enter で確定)"
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <button
          onClick={handleSearch}
          className="btn-primary px-4 py-2 text-sm shrink-0"
        >
          検索
        </button>
        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
        >
          <option value="reviews">レビュー数順</option>
          <option value="name">名前順</option>
        </select>
      </div>

      {/* Error */}
      {error && (
        <div className="card p-4 flex items-center gap-3 text-red-600 bg-red-50 border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error}</p>
        </div>
      )}

      {/* Loading */}
      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {Array.from({ length: 12 }).map((_, i) => (
            <div key={i} className="card p-5 animate-pulse">
              <div className="flex gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-200 rounded-xl shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-gray-200 rounded w-3/4" />
                  <div className="h-3 bg-gray-100 rounded w-1/2" />
                </div>
              </div>
              <div className="h-3 bg-gray-100 rounded mb-1" />
              <div className="h-3 bg-gray-100 rounded w-5/6" />
            </div>
          ))}
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-500">
            {total.toLocaleString()}件中 {(page - 1) * LIMIT + 1}〜{Math.min(page * LIMIT, total)}件を表示
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
            {sorted.map((tool) => (
              <Link key={tool.id} to={`/catalog/${tool.alias}`}>
                <div className="card p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer h-full flex flex-col">
                  <div className="flex items-start gap-3 mb-3">
                    <ToolLogo tool={tool} />
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-gray-900 truncate">{tool.name}</h3>
                      {tool.vendor_name && (
                        <p className="text-xs text-gray-500 truncate">{tool.vendor_name}</p>
                      )}
                    </div>
                  </div>

                  {tool.description ? (
                    <p className="text-sm text-gray-600 line-clamp-2 mb-3 flex-1">{tool.description}</p>
                  ) : (
                    <div className="flex-1" />
                  )}

                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-1.5 text-sm text-gray-500">
                      <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                      <span>{tool.reviews_count > 0 ? `${tool.reviews_count}件のレビュー` : 'レビューなし'}</span>
                    </div>
                    <div className="flex gap-1.5">
                      {tool.is_trial === 1 && (
                        <span className="text-xs text-green-600 bg-green-50 px-2 py-0.5 rounded-full font-medium">
                          無料体験
                        </span>
                      )}
                      {tool.is_japanese_support === 1 && (
                        <span className="text-xs text-blue-600 bg-blue-50 px-2 py-0.5 rounded-full font-medium flex items-center gap-0.5">
                          <Globe2 className="w-3 h-3" /> 日本語
                        </span>
                      )}
                    </div>
                  </div>

                  {tool.use_company_count != null && (
                    <div className="flex items-center gap-1 mt-2 text-xs text-gray-400">
                      <Users className="w-3 h-3" />
                      {tool.use_company_count.toLocaleString()}社が利用
                    </div>
                  )}

                  {/* badges */}
                  <div className="flex flex-wrap gap-1 mt-2">
                    {tool.is_customer_success === 1 && (
                      <span className="text-xs text-purple-600 bg-purple-50 px-2 py-0.5 rounded-full flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> CS対応
                      </span>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="text-sm text-gray-600 px-3">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
