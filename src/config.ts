// src/config.ts — env loading + constants. Single source of truth for tuning.
import 'dotenv/config';

function envStr(k: string, def = ''): string {
  const v = process.env[k];
  return v === undefined || v === '' ? def : v;
}

function envInt(k: string, def: number): number {
  const v = process.env[k];
  if (!v) return def;
  const n = parseInt(v, 10);
  return isNaN(n) ? def : n;
}

function envBool(k: string, def: boolean): boolean {
  const v = process.env[k];
  if (v === undefined) return def;
  return v.toLowerCase() === 'true' || v === '1';
}

export const config = {
  // DB
  supabaseUrl: envStr('SUPABASE_URL'),
  supabaseServiceKey: envStr('SUPABASE_SERVICE_ROLE_KEY'),
  sqlitePath: envStr('MODEL_HUNTER_DB_PATH', './data/model-hunter.sqlite'),

  // Telegram
  telegramBotToken: envStr('TELEGRAM_BOT_TOKEN'),
  telegramChatId: envStr('TELEGRAM_CHAT_ID'),

  // Email (Resend)
  resendApiKey: envStr('RESEND_API_KEY'),
  alertEmailTo: envStr('ALERT_EMAIL_TO'),
  alertEmailFrom: envStr('ALERT_EMAIL_FROM', 'alerts@modelhunter.local'),

  // LLM providers (failover order: Ollama local -> OpenAI -> NVIDIA NIM -> Groq -> Gemini -> OpenRouter)
  ollamaHost: envStr('OLLAMA_HOST', 'http://127.0.0.1:11434'),
  ollamaModel: envStr('OLLAMA_MODEL', 'llama3.2:3b'),
  openaiApiKey: envStr('OPENAI_API_KEY'),
  nvidiaApiKey: envStr('NVIDIA_API_KEY'),
  groqApiKey: envStr('GROQ_API_KEY'),
  geminiApiKey: envStr('GEMINI_API_KEY'),
  openrouterApiKey: envStr('OPENROUTER_API_KEY'),

  // Tuning
  relevanceThreshold: envInt('RELEVANCE_THRESHOLD', 65),
  dryRun: envBool('DRY_RUN', false),
  heartbeatHourUtc: envInt('HEARTBEAT_HOUR_UTC', 8),
  logLevel: envStr('LOG_LEVEL', 'info'),

  // Computed
  get useSupabase(): boolean {
    return Boolean(this.supabaseUrl && this.supabaseServiceKey);
  },
};

export type Config = typeof config;
