// scripts/release-check.ts — verify the project is ready to ship.
import { existsSync } from 'fs';
import { join } from 'path';
import { config } from '../src/config.js';
import { logger } from '../src/logger.js';

interface Check {
  name: string;
  ok: boolean;
  detail: string;
}

async function main() {
  const checks: Check[] = [];

  // Required files
  for (const f of [
    'package.json', 'tsconfig.json', 'README.md', '.gitignore', '.env.example',
    'sql/schema.sql',
    '.github/workflows/hunt.yml',
    'src/index.ts', 'src/config.ts', 'src/db.ts', 'src/ingest.ts',
    'src/llm.ts', 'src/classify.ts', 'src/rank.ts',
    'src/alert.ts', 'src/heartbeat.ts',
    'src/fetchers/rss.ts', 'src/fetchers/json.ts', 'src/fetchers/html.ts',
    'src/notify/telegram.ts', 'src/notify/email.ts',
    'scripts/seed-sources.ts',
  ]) {
    checks.push({ name: 'file: ' + f, ok: existsSync(join(process.cwd(), f)), detail: '' });
  }

  // Config presence
  checks.push({ name: 'config: TELEGRAM_BOT_TOKEN', ok: !!config.telegramBotToken, detail: config.telegramBotToken ? 'set' : 'missing' });
  checks.push({ name: 'config: TELEGRAM_CHAT_ID', ok: !!config.telegramChatId, detail: config.telegramChatId ? 'set' : 'missing' });
  checks.push({ name: 'config: OLLAMA_HOST', ok: !!config.ollamaHost, detail: config.ollamaHost });
  checks.push({ name: 'config: OLLAMA_MODEL', ok: !!config.ollamaModel, detail: config.ollamaModel });
  checks.push({ name: 'config: relevance threshold', ok: config.relevanceThreshold > 0, detail: String(config.relevanceThreshold) });

  // DB presence
  checks.push({ name: 'db: path', ok: !!config.sqlitePath, detail: config.sqlitePath });

  // Print
  console.log('\n=== RELEASE CHECKLIST ===');
  let pass = 0, fail = 0;
  for (const c of checks) {
    const mark = c.ok ? '✅' : '❌';
    const det = c.detail ? ' (' + c.detail + ')' : '';
    console.log(mark + ' ' + c.name + det);
    if (c.ok) pass++; else fail++;
  }
  console.log('\n' + pass + ' passed, ' + fail + ' failed');
  process.exit(fail > 0 ? 1 : 0);
}

main();
