import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft,
  BadgeCheck,
  ExternalLink,
  ThumbsUp,
  Plus,
  CheckCircle2,
  XCircle,
} from 'lucide-react'
import { tools } from '../data/tools'
import { contracts } from '../data/mockData'
import { StarRating } from '../components/StarRating'
import { ContractStatusBadge } from '../components/StatusBadge'

export function ToolDetail() {
  const { id } = useParams<{ id: string }>()
  const tool = tools.find((t) => t.id === id)
  const contract = contracts.find((c) => c.toolId === id)

  if (!tool) {
    return (
      <div className="p-6">
        <p className="text-gray-500">ツールが見つかりません</p>
      </div>
    )
  }

  const avgRating = tool.rating
  const ratingDist = [5, 4, 3, 2, 1].map((star) => {
    const count = tool.reviews.filter((r) => Math.floor(r.rating) === star).length
    return { star, count, pct: tool.reviewCount > 0 ? Math.round((count / tool.reviews.length) * 100) : 0 }
  })

  return (
    <div className="p-6 space-y-6 max-w-5xl">
      <Link to="/catalog" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900">
        <ArrowLeft className="w-4 h-4" /> カタログに戻る
      </Link>

      {/* Header */}
      <div className="card p-6">
        <div className="flex flex-col sm:flex-row gap-5">
          <img
            src={tool.logoUrl}
            alt={tool.name}
            className="w-20 h-20 rounded-2xl object-contain border border-gray-100 p-2 shrink-0"
            onError={(e) => {
              const target = e.target as HTMLImageElement
              target.src = `https://ui-avatars.com/api/?name=${tool.name}&background=6366f1&color=fff&size=80`
            }}
          />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h1 className="text-2xl font-bold text-gray-900">{tool.name}</h1>
              {tool.isFindyVerified && (
                <div className="flex items-center gap-1 text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-full text-xs font-medium">
                  <BadgeCheck className="w-3.5 h-3.5" />
                  Findy認定
                </div>
              )}
              {contract && <ContractStatusBadge status={contract.status} />}
            </div>
            <p className="text-gray-500 text-sm mt-1">{tool.category}</p>
            <p className="text-gray-700 mt-2">{tool.description}</p>
            <div className="flex items-center gap-4 mt-3 flex-wrap">
              <div className="flex items-center gap-2">
                <StarRating rating={tool.rating} size="md" />
                <span className="font-semibold text-gray-900">{tool.rating}</span>
                <span className="text-sm text-gray-500">({tool.reviewCount}件のレビュー)</span>
              </div>
              <a
                href={tool.website}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm text-indigo-600 hover:underline flex items-center gap-1"
              >
                公式サイト <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
          </div>
          <div className="flex flex-col gap-2 shrink-0">
            {contract ? (
              <Link to="/contracts" className="btn-secondary text-center">
                契約を確認
              </Link>
            ) : (
              <Link to="/procurement" className="btn-primary text-center flex items-center gap-1">
                <Plus className="w-4 h-4" /> 調達申請
              </Link>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Reviews */}
        <div className="lg:col-span-2 space-y-4">
          {/* Rating summary */}
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">レビュー概要</h2>
            <div className="flex gap-6 items-start">
              <div className="text-center shrink-0">
                <p className="text-5xl font-bold text-gray-900">{avgRating}</p>
                <StarRating rating={avgRating} size="md" />
                <p className="text-sm text-gray-500 mt-1">{tool.reviewCount}件</p>
              </div>
              <div className="flex-1 space-y-1.5">
                {ratingDist.map(({ star, pct }) => (
                  <div key={star} className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 w-4">{star}</span>
                    <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-400 rounded-full"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-gray-400 w-8 text-right">{pct}%</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Review list */}
          {tool.reviews.map((review) => (
            <div key={review.id} className="card p-5">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium text-gray-900">{review.title}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <StarRating rating={review.rating} />
                    <span className="text-xs text-gray-500">{review.userName} · {review.userRole}</span>
                  </div>
                </div>
                <span className="text-xs text-gray-400">{review.createdAt}</span>
              </div>
              <p className="text-sm text-gray-700 mt-2">{review.body}</p>
              <div className="grid grid-cols-2 gap-4 mt-3">
                <div>
                  <p className="text-xs font-medium text-green-600 mb-1 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> 良かった点
                  </p>
                  <ul className="space-y-0.5">
                    {review.pros.map((p) => (
                      <li key={p} className="text-xs text-gray-600">· {p}</li>
                    ))}
                  </ul>
                </div>
                <div>
                  <p className="text-xs font-medium text-red-500 mb-1 flex items-center gap-1">
                    <XCircle className="w-3 h-3" /> 気になった点
                  </p>
                  <ul className="space-y-0.5">
                    {review.cons.map((c) => (
                      <li key={c} className="text-xs text-gray-600">· {c}</li>
                    ))}
                  </ul>
                </div>
              </div>
              <div className="flex items-center gap-1 mt-3 text-xs text-gray-400">
                <ThumbsUp className="w-3 h-3" />
                {review.helpful}人が参考になったと回答
              </div>
            </div>
          ))}
        </div>

        {/* Pricing */}
        <div className="space-y-4">
          <div className="card p-5">
            <h2 className="font-semibold text-gray-900 mb-4">料金プラン</h2>
            <div className="space-y-3">
              {tool.pricingPlans.map((plan, i) => (
                <div
                  key={i}
                  className={`rounded-xl border p-4 ${
                    i === 1 ? 'border-indigo-300 bg-indigo-50' : 'border-gray-200'
                  }`}
                >
                  {i === 1 && (
                    <span className="text-xs text-indigo-600 font-medium bg-indigo-100 px-2 py-0.5 rounded-full mb-2 inline-block">
                      おすすめ
                    </span>
                  )}
                  <p className="font-semibold text-gray-900">{plan.name}</p>
                  <p className="text-xl font-bold text-gray-900 mt-1">
                    {plan.price === 0 ? (
                      <span className="text-green-600">無料</span>
                    ) : (
                      <>
                        {plan.currency === 'USD' ? '$' : '¥'}
                        {plan.price}
                        <span className="text-sm font-normal text-gray-500">
                          /{plan.cycle === 'monthly' ? '月' : '年'}
                          {plan.perSeat && '/ユーザー'}
                        </span>
                      </>
                    )}
                  </p>
                  <ul className="mt-2 space-y-1">
                    {plan.features.map((f) => (
                      <li key={f} className="text-xs text-gray-600 flex items-center gap-1.5">
                        <CheckCircle2 className="w-3 h-3 text-green-500 shrink-0" />
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>

          {/* Contract info */}
          {contract && (
            <div className="card p-5">
              <h2 className="font-semibold text-gray-900 mb-3">契約情報</h2>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-500">プラン</span>
                  <span className="font-medium">{contract.plan}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">シート</span>
                  <span className="font-medium">{contract.usedSeats}/{contract.seats}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">月額</span>
                  <span className="font-medium">¥{contract.monthlyAmount.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-500">更新日</span>
                  <span className="font-medium">{contract.renewalDate}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
