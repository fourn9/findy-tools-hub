import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, AlertCircle, CheckCircle2, XCircle, Clock, FileEdit } from 'lucide-react'
import { procurementRequests } from '../data/mockData'
import { RequestStatusBadge } from '../components/StatusBadge'
import { RequestStatus } from '../types'

const STATUS_STEPS: { key: RequestStatus; label: string; icon: React.ReactNode }[] = [
  { key: 'draft', label: '下書き', icon: <FileEdit className="w-4 h-4" /> },
  { key: 'reviewing', label: '審査中', icon: <Clock className="w-4 h-4" /> },
  { key: 'approved', label: '承認済み', icon: <CheckCircle2 className="w-4 h-4" /> },
  { key: 'contracted', label: '契約済み', icon: <CheckCircle2 className="w-4 h-4" /> },
]

const statusOrder: Record<RequestStatus, number> = {
  draft: 0, reviewing: 1, approved: 2, rejected: -1, contracted: 3,
}

function RequestCard({ req }: { req: typeof procurementRequests[0] }) {
  const [expanded, setExpanded] = useState(false)
  const step = statusOrder[req.status]

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <img
          src={req.toolLogo}
          alt={req.toolName}
          className="w-10 h-10 rounded-xl object-contain border border-gray-100 p-1 shrink-0"
          onError={(e) => {
            const target = e.target as HTMLImageElement
            target.src = `https://ui-avatars.com/api/?name=${req.toolName}&background=6366f1&color=fff&size=40`
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{req.toolName}</p>
            <RequestStatusBadge status={req.status} />
            <span
              className={`badge ${
                req.priority === 'high'
                  ? 'bg-red-100 text-red-600'
                  : req.priority === 'medium'
                  ? 'bg-yellow-100 text-yellow-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {req.priority === 'high' ? '優先度高' : req.priority === 'medium' ? '優先度中' : '優先度低'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            申請者: {req.requesterName} · {req.createdAt}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-gray-900">¥{req.monthlyBudget.toLocaleString()}/月</p>
          <p className="text-xs text-gray-500">{req.expectedSeats}席</p>
        </div>
        <ChevronRight
          className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`}
        />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
          {/* Progress steps */}
          {req.status !== 'rejected' && (
            <div className="flex items-center gap-1">
              {STATUS_STEPS.map((s, i) => {
                const active = statusOrder[req.status] >= i
                const current = statusOrder[req.status] === i
                return (
                  <div key={s.key} className="flex items-center gap-1 flex-1">
                    <div
                      className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
                        current
                          ? 'bg-indigo-600 text-white'
                          : active
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-200 text-gray-400'
                      }`}
                    >
                      {s.icon}
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div
                        className={`h-0.5 flex-1 ${
                          statusOrder[req.status] > i ? 'bg-green-400' : 'bg-gray-200'
                        }`}
                      />
                    )}
                  </div>
                )
              })}
            </div>
          )}
          {req.status === 'rejected' && (
            <div className="flex items-center gap-2 text-red-600 bg-red-50 rounded-lg p-3">
              <XCircle className="w-4 h-4 shrink-0" />
              <span className="text-sm font-medium">申請が却下されました</span>
            </div>
          )}

          {/* Reason */}
          <div>
            <p className="text-xs font-medium text-gray-500 mb-1">申請理由</p>
            <p className="text-sm text-gray-700">{req.reason}</p>
          </div>

          {/* Approver comment */}
          {req.approverComment && (
            <div className={`rounded-lg p-3 ${req.status === 'rejected' ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-xs font-medium text-gray-500 mb-1">
                {req.approverName} のコメント
              </p>
              <p className="text-sm text-gray-700">{req.approverComment}</p>
            </div>
          )}

          {/* Actions */}
          {req.status === 'approved' && (
            <div className="flex gap-2">
              <button className="btn-primary flex items-center gap-1">
                <CheckCircle2 className="w-4 h-4" />
                契約手続きへ進む
              </button>
              <Link to={`/catalog/${req.toolId}`} className="btn-secondary">
                ツール詳細
              </Link>
            </div>
          )}
          {req.status === 'draft' && (
            <div className="flex gap-2">
              <button className="btn-primary">審査に提出</button>
              <button className="btn-secondary">削除</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export function Procurement() {
  const [filter, setFilter] = useState<RequestStatus | 'all'>('all')

  const filtered = filter === 'all'
    ? procurementRequests
    : procurementRequests.filter((r) => r.status === filter)

  const counts = {
    all: procurementRequests.length,
    reviewing: procurementRequests.filter((r) => r.status === 'reviewing').length,
    approved: procurementRequests.filter((r) => r.status === 'approved').length,
    contracted: procurementRequests.filter((r) => r.status === 'contracted').length,
    rejected: procurementRequests.filter((r) => r.status === 'rejected').length,
    draft: procurementRequests.filter((r) => r.status === 'draft').length,
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">調達管理</h1>
          <p className="text-sm text-gray-500 mt-1">ツールの検討から契約まで一元管理</p>
        </div>
        <Link to="/catalog" className="btn-primary flex items-center gap-1">
          <Plus className="w-4 h-4" /> 新規申請
        </Link>
      </div>

      {/* Info banner */}
      <div className="card p-4 bg-indigo-50 border-indigo-200 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-indigo-800">調達フロー</p>
          <p className="text-sm text-indigo-600 mt-0.5">
            ツールカタログからツールを選んで申請 → マネージャーが承認 → IT管理者が契約手続き → 利用開始
          </p>
        </div>
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all', label: 'すべて' },
          { key: 'reviewing', label: '審査中' },
          { key: 'approved', label: '承認済み' },
          { key: 'contracted', label: '契約済み' },
          { key: 'draft', label: '下書き' },
          { key: 'rejected', label: '却下' },
        ] as const).map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === key
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {label}
            <span
              className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
                filter === key ? 'bg-indigo-500 text-indigo-100' : 'bg-gray-100 text-gray-500'
              }`}
            >
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* Request list */}
      <div className="space-y-3">
        {filtered.map((req) => (
          <RequestCard key={req.id} req={req} />
        ))}
      </div>
    </div>
  )
}
