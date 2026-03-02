import { useState, useEffect } from 'react'
import {
  Plus, ChevronRight, AlertCircle, CheckCircle2, XCircle,
  Clock, FileEdit, Loader2, RefreshCw, ThumbsUp, ThumbsDown,
} from 'lucide-react'
import {
  getProcurementRequests,
  createProcurementRequest,
  approveProcurementRequest,
  rejectProcurementRequest,
  type ApiProcurementRequest,
} from '../lib/api'

// ──────────────────────────────────────────────
// 定数
// ──────────────────────────────────────────────
type ReqStatus = ApiProcurementRequest['status']

const STATUS_STEPS: { key: ReqStatus; label: string }[] = [
  { key: 'draft',      label: '下書き' },
  { key: 'reviewing',  label: '審査中' },
  { key: 'approved',   label: '承認済み' },
  { key: 'contracted', label: '契約済み' },
]

const statusOrder: Record<ReqStatus, number> = {
  draft: 0, reviewing: 1, approved: 2, contracted: 3, rejected: -1,
}

// ──────────────────────────────────────────────
// ステータスバッジ
// ──────────────────────────────────────────────
function StatusBadge({ status }: { status: ReqStatus }) {
  const map: Record<ReqStatus, string> = {
    draft:      'bg-gray-100 text-gray-500',
    reviewing:  'bg-yellow-100 text-yellow-700',
    approved:   'bg-green-100 text-green-700',
    rejected:   'bg-red-100 text-red-700',
    contracted: 'bg-indigo-100 text-indigo-700',
  }
  const label: Record<ReqStatus, string> = {
    draft: '下書き', reviewing: '審査中', approved: '承認済み',
    rejected: '却下', contracted: '契約済み',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {label[status]}
    </span>
  )
}

// ──────────────────────────────────────────────
// 申請カード
// ──────────────────────────────────────────────
function RequestCard({
  req,
  onAction,
}: {
  req: ApiProcurementRequest
  onAction: () => void
}) {
  const [expanded, setExpanded] = useState(false)
  const [actionLoading, setActionLoading] = useState<'approve' | 'reject' | null>(null)
  const [approverName, setApproverName] = useState('')
  const [comment, setComment] = useState('')
  const [showActionForm, setShowActionForm] = useState<'approve' | 'reject' | null>(null)
  const step = statusOrder[req.status]

  const logo = req.tool_logo_url
    || `https://ui-avatars.com/api/?name=${encodeURIComponent(req.tool_name)}&background=6366f1&color=fff&size=40`

  const handleApprove = async () => {
    if (!approverName.trim()) return
    setActionLoading('approve')
    try {
      await approveProcurementRequest(req.id, approverName, comment)
      onAction()
    } finally {
      setActionLoading(null)
      setShowActionForm(null)
    }
  }

  const handleReject = async () => {
    if (!approverName.trim()) return
    setActionLoading('reject')
    try {
      await rejectProcurementRequest(req.id, approverName, comment)
      onAction()
    } finally {
      setActionLoading(null)
      setShowActionForm(null)
    }
  }

  return (
    <div className="card overflow-hidden">
      <button
        className="w-full p-5 flex items-center gap-4 hover:bg-gray-50 transition-colors text-left"
        onClick={() => setExpanded(!expanded)}
      >
        <img
          src={logo}
          alt={req.tool_name}
          className="w-10 h-10 rounded-xl object-contain border border-gray-100 p-1 shrink-0"
          onError={(e) => {
            const t = e.target as HTMLImageElement
            t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(req.tool_name)}&background=6366f1&color=fff&size=40`
          }}
        />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="font-semibold text-gray-900">{req.tool_name}</p>
            <StatusBadge status={req.status} />
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              req.priority === 'high' ? 'bg-red-100 text-red-600'
              : req.priority === 'medium' ? 'bg-yellow-100 text-yellow-700'
              : 'bg-gray-100 text-gray-500'
            }`}>
              {req.priority === 'high' ? '優先度高' : req.priority === 'medium' ? '優先度中' : '優先度低'}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            申請者: {req.requester_name} · {new Date(req.created_at).toLocaleDateString('ja-JP')}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-sm font-medium text-gray-900">¥{req.monthly_budget.toLocaleString()}/月</p>
          <p className="text-xs text-gray-500">{req.expected_seats}席</p>
        </div>
        <ChevronRight className={`w-4 h-4 text-gray-400 transition-transform shrink-0 ${expanded ? 'rotate-90' : ''}`} />
      </button>

      {expanded && (
        <div className="border-t border-gray-100 p-5 bg-gray-50 space-y-4">
          {/* プログレスバー */}
          {req.status !== 'rejected' && (
            <div className="flex items-center gap-1">
              {STATUS_STEPS.map((s, i) => {
                const active = step >= i
                const current = step === i
                return (
                  <div key={s.key} className="flex items-center gap-1 flex-1">
                    <div className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-xs font-medium ${
                      current ? 'bg-indigo-600 text-white'
                      : active ? 'bg-green-100 text-green-700'
                      : 'bg-gray-200 text-gray-400'
                    }`}>
                      <span className="hidden sm:inline">{s.label}</span>
                    </div>
                    {i < STATUS_STEPS.length - 1 && (
                      <div className={`h-0.5 flex-1 ${step > i ? 'bg-green-400' : 'bg-gray-200'}`} />
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

          {/* 申請理由 */}
          {req.reason && (
            <div>
              <p className="text-xs font-medium text-gray-500 mb-1">申請理由</p>
              <p className="text-sm text-gray-700">{req.reason}</p>
            </div>
          )}

          {/* 承認者コメント */}
          {req.approver_comment && (
            <div className={`rounded-lg p-3 ${req.status === 'rejected' ? 'bg-red-50' : 'bg-green-50'}`}>
              <p className="text-xs font-medium text-gray-500 mb-1">{req.approver_name} のコメント</p>
              <p className="text-sm text-gray-700">{req.approver_comment}</p>
            </div>
          )}

          {/* 承認・却下アクション（審査中のみ） */}
          {req.status === 'reviewing' && !showActionForm && (
            <div className="flex gap-2">
              <button
                onClick={() => setShowActionForm('approve')}
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700"
              >
                <ThumbsUp className="w-4 h-4" /> 承認
              </button>
              <button
                onClick={() => setShowActionForm('reject')}
                className="flex items-center gap-1.5 px-3 py-2 bg-red-500 text-white rounded-lg text-sm font-medium hover:bg-red-600"
              >
                <ThumbsDown className="w-4 h-4" /> 却下
              </button>
            </div>
          )}

          {/* アクションフォーム */}
          {showActionForm && (
            <div className={`rounded-xl p-4 space-y-3 ${
              showActionForm === 'approve' ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'
            }`}>
              <p className="text-sm font-medium">
                {showActionForm === 'approve' ? '✅ 承認処理' : '❌ 却下処理'}
              </p>
              <input
                type="text"
                placeholder="承認者名（必須）"
                value={approverName}
                onChange={(e) => setApproverName(e.target.value)}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
              <textarea
                placeholder="コメント（任意）"
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
              />
              <div className="flex gap-2">
                <button
                  onClick={showActionForm === 'approve' ? handleApprove : handleReject}
                  disabled={!approverName.trim() || !!actionLoading}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium text-white disabled:opacity-50 ${
                    showActionForm === 'approve' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-500 hover:bg-red-600'
                  }`}
                >
                  {actionLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  確定
                </button>
                <button
                  onClick={() => { setShowActionForm(null); setApproverName(''); setComment('') }}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
                >
                  キャンセル
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ──────────────────────────────────────────────
// 新規申請モーダル
// ──────────────────────────────────────────────
function NewRequestModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    tool_name: '',
    requester_name: '',
    requester_email: '',
    reason: '',
    expected_seats: '',
    monthly_budget: '',
    priority: 'medium' as 'low' | 'medium' | 'high',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async () => {
    if (!form.tool_name || !form.requester_name) {
      setError('ツール名と申請者名は必須です')
      return
    }
    setLoading(true)
    setError(null)
    try {
      await createProcurementRequest({
        tool_name: form.tool_name,
        requester_name: form.requester_name,
        requester_email: form.requester_email || undefined,
        reason: form.reason || undefined,
        expected_seats: Number(form.expected_seats) || 0,
        monthly_budget: Number(form.monthly_budget.replace(/[¥,￥\s]/g, '')) || 0,
        priority: form.priority,
      })
      onCreated()
      onClose()
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  const Field = ({ label, children }: { label: string; children: React.ReactNode }) => (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">{label}</label>
      {children}
    </div>
  )

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-5 border-b sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900">新規調達申請</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl">×</button>
        </div>
        <div className="p-5 space-y-4">
          {error && (
            <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3">{error}</div>
          )}

          <Field label="ツール名 *">
            <input
              type="text"
              placeholder="例: Notion, Figma, Linear..."
              value={form.tool_name}
              onChange={(e) => setForm({ ...form, tool_name: e.target.value })}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="申請者名 *">
              <input
                type="text"
                placeholder="山田 太郎"
                value={form.requester_name}
                onChange={(e) => setForm({ ...form, requester_name: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
            <Field label="メールアドレス">
              <input
                type="email"
                placeholder="yamada@example.com"
                value={form.requester_email}
                onChange={(e) => setForm({ ...form, requester_email: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
          </div>

          <Field label="申請理由">
            <textarea
              placeholder="このツールが必要な理由・期待する効果を記述してください"
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm resize-none"
            />
          </Field>

          <div className="grid grid-cols-3 gap-3">
            <Field label="席数">
              <input
                type="number"
                placeholder="0"
                value={form.expected_seats}
                onChange={(e) => setForm({ ...form, expected_seats: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
            <Field label="月額予算（円）">
              <input
                type="text"
                placeholder="50000"
                value={form.monthly_budget}
                onChange={(e) => setForm({ ...form, monthly_budget: e.target.value })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
              />
            </Field>
            <Field label="優先度">
              <select
                value={form.priority}
                onChange={(e) => setForm({ ...form, priority: e.target.value as 'low' | 'medium' | 'high' })}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-white"
              >
                <option value="low">低</option>
                <option value="medium">中</option>
                <option value="high">高</option>
              </select>
            </Field>
          </div>

          <button
            onClick={handleSubmit}
            disabled={loading}
            className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            申請を提出する
          </button>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// メインページ
// ──────────────────────────────────────────────
export function Procurement() {
  const [filter, setFilter] = useState<ReqStatus | 'all'>('all')
  const [requests, setRequests] = useState<ApiProcurementRequest[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showNew, setShowNew] = useState(false)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const res = await getProcurementRequests()
      setRequests(res.requests)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const filtered = filter === 'all' ? requests : requests.filter((r) => r.status === filter)

  const counts = {
    all: requests.length,
    reviewing: requests.filter((r) => r.status === 'reviewing').length,
    approved: requests.filter((r) => r.status === 'approved').length,
    contracted: requests.filter((r) => r.status === 'contracted').length,
    rejected: requests.filter((r) => r.status === 'rejected').length,
    draft: requests.filter((r) => r.status === 'draft').length,
  }

  return (
    <div className="p-6 space-y-6">
      {showNew && (
        <NewRequestModal onClose={() => setShowNew(false)} onCreated={load} />
      )}

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">調達管理</h1>
          <p className="text-sm text-gray-500 mt-1">ツールの検討から契約まで一元管理</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" /> 更新
          </button>
          <button
            onClick={() => setShowNew(true)}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> 新規申請
          </button>
        </div>
      </div>

      {/* フローガイド */}
      <div className="card p-4 bg-indigo-50 border-indigo-200 flex items-start gap-3">
        <AlertCircle className="w-5 h-5 text-indigo-500 shrink-0 mt-0.5" />
        <div>
          <p className="text-sm font-medium text-indigo-800">調達フロー</p>
          <p className="text-sm text-indigo-600 mt-0.5">
            新規申請 → 審査中（マネージャー承認）→ 承認済 → 契約手続き → 利用開始
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
          ⚠️ API 接続エラー: {error}
        </div>
      )}

      {/* フィルタータブ */}
      <div className="flex gap-2 flex-wrap">
        {([
          { key: 'all',       label: 'すべて' },
          { key: 'reviewing', label: '審査中' },
          { key: 'approved',  label: '承認済み' },
          { key: 'contracted',label: '契約済み' },
          { key: 'draft',     label: '下書き' },
          { key: 'rejected',  label: '却下' },
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
            <span className={`ml-1.5 text-xs px-1.5 py-0.5 rounded-full ${
              filter === key ? 'bg-indigo-500 text-indigo-100' : 'bg-gray-100 text-gray-500'
            }`}>
              {counts[key]}
            </span>
          </button>
        ))}
      </div>

      {/* ローディング */}
      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 text-indigo-500 animate-spin" />
          <span className="ml-2 text-sm text-gray-500">読み込み中...</span>
        </div>
      )}

      {/* 空状態 */}
      {!loading && !error && requests.length === 0 && (
        <div className="card p-12 text-center">
          <CheckCircle2 className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">申請はありません</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">
            新規ツールの導入申請を作成してください
          </p>
          <button
            onClick={() => setShowNew(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" /> 新規申請を作成
          </button>
        </div>
      )}

      {/* 申請一覧 */}
      {!loading && filtered.length > 0 && (
        <div className="space-y-3">
          {filtered.map((req) => (
            <RequestCard key={req.id} req={req} onAction={load} />
          ))}
        </div>
      )}

      {!loading && requests.length > 0 && filtered.length === 0 && (
        <div className="card p-8 text-center text-gray-400">
          <FileEdit className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="text-sm">このステータスの申請はありません</p>
        </div>
      )}
    </div>
  )
}
