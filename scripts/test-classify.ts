// scripts/test-classify.ts — Quick test of Pollinations failover.
import { classifyOne } from '../src/llm.js';

async function main() {
  const v = await classifyOne({
    title: 'Hugging Face launches free Llama 3 inference for developers',
    excerpt: 'All logged-in users get 1000 free API calls per day on Llama-3.1-70B, no credit card.',
  });
  console.log('Verdict:', JSON.stringify(v, null, 2));
}
main();