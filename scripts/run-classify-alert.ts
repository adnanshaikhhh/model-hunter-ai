// scripts/run-classify-alert.ts — Quick: classify unprocessed items + send alerts.
import { getDB, closeDB } from '../src/db.js';
import { classifyUnprocessed } from '../src/classify.js';
import { runAlerts } from '../src/alert.js';
import { logger } from '../src/logger.js';

async function main() {
  const db = await getDB();
  try {
    const c = await classifyUnprocessed(db, 20);
    const a = await runAlerts(db);
    logger.info('done', { classified: c.scored, errors: c.errors, alerted: a.alerted });
  } finally {
    closeDB();
  }
}
main();