# Model Hunter AI

**Personal radar that watches curated high-signal sources and pings your Telegram when free / cheap AI model access opportunities appear.**

> Blueprint: Notion page `389551bc-671d-8044-8254-fef9788a190f`

## What it does

1. **Polls** ~15 curated RSS/JSON sources every hour (Hacker News, OpenAI blog, Anthropic, Reddit, HuggingFace, OpenAI status, etc.)
2. **Deduplicates** every item by content hash — no double-alerts
3. **Classifies** with a free local LLM (Ollama) — falls back to OpenAI / NVIDIA NIM / Groq / Gemini / OpenRouter if needed
4. **Scores** 0-100 with deterministic boosts for deadline urgency + high-value opp type
5. **Alerts** via Telegram (primary, instant, free) + Email via Resend (backup, P1)
6. **Logs** every send to `alerts` table for full audit trail
7. **Heartbeats** daily so silence ≠ false confidence

## Stack

| Component | Choice | Cost |
|---|---|---|
| Scheduler | GitHub Actions cron | $0 (free tier) |
| LLM | Ollama local (default) | $0 |
| LLM failover | OpenAI / NVIDIA NIM / Groq / Gemini / OpenRouter free tiers | $0 |
| DB (local) | SQLite | $0 |
| DB (prod) | Supabase Postgres (optional) | $0 (free tier) |
| Telegram | Bot API | $0 |
| Email | Resend free tier (3k/mo) | $0 |
| **Total** | | **$0.00** |

## Setup

### 1. Local dev

```bash
git clone https://github.com/adnanshaikhhh/model-hunter-ai.git
cd model-hunter-ai
npm install
cp .env.example .env
# edit .env: at minimum set TELEGRAM_BOT_TOKEN + TELEGRAM_CHAT_ID
npm run seed       # inserts ~15 curated sources
npm run smoke      # tests DB + classifier end-to-end
npm run dev        # runs full pipeline once
```

### 2. GitHub Actions cron (production)

1. Push repo to GitHub
2. Add repository secrets (Settings → Secrets → Actions):
   - `TELEGRAM_BOT_TOKEN` — your bot token from @BotFather
   - `TELEGRAM_CHAT_ID` — your personal chat ID
   - `RESEND_API_KEY` (optional) + `ALERT_EMAIL_TO` (optional, for email backup)
   - `OLLAMA_HOST` + `OLLAMA_MODEL` (if running on a self-hosted runner)
   - `OPENAI_API_KEY` / `NVIDIA_API_KEY` / `GROQ_API_KEY` / `GEMINI_API_KEY` / `OPENROUTER_API_KEY` (optional cloud fallbacks)
   - `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (optional, for production DB)
3. Trigger `workflow_dispatch` once to validate end-to-end
4. Let the hourly cron take over

## Architecture

```
GitHub Actions cron (hourly)
       │
       ▼
   src/index.ts
       │
       ├── ingestAll(db)        ← fetch RSS/JSON from sources
       │     ↓
       │   deduplicate by content_hash, insert new items
       │
       ├── classifyUnprocessed(db)   ← LLM call per item (or batched)
       │     ↓
       │   update items with verdict {is_opportunity, opp_type, relevance, summary, deadline}
       │
       ├── runAlerts(db)        ← select items score >= 65
       │     ↓
       │   Telegram (primary) + Email (backup)
       │     ↓
       │   mark items 'alerted', log to alerts table
       │
       └── maybeHeartbeat(db)   ← daily summary at HEARTBEAT_HOUR_UTC
```

## Idempotency

Every step is idempotent:
- **Ingest**: `content_hash UNIQUE` → duplicate inserts return null
- **Classify**: items in status `new` are only processed once (moved to `scored` or `scored-not-opp`)
- **Alert**: only items in `scored` status with `relevance >= threshold` are selected → after send, status moves to `alerted`

Re-running the worker 10x in a row produces exactly 1 alert per opportunity.

## Adding a new source

```bash
# either edit scripts/seed-sources.ts and re-run `npm run seed`,
# or insert directly:
sqlite3 data/model-hunter.sqlite   "INSERT INTO sources (name, url, type, category, active) VALUES ('New Feed', 'https://.../rss', 'rss', 'credits', 1)"
```

## Definition of Done

Per blueprint §39.3:

- [x] GitHub repo exists, builds with `npm run build`, runs with `node dist/src/index.js`
- [x] DB has `sources`, `items`, `alerts` tables (sql/schema.sql)
- [x] ~15 curated sources seeded
- [x] Hourly GitHub Actions cron scheduled
- [x] LLM classifier with multi-provider failover
- [x] Telegram alerts + Email backup
- [x] Idempotent (no double-alerts)
- [x] Per-source error isolation (sources.last_status)
- [x] Daily heartbeat message

## License

MIT — single user, $0, just ship.
