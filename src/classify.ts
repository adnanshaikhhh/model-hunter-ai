// src/classify.ts — batch classification of unprocessed items.
import { classifyMany } from './llm.js';
import { logger } from './logger.js';
import type { DB, Item } from './types.js';

export async function classifyUnprocessed(db: DB, limit = 30): Promise<{ scored: number; errors: number }> {
  const items = await db.getUnprocessedItems(limit);
  if (items.length === 0) {
    logger.debug('classify: no unprocessed items');
    return { scored: 0, errors: 0 };
  }
  logger.info('classify starting', { count: items.length });
  const inputs = items.map(it => ({ title: it.title, excerpt: it.excerpt ?? '' }));
  const verdicts = await classifyMany(inputs);
  let scored = 0;
  let errors = 0;
  for (let i = 0; i < items.length; i++) {
    const v = verdicts[i];
    if (v) {
      await db.updateItemVerdict(items[i].id, v);
      scored += 1;
    } else {
      // All providers failed — mark as scored-not-opp so we don't retry next run
      await db.updateItemVerdict(items[i].id, {
        is_opportunity: false,
        opp_type: null,
        relevance: 0,
        summary: '(classifier failed all providers)',
        deadline: null,
      });
      errors += 1;
    }
  }
  logger.info('classify complete', { scored, errors });
  return { scored, errors };
}
