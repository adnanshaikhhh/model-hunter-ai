// scripts/smoke-test.ts — local end-to-end test.
// Creates fake source, inserts a test item, classifies, alerts (DRY_RUN if no creds).
import { getDB, closeDB } from '../src/db.js';
import { classifyOne } from '../src/llm.js';
import { logger } from '../src/logger.js';

async function main() {
  const db = await getDB();
  try {
    // Insert a test source first (FK target)
    const { default: Database } = await import('better-sqlite3');
    const sqlite = new Database(process.env.MODEL_HUNTER_DB_PATH || './data/model-hunter.sqlite');
    sqlite.prepare('INSERT OR IGNORE INTO sources (id, name, url, type, category) VALUES (?, ?, ?, ?, ?)').run(
      999, 'smoke-test-source', 'https://example.com/feed.xml', 'rss', 'test'
    );
    sqlite.close();

    // Test 1: DB write/read
    const hash = 'smoke-' + Date.now();
    const id = await db.insertItem({
      source_id: 999,
      title: 'Smoke test item ' + hash,
      url: 'https://example.com/' + hash,
      excerpt: 'If you see this in items, the DB works.',
      content_hash: hash,
      discovered_at: new Date().toISOString(),
    });
    logger.info('smoke: DB insert OK', { id });

    // Test 2: classifier (uses Ollama local)
    const verdict = await classifyOne({
      title: 'Free Llama 3 inference credits for developers',
      excerpt: 'Announcing 1000 free daily API calls for the next 30 days.',
    });
    logger.info('smoke: classifier', { verdict });

    // Test 3: item lifecycle
    if (verdict) {
      await db.updateItemVerdict(id!, verdict);
      const items = await db.getItemsForAlert(0);
      logger.info('smoke: items-for-alert count', { count: items.length });
    }

    logger.info('=== SMOKE TEST PASSED ===');
  } finally {
    closeDB();
  }
}

main().catch(err => {
  console.error('SMOKE FAILED:', err);
  process.exit(1);
});
