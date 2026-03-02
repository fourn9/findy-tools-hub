import { useState, useEffect, useRef, useCallback } from 'react'
import { Link } from 'react-router-dom'
import {
  FileText, AlertTriangle, Calendar, Users, DollarSign,
  Upload, X, Loader2, RefreshCw, Sparkles, Copy, Check,
} from 'lucide-react'
import {
  getContracts,
  getContractStats,
  importContractsCsv,
  generateNegotiationScript,
  type ApiContract,
  type ContractStats,
} from '../lib/api'

// ──────────────────────────────────────────────
// ステータスバッジ
// ──────────────────────────────────────────────
function StatusBadge({ status }: { status: ApiContract['status'] }) {
  const map: Record<ApiContract['status'], string> = {
    active:    'bg-green-100 text-green-700',
    trial:     'bg-blue-100 text-blue-700',
    pending:   'bg-yellow-100 text-yellow-700',
    expired:   'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-500',
  }
  const label: Record<ApiContract['status'], string> = {
    active: '利用中', trial: 'トライアル', pending: '手続き中',
    expired: '期限切れ', cancelled: 'キャンセル',
  }
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${map[status]}`}>
      {label[status]}
    </span>
  )
}

// ──────────────────────────────────────────────
// CSV インポートモーダル
// ──────────────────────────────────────────────
function CsvImportModal({ onClose, onImported }: { onClose: () => void; onImported: () => void }) {
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{ imported: number; errors: string[] } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleImport = async () => {
    if (!file) return
    setLoading(true)
    try {
      const res = await importContractsCsv(file)
      setResult({ imported: res.imported, errors: res.errors })
      if (res.imported > 0) onImported()
    } catch (err) {
      setResult({ imported: 0, errors: [String(err)] })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg">
        <div className="flex items-center justify-between p-5 border-b">
          <h2 className="text-lg font-semibold text-gray-900">CSV インポート</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {!result ? (
            <>
              <p className="text-sm text-gray-600">
                Excel や Google Sheets からエクスポートした CSV ファイルをアップロードしてください。
                列名は日本語・英語どちらでも自動認識します。
              </p>

              <div className="bg-gray-50 rounded-xl p-4 text-xs text-gray-500 space-y-1 font-mono">
                <p className="font-semibold text-gray-700 text-sm mb-2">対応する列名（例）</p>
                <p>ツール名 / tool_name, ステータス / status</p>
                <p>月額（円）/ monthly_amount, シート数 / seats</p>
                <p>更新日 / renewal_date, 担当者 / owner, 部署 / department</p>
              </div>

              <div
                className="border-2 border-dashed border-gray-200 rounded-xl p-8 text-center cursor-pointer hover:border-indigo-400 transition-colors"
                onClick={() => inputRef.current?.click()}
              >
                <Upload className="w-8 h-8 text-gray-300 mx-auto mb-2" />
                <p className="text-sm text-gray-500">
                  {file ? file.name : 'クリックしてファイルを選択'}
                </p>
                {file && (
                  <p className="text-xs text-gray-400 mt-1">
                    {(file.size / 1024).toFixed(1)} KB
                  </p>
                )}
                <input
                  ref={inputRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                />
              </div>

              <button
                onClick={handleImport}
                disabled={!file || loading}
                className="w-full py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                {loading && <Loader2 className="w-4 h-4 animate-spin" />}
                {loading ? 'インポート中...' : 'インポート開始'}
              </button>
            </>
          ) : (
            <div className="space-y-3">
              <div className={`rounded-xl p-4 ${result.imported > 0 ? 'bg-green-50' : 'bg-red-50'}`}>
                <p className={`font-semibold ${result.imported > 0 ? 'text-green-700' : 'text-red-700'}`}>
                  {result.imported > 0
                    ? `✅ ${result.imported} 件のデータをインポートしました`
                    : '❌ インポートに失敗しました'}
                </p>
              </div>
              {result.errors.length > 0 && (
                <div className="bg-amber-50 rounded-xl p-4">
                  <p className="text-sm font-medium text-amber-700 mb-2">スキップされた行</p>
                  <ul className="text-xs text-amber-600 space-y-1">
                    {result.errors.slice(0, 5).map((e, i) => <li key={i}>{e}</li>)}
                    {result.errors.length > 5 && (
                      <li>…他 {result.errors.length - 5} 件</li>
                    )}
                  </ul>
                </div>
              )}
              <button
                onClick={onClose}
                className="w-full py-2.5 bg-gray-100 text-gray-700 rounded-xl font-medium hover:bg-gray-200"
              >
                閉じる
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// 交渉スクリプト生成モーダル
// ──────────────────────────────────────────────
function NegotiationModal({ contract, onClose }: { contract: ApiContract; onClose: () => void }) {
  const [script, setScript] = useState('')
  const [loading, setLoading] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const scriptRef = useRef<HTMLDivElement>(null)

  const daysUntilRenewal = contract.renewal_date
    ? Math.ceil((new Date(contract.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
    : null

  const generate = useCallback(async () => {
    setScript('')
    setLoading(true)
    setDone(false)
    setError(null)
    setCopied(false)

    await generateNegotiationScript(
      contract,
      (chunk) => {
        setScript((prev) => prev + chunk)
        // 自動スクロール
        setTimeout(() => {
          if (scriptRef.current) {
            scriptRef.current.scrollTop = scriptRef.current.scrollHeight
          }
        }, 0)
      },
      () => {
        setLoading(false)
        setDone(true)
      },
      (err) => {
        setError(err)
        setLoading(false)
      },
    )
  }, [contract])

  // マウント時に自動生成開始
  useEffect(() => { generate() }, [generate])

  const handleCopy = () => {
    navigator.clipboard.writeText(script).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl flex flex-col" style={{ maxHeight: '90vh' }}>
        {/* ヘッダー */}
        <div className="flex items-start justify-between p-5 border-b shrink-0">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-indigo-500" />
            <div>
              <h2 className="text-lg font-semibold text-gray-900">交渉スクリプト生成</h2>
              <p className="text-xs text-gray-500 mt-0.5">
                {contract.tool_name}
                {daysUntilRenewal !== null && (
                  <span className={`ml-2 font-medium ${daysUntilRenewal <= 30 ? 'text-red-500' : 'text-amber-500'}`}>
                    更新まで {daysUntilRenewal} 日
                  </span>
                )}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コンテンツ */}
        <div className="flex-1 overflow-hidden flex flex-col p-5 gap-4">
          {/* 契約サマリー */}
          <div className="grid grid-cols-3 gap-3 shrink-0">
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">月額</p>
              <p className="text-base font-bold text-gray-900">¥{contract.monthly_amount.toLocaleString()}</p>
            </div>
            {contract.seats > 0 && (
              <div className="bg-gray-50 rounded-xl p-3">
                <p className="text-xs text-gray-500">シート使用率</p>
                <p className="text-base font-bold text-gray-900">
                  {Math.round((contract.used_seats / contract.seats) * 100)}%
                  <span className="text-xs text-gray-400 font-normal ml-1">
                    ({contract.used_seats}/{contract.seats})
                  </span>
                </p>
              </div>
            )}
            <div className="bg-gray-50 rounded-xl p-3">
              <p className="text-xs text-gray-500">課金サイクル</p>
              <p className="text-base font-bold text-gray-900">
                {contract.billing_cycle === 'yearly' ? '年次' : '月次'}
              </p>
            </div>
          </div>

          {/* スクリプト表示エリア */}
          <div
            ref={scriptRef}
            className="flex-1 overflow-y-auto bg-gray-50 rounded-xl p-4 font-mono text-sm text-gray-800 leading-relaxed whitespace-pre-wrap min-h-0"
            style={{ minHeight: '300px' }}
          >
            {loading && script === '' && (
              <div className="flex items-center gap-2 text-gray-400">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Claude が交渉スクリプトを生成中...</span>
              </div>
            )}
            {script}
            {loading && script !== '' && (
              <span className="inline-block w-2 h-4 bg-indigo-400 animate-pulse ml-0.5" />
            )}
            {error && (
              <div className="text-red-600">
                <p className="font-semibold">⚠️ エラーが発生しました</p>
                <p className="text-xs mt-1">{error}</p>
                {error.includes('ANTHROPIC_API_KEY') && (
                  <p className="text-xs mt-2 text-gray-500">
                    サーバーの環境変数 ANTHROPIC_API_KEY を設定してください。
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* フッターボタン */}
        <div className="flex items-center justify-between p-5 border-t shrink-0 gap-3">
          <button
            onClick={generate}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 rounded-xl border border-gray-200 text-sm text-gray-600 hover:bg-gray-50 disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            再生成
          </button>
          <div className="flex gap-2">
            <button
              onClick={handleCopy}
              disabled={!done || !script}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-medium hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
              {copied ? 'コピーしました!' : 'コピー'}
            </button>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// メインページ
// ──────────────────────────────────────────────
export function Contracts() {
  const [filter, setFilter] = useState<ApiContract['status'] | 'all'>('all')
  const [contracts, setContracts] = useState<ApiContract[]>([])
  const [stats, setStats] = useState<ContractStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showImport, setShowImport] = useState(false)
  const [negotiatingContract, setNegotiatingContract] = useState<ApiContract | null>(null)

  const load = async () => {
    try {
      setLoading(true)
      setError(null)
      const [contractsRes, statsRes] = await Promise.all([
        getContracts({ status: filter === 'all' ? undefined : filter }),
        getContractStats(),
      ])
      setContracts(contractsRes.contracts)
      setStats(statsRes)
    } catch (err) {
      setError(String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [filter])

  return (
    <div className="p-6 space-y-6">
      {showImport && (
        <CsvImportModal
          onClose={() => setShowImport(false)}
          onImported={load}
        />
      )}

      {negotiatingContract && (
        <NegotiationModal
          contract={negotiatingContract}
          onClose={() => setNegotiatingContract(null)}
        />
      )}

      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">契約管理</h1>
          <p className="text-sm text-gray-500 mt-1">ツールの契約・ライセンス情報を管理</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <button
            onClick={load}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            <RefreshCw className="w-4 h-4" />
            更新
          </button>
          <button
            onClick={() => setShowImport(true)}
            className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-sm text-gray-600 hover:bg-gray-50"
          >
            <Upload className="w-4 h-4" />
            CSV インポート
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl p-4">
          ⚠️ API 接続エラー: {error}
          <p className="text-xs mt-1 text-red-500">バックエンドサーバーが起動していることを確認してください。</p>
        </div>
      )}

      {/* サマリーカード */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">契約中</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '—' : stats?.statusCounts.active ?? 0}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">トライアル</p>
          <p className="text-2xl font-bold text-blue-600">
            {loading ? '—' : stats?.statusCounts.trial ?? 0}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">手続き中</p>
          <p className="text-2xl font-bold text-yellow-600">
            {loading ? '—' : stats?.statusCounts.pending ?? 0}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">月次合計</p>
          <p className="text-2xl font-bold text-gray-900">
            {loading ? '—' : `¥${Math.round((stats?.totalMonthlySpend ?? 0) / 10000)}`}
            {!loading && <span className="text-base">万</span>}
          </p>
        </div>
      </div>

      {/* 更新アラート */}
      {stats && stats.renewalAlerts.length > 0 && (
        <div className="card p-4 border-l-4 border-l-amber-400 bg-amber-50">
          <div className="flex items-start gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0" />
            <div className="flex-1">
              <p className="text-sm font-medium text-amber-800">更新期限アラート（60日以内）</p>
              <ul className="mt-1 space-y-1">
                {stats.renewalAlerts.map((c) => {
                  const days = Math.ceil(
                    (new Date(c.renewal_date!).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
                  )
                  return (
                    <li key={c.id} className="flex items-center justify-between text-sm text-amber-700">
                      <span>
                        <span className="font-medium">{c.tool_name}</span> —{' '}
                        {c.renewal_date}（{days}日後）
                      </span>
                      <button
                        onClick={() => setNegotiatingContract(c)}
                        className="flex items-center gap-1 text-xs text-indigo-600 hover:text-indigo-800 font-medium bg-white px-2 py-1 rounded-lg border border-indigo-200 hover:bg-indigo-50 transition-colors shrink-0 ml-3"
                      >
                        <Sparkles className="w-3 h-3" />
                        交渉スクリプト生成
                      </button>
                    </li>
                  )
                })}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* フィルター */}
      <div className="flex gap-2 flex-wrap">
        {(['all', 'active', 'trial', 'pending', 'expired', 'cancelled'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              filter === s
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
            }`}
          >
            {s === 'all' ? 'すべて'
              : s === 'active' ? '利用中'
              : s === 'trial' ? 'トライアル'
              : s === 'pending' ? '手続き中'
              : s === 'expired' ? '期限切れ'
              : 'キャンセル'}
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

      {/* データなし（空状態） */}
      {!loading && !error && contracts.length === 0 && (
        <div className="card p-12 text-center">
          <FileText className="w-12 h-12 text-gray-200 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">契約データがありません</p>
          <p className="text-sm text-gray-400 mt-1 mb-6">
            CSV ファイルをインポートするか、手動で追加してください
          </p>
          <button
            onClick={() => setShowImport(true)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700"
          >
            <Upload className="w-4 h-4" />
            CSV インポートで始める
          </button>
        </div>
      )}

      {/* 契約リスト */}
      {!loading && contracts.length > 0 && (
        <div className="space-y-3">
          {contracts.map((c) => {
            const seatPct = c.seats > 0 ? Math.round((c.used_seats / c.seats) * 100) : 0
            const logoSrc = c.tool_logo_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(c.tool_name)}&background=6366f1&color=fff&size=48`

            // 更新まで 90 日以内なら交渉スクリプトボタンを強調
            const daysUntilRenewal = c.renewal_date
              ? Math.ceil((new Date(c.renewal_date).getTime() - Date.now()) / (1000 * 60 * 60 * 24))
              : null
            const showNegotiateHighlight = daysUntilRenewal !== null && daysUntilRenewal <= 90 && daysUntilRenewal > 0

            return (
              <div key={c.id} className={`card p-5 hover:shadow-md transition-shadow ${showNegotiateHighlight ? 'ring-1 ring-amber-200' : ''}`}>
                <div className="flex items-start gap-4">
                  <img
                    src={logoSrc}
                    alt={c.tool_name}
                    className="w-12 h-12 rounded-xl object-contain border border-gray-100 p-1.5 shrink-0"
                    onError={(e) => {
                      const t = e.target as HTMLImageElement
                      t.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(c.tool_name)}&background=6366f1&color=fff&size=48`
                    }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap justify-between">
                      <div className="flex items-center gap-2 flex-wrap">
                        {c.tool_alias ? (
                          <Link
                            to={`/catalog/${c.tool_alias}`}
                            className="font-semibold text-gray-900 hover:text-indigo-600 transition-colors"
                          >
                            {c.tool_name}
                          </Link>
                        ) : (
                          <span className="font-semibold text-gray-900">{c.tool_name}</span>
                        )}
                        <StatusBadge status={c.status} />
                        {c.plan && (
                          <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                            {c.plan}
                          </span>
                        )}
                      </div>

                      {/* 交渉スクリプト生成ボタン */}
                      <button
                        onClick={() => setNegotiatingContract(c)}
                        className={`flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-lg font-medium transition-colors shrink-0 ${
                          showNegotiateHighlight
                            ? 'bg-indigo-600 text-white hover:bg-indigo-700'
                            : 'border border-gray-200 text-gray-500 hover:bg-gray-50 hover:text-indigo-600 hover:border-indigo-200'
                        }`}
                      >
                        <Sparkles className="w-3 h-3" />
                        交渉スクリプト
                        {showNegotiateHighlight && (
                          <span className="bg-white/20 text-white text-xs rounded px-1">
                            {daysUntilRenewal}日
                          </span>
                        )}
                      </button>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-3">
                      <div className="flex items-center gap-2">
                        <DollarSign className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">月額</p>
                          <p className="text-sm font-medium text-gray-900">
                            ¥{c.monthly_amount.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      {c.seats > 0 && (
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-gray-400 shrink-0" />
                          <div>
                            <p className="text-xs text-gray-500">シート</p>
                            <p className="text-sm font-medium text-gray-900">
                              {c.used_seats}/{c.seats}
                            </p>
                          </div>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">更新日</p>
                          <p className={`text-sm font-medium ${showNegotiateHighlight ? 'text-amber-600' : 'text-gray-900'}`}>
                            {c.renewal_date ?? '未設定'}
                            {showNegotiateHighlight && (
                              <span className="ml-1 text-xs text-amber-500">({daysUntilRenewal}日後)</span>
                            )}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <FileText className="w-4 h-4 text-gray-400 shrink-0" />
                        <div>
                          <p className="text-xs text-gray-500">担当</p>
                          <p className="text-sm font-medium text-gray-900">
                            {c.owner ?? '—'}
                            {c.department && (
                              <span className="text-xs text-gray-400 ml-1">({c.department})</span>
                            )}
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* シート使用率バー */}
                    {c.seats > 0 && (
                      <div className="mt-3">
                        <div className="flex justify-between text-xs text-gray-500 mb-1">
                          <span>シート使用率</span>
                          <span className={seatPct > 90 ? 'text-red-500 font-medium' : seatPct < 70 ? 'text-amber-500' : ''}>{seatPct}%</span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all ${
                              seatPct > 90 ? 'bg-red-400' : seatPct < 70 ? 'bg-amber-400' : 'bg-indigo-400'
                            }`}
                            style={{ width: `${Math.min(seatPct, 100)}%` }}
                          />
                        </div>
                        {seatPct < 70 && (
                          <p className="text-xs text-amber-600 mt-1">
                            💡 使用率が低め — 交渉スクリプトでシート削減を提案できます
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
