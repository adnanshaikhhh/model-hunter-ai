// src/fetchers/html.ts — Plain HTML fallback (avoid for most sources).
import { logger } from '../logger.js';
import type { FetchedItem } from './rss.js';

export async function fetchHtml(url: string, selector?: string): Promise<FetchedItem[]> {
  // Blueprint §16: avoid headless browsers in MVP. Placeholder for rare cases.
  logger.warn('html fetch called (not implemented in MVP)', { url, hasSelector: !!selector });
  return [];
}