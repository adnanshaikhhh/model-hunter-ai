// src/notify/email.ts — Resend email backup.
import { config } from '../config.js';
import { logger } from '../logger.js';
import type { Item } from '../types.js';
import { applyRankingBoosts } from '../rank.js';

export function formatEmailBody(item: Item): { subject: string; html: string; text: string } {
  const finalScore = applyRankingBoosts(item);
  const subject = '[Model Hunter ' + finalScore + '] ' + (item.summary || item.title).slice(0, 80);
  const text =
    'Score: ' + finalScore + '\n' +
    'Type: ' + (item.opp_type || 'unknown') + '\n' +
    'Title: ' + item.title + '\n' +
    (item.deadline ? 'Deadline: ' + item.deadline + '\n' : '') +
    'Link: ' + (item.url || '(no link)') + '\n\n' +
    (item.raw_excerpt || '');
  const html = '<h2>🛰️ Model Hunter — ' + finalScore + '</h2>' +
    '<p><b>' + (item.summary || item.title) + '</b></p>' +
    '<p>Type: ' + (item.opp_type || 'unknown') + '<br>' +
    (item.deadline ? 'Deadline: ' + item.deadline + '<br>' : '') +
    '<a href="' + (item.url || '#') + '">Open opportunity →</a></p>' +
    (item.raw_excerpt ? '<hr><p><small>' + item.raw_excerpt.slice(0, 800) + '</small></p>' : '');
  return { subject, html, text };
}

export async function sendEmail(item: Item): Promise<void> {
  const apiKey = config.resendApiKey;
  const to = config.alertEmailTo;
  if (!apiKey || !to) {
    throw new Error('Email not configured (RESEND_API_KEY / ALERT_EMAIL_TO)');
  }
  const { subject, html, text } = formatEmailBody(item);
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: config.alertEmailFrom,
      to: [to],
      subject,
      html,
      text,
    }),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error('Resend HTTP ' + res.status + ': ' + body.slice(0, 200));
  }
  logger.info('email sent', { to, subject });
}
