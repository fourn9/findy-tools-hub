import { useState, useEffect } from 'react'
import { Key, CheckCircle2, AlertCircle, Eye, EyeOff, Trash2, Github, Bot, Cpu, RefreshCw, Zap } from 'lucide-react'
import { supabase } from '../lib/supabase'

// バックエンド URL（Vite 環境変数 or ローカルフォールバック）
const API_URL = (import.meta as any).env?.VITE_API_URL ?? 'http://localhost:3000'

type Provider = 'anthropic' | 'openai' | 'github'

type SavedKey = {
  id: string
  provider: Provider
  key_masked: string
  created_at: string
}

type ProviderMeta = {
  label: string
  icon: React.ReactNode
  placeholder: string
  hint: string
  color: string
}

const PROVIDERS: Record<Provider, ProviderMeta> = {
  anthropic: {
    label: 'Anthropic (Claude API)',
    icon: <Bot className="w-4 h-4" />,
    placeholder: 'sk-ant-api03-...',
    hint: 'console.anthropic.com → API Keys',
    color: 'text-violet-600 bg-violet-50 border-violet-200',
  },
  openai: {
    label: 'OpenAI API',
    icon: <Cpu className="w-4 h-4" />,
    placeholder: 'sk-...',
    hint: 'platform.openai.com → API Keys',
    color: 'text-green-600 bg-green-50 border-green-200',
  },
  github: {
    label: 'GitHub',
    icon: <Github className="w-4 h-4" />,
    placeholder: 'ghp_...',
    hint: 'github.com → Settings → Developer settings → Personal access tokens',
    color: 'text-gray-600 bg-gray-50 border-gray-200',
  },
}

function mask(key: string) {
  if (key.length <= 8) return '••••••••'
  return key.slice(0, 7) + '...' + key.slice(-4)
}

export function Settings() {
  const [savedKeys, setSavedKeys] = useState<SavedKey[]>([])
  const [inputs,   setInputs]    = useState<Record<Provider, string>>({ anthropic: '', openai: '', github: '' })
  const [visible,  setVisible]   = useState<Record<Provider, boolean>>({ anthropic: false, openai: false, github: false })
  const [saving,   setSaving]    = useState<Record<Provider, boolean>>({ anthropic: false, openai: false, github: false })
  const [messages, setMessages]  = useState<Record<Provider, { ok: boolean; text: string } | null>>({ anthropic: null, openai: null, github: null })
  const [loading,  setLoading]   = useState(true)

  // Sync Now state
  const [syncing,    setSyncing]    = useState(false)
  const [syncResult, setSyncResult] = useState<{ ok: boolean; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const { data } = await supabase.from('api_keys').select('*').order('created_at', { ascending: false })
    setSavedKeys((data ?? []) as SavedKey[])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const hasKey = (p: Provider) => savedKeys.some(k => k.provider === p)

  const save = async (provider: Provider) => {
    const key = inputs[provider].trim()
    if (!key) return
    setSaving(s => ({ ...s, [provider]: true }))
    setMessages(m => ({ ...m, [provider]: null }))

    await supabase.from('api_keys').delete().eq('provider', provider)

    const { error } = await supabase.from('api_keys').insert({
      provider,
      key_value:  key,
      key_masked: mask(key),
    })

    if (error) {
      setMessages(m => ({ ...m, [provider]: { ok: false, text: error.message } }))
    } else {
      setMessages(m => ({ ...m, [provider]: { ok: true, text: '保存しました' } }))
      setInputs(i => ({ ...i, [provider]: '' }))
      load()
    }
    setSaving(s => ({ ...s, [provider]: false }))
  }

  const remove = async (provider: Provider) => {
    await supabase.from('api_keys').delete().eq('provider', provider)
    load()
  }

  const syncNow = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res  = await fetch(`${API_URL}/api/ai-usage/sync`, { method: 'POST' })
      const json = await res.json().catch(() => ({}))
      if (res.ok) {
        const synced = json.synced ?? 0
        setSyncResult({ ok: true, text: `同期完了。${synced}件のデータを追加しました。` })
      } else {
        setSyncResult({ ok: false, text: json.error ?? `エラー: HTTP ${res.status}` })
      }
    } catch (e) {
      setSyncResult({ ok: false, text: e instanceof Error ? e.message : '接続エラー。バックエンドが起動しているか確認してください。' })
    }
    setSyncing(false)
  }

  const hasAiApiKey = hasKey('anthropic') || hasKey('openai')

  return (
    <div className="p-6 space-y-6 max-w-2xl">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
          <Key className="w-6 h-6 text-gray-700" />
          設定
        </h1>
        <p className="text-sm text-gray-500 mt-1">APIキーを登録すると、実データでダッシュボードが動作します</p>
      </div>

      {/* API Keys */}
      <div className="space-y-4">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">API キー管理</h2>

        {(Object.keys(PROVIDERS) as Provider[]).map(provider => {
          const meta    = PROVIDERS[provider]
          const already = hasKey(provider)
          const current = savedKeys.find(k => k.provider === provider)
          const msg     = messages[provider]

          return (
            <div key={provider} className="bg-white border border-gray-200 rounded-xl p-5 space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={`p-1.5 rounded-lg border ${meta.color}`}>{meta.icon}</span>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{meta.label}</p>
                    <p className="text-xs text-gray-400">{meta.hint}</p>
                  </div>
                </div>
                {already && (
                  <div className="flex items-center gap-2">
                    <span className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
                      <CheckCircle2 className="w-3 h-3" /> 登録済み {current?.key_masked}
                    </span>
                    <button
                      onClick={() => remove(provider)}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="削除"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <div className="relative flex-1">
                  <input
                    type={visible[provider] ? 'text' : 'password'}
                    value={inputs[provider]}
                    onChange={e => setInputs(i => ({ ...i, [provider]: e.target.value }))}
                    placeholder={already ? '新しいキーで上書きする場合のみ入力' : meta.placeholder}
                    className="w-full pl-3 pr-10 py-2.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-500 font-mono"
                  />
                  <button
                    type="button"
                    onClick={() => setVisible(v => ({ ...v, [provider]: !v[provider] }))}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    {visible[provider] ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <button
                  onClick={() => save(provider)}
                  disabled={!inputs[provider].trim() || saving[provider]}
                  className="px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  {saving[provider] ? '保存中...' : '保存'}
                </button>
              </div>

              {msg && (
                <p className={`flex items-center gap-1.5 text-xs ${msg.ok ? 'text-green-600' : 'text-red-600'}`}>
                  {msg.ok ? <CheckCircle2 className="w-3.5 h-3.5" /> : <AlertCircle className="w-3.5 h-3.5" />}
                  {msg.text}
                </p>
              )}
            </div>
          )
        })}
      </div>

      {/* ────── データ同期 ────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-semibold text-gray-700 uppercase tracking-wide">データ同期</h2>

        <div className="bg-white border border-gray-200 rounded-xl p-5">
          <div className="flex items-start gap-3 mb-4">
            <div className="p-1.5 rounded-lg bg-indigo-50 border border-indigo-200 text-indigo-600">
              <Zap className="w-4 h-4" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">Anthropic / OpenAI 使用量を今すぐ同期</p>
              <p className="text-xs text-gray-400">
                登録済みの APIキーを使って Usage API からデータを取得し、トークン最適化タブを更新します。
              </p>
            </div>
          </div>

          {!hasAiApiKey && (
            <div className="mb-3 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
              <p className="text-xs text-amber-700">Anthropic または OpenAI の APIキーを先に登録してください。</p>
            </div>
          )}

          <div className="flex items-center gap-3 flex-wrap">
            <button
              onClick={syncNow}
              disabled={syncing || !hasAiApiKey}
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              {syncing ? '同期中...' : '今すぐ同期'}
            </button>

            {syncResult && (
              <p className={`flex items-center gap-1.5 text-sm ${syncResult.ok ? 'text-green-600' : 'text-red-600'}`}>
                {syncResult.ok
                  ? <CheckCircle2 className="w-4 h-4" />
                  : <AlertCircle className="w-4 h-4" />}
                {syncResult.text}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* 注意書き */}
      {!loading && savedKeys.length === 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
          <p className="font-medium mb-1">APIキーが未登録です</p>
          <p className="text-xs text-amber-700">
            Anthropic APIキーを登録すると「今すぐ同期」でトークン使用量が取得できます。<br />
            GitHubトークンは AIガバナンス → 効果測定 タブで直接入力できます。
          </p>
        </div>
      )}
    </div>
  )
}
