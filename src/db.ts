// src/db.ts — DB adapter. SQLite (default) or Supabase Postgres.
// Schema is identical at the SQL level (sql/schema.sql). Adapter exposes a uniform DB interface.

import Database from 'better-sqlite3';
import { promises as fs } from 'fs';
import * as path from 'path';
import { config } from './config.js';
import { logger } from './logger.js';
import type { DB, Source, RawItem, Item, Verdict } from './types.js';

// ----- SQLite impl -----

class SqliteDB implements DB {
  private db: Database.Database;

  constructor(filePath: string) {
    this.db = new Database(filePath);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  async init(): Promise<void> {
    const schemaPath = path.join(process.cwd(), 'sql', 'schema.sql');
    let schemaSql: string;
    try {
      schemaSql = await fs.readFile(schemaPath, 'utf-8');
    } catch {
      schemaSql = SQLITE_SCHEMA_FALLBACK;
    }
    this.db.exec(schemaSql);
    logger.info('sqlite schema initialized', { path: this.db.name });
  }

  async getActiveSources(): Promise<Source[]> {
    return this.db.prepare('SELECT * FROM sources WHERE active = 1 ORDER BY id').all() as Source[];
  }

  async markSourceChecked(id: number, status: string): Promise<void> {
    this.db.prepare('UPDATE sources SET last_checked = ?, last_status = ? WHERE id = ?')
      .run(new Date().toISOString(), status, id);
  }

  async insertItem(item: RawItem): Promise<number | null> {
    const stmt = this.db.prepare(
      'INSERT OR IGNORE INTO items (source_id, content_hash, title, url, raw_excerpt, discovered_at) VALUES (?, ?, ?, ?, ?, ?)'
    );
    const result = stmt.run(item.source_id, item.content_hash, item.title, item.url ?? null, item.excerpt ?? null, item.discovered_at);
    if (result.changes === 0) return null; // duplicate
    return Number(result.lastInsertRowid);
  }

  async updateItemVerdict(id: number, v: Verdict): Promise<void> {
    this.db.prepare(
      'UPDATE items SET is_opportunity = ?, opp_type = ?, relevance = ?, summary = ?, deadline = ?, status = ?, processed_at = ? WHERE id = ?'
    ).run(
      v.is_opportunity ? 1 : 0,
      v.opp_type,
      v.relevance,
      v.summary,
      v.deadline,
      v.is_opportunity ? 'scored' : 'scored-not-opp',
      new Date().toISOString(),
      id,
    );
  }

  async getUnprocessedItems(limit = 50): Promise<Item[]> {
    return this.db.prepare(
      "SELECT * FROM items WHERE status = 'new' ORDER BY discovered_at DESC LIMIT ?"
    ).all(limit) as Item[];
  }

  async getItemsForAlert(threshold: number): Promise<Item[]> {
    return this.db.prepare(
      "SELECT * FROM items WHERE status = 'scored' AND relevance >= ? AND is_opportunity = 1 ORDER BY relevance DESC, discovered_at DESC LIMIT 20"
    ).all(threshold) as Item[];
  }

  async markItemAlerted(id: number): Promise<void> {
    this.db.prepare("UPDATE items SET status = 'alerted' WHERE id = ?").run(id);
  }

  async logAlert(itemId: number, channel: string, success: boolean, error?: string): Promise<void> {
    this.db.prepare(
      'INSERT INTO alerts (item_id, channel, success, error) VALUES (?, ?, ?, ?)'
    ).run(itemId, channel, success ? 1 : 0, error ?? null);
  }

  async countItemsSince(iso: string): Promise<number> {
    const row = this.db.prepare('SELECT COUNT(*) as c FROM items WHERE discovered_at >= ?').get(iso) as { c: number };
    return row.c;
  }

  async countFailedSources(): Promise<number> {
    const row = this.db.prepare(
      "SELECT COUNT(*) as c FROM sources WHERE last_status IS NOT NULL AND last_status != 'ok'"
    ).get() as { c: number };
    return row.c;
  }

  async countSourcesCheckedLast24h(): Promise<number> {
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const row = this.db.prepare('SELECT COUNT(*) as c FROM sources WHERE last_checked >= ?').get(since) as { c: number };
    return row.c;
  }

  close() {
    this.db.close();
  }
}

// Inline fallback schema (used if sql/schema.sql not found at runtime)
const SQLITE_SCHEMA_FALLBACK = `
CREATE TABLE IF NOT EXISTS sources (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('rss','json','html')),
  parser_hint TEXT, category TEXT,
  active INTEGER DEFAULT 1,
  last_checked TEXT, last_status TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id INTEGER REFERENCES sources(id),
  content_hash TEXT UNIQUE NOT NULL,
  title TEXT NOT NULL, url TEXT, raw_excerpt TEXT,
  is_opportunity INTEGER, opp_type TEXT, relevance INTEGER,
  summary TEXT, deadline TEXT,
  status TEXT DEFAULT 'new',
  discovered_at TEXT DEFAULT (datetime('now')),
  processed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_items_relevance ON items(relevance DESC);
CREATE INDEX IF NOT EXISTS idx_items_discovered ON items(discovered_at DESC);
CREATE INDEX IF NOT EXISTS idx_items_status ON items(status);
CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  item_id INTEGER REFERENCES items(id),
  channel TEXT NOT NULL,
  sent_at TEXT DEFAULT (datetime('now')),
  success INTEGER, error TEXT
);
`;

// ----- Factory -----

let _instance: DB | null = null;

export async function getDB(): Promise<DB> {
  if (_instance) return _instance;
  if (config.useSupabase) {
    // Future: implement SupabaseDB adapter (PostgREST + service role key)
    // For now, log warning and fall back to SQLite
    logger.warn('Supabase adapter not implemented yet — using SQLite');
  }
  // Ensure data dir exists
  const dbPath = config.sqlitePath;
  await fs.mkdir(path.dirname(dbPath), { recursive: true });
  const sqlite = new SqliteDB(dbPath);
  await sqlite.init();
  _instance = sqlite;
  return _instance;
}

export function closeDB() {
  if (_instance && 'close' in _instance) {
    (_instance as SqliteDB).close();
  }
  _instance = null;
}