# デプロイガイド — Findy Tools Hub

## 前提

| サービス | 用途 | 無料枠 |
|---|---|---|
| [Supabase](https://supabase.com) | 認証 + PostgreSQL DB | Free tier あり |
| [Render](https://render.com) | Hono バックエンド (Bun) | Free tier あり |
| GitHub Pages | Vite フロントエンド | 無料 |

---

## STEP 1 — Supabase プロジェクト作成

1. [supabase.com](https://supabase.com) → **New project** を作成
2. **Project Settings → API** を開き以下をメモ：
   - `Project URL` → `https://xxxx.supabase.co`
   - `anon / public` キー → `eyJ...`（フロントエンド用）
   - `service_role` キー → `eyJ...`（バックエンド専用・絶対に公開しない）

---

## STEP 2 — データベーステーブル作成

1. Supabase ダッシュボード → **SQL Editor**
2. `supabase/schema.sql` の内容を全てコピー＆ペーストして **Run**
3. 5テーブル (`contracts`, `api_keys`, `ai_usage_snapshots`, `expense_items`, `github_metrics`) が作成される
4. 初期データ（GitHub Copilot など11件の契約データ）も一緒にINSERTされる

---

## STEP 3 — 最初のユーザーアカウントを作成

1. Supabase ダッシュボード → **Authentication → Users → Add user**
2. メールアドレスとパスワードを設定
3. このアカウントでアプリにログインする

> RLSポリシーは `authenticated` ユーザー全員が全データにアクセスできる設定です。
> チームメンバーを追加する場合は同様に Authentication → Users から招待してください。

---

## STEP 4 — フロントエンド環境変数（ローカル開発）

プロジェクトルートに `.env.local` を作成：

```bash
# .env.local（gitignore済み）
VITE_SUPABASE_URL=https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
VITE_API_URL=http://localhost:3000
```

ローカル確認：
```bash
bun run dev
# → http://localhost:5173
```

---

## STEP 5 — バックエンド（Render）デプロイ

### 5-1. Render に push（初回）

```bash
# GitHub にプッシュ（GitHub Actions が自動デプロイ）
git push origin main
```

### 5-2. Render サービス作成

1. [render.com](https://render.com) → **New → Web Service**
2. GitHub リポジトリを接続
3. 設定：

| 項目 | 値 |
|---|---|
| Runtime | **Node** |
| Build Command | `bun install` |
| Start Command | `bun run server/index.ts` |
| Root Directory | （空白） |

### 5-3. Render 環境変数を設定

Render ダッシュボード → **Environment** タブ：

```
SUPABASE_URL            = https://xxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY = eyJ...（service_role キー）
DATABASE_URL            = （Supabase の Connection String — PostgreSQL）
```

> `DATABASE_URL` は Supabase → Project Settings → Database → **Connection string (URI)** にあります。

デプロイが完了したら Render が発行する URL をメモ：
例：`https://findy-tools-api.onrender.com`

---

## STEP 6 — フロントエンド（GitHub Pages）デプロイ

### 6-1. リポジトリ Secrets を設定

GitHub リポジトリ → **Settings → Secrets and variables → Actions → New repository secret**：

```
VITE_SUPABASE_URL      = https://xxxx.supabase.co
VITE_SUPABASE_ANON_KEY = eyJ...（anon キー）
VITE_API_URL           = https://findy-tools-api.onrender.com
```

### 6-2. GitHub Pages を有効化

GitHub リポジトリ → **Settings → Pages**：
- Source: **GitHub Actions**

### 6-3. デプロイをトリガー

```bash
git push origin main
# → .github/workflows/deploy-frontend.yml が自動実行
# → https://<username>.github.io/<repo>/ で公開
```

---

## STEP 7 — APIキー登録（初回ログイン後）

ログイン後、**設定** ページ (`/settings`) から以下を登録：

| キー | 取得場所 | 用途 |
|---|---|---|
| Anthropic API キー | [console.anthropic.com](https://console.anthropic.com) → API Keys | トークン使用量の同期 |
| OpenAI API キー | [platform.openai.com](https://platform.openai.com) → API Keys | トークン使用量の同期 |
| GitHub PAT | GitHub → Settings → Developer settings → Personal access tokens | PRサイクルタイム計測（AIガバナンス→効果測定タブで直接入力も可） |

キー登録後、**「今すぐ同期」** ボタンを押すと直近30日のトークン使用量が取得できます。

---

## STEP 8 — 動作確認チェックリスト

- [ ] `/login` でログインできる
- [ ] ダッシュボードに契約データが表示される（初期データ11件）
- [ ] AI ガバナンス → 概要タブ：AI契約のROI計算が表示される
- [ ] AI ガバナンス → トークン最適化：「同期」後にモデル別コストが表示される
- [ ] AI ガバナンス → Shadow AI：経費CSVをアップロードするとフラグが立つ
- [ ] AI ガバナンス → 効果測定：GitHubリポジトリ名＋トークン入力→同期でPRサイクルタイムが表示
- [ ] 設定 → APIキー保存・削除ができる

---

## アーキテクチャ全体図

```
ブラウザ (GitHub Pages)
  │  VITE_SUPABASE_URL / ANON_KEY
  │
  ├─→ Supabase (auth + DB)
  │     ├── contracts
  │     ├── api_keys
  │     ├── ai_usage_snapshots
  │     ├── expense_items
  │     └── github_metrics
  │
  └─→ Render (Hono/Bun API)  ← SUPABASE_SERVICE_ROLE_KEY
        ├── POST /api/ai-usage/sync   ← Anthropic/OpenAI Usage API
        ├── GET  /api/ai-usage/summary
        ├── /api/tools
        ├── /api/sync
        ├── /api/contracts
        ├── /api/procurement
        └── /api/negotiate
```

---

## トラブルシューティング

### ログインできない
- Supabase Authentication → Users にユーザーが存在するか確認
- `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY` が正しく設定されているか確認

### 契約データが表示されない
- `supabase/schema.sql` が実行済みか確認（特に INSERT INTO contracts 部分）
- RLSポリシーが有効か確認：SQL Editor で `SELECT * FROM contracts;` が返るか

### 「今すぐ同期」がエラーになる
- Render のバックエンドが起動しているか確認（Render → Logs）
- `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` が Render 環境変数に設定されているか確認
- anthropic/openai の APIキーが設定ページに登録済みか確認

### GitHub Pages でページが表示されない (404)
- `vite.config.ts` の `base` が `/リポジトリ名/` になっているか確認
- GitHub Actions の workflow が成功しているか確認
