// src/llm.ts — Provider-abstracted classifier with failover.
// Primary: Ollama local (free, $0, no key). Cloud fallbacks in order:
// Pollinations (free, no auth) -> OpenAI -> NVIDIA NIM -> Groq -> Gemini -> OpenRouter.

import { z } from 'zod';
import { config } from './config.js';
import { logger } from './logger.js';
import type { Verdict } from './types.js';

const VerdictSchema = z.object({
  is_opportunity: z.boolean(),
  opp_type: z.enum(['free_credits','trial','research','startup','hackathon','beta','promo','other']).nullable(),
  relevance: z.number().int().min(0).max(100),
  summary: z.string().max(200),
  deadline: z.string().nullable(),
});

export interface ClassifyInput {
  title: string;
  excerpt?: string;
}

const SYSTEM = 'You are a strict JSON classifier. Reply with ONLY a single JSON object matching the requested schema. No prose, no markdown, no code fences.';

const USER_TEMPLATE = (title: string, excerpt: string) =>
  'Decide if this item is a FREE or CHEAP AI MODEL ACCESS OPPORTUNITY ' +
  '(free credits, free trial, research access, startup credits, hackathon prize, beta access, promo).\n\n' +
  'Title: ' + title + '\n' +
  'Excerpt: ' + (excerpt || '(none)') + '\n\n' +
  'Reply with exactly this JSON shape:\n' +
  '{"is_opportunity": bool, "opp_type": "free_credits|trial|research|startup|hackathon|beta|promo|other", "relevance": 0-100, "summary": "one line, <=140 chars", "deadline": "YYYY-MM-DD or null"}\n\n' +
  'Calibration: relevance >= 75 = highly actionable (free credits, official program). ' +
  '50-74 = worth checking. < 50 = noise. Set is_opportunity=false if unclear.';

// --- Provider adapters ---

async function callOllama(prompt: string): Promise<string> {
  const res = await fetch(config.ollamaHost + '/api/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: config.ollamaModel,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
      stream: false,
      options: { temperature: 0, num_predict: 250 },
    }),
    signal: AbortSignal.timeout(90000),
  });
  if (!res.ok) throw new Error('Ollama HTTP ' + res.status);
  const data = await res.json();
  return (data.message?.content || '').trim();
}

async function callOpenAI(prompt: string, model: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model, temperature: 0, max_tokens: 250, response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('OpenAI HTTP ' + res.status);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function callNvidia(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://integrate.api.nvidia.com/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta/llama-3.1-70b-instruct',
      temperature: 0, max_tokens: 250,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('NVIDIA HTTP ' + res.status);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function callGroq(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'llama-3.3-70b-versatile',
      temperature: 0, max_tokens: 250,
      response_format: { type: 'json_object' },
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('Groq HTTP ' + res.status);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

async function callGemini(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + apiKey, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: SYSTEM + '\n\n' + prompt }] }],
      generationConfig: { temperature: 0, maxOutputTokens: 250, responseMimeType: 'application/json' },
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('Gemini HTTP ' + res.status);
  const data = await res.json();
  return (data.candidates?.[0]?.content?.parts?.[0]?.text || '').trim();
}

async function callOpenRouter(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + apiKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'meta-llama/llama-3.3-70b-instruct:free',
      temperature: 0, max_tokens: 250,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
    }),
    signal: AbortSignal.timeout(30000),
  });
  if (!res.ok) throw new Error('OpenRouter HTTP ' + res.status);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}


async function callPollinations(prompt: string): Promise<string> {
  const res = await fetch('https://text.pollinations.ai/openai/chat/completions', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openai-fast',
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: prompt },
      ],
      max_tokens: 250,
      temperature: 0,
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!res.ok) throw new Error('Pollinations HTTP ' + res.status);
  const data = await res.json();
  return (data.choices?.[0]?.message?.content || '').trim();
}

// --- Verdict parsing ---

function parseVerdict(raw: string): Verdict {
  // Strip markdown fences if model added them anyway
  let s = raw.trim();
  if (s.startsWith('```')) {
    s = s.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '').trim();
  }
  // Extract first JSON object
  const m = s.match(/\{[\s\S]*\}/);
  if (!m) throw new Error('No JSON object found: ' + s.slice(0, 100));
  const parsed = JSON.parse(m[0]);
  const result = VerdictSchema.safeParse(parsed);
  if (!result.success) throw new Error('Schema validation failed: ' + result.error.message);
  return result.data as Verdict;
}

// --- Public classify with failover ---

export async function classifyOne(input: ClassifyInput): Promise<Verdict | null> {
  const prompt = USER_TEMPLATE(input.title, input.excerpt ?? '');
  const providers = [
    ['Ollama', () => callOllama(prompt)],
    // Pollinations.ai: free, no auth, no key needed. Try early since it's the most reliable in CI.
    ['Pollinations', () => callPollinations(prompt)],
    config.openaiApiKey ? ['OpenAI', () => callOpenAI(prompt, 'gpt-4o-mini', config.openaiApiKey)] : null,
    config.nvidiaApiKey ? ['NVIDIA', () => callNvidia(prompt, config.nvidiaApiKey)] : null,
    config.groqApiKey ? ['Groq', () => callGroq(prompt, config.groqApiKey)] : null,
    config.geminiApiKey ? ['Gemini', () => callGemini(prompt, config.geminiApiKey)] : null,
    config.openrouterApiKey ? ['OpenRouter', () => callOpenRouter(prompt, config.openrouterApiKey)] : null,
  ].filter(Boolean) as [string, () => Promise<string>][];

  for (const [name, fn] of providers) {
    try {
      const raw = await fn();
      const verdict = parseVerdict(raw);
      logger.debug('classified via ' + name, { relevance: verdict.relevance });
      return verdict;
    } catch (err: any) {
      logger.warn('classifier provider failed', { provider: name, err: String(err).slice(0, 120) });
      // continue to next provider
    }
  }
  logger.error('all classifier providers failed');
  return null;
}

export async function classifyMany(inputs: ClassifyInput[]): Promise<(Verdict | null)[]> {
  // Sequential — Ollama local is the bottleneck; parallelism would saturate it.
  const out: (Verdict | null)[] = [];
  for (const inp of inputs) {
    out.push(await classifyOne(inp));
  }
  return out;
}