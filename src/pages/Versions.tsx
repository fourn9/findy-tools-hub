import { RefreshCw, CheckCircle2, AlertCircle, ExternalLink } from 'lucide-react'
import { versionInfoList } from '../data/mockData'

export function Versions() {
  const outdated = versionInfoList.filter((v) => v.hasUpdate)
  const upToDate = versionInfoList.filter((v) => !v.hasUpdate)

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">バージョン管理</h1>
        <p className="text-sm text-gray-500 mt-1">利用中ツールのバージョンと更新情報を管理</p>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">追跡中</p>
          <p className="text-2xl font-bold text-gray-900">{versionInfoList.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">更新あり</p>
          <p className="text-2xl font-bold text-amber-600">{outdated.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">最新版</p>
          <p className="text-2xl font-bold text-green-600">{upToDate.length}</p>
        </div>
      </div>

      {/* Outdated */}
      {outdated.length > 0 && (
        <div className="space-y-3">
          <h2 className="font-semibold text-gray-900 flex items-center gap-2">
            <AlertCircle className="w-5 h-5 text-amber-500" />
            更新が利用可能 ({outdated.length}件)
          </h2>
          {outdated.map((v) => (
            <div key={v.toolId} className="card p-5 border-l-4 border-l-amber-400">
              <div className="flex items-center justify-between flex-wrap gap-3">
                <div>
                  <p className="font-semibold text-gray-900">{v.toolName}</p>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded font-mono">
                      現在: {v.currentVersion}
                    </span>
                    <span className="text-xs text-gray-400">→</span>
                    <span className="text-xs text-green-700 bg-green-100 px-2 py-0.5 rounded font-mono">
                      最新: {v.latestVersion}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mt-1">リリース日: {v.releaseDate}</p>
                </div>
                <div className="flex gap-2">
                  <a
                    href={v.changelogUrl}
                    className="btn-secondary flex items-center gap-1 text-xs"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    変更履歴
                  </a>
                  <button className="btn-primary flex items-center gap-1 text-xs">
                    <RefreshCw className="w-3.5 h-3.5" />
                    更新申請
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Up to date */}
      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-green-500" />
          最新版を利用中 ({upToDate.length}件)
        </h2>
        {upToDate.map((v) => (
          <div key={v.toolId} className="card p-4 opacity-75">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">{v.toolName}</p>
                <span className="text-xs text-gray-500 font-mono">{v.currentVersion}</span>
              </div>
              <CheckCircle2 className="w-5 h-5 text-green-400" />
            </div>
          </div>
        ))}
      </div>

      {/* Update schedule */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-3">更新ポリシー</h2>
        <div className="space-y-3 text-sm">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-red-100 rounded-full flex items-center justify-center text-red-600 text-xs font-bold shrink-0 mt-0.5">!</div>
            <div>
              <p className="font-medium text-gray-900">セキュリティアップデート</p>
              <p className="text-gray-500">検出後48時間以内に適用</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-amber-100 rounded-full flex items-center justify-center text-amber-600 text-xs font-bold shrink-0 mt-0.5">M</div>
            <div>
              <p className="font-medium text-gray-900">メジャーバージョン</p>
              <p className="text-gray-500">QAテスト後、承認フローを経て適用</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 bg-gray-100 rounded-full flex items-center justify-center text-gray-600 text-xs font-bold shrink-0 mt-0.5">m</div>
            <div>
              <p className="font-medium text-gray-900">マイナーバージョン</p>
              <p className="text-gray-500">月次メンテナンスウィンドウで適用</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
