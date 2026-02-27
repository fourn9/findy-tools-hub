import { Database } from 'bun:sqlite'
import { join } from 'path'
import { mkdirSync } from 'fs'

const DATA_DIR = join(import.meta.dir, '../data')
mkdirSync(DATA_DIR, { recursive: true })

export const db = new Database(join(DATA_DIR, 'findy-tools.db'))

db.run('PRAGMA journal_mode = WAL')
db.run('PRAGMA foreign_keys = ON')

db.run(`
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
    tags                 TEXT,   -- JSON array
    raw_data             TEXT,   -- JSON
    scraped_at           TEXT    DEFAULT (datetime('now')),
    updated_at           TEXT    DEFAULT (datetime('now'))
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS reviews (
    id                      INTEGER PRIMARY KEY AUTOINCREMENT,
    tool_id                 INTEGER NOT NULL REFERENCES tools(id) ON DELETE CASCADE,
    external_id             TEXT,
    page_path               TEXT,
    title                   TEXT,
    good_point              TEXT,   -- 良い点 (goodPoint1)
    growth_point            TEXT,   -- 改善点 (growthPoint1)
    introduction_background TEXT,   -- 導入背景
    explanation_within_company TEXT, -- 社内への説明
    reviewer_name           TEXT,
    reviewer_avatar_url     TEXT,
    reviewer_job_position   TEXT,   -- CTO, SRE, etc.
    reviewer_job_types      TEXT,   -- JSON array
    company_name            TEXT,
    employee_size           TEXT,
    engineer_employee_size  TEXT,
    labels                  TEXT,   -- JSON array (導入/活用 tags)
    scraped_at              TEXT    DEFAULT (datetime('now')),
    UNIQUE(tool_id, external_id)
  )
`)

db.run(`
  CREATE TABLE IF NOT EXISTS sync_log (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    started_at   TEXT    DEFAULT (datetime('now')),
    completed_at TEXT,
    tools_synced INTEGER DEFAULT 0,
    status       TEXT    DEFAULT 'running',
    error        TEXT
  )
`)

export default db
