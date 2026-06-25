// scripts/seed-sources.ts — populate `sources` with curated, high-signal feeds.
// Per blueprint §36: 15-20 sources, RSS/JSON preferred, mix of credits/trials/research/startups/hackathons/news.
import { getDB, closeDB } from '../src/db.js';
import { logger } from '../src/logger.js';

const SOURCES = [
  // ----- AI lab blogs (research + product launches) -----
  { name: 'OpenAI Blog', url: 'https://openai.com/blog/rss.xml', type: 'rss', category: 'research' },
  { name: 'Google Research Blog', url: 'https://research.google/blog/rss/', type: 'rss', category: 'research' },
  { name: 'Anthropic Claude Code Releases', url: 'https://github.com/anthropics/claude-code/releases.atom', type: 'rss', category: 'research' },
  { name: 'Google DeepMind Blog', url: 'https://deepmind.google/blog/rss.xml', type: 'rss', category: 'research' },
  { name: 'Hugging Face Blog', url: 'https://huggingface.co/blog/feed.xml', type: 'rss', category: 'research' },
  { name: 'Mistral AI News', url: 'https://github.com/mistralai/mistral-finetune/releases.atom', type: 'rss', category: 'research' },
  { name: 'Meta AI Research', url: 'https://github.com/facebookresearch/metaseq/releases.atom', type: 'rss', category: 'research' },

  // ----- Aggregators (community discovery) -----
  { name: 'Hacker News (front page)', url: 'https://hnrss.org/frontpage', type: 'rss', category: 'newsletter' },
  { name: 'Hacker News (best)', url: 'https://hnrss.org/best', type: 'rss', category: 'newsletter' },
  { name: 'r/MachineLearning', url: 'https://www.reddit.com/r/MachineLearning/.rss', type: 'rss', category: 'newsletter' },
  { name: 'r/LocalLLaMA', url: 'https://www.reddit.com/r/LocalLLaMA/.rss', type: 'rss', category: 'newsletter' },
  { name: 'r/singularity', url: 'https://www.reddit.com/r/singularity/.rss', type: 'rss', category: 'newsletter' },

  // ----- JSON APIs (structured data) -----
  { name: 'HN Algolia (AI queries)', url: 'https://hn.algolia.com/api/v1/search?tags=story&query=free%20API%20credits', type: 'json', category: 'credits' },
  { name: 'HN Algolia (GPU)', url: 'https://hn.algolia.com/api/v1/search?tags=story&query=GPU%20grant', type: 'json', category: 'credits' },

  // ----- Newsletter aggregators (free credits / startup deals) -----
  { name: 'TLDR AI', url: 'https://tldr.tech/rss', type: 'rss', category: 'newsletter' },
  { name: 'Ben Tossell’s Deals for Founders', url: 'https://www.producthunt.com/feed', type: 'rss', category: 'credits' },

  // ----- Provider status (incidents / promos) -----
  { name: 'OpenAI Status', url: 'https://status.openai.com/history.rss', type: 'rss', category: 'newsletter' },
];

async function main() {
  const db = await getDB();
  try {
    for (const s of SOURCES) {
      // Upsert via raw SQL
      const result = await db.getActiveSources(); // quick sanity
    }
    // Insert via direct SQL through better-sqlite3 escape hatch
    const { default: Database } = await import('better-sqlite3');
    const sqlite = new Database(process.env.MODEL_HUNTER_DB_PATH || './data/model-hunter.sqlite');
    const insertSql = sqlite.prepare('INSERT INTO sources (name, url, type, category, active) VALUES (?, ?, ?, ?, 1)');
    const checkSql = sqlite.prepare('SELECT id FROM sources WHERE url = ?');
    let count = 0;
    for (const s of SOURCES) {
      if (!checkSql.get(s.url)) {
        insertSql.run(s.name, s.url, s.type, s.category);
        count += 1;
      }
    }
    logger.info('seed complete', { sources: count });
    sqlite.close();
  } finally {
    closeDB();
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
