// src/fetchers/json.ts — JSON API fetcher (HN Algolia, Reddit, GitHub, etc.).
import { logger } from '../logger.js';
import type { FetchedItem } from './rss.js';

export async function fetchJson(url: string, hint?: string): Promise<FetchedItem[]> {
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'ModelHunter/1.0 (+personal-radar)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    return normalize(data, hint);
  } catch (err: any) {
    logger.warn('json fetch failed', { url, err: String(err).slice(0, 150) });
    throw err;
  }
}

function normalize(data: any, hint?: string): FetchedItem[] {
  if (Array.isArray(data?.hits)) {
    return data.hits.slice(0, 50).map((h: any) => ({
      title: h.title || h.story_title || '',
      url: h.url || h.story_url || ('https://news.ycombinator.com/item?id=' + h.objectID),
      excerpt: (h.story_text || h.comment_text || '').replace(/<[^>]+>/g, '').slice(0, 500),
    })).filter((i: FetchedItem) => i.title);
  }
  if (Array.isArray(data?.data?.children)) {
    return data.data.children.slice(0, 50).map((c: any) => {
      const d = c.data || {};
      return {
        title: d.title || '',
        url: d.url_overridden_by_dest || d.url || ('https://reddit.com' + d.permalink),
        excerpt: (d.selftext || '').slice(0, 500),
      };
    }).filter((i: FetchedItem) => i.title);
  }
  if (Array.isArray(data) && data[0]?.html_url?.includes('github.com')) {
    return data.slice(0, 30).map((r: any) => ({
      title: r.name || r.tag_name || '',
      url: r.html_url,
      excerpt: (r.body || '').slice(0, 500),
    })).filter((i: FetchedItem) => i.title);
  }
  if (Array.isArray(data)) {
    return data.slice(0, 50).map((it: any) => ({
      title: it.title ?? it.name ?? '',
      url: it.url ?? it.link ?? it.html_url,
      excerpt: (it.excerpt ?? it.description ?? it.body ?? it.text ?? '').toString().slice(0, 500),
    })).filter((i: FetchedItem) => i.title);
  }
  logger.warn('json normalize: unrecognized shape', { hint: hint?.slice(0, 50) });
  return [];
}