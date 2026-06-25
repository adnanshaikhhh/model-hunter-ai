// src/notify/telegram.ts — Telegram Bot API sender.
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { Item } from '../types.js';
import { applyRankingBoosts } from '../rank.js';

export function formatTelegramMessage(item: Item): string {
  const finalScore = applyRankingBoosts(item);
  const typeLabel = item.opp_type ? item.opp_type.replace('_', ' ') : 'opportunity';
  const deadline = item.deadline ? '\nDeadline: ' + item.deadline : '';
  return (
    '🛰️ Model Hunter — NEW OPPORTUNITY [score ' + finalScore + ']\n' +
    'Type: ' + typeLabel + '\n' +
    '💡 ' + (item.summary || item.title) + '\n' +
    (item.deadline ? '⏳ Deadline: ' + item.deadline + '\n' : '') +
    '🔗 ' + (item.url || '(no link)')
  );
}

export async function sendTelegram(text: string): Promise<void> {
  const token = config.telegramBotToken;
  const chatId = config.telegramChatId;
  if (!token || !chatId) {
    throw new Error('Telegram not configured (TELEGRAM_BOT_TOKEN / TELEGRAM_CHAT_ID)');
  }
  const url = 'https://api.telegram.org/bot' + token + '/sendMessage';
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: false }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('Telegram HTTP ' + res.status + ': ' + body.slice(0, 200));
  }
  logger.info('telegram sent', { len: text.length });
}
