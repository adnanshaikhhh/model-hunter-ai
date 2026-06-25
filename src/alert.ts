// src/alert.ts — select threshold items + send via Telegram (primary) + Email (backup) + log + idempotent status gating.
import { config } from './config.js';
import { logger } from './logger.js';
import { formatTelegramMessage, sendTelegram } from './notify/telegram.js';
import { sendEmail } from './notify/email.js';
import { applyRankingBoosts } from './rank.js';
import type { DB } from './types.js';

export async function runAlerts(db: DB): Promise<{ alerted: number; telegramOk: number; emailOk: number }> {
  const items = await db.getItemsForAlert(config.relevanceThreshold);
  if (items.length === 0) {
    logger.debug('alert: no items above threshold', { threshold: config.relevanceThreshold });
    return { alerted: 0, telegramOk: 0, emailOk: 0 };
  }
  logger.info('alert: processing items', { count: items.length, threshold: config.relevanceThreshold });
  let telegramOk = 0;
  let emailOk = 0;
  let alerted = 0;
  for (const item of items) {
    const finalScore = applyRankingBoosts(item);
    const text = formatTelegramMessage(item);

    // Telegram (primary)
    try {
      if (config.dryRun) {
        logger.info('DRY_RUN: would send telegram', { item_id: item.id, score: finalScore });
      } else {
        await sendTelegram(text);
        await db.logAlert(item.id, 'telegram', true);
        telegramOk += 1;
      }
    } catch (err: any) {
      const msg = String(err).slice(0, 200);
      logger.warn('telegram send failed', { item_id: item.id, err: msg });
      await db.logAlert(item.id, 'telegram', false, msg).catch(() => {});
    }

    // Email (backup)
    try {
      if (config.dryRun) {
        logger.info('DRY_RUN: would send email', { item_id: item.id, score: finalScore });
      } else {
        await sendEmail(item);
        await db.logAlert(item.id, 'email', true);
        emailOk += 1;
      }
    } catch (err: any) {
      const msg = String(err).slice(0, 200);
      logger.warn('email send failed', { item_id: item.id, err: msg });
      await db.logAlert(item.id, 'email', false, msg).catch(() => {});
    }

    // Mark alerted regardless (idempotent — won't re-alert since query filters status='scored')
    await db.markItemAlerted(item.id);
    alerted += 1;
  }
  logger.info('alert complete', { alerted, telegramOk, emailOk });
  return { alerted, telegramOk, emailOk };
}
