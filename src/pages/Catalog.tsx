import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Search, SlidersHorizontal, Star, BadgeCheck, TrendingUp } from 'lucide-react'
import { tools } from '../data/tools'
import { ToolCategory } from '../types'
import { StarRating } from '../components/StarRating'

const categories: ToolCategory[] = [
  'CI/CD', 'モニタリング', 'セキュリティ', 'コミュニケーション',
  'プロジェクト管理', 'ドキュメント', 'データベース', 'クラウドインフラ',
  'IDE/エディタ', 'テスト',
]

export function Catalog() {
  const [search, setSearch] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<ToolCategory | 'すべて'>('すべて')
  const [sortBy, setSortBy] = useState<'rating' | 'popular' | 'reviews'>('popular')

  const filtered = tools
    .filter((t) => {
      const matchSearch =
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.description.toLowerCase().includes(search.toLowerCase()) ||
        t.tags.some((tag) => tag.toLowerCase().includes(search.toLowerCase()))
      const matchCategory = selectedCategory === 'すべて' || t.category === selectedCategory
      return matchSearch && matchCategory
    })
    .sort((a, b) => {
      if (sortBy === 'rating') return b.rating - a.rating
      if (sortBy === 'reviews') return b.reviewCount - a.reviewCount
      // popular: verified + popular first
      return (b.isPopular ? 1 : 0) - (a.isPopular ? 1 : 0)
    })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ツールカタログ</h1>
          <p className="text-sm text-gray-500 mt-1">Findy Toolsのレビューをもとに厳選したエンジニア向けツール</p>
        </div>
      </div>

      {/* Search & Filter */}
      <div className="card p-4 flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="ツール名、カテゴリ、タグで検索..."
            className="w-full pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="text-sm border border-gray-200 rounded-lg px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
          >
            <option value="popular">人気順</option>
            <option value="rating">評価順</option>
            <option value="reviews">レビュー数順</option>
          </select>
        </div>
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap">
        <button
          onClick={() => setSelectedCategory('すべて')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
            selectedCategory === 'すべて'
              ? 'bg-indigo-600 text-white'
              : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
          }`}
        >
          すべて
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Results */}
      <p className="text-sm text-gray-500">{filtered.length}件のツール</p>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {filtered.map((tool) => (
          <Link key={tool.id} to={`/catalog/${tool.id}`}>
            <div className="card p-5 hover:shadow-md hover:border-indigo-200 transition-all cursor-pointer h-full">
              <div className="flex items-start gap-3 mb-3">
                <img
                  src={tool.logoUrl}
                  alt={tool.name}
                  className="w-12 h-12 rounded-xl object-contain border border-gray-100 p-1"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://ui-avatars.com/api/?name=${tool.name}&background=6366f1&color=fff&size=48`
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <h3 className="font-semibold text-gray-900 truncate">{tool.name}</h3>
                    {tool.isFindyVerified && (
                      <span title="Findy認定"><BadgeCheck className="w-4 h-4 text-indigo-500 shrink-0" /></span>
                    )}
                    {tool.isPopular && (
                      <span title="人気"><TrendingUp className="w-4 h-4 text-orange-400 shrink-0" /></span>
                    )}
                  </div>
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                    {tool.category}
                  </span>
                </div>
              </div>

              <p className="text-sm text-gray-600 line-clamp-2 mb-3">{tool.shortDescription}</p>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <StarRating rating={tool.rating} />
                  <span className="text-sm font-medium text-gray-700">{tool.rating}</span>
                  <span className="text-xs text-gray-400">({tool.reviewCount}件)</span>
                </div>
                {tool.pricingPlans[0].price === 0 ? (
                  <span className="text-xs text-green-600 font-medium bg-green-50 px-2 py-0.5 rounded-full">
                    無料プランあり
                  </span>
                ) : (
                  <span className="text-xs text-gray-500">
                    ${tool.pricingPlans[0].price}〜/月
                  </span>
                )}
              </div>

              <div className="flex flex-wrap gap-1 mt-3">
                {tool.tags.slice(0, 3).map((tag) => (
                  <span key={tag} className="text-xs text-gray-500 bg-gray-50 border border-gray-100 px-2 py-0.5 rounded">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
