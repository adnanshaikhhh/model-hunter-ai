// src/index.ts — entrypoint: runs full pipeline.
import { getDB, closeDB } from './db.js';
import { config } from './config.js';
import { logger } from './logger.js';
import { ingestAll } from './ingest.js';
import { classifyUnprocessed } from './classify.js';
import { runAlerts } from './alert.js';
import { maybeHeartbeat } from './heartbeat.js';

async function main() {
  const start = Date.now();
  logger.info('=== Model Hunter run start ===', { dryRun: config.dryRun, threshold: config.relevanceThreshold });
  const db = await getDB();

  try {
    // T3: ingest all active sources
    const ingestResults = await ingestAll(db);
    const errSources = ingestResults.filter(r => r.status === 'error').map(r => r.source);
    if (errSources.length > 0) {
      logger.warn('sources with errors', { count: errSources.length, names: errSources });
    }

    // T4: classify new items
    const classifyResult = await classifyUnprocessed(db, 30);

    // T6+T7: alert
    const alertResult = await runAlerts(db);

    // T8: heartbeat (only at configured UTC hour)
    const heartbeatSent = await maybeHeartbeat(db);

    const elapsed = ((Date.now() - start) / 1000).toFixed(1);
    logger.info('=== Model Hunter run complete ===', {
      elapsed_s: elapsed,
      sources_errored: errSources.length,
      classified: classifyResult.scored,
      classify_errors: classifyResult.errors,
      alerted: alertResult.alerted,
      telegram_ok: alertResult.telegramOk,
      email_ok: alertResult.emailOk,
      heartbeat_sent: heartbeatSent,
    });
  } catch (err: any) {
    logger.error('pipeline fatal error', { err: String(err).slice(0, 300), stack: err.stack?.slice(0, 500) });
    process.exitCode = 1;
  } finally {
    closeDB();
  }
}

main();
