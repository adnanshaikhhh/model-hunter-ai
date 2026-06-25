// src/heartbeat.ts — daily liveness summary message.
import { config } from './config.js';
import { logger } from './logger.js';
import { sendTelegram } from './notify/telegram.js';
import type { DB } from './types.js';

export async function maybeHeartbeat(db: DB): Promise<boolean> {
  const now = new Date();
  if (now.getUTCHours() !== config.heartbeatHourUtc) return false;

  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const [items24, failed, checked] = await Promise.all([
    db.countItemsSince(since24h),
    db.countFailedSources(),
    db.countSourcesCheckedLast24h(),
  ]);
  const text = '💚 Model Hunter — daily heartbeat\n' +
    '• Sources checked (24h): ' + checked + '\n' +
    '• Items discovered (24h): ' + items24 + '\n' +
    '• Sources failing: ' + failed + '\n' +
    '• Threshold: ' + config.relevanceThreshold + '\n' +
    '• Cost: $0.00';

  try {
    if (config.dryRun) {
      logger.info('DRY_RUN heartbeat', { text });
    } else {
      await sendTelegram(text);
      logger.info('heartbeat sent');
    }
    return true;
  } catch (err: any) {
    logger.warn('heartbeat failed', { err: String(err).slice(0, 200) });
    return false;
  }
}
