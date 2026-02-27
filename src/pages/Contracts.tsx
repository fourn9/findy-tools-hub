import { useState } from 'react'
import { Link } from 'react-router-dom'
import { FileText, AlertTriangle, Calendar, Users, DollarSign } from 'lucide-react'
import { contracts } from '../data/mockData'
import { ContractStatusBadge } from '../components/StatusBadge'
import { ContractStatus } from '../types'

export function Contracts() {
  const [filter, setFilter] = useState<ContractStatus | 'all'>('all')

  const filtered = filter === 'all' ? contracts : contracts.filter((c) => c.status === filter)

  const totalMonthly = contracts
    .filter((c) => c.status === 'active' || c.status === 'trial')
    .reduce((sum, c) => sum + c.monthlyAmount, 0)

  // Renewal alerts
  const renewalAlerts = contracts.filter((c) => {
    if (!c.renewalDate) return false
    const renewal = new Date(c.renewalDate)
    const today = new Date('2026-02-27')
    const diff = (renewal.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    return diff > 0 && diff <= 60
  })

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">契約管理</h1>
        <p className="text-sm text-gray-500 mt-1">ツールの契約・ライセンス情報を管理</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">契約中</p>
          <p className="text-2xl font-bold text-gray-900">
            {contracts.filter((c) => c.status === 'active').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">トライアル</p>
          <p className="text-2xl font-bold text-blue-600">
            {contracts.filter((c) => c.status === 'trial').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">手続き中</p>
          <p className="text-2xl font-bold text-yellow-600">
            {contracts.filter((c) => c.status === 'pending').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">月次合計</p>
          <p className="text-2xl font-bold text-gray-900">
            ¥{Math.round(totalMonthly / 10000)}<span className="text-base">万</span>
          </p>
        </div>
      </div>

      {/* Renewal alerts */}
      {renewalAlerts.length > 0 && (
        <div className="card p-4 border-l-4 border-l-amber-400 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">更新期限アラート</p>
              <ul className="mt-1 space-y-0.5">
                {renewalAlerts.map((c) => {
                  const days = Math.ceil(
                    (new Date(c.renewalDate).getTime() - new Date('2026-02-27').getTime()) /
                      (1000 * 60 * 60 * 24)
                  )
                  return (
                    <li key={c.id} className="text-sm text-amber-700">
                      <span className="font-medium">{c.toolName}</span> —{' '}
                      {c.renewalDate}（{days}日後）
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'trial', 'pending', 'expired'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? 'すべて' : s === 'active' ? '利用中' : s === 'trial' ? 'トライアル' : s === 'pending' ? '手続き中' : '期限切れ'}
          </button>
        ))}
      </div>

      {/* Contract list */}
      <div className="space-y-3">
        {filtered.map((c) => {
          const seatPct = c.seats > 0 ? Math.round((c.usedSeats / c.seats) * 100) : 0
          return (
            <div key={c.id} className="card p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-4">
                <img
                  src={c.toolLogo}
                  alt={c.toolName}
                  className="w-12 h-12 rounded-xl object-contain border border-gray-100 p-1.5 shrink-0"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://ui-avatars.com/api/?name=${c.toolName}&background=6366f1&color=fff&size=48`
                  }}
                />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <Link
                      to={`/catalog/${c.toolId}`}
                      className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                    >
                      {c.toolName}
                    </Link>
                    <ContractStatusBadge status={c.status} />
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                      {c.plan}
                    </span>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">月額</p>
                        <p className="text-sm font-medium text-gray-900">
                          ¥{c.monthlyAmount.toLocaleString()}
                        </p>
                      </div>
                    </div>
                    {c.seats > 0 && (
                      <div className="flex items-center gap-2">
                        <Users className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">シート</p>
                          <p className="text-sm font-medium text-gray-900">
                            {c.usedSeats}/{c.seats}
                          </p>
                        </div>
                      </div>
                    )}
                    <div className="flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">更新日</p>
                        <p className="text-sm font-medium text-gray-900">
                          {c.renewalDate || '未設定'}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                      <div>
                        <p className="text-xs text-gray-500">担当</p>
                        <p className="text-sm font-medium text-gray-900">{c.owner}</p>
                      </div>
                    </div>
                  </div>

                  {/* Seat usage bar */}
                  {c.seats > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-gray-500 mb-1">
                        <span>シート使用率</span>
                        <span>{seatPct}%</span>
                      </div>
                      <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            seatPct > 90
                              ? 'bg-red-400'
                              : seatPct > 70
                              ? 'bg-amber-400'
                              : 'bg-indigo-400'
                          }`}
                          style={{ width: `${seatPct}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
