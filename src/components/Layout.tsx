import { useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  FileText,
  Users,
  TrendingUp,
  Settings,
  Bell,
  Search,
  ChevronDown,
  Boxes,
  GitBranch,
  Menu,
  X,
  Sparkles,
  Brain,
} from 'lucide-react'

const navItems: { path: string; label: string; icon: React.ElementType; highlight?: boolean }[] = [
  { path: '/', label: 'ダッシュボード', icon: LayoutDashboard },
  { path: '/catalog', label: 'ツールカタログ', icon: Package },
  { path: '/procurement', label: '調達管理', icon: ShoppingCart },
  { path: '/contracts', label: '契約管理', icon: FileText },
  { path: '/accounts', label: 'アカウント管理', icon: Users },
  { path: '/versions', label: 'バージョン管理', icon: GitBranch },
  { path: '/spend', label: '支出分析', icon: TrendingUp },
  { path: '/optimization', label: '支出最適化', icon: Sparkles, highlight: true },
  { path: '/ai-cost', label: 'AIコスト最適化', icon: Brain, highlight: true },
]

export function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${mobileOpen ? 'translate-x-0' : '-translate-x-full'} fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-200 md:relative md:translate-x-0`}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 h-16 border-b border-gray-200 shrink-0">
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
            <Boxes className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-bold text-gray-900 text-sm leading-tight">Findy Tools Hub</p>
            <p className="text-xs text-gray-500">ツール管理プラットフォーム</p>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 px-3">
          <ul className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const active = location.pathname === item.path
              return (
                <li key={item.path}>
                  <Link
                    to={item.path}
                    onClick={() => setMobileOpen(false)}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
                      active
                        ? 'bg-indigo-50 text-indigo-700 font-medium'
                        : item.highlight
                        ? 'text-indigo-600 bg-indigo-50/60 hover:bg-indigo-100 font-medium'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`}
                  >
                    <Icon className={`w-4 h-4 ${active ? 'text-indigo-600' : item.highlight ? 'text-indigo-500' : 'text-gray-400'}`} />
                    <span className="flex-1">{item.label}</span>
                    {item.highlight && !active && (
                      <span className="text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">NEW</span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>

        {/* Bottom */}
        <div className="border-t border-gray-200 p-3">
          <Link
            to="/settings"
            className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-gray-600 hover:bg-gray-100 hover:text-gray-900 transition-colors"
          >
            <Settings className="w-4 h-4 text-gray-400" />
            設定
          </Link>
          <div className="flex items-center gap-3 px-3 py-2 mt-1">
            <div className="w-7 h-7 bg-indigo-600 rounded-full flex items-center justify-center text-white text-xs font-bold">
              山
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium text-gray-900 truncate">山田 太郎</p>
              <p className="text-xs text-gray-500 truncate">ITマネージャー</p>
            </div>
            <ChevronDown className="w-3 h-3 text-gray-400 shrink-0" />
          </div>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/30 md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Main */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Header */}
        <header className="h-16 bg-white border-b border-gray-200 flex items-center gap-4 px-4 md:px-6 shrink-0">
          <button
            className="md:hidden p-2 rounded-lg hover:bg-gray-100"
            onClick={() => setMobileOpen(!mobileOpen)}
          >
            {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
          </button>
          <div className="flex-1 relative max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="ツールを検索..."
              className="w-full pl-10 pr-4 py-2 text-sm bg-gray-100 rounded-lg border-none outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition-colors"
            />
          </div>
          <div className="flex items-center gap-2 ml-auto">
            <button className="relative p-2 rounded-lg hover:bg-gray-100 transition-colors">
              <Bell className="w-5 h-5 text-gray-600" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full"></span>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>
    </div>
  )
}
