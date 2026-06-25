import { getDB, closeDB } from '../src/db.js';
import { classifyOne } from '../src/llm.js';
import { runAlerts } from '../src/alert.js';
import { logger } from '../src/logger.js';

async function main() {
  const db = await getDB();
  try {
    // Insert test item directly
    const id = await db.insertItem({
      source_id: 1000,  // OpenAI Blog
      title: 'OpenAI announces free ChatGPT Plus for students in 50+ countries',
      excerpt: 'Verified students get 2 years of free ChatGPT Plus (GPT-4 access), no credit card required. Program runs through end of 2026.',
      content_hash: 'live-test-' + Date.now(),
      discovered_at: new Date().toISOString(),
    });
    logger.info('inserted test item', { id });

    const v = await classifyOne({
      title: 'OpenAI announces free ChatGPT Plus for students in 50+ countries',
      excerpt: 'Verified students get 2 years of free ChatGPT Plus (GPT-4 access), no credit card required.',
    });
    logger.info('classified', { verdict: v });
    if (v && id) {
      await db.updateItemVerdict(id, v);
      const r = await runAlerts(db);
      logger.info('alert result', { r });
    }
  } finally {
    closeDB();
  }
}
main();
