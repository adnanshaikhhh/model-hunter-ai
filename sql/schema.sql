-- MODEL HUNTER AI — Database Schema
-- Postgres-compatible (runs on Supabase in production, SQLite in local dev via db adapter)
-- Blueprint Section 15.

-- SOURCES: the curated registry of what to watch
CREATE TABLE IF NOT EXISTS sources (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  url           TEXT NOT NULL,
  type          TEXT NOT NULL CHECK (type IN ('rss','json','html')),
  parser_hint   TEXT,
  category      TEXT,
  active        INTEGER DEFAULT 1,
  last_checked  TEXT,
  last_status   TEXT,
  created_at    TEXT DEFAULT (datetime('now'))
);

-- ITEMS: every discovered opportunity (append-only, deduped)
CREATE TABLE IF NOT EXISTS items (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id       INTEGER REFERENCES sources(id),
  content_hash    TEXT UNIQUE NOT NULL,
  title           TEXT NOT NULL,
  url             TEXT,
  raw_excerpt     TEXT,
  is_opportunity  INTEGER,
  opp_type        TEXT,
  relevance       INTEGER,
  summary         TEXT,
  deadline        TEXT,
  status          TEXT DEFAULT 'new',
  discovered_at   TEXT DEFAULT (datetime('now')),
  processed_at    TEXT
);

CREATE INDEX IF NOT EXISTS idx_items_relevance ON items(relevance DESC);
CREATE INDEX IF NOT EXISTS idx_items_discovered ON items(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_opp_type ON items(opp_type);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);

-- ALERTS: log of every notification sent
CREATE TABLE IF NOT EXISTS alerts (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id   INTEGER REFERENCES items(id),
  channel   TEXT NOT NULL,
  sent_at   TEXT DEFAULT (datetime('now')),
  success   INTEGER,
  error     TEXT
);

CREATE INDEX IF NOT EXISTS idx_alerts_item ON alerts(item_id);