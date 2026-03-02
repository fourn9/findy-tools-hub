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
      created_at     TIMESTAMPTZ DEFAULT NOW(),
      updated_at     TIMESTAMPTZ DEFAULT NOW()
    )
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

export default sql
