import { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, ExternalLink, Star, Globe2, Users,
  CheckCircle2, Plus, Building2, AlertCircle, Loader2,
} from 'lucide-react'
import { getTool, type ApiTool, type ApiReview } from '../lib/api'
import { contracts } from '../data/mockData'
import { ContractStatusBadge } from '../components/StatusBadge'

const FINDY_BASE = 'https://findy-tools.io'

function ToolLogo({ tool }: { tool: ApiTool }) {
  const src = tool.logo_url ? `${FINDY_BASE}${tool.logo_url}` : null
  return (
    <img
      src={src ?? `https://ui-avatars.com/api/?name=${encodeURIComponent(tool.name)}&background=6366f1&color=fff&size=80`}
      alt={tool.name}
      className="w-20 h-20 rounded-2xl object-contain border border-gray-100 bg-white p-2 shrink-0"
      onError={(e) => {
        const t = e.target as HTMLImageElement
        t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(tool.name)}&background=6366f1&color=fff&size=80`
      }}
    />
  )
}

function ReviewCard({ review }: { review: ApiReview }) {
  let labels: string[] = []
  try { labels = JSON.parse(review.labels) } catch { labels = [] }

  return (
    <div className="card p-5 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          {review.title && (
            <p className="font-semibold text-gray-900">{review.title}</p>
          )}
          <div className="flex flex-wrap items-center gap-2 mt-1 text-xs text-gray-500">
            {review.reviewer_job_position && (
              <span className="bg-gray-100 px-2 py-0.5 rounded-full">
                {review.reviewer_job_position}
              </span>
            )}
            {review.company_name && (
              <span className="flex items-center gap-0.5">
                <Building2 className="w-3 h-3" />
                {review.company_name}
              </span>
            )}
            {review.employee_size && (
              <span className="flex items-center gap-0.5">
                <Users className="w-3 h-3" />
                {review.employee_size}
              </span>
            )}
          </div>
        </div>
      </div>

      {(review.good_point || review.growth_point) && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {review.good_point && (
            <div>
              <p className="text-xs font-semibold text-green-600 mb-1 flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> 良かった点
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{review.good_point}</p>
            </div>
          )}
          {review.growth_point && (
            <div>
              <p className="text-xs font-semibold text-amber-600 mb-1 flex items-center gap-1">
                <Star className="w-3.5 h-3.5" /> 改善してほしい点
              </p>
              <p className="text-sm text-gray-700 whitespace-pre-line">{review.growth_point}</p>
            </div>
          )}
        </div>
      )}

      {review.introduction_background && (
        <div>
          <p className="text-xs font-semibold text-indigo-600 mb-1">導入背景</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{review.introduction_background}</p>
        </div>
      )}

      {labels.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {labels.map((label) => (
            <span
              key={label}
              className="text-xs bg-indigo-50 text-indigo-600 px-2 py-0.5 rounded-full"
            >
              {label}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export function ToolDetail() {
  const { id: alias } = useParams<{ id: string }>()
  const [tool, setTool] = useState<(ApiTool & { reviews: ApiReview[] }) | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!alias) return
    setLoading(true)
    setError(null)
    getTool(alias)
      .then(setTool)
      .catch((e) => setError(e instanceof Error ? e.message : 'エラーが発生しました'))
      .finally(() => setLoading(false))
  }, [alias])

  // モックの契約情報と紐付け（alias ベース）
  const contract = contracts.find((c) => c.toolId === alias)

  if (loading) {
    return (
      <div className="p-6 flex items-center gap-3 text-gray-500">
        <Loader2 className="w-5 h-5 animate-spin" />
        読み込み中...
      </div>
    )
  }

  if (error || !tool) {
    return (
      <div className="p-6 space-y-4">
        <Link to="/catalog" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
          <ArrowLeft className="w-4 h-4" /> カタログに戻る
        </Link>
        <div className="card p-5 flex items-center gap-3 text-red-600 bg-red-50 border-red-200">
          <AlertCircle className="w-5 h-5 shrink-0" />
          <p className="text-sm">{error ?? 'ツールが見つかりません'}</p>
        </div>
      </div>
    )
  }

  const findyUrl = `${FINDY_BASE}${tool.page_path}`

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Link to="/catalog" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> カタログに戻る
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <ToolLogo tool={tool} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{tool.name}</h1>
              {contract && <ContractStatusBadge status={contract.status} />}
            </div>
            {tool.vendor_name && (
              <p className="text-sm text-gray-500 mt-0.5">{tool.vendor_name}</p>
            )}
            {tool.description && (
              <p className="text-gray-700 mt-2">{tool.description}</p>
            )}
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-1.5 text-sm text-gray-600">
                <Star className="w-4 h-4 text-amber-400 fill-amber-400" />
                <span>{tool.reviews_count}件のレビュー</span>
              </div>
              {tool.use_company_count != null && (
                <div className="flex items-center gap-1 text-sm text-gray-500">
                  <Users className="w-4 h-4" />
                  {tool.use_company_count.toLocaleString()}社が利用
                </div>
              )}
              <a
                href={findyUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              >
                Findy Toolsで見る <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>

            {/* Feature badges */}
            <div className="flex flex-wrap gap-2 mt-3">
              {tool.is_trial === 1 && (
                <span className="text-xs text-green-600 bg-green-50 px-2.5 py-1 rounded-full font-medium">
                  無料体験あり
                </span>
              )}
              {tool.is_japanese_support === 1 && (
                <span className="text-xs text-blue-600 bg-blue-50 px-2.5 py-1 rounded-full font-medium flex items-center gap-1">
                  <Globe2 className="w-3 h-3" /> 日本語サポート
                </span>
              )}
              {tool.is_customer_success === 1 && (
                <span className="text-xs text-purple-600 bg-purple-50 px-2.5 py-1 rounded-full font-medium">
                  カスタマーサクセスあり
                </span>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2 shrink-0">
            {contract ? (
              <Link to="/contracts" className="btn-secondary text-center">
                契約を確認
              </Link>
            ) : (
              <Link to="/procurement" className="btn-primary text-center flex items-center gap-1 justify-center">
                <Plus className="w-4 h-4" /> 調達申請
              </Link>
            )}
          </div>
        </div>
      </div>

      {/* Reviews */}
      {tool.reviews.length > 0 ? (
        <div className="space-y-4">
          <h2 className="font-semibold text-gray-900 text-lg">
            レビュー ({tool.reviews.length}件)
          </h2>
          {tool.reviews.map((r) => (
            <ReviewCard key={r.id} review={r} />
          ))}
        </div>
      ) : (
        <div className="card p-6 text-center">
          <Star className="w-10 h-10 text-gray-300 mx-auto mb-2" />
          <p className="text-gray-500 text-sm">まだレビューデータがありません</p>
          <p className="text-gray-400 text-xs mt-1">
            「データ同期」からフルスクレイプを実行するとレビューが取得されます
          </p>
          <a
            href={findyUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-3 inline-flex items-center gap-1 text-sm text-indigo-600 hover:underline"
          >
            Findy Toolsでレビューを見る <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>
      )}
    </div>
  )
}
