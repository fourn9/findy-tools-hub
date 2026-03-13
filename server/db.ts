import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error(
    'DATABASE_URL is not set.\n' +
      'ローカル開発: .env.example をコピーして .env を作成してください。\n' +
      'Render: Dashboard の Environment Variables に DATABASE_URL を追加してください。',
  )
}

export const sql = postgres(process.env.DATABASE_URL, {
  max: 10,
  idle_timeout: 20,
  connect_timeout: 10,
  // Render の PostgreSQL は自己署名証明書を使うため production では検証を緩和する
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
})

export async function initDb(): Promise<void> {
  await sql`
    CREATE TABLE IF NOT EXISTS tools (
      id                   INTEGER PRIMARY KEY,
      alias                TEXT    UNIQUE NOT NULL,
      page_path            TEXT,
      name                 TEXT    NOT NULL,
      description          TEXT,
      logo_url             TEXT,
      reviews_count        INTEGER DEFAULT 0,
      vendor_id            INTEGER,
      vendor_name          TEXT,
      is_trial             INTEGER DEFAULT 0,
      is_japanese_support  INTEGER DEFAULT 0,
      is_customer_success  INTEGER DEFAULT 0,
      use_company_count    INTEGER,
      tags                 TEXT,
      raw_data             TEXT,
      scraped_at           TIMESTAMPTZ DEFAULT NOW(),
      updated_at           TIMESTAMPTZ DEFAULT NOW()
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS reviews (
      id                         SERIAL PRIMARY KEY,
      tool_id                    INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
      external_id                TEXT,
      page_path                  TEXT,
      title                      TEXT,
      good_point                 TEXT,
      growth_point               TEXT,
      introduction_background    TEXT,
      explanation_within_company TEXT,
      reviewer_name              TEXT,
      reviewer_avatar_url        TEXT,
      reviewer_job_position      TEXT,
      reviewer_job_types         TEXT,
      company_name               TEXT,
      employee_size              TEXT,
      engineer_employee_size     TEXT,
      labels                     TEXT,
      scraped_at                 TIMESTAMPTZ DEFAULT NOW(),
      UNIQUE(tool_id, external_id)
    )
  `

  await sql`
    CREATE TABLE IF NOT EXISTS sync_log (
      id           SERIAL PRIMARY KEY,
      started_at   TIMESTAMPTZ DEFAULT NOW(),
      completed_at TIMESTAMPTZ,
      tools_synced INTEGER DEFAULT 0,
      status       TEXT DEFAULT 'running',
      error        TEXT
    )
  `

  // ────────────────────────────────────────
  // SaaS Intelligence Platform テーブル
  // ────────────────────────────────────────

  await sql`
    CREATE TABLE IF NOT EXISTS contracts (
      id             SERIAL PRIMARY KEY,
      tool_alias     TEXT,                       -- Findy Tools カタログの alias (任意)
      tool_name      TEXT    NOT NULL,
      tool_logo_url  TEXT,
      status         TEXT    NOT NULL DEFAULT 'active',
                                                 -- active | trial | pending | expired | cancelled
      plan           TEXT,
      seats          INTEGER NOT NULL DEFAULT 0,
      used_seats     INTEGER NOT NULL DEFAULT 0,
      monthly_amount INTEGER NOT NULL DEFAULT 0,
      billing_cycle  TEXT    NOT NULL DEFAULT 'monthly', -- monthly | yearly
      start_date     DATE,
      renewal_date   DATE,
      owner          TEXT,
      department     TEXT,
      notes          TEXT,
      category       TEXT    NOT NULL DEFAULT 'other',
                                                 -- ai_tool | dev_tool | productivity | communication | security | hr | finance | other
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
  `

  // カラムが存在しない場合のみ追加（既存 DB へのマイグレーション）
  await sql`
    ALTER TABLE contracts ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'other'
  `

  await sql`
    CREATE TABLE IF NOT EXISTS procurement_requests (
      id               SERIAL PRIMARY KEY,
      tool_alias       TEXT,
      tool_name        TEXT NOT NULL,
      tool_logo_url    TEXT,
      requester_name   TEXT NOT NULL,
      requester_email  TEXT,
      status           TEXT NOT NULL DEFAULT 'reviewing',
                                                  -- draft | reviewing | approved | rejected | contracted
      reason           TEXT,
      expected_seats   INTEGER DEFAULT 0,
      monthly_budget   INTEGER DEFAULT 0,
      priority         TEXT DEFAULT 'medium',     -- low | medium | high
      approver_name    TEXT,
      approver_comment TEXT,
      approved_at      TIMESTAMPTZ,
      created_at       TIMESTAMPTZ DEFAULT NOW(),
      updated_at       TIMESTAMPTZ DEFAULT NOW()
    )
  `
}

// ────────────────────────────────────────
// シードデータ（テーブルが空の場合のみ投入）
// ────────────────────────────────────────
export async function seedDb(): Promise<void> {
  const [{ count: contractCount }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) AS count FROM contracts
  `
  if (Number(contractCount) === 0) {
    console.log('🌱 contracts テーブルが空 → モックデータを投入します')
    await sql`
      INSERT INTO contracts
        (tool_name, tool_logo_url, status, plan, seats, used_seats, monthly_amount,
         billing_cycle, start_date, renewal_date, owner, department, category)
      VALUES
        ('GitHub',                'https://cdn.simpleicons.org/github/181717',    'active',  'Enterprise',   30, 26,  45000, 'monthly', '2023-04-01', '2025-03-31', '田中 一郎', 'エンジニアリング', 'dev_tool'),
        ('Slack',                 'https://cdn.simpleicons.org/slack/4A154B',     'active',  'Pro',          50, 46,  38000, 'monthly', '2023-01-01', '2025-12-31', '鈴木 花子', '全社',             'communication'),
        ('Datadog',               'https://cdn.simpleicons.org/datadog/632CA6',   'active',  'Pro',          10,  8,  62000, 'monthly', '2024-01-01', '2025-12-31', '佐藤 次郎', 'SRE',              'dev_tool'),
        ('Figma',                 'https://cdn.simpleicons.org/figma/F24E1E',     'active',  'Organization', 15, 11,  28000, 'monthly', '2023-07-01', '2025-06-30', '高橋 美咲', 'デザイン',         'dev_tool'),
        ('Notion',                'https://cdn.simpleicons.org/notion/000000',    'active',  'Business',     40, 26,  32000, 'monthly', '2022-10-01', '2025-09-30', '伊藤 健司', '全社',             'productivity'),
        ('Zoom',                  'https://cdn.simpleicons.org/zoom/2D8CFF',      'active',  'Business',     50, 28,  18000, 'monthly', '2022-04-01', '2025-03-31', '渡辺 明',   '全社',             'communication'),
        ('GitHub Copilot',        'https://cdn.simpleicons.org/github/181717',    'active',  'Business',     40, 28, 160000, 'monthly', '2024-04-01', '2025-03-31', '田中 一郎', 'エンジニアリング', 'ai_tool'),
        ('Claude API (Anthropic)','https://cdn.simpleicons.org/anthropic/D97757', 'active',  'API従量課金',   0,  0, 185000, 'monthly', '2024-06-01', '2025-05-31', '山田 竜也', 'エンジニアリング', 'ai_tool'),
        ('ChatGPT Team',          'https://cdn.simpleicons.org/openai/412991',    'active',  'Team',         15,  9,  75000, 'monthly', '2024-03-01', '2025-02-28', '中村 奈々', 'プロダクト',       'ai_tool'),
        ('Cursor',                'https://cdn.simpleicons.org/cursor/000000',    'pending', 'Pro',          30,  0,  60000, 'monthly', '2025-04-01', '2026-03-31', '田中 一郎', 'エンジニアリング', 'ai_tool'),
        ('AWS',                   'https://cdn.simpleicons.org/amazonaws/FF9900', 'active',  'PayAsYouGo',    0,  0, 280000, 'monthly', '2020-01-01', NULL,          '小林 隆',   'インフラ',         'other')
    `
  }

  const [{ count: procCount }] = await sql<[{ count: string }]>`
    SELECT COUNT(*) AS count FROM procurement_requests
  `
  if (Number(procCount) === 0) {
    console.log('🌱 procurement_requests テーブルが空 → モックデータを投入します')
    await sql`
      INSERT INTO procurement_requests
        (tool_name, tool_logo_url, requester_name, requester_email, status,
         reason, expected_seats, monthly_budget, priority, approver_name, approver_comment, approved_at)
      VALUES
        ('Cursor',         'https://cdn.simpleicons.org/cursor/000000',  '田中 一郎', 'tanaka@example.com',    'reviewing',  'GitHub Copilot と比較してコード補完の精度が高く、エンジニア30名の生産性向上が見込まれます。', 30, 60000, 'high',   NULL,        NULL,                                              NULL),
        ('Perplexity Pro', '',                                           '中村 奈々', 'nakamura@example.com',  'approved',   'リサーチ業務の効率化。競合調査や技術調査の時間を50%削減できる見込みです。',                    5, 15000, 'medium', '山本 部長', '試験導入として承認。3ヶ月後に効果測定を実施してください。', '2026-03-08'),
        ('Dify',           '',                                           '山田 竜也', 'yamada@example.com',    'reviewing',  'LLM アプリ開発基盤として。現在個別に実装しているプロンプト管理を一元化したい。',                10, 45000, 'high',   NULL,        NULL,                                              NULL),
        ('Linear',         'https://cdn.simpleicons.org/linear/5E6AD2',  '田中 一郎', 'tanaka@example.com',    'contracted', 'Jira から移行。エンジニアチームの Issue 管理・スプリント計画の改善。',                           25, 35000, 'medium', '山本 部長', '承認。来月から移行プロジェクト開始。',                    '2026-02-11'),
        ('Figma Dev Mode', 'https://cdn.simpleicons.org/figma/F24E1E',   '高橋 美咲', 'takahashi@example.com', 'rejected',   '既存の Figma Organization プランで Dev Mode が利用可能になったため不要と判断。',                 15, 20000, 'low',    '山本 部長', '既存契約に含まれているため却下。IT部門に確認を。',         NULL)
    `
  }
}

export default sql
