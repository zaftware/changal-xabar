import Database from 'better-sqlite3';

const db = new Database('data.db');

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  intake_type TEXT DEFAULT 'feed',
  title TEXT,
  title_uz TEXT,
  url TEXT,
  source_url TEXT,
  duplicate_key TEXT,
  body TEXT,
  body_uz TEXT,
  published_at TEXT,
  score REAL DEFAULT 0,
  score_details TEXT,
  tldr_uz TEXT,
  is_political INTEGER DEFAULT 0,
  workflow_status TEXT DEFAULT 'candidate',
  priority INTEGER DEFAULT 0,
  published_to_tg INTEGER DEFAULT 0,
  drafted_at TEXT,
  reviewed_at TEXT,
  approved_at TEXT,
  rejected_at TEXT,
  tg_published_at TEXT,
  last_error TEXT,
  hash TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now')),
  updated_at TEXT DEFAULT (datetime('now'))
);
`);

const ensureCols = [
  "ALTER TABLE posts ADD COLUMN intake_type TEXT DEFAULT 'feed'",
  "ALTER TABLE posts ADD COLUMN title_uz TEXT",
  "ALTER TABLE posts ADD COLUMN source_url TEXT",
  "ALTER TABLE posts ADD COLUMN duplicate_key TEXT",
  "ALTER TABLE posts ADD COLUMN body_uz TEXT",
  "ALTER TABLE posts ADD COLUMN score_details TEXT",
  "ALTER TABLE posts ADD COLUMN is_political INTEGER DEFAULT 0",
  "ALTER TABLE posts ADD COLUMN workflow_status TEXT DEFAULT 'candidate'",
  "ALTER TABLE posts ADD COLUMN priority INTEGER DEFAULT 0",
  "ALTER TABLE posts ADD COLUMN published_to_tg INTEGER DEFAULT 0",
  "ALTER TABLE posts ADD COLUMN drafted_at TEXT",
  "ALTER TABLE posts ADD COLUMN reviewed_at TEXT",
  "ALTER TABLE posts ADD COLUMN approved_at TEXT",
  "ALTER TABLE posts ADD COLUMN rejected_at TEXT",
  "ALTER TABLE posts ADD COLUMN tg_published_at TEXT",
  "ALTER TABLE posts ADD COLUMN last_error TEXT",
  "ALTER TABLE posts ADD COLUMN updated_at TEXT DEFAULT (datetime('now'))"
];
for (const sql of ensureCols) {
  try { db.exec(sql); } catch {}
}

db.exec(`
CREATE INDEX IF NOT EXISTS idx_posts_workflow_status
ON posts(workflow_status, priority DESC, score DESC, id DESC);

CREATE INDEX IF NOT EXISTS idx_posts_duplicate_key
ON posts(duplicate_key);
`);

db.exec(`
UPDATE posts
SET intake_type = CASE
  WHEN source = 'manual' THEN 'manual'
  ELSE 'feed'
END
WHERE intake_type IS NULL;

UPDATE posts
SET duplicate_key = COALESCE(NULLIF(url, ''), NULLIF(source_url, ''), hash)
WHERE duplicate_key IS NULL;

UPDATE posts
SET workflow_status = CASE
  WHEN published_to_tg = 1 THEN 'published'
  WHEN published_to_tg = -1 THEN 'rejected'
  ELSE 'candidate'
END
WHERE workflow_status IS NULL;

UPDATE posts
SET priority = 0
WHERE priority IS NULL;

UPDATE posts
SET updated_at = COALESCE(updated_at, created_at, datetime('now'))
WHERE updated_at IS NULL;
`);

export default db;
