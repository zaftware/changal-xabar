import Database from 'better-sqlite3';

const db = new Database('data.db');

db.exec(`
CREATE TABLE IF NOT EXISTS posts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  title TEXT,
  title_uz TEXT,
  url TEXT,
  source_url TEXT,
  body TEXT,
  body_uz TEXT,
  published_at TEXT,
  score REAL DEFAULT 0,
  tldr_uz TEXT,
  is_political INTEGER DEFAULT 0,
  published_to_tg INTEGER DEFAULT 0,
  hash TEXT UNIQUE,
  created_at TEXT DEFAULT (datetime('now'))
);
`);

const ensureCols = [
  "ALTER TABLE posts ADD COLUMN title_uz TEXT",
  "ALTER TABLE posts ADD COLUMN source_url TEXT",
  "ALTER TABLE posts ADD COLUMN body_uz TEXT",
  "ALTER TABLE posts ADD COLUMN is_political INTEGER DEFAULT 0",
  "ALTER TABLE posts ADD COLUMN published_to_tg INTEGER DEFAULT 0"
];
for (const sql of ensureCols) {
  try { db.exec(sql); } catch {}
}

export default db;
