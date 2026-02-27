import { useState } from 'react'
import { Search, UserPlus, Package } from 'lucide-react'
import { members } from '../data/mockData'
import { tools } from '../data/tools'

export function Accounts() {
  const [search, setSearch] = useState('')
  const [dept, setDept] = useState('すべて')

  const departments = ['すべて', ...Array.from(new Set(members.map((m) => m.department)))]

  const filtered = members.filter((m) => {
    const matchSearch =
      m.name.toLowerCase().includes(search.toLowerCase()) ||
      m.email.toLowerCase().includes(search.toLowerCase()) ||
      m.role.toLowerCase().includes(search.toLowerCase())
    const matchDept = dept === 'すべて' || m.department === dept
    return matchSearch && matchDept
  })

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">アカウント管理</h1>
          <p className="text-sm text-gray-500 mt-1">メンバーのツールアクセスを管理</p>
        </div>
        <button className="btn-primary flex items-center gap-1">
          <UserPlus className="w-4 h-4" /> メンバー追加
        </button>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">総メンバー数</p>
          <p className="text-2xl font-bold text-gray-900">{members.length}</p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">アクティブ（今日）</p>
          <p className="text-2xl font-bold text-green-600">
            {members.filter((m) => m.lastActive === '2026-02-27').length}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">平均ツール数</p>
          <p className="text-2xl font-bold text-indigo-600">
            {(members.reduce((sum, m) => sum + m.assignedTools.length, 0) / members.length).toFixed(1)}
          </p>
        </div>
        <div className="card p-4">
          <p className="text-xs text-gray-500 mb-1">部署数</p>
          <p className="text-2xl font-bold text-gray-900">
            {new Set(members.map((m) => m.department)).size}
          </p>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-3 flex-wrap">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="名前・メール・ロールで検索..."
            className="pl-10 pr-4 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        <select
          value={dept}
          onChange={(e) => setDept(e.target.value)}
          className="px-3 py-2 text-sm rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-indigo-400"
        >
          {departments.map((d) => (
            <option key={d}>{d}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                <th className="text-left p-4 font-medium text-gray-600">メンバー</th>
                <th className="text-left p-4 font-medium text-gray-600">部署</th>
                <th className="text-left p-4 font-medium text-gray-600">割り当てツール</th>
                <th className="text-left p-4 font-medium text-gray-600">最終アクティブ</th>
                <th className="text-right p-4 font-medium text-gray-600">操作</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {filtered.map((member) => (
                <tr key={member.id} className="hover:bg-gray-50 transition-colors">
                  <td className="p-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 bg-indigo-100 rounded-full flex items-center justify-center text-indigo-700 text-sm font-bold shrink-0">
                        {member.name.charAt(0)}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{member.name}</p>
                        <p className="text-xs text-gray-500">{member.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="p-4">
                    <div>
                      <p className="text-gray-700">{member.department}</p>
                      <p className="text-xs text-gray-400">{member.role}</p>
                    </div>
                  </td>
                  <td className="p-4">
                    <div className="flex items-center gap-1 flex-wrap">
                      {member.assignedTools.slice(0, 3).map((toolId) => {
                        const tool = tools.find((t) => t.id === toolId)
                        return tool ? (
                          <img
                            key={toolId}
                            src={tool.logoUrl}
                            alt={tool.name}
                            title={tool.name}
                            className="w-6 h-6 rounded border border-gray-100 object-contain p-0.5"
                            onError={(e) => {
                              const target = e.target as HTMLImageElement
                              target.src = `https://ui-avatars.com/api/?name=${tool.name}&background=6366f1&color=fff&size=24`
                            }}
                          />
                        ) : null
                      })}
                      {member.assignedTools.length > 3 && (
                        <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded">
                          +{member.assignedTools.length - 3}
                        </span>
                      )}
                      <span className="text-xs text-gray-400 ml-1">
                        ({member.assignedTools.length}ツール)
                      </span>
                    </div>
                  </td>
                  <td className="p-4">
                    <span
                      className={`text-sm ${
                        member.lastActive === '2026-02-27'
                          ? 'text-green-600'
                          : 'text-gray-500'
                      }`}
                    >
                      {member.lastActive === '2026-02-27' ? '今日' : member.lastActive}
                    </span>
                  </td>
                  <td className="p-4 text-right">
                    <button className="text-sm text-indigo-600 hover:underline">
                      管理
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Tool usage matrix */}
      <div className="card p-5">
        <h2 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
          <Package className="w-4 h-4 text-gray-500" />
          ツール別利用者数
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {tools.map((tool) => {
            const userCount = members.filter((m) => m.assignedTools.includes(tool.id)).length
            return (
              <div key={tool.id} className="border border-gray-100 rounded-xl p-3 text-center hover:border-indigo-200 transition-colors">
                <img
                  src={tool.logoUrl}
                  alt={tool.name}
                  className="w-8 h-8 mx-auto mb-2 object-contain"
                  onError={(e) => {
                    const target = e.target as HTMLImageElement
                    target.src = `https://ui-avatars.com/api/?name=${tool.name}&background=6366f1&color=fff&size=32`
                  }}
                />
                <p className="text-xs font-medium text-gray-700 truncate">{tool.name}</p>
                <p className="text-xl font-bold text-indigo-600 mt-1">{userCount}</p>
                <p className="text-xs text-gray-400">名</p>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
