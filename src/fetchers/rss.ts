// src/fetchers/rss.ts — RSS/Atom feed fetcher.
import Parser from 'rss-parser';
import { logger } from '../logger.js';

export interface FetchedItem {
  title: string;
  url?: string;
  excerpt?: string;
}

const parser = new Parser({
  timeout: 15000,
  headers: {
    'User-Agent': 'ModelHunter/1.0 (+personal-radar)',
  },
});

export async function fetchRss(url: string): Promise<FetchedItem[]> {
  try {
    const feed = await parser.parseURL(url);
    return (feed.items ?? [])
      .filter(it => it.title)
      .slice(0, 50)
      .map(it => ({
        title: (it.title ?? '').trim(),
        url: it.link || it.guid,
        excerpt: (it.contentSnippet ?? it.content ?? '').slice(0, 500).trim() || undefined,
      }));
  } catch (err: any) {
    logger.warn('rss fetch failed', { url, err: String(err).slice(0, 150) });
    throw err;
  }
}