-- ================================================================
-- Findy Tools Hub — Supabase スキーマ
-- Supabase ダッシュボード → SQL Editor に貼り付けて実行
-- ================================================================

-- ── 1. 契約テーブル ──────────────────────────────────────────────
create table if not exists contracts (
  id            text primary key,
  name          text not null,
  vendor        text,
  category      text,                          -- 'ai_tool' | 'dev_tool' | ...
  plan          text,
  status        text not null default 'active', -- 'active' | 'pending' | 'cancelled'
  monthly_cost  integer not null default 0,
  seats         integer,
  usage_rate    integer,                        -- 0-100 (%)
  contract_end  date,
  department    text,
  usage_type    text,                           -- 'seat' | 'token' | 'usage'
  monthly_tokens bigint,
  engineer_count integer,
  logo_url      text,
  created_at    timestamptz default now()
);

-- ── 2. APIキーテーブル ───────────────────────────────────────────
create table if not exists api_keys (
  id         uuid default gen_random_uuid() primary key,
  provider   text not null unique,             -- 'anthropic' | 'openai' | 'github'
  key_value  text not null,                    -- 実際のキー値（本番では暗号化推奨）
  key_masked text not null,                    -- 表示用マスク文字列
  created_at timestamptz default now()
);

-- ── 3. AI 使用量スナップショット ──────────────────────────────────
create table if not exists ai_usage_snapshots (
  id             uuid default gen_random_uuid() primary key,
  provider       text not null,                -- 'anthropic' | 'openai'
  model          text not null,
  date           date not null,
  input_tokens   bigint default 0,
  output_tokens  bigint default 0,
  cost_usd       numeric(10,4) default 0,
  cost_jpy       integer default 0,
  created_at     timestamptz default now(),
  unique(provider, model, date)
);

-- ── 4. 経費アイテム（Shadow AI 検出用）────────────────────────────
create table if not exists expense_items (
  id                   uuid default gen_random_uuid() primary key,
  date                 date not null,
  description          text not null,
  amount               integer not null,        -- 円
  vendor               text,
  flagged_as_shadow_ai boolean default false,
  shadow_ai_tool       text,                    -- 検出されたツール名
  risk_level           text,                    -- 'high' | 'medium' | 'low'
  uploaded_at          timestamptz default now()
);

-- ── 5. GitHub メトリクス（効果測定用）────────────────────────────
create table if not exists github_metrics (
  id               uuid default gen_random_uuid() primary key,
  repo             text not null,
  week_start       date not null,
  pr_cycle_hours   numeric(6,1),               -- PRマージまでの平均時間
  commits          integer,                     -- 週次コミット数
  prs_merged       integer,
  collected_at     timestamptz default now(),
  unique(repo, week_start)
);

-- ================================================================
-- RLS（Row Level Security）— シングルテナントなのでシンプルに
-- authenticated ユーザー全員が全データにアクセス可
-- ================================================================
alter table contracts            enable row level security;
alter table api_keys             enable row level security;
alter table ai_usage_snapshots   enable row level security;
alter table expense_items        enable row level security;
alter table github_metrics       enable row level security;

create policy "authenticated users can do everything" on contracts
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on api_keys
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on ai_usage_snapshots
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on expense_items
  for all to authenticated using (true) with check (true);
create policy "authenticated users can do everything" on github_metrics
  for all to authenticated using (true) with check (true);

-- ================================================================
-- 初期データ（既存のモックデータを移行）
-- ================================================================
insert into contracts (id, name, vendor, category, plan, status, monthly_cost, seats, usage_rate, department, usage_type, monthly_tokens, engineer_count) values
  ('c1',  'GitHub',              'GitHub',     'dev_tool',      'Enterprise',        'active',   45000,  30,  85, 'エンジニアリング', 'seat',  null,    null),
  ('c2',  'Slack',               'Salesforce', 'communication', 'Pro',               'active',   38000,  50,  92, '全社',             'seat',  null,    null),
  ('c3',  'Datadog',             'Datadog',    'infrastructure','Pro',               'active',   62000,  10,  78, 'SRE',              'seat',  null,    null),
  ('c4',  'Figma',               'Figma',      'dev_tool',      'Organization',      'active',   28000,  15,  70, 'デザイン',         'seat',  null,    null),
  ('c5',  'Notion',              'Notion',     'productivity',  'Business',          'active',   32000,  40,  65, '全社',             'seat',  null,    null),
  ('c6',  'Zoom',                'Zoom',       'communication', 'Business',          'active',   18000,  50,  55, '全社',             'seat',  null,    null),
  ('c7',  'AWS',                 'Amazon',     'infrastructure','PayAsYouGo',        'active',  280000, null, null,'インフラ',         'usage', null,    null),
  ('c8',  'Cursor',              'Anysphere',  'ai_tool',       'Pro',               'pending',  60000,  30,   0, 'エンジニアリング', 'seat',  null,    30),
  ('c9',  'GitHub Copilot',      'GitHub',     'ai_tool',       'Business',          'active',  160000,  40,  70, 'エンジニアリング', 'seat',  null,    40),
  ('c10', 'Claude API (Anthropic)','Anthropic','ai_tool',       'API従量課金',       'active',  185000, null,null,'エンジニアリング', 'token', 12000000,null),
  ('c11', 'ChatGPT Team',        'OpenAI',     'ai_tool',       'Team',              'active',   75000,  15,  60, 'プロダクト',       'seat',  null,    null)
on conflict (id) do nothing;
