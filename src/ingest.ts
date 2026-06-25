// src/ingest.ts — normalize + hash + dedupe-insert items per source.
import { createHash } from 'crypto';
import { fetchRss } from './fetchers/rss.js';
import { fetchJson } from './fetchers/json.js';
import { fetchHtml } from './fetchers/html.js';
import { logger } from './logger.js';
import type { DB, Source } from './types.js';

export interface IngestResult {
  source: string;
  fetched: number;
  newItems: number;
  duplicates: number;
  status: 'ok' | 'error';
  error?: string;
}

function normalizeTitle(t: string): string {
  return t.replace(/\s+/g, ' ').trim().slice(0, 300);
}

function contentHash(sourceId: number, title: string, url?: string): string {
  const norm = normalizeTitle(title).toLowerCase();
  const u = (url || '').split('?')[0].split('#')[0];
  return createHash('sha256').update(sourceId + '|' + norm + '|' + u).digest('hex');
}

async function fetchForSource(s: Source) {
  if (s.type === 'rss') return await fetchRss(s.url);
  if (s.type === 'json') return await fetchJson(s.url, s.parser_hint ?? undefined);
  if (s.type === 'html') return await fetchHtml(s.url, s.parser_hint ?? undefined);
  return [];
}

export async function ingestSource(db: DB, s: Source): Promise<IngestResult> {
  const name = s.name;
  try {
    const items = await fetchForSource(s);
    let newItems = 0;
    let duplicates = 0;
    const now = new Date().toISOString();
    for (const it of items) {
      const hash = contentHash(s.id, it.title, it.url);
      const id = await db.insertItem({
        source_id: s.id,
        title: normalizeTitle(it.title),
        url: it.url,
        excerpt: it.excerpt,
        content_hash: hash,
        discovered_at: now,
      });
      if (id === null) duplicates += 1;
      else newItems += 1;
    }
    await db.markSourceChecked(s.id, 'ok');
    return { source: name, fetched: items.length, newItems, duplicates, status: 'ok' };
  } catch (err: any) {
    const msg = String(err).slice(0, 200);
    await db.markSourceChecked(s.id, 'error: ' + msg);
    logger.warn('ingest source failed', { source: name, err: msg });
    return { source: name, fetched: 0, newItems: 0, duplicates: 0, status: 'error', error: msg };
  }
}

export async function ingestAll(db: DB): Promise<IngestResult[]> {
  const sources = await db.getActiveSources();
  logger.info('ingest starting', { sourceCount: sources.length });
  const results: IngestResult[] = [];
  for (const s of sources) {
    results.push(await ingestSource(db, s));
  }
  const ok = results.filter(r => r.status === 'ok').length;
  const err = results.length - ok;
  const totalNew = results.reduce((a, r) => a + r.newItems, 0);
  const totalDup = results.reduce((a, r) => a + r.duplicates, 0);
  logger.info('ingest complete', { sources: results.length, ok, err, newItems: totalNew, duplicates: totalDup });
  return results;
}