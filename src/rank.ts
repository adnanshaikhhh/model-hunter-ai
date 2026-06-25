// src/rank.ts — deterministic score boosts per blueprint §23.
import type { Item } from './types.js';

const HIGH_VALUE_TYPES = new Set(['free_credits', 'startup', 'hackathon']);

export function applyRankingBoosts(item: Item): number {
  let score = item.relevance ?? 0;
  // +15 if deadline within 7 days
  if (item.deadline) {
    const d = Date.parse(item.deadline);
    if (!isNaN(d)) {
      const days = (d - Date.now()) / (1000 * 60 * 60 * 24);
      if (days >= 0 && days <= 7) score += 15;
    }
  }
  // +10 if high-value opp_type
  if (item.opp_type && HIGH_VALUE_TYPES.has(item.opp_type)) score += 10;
  // +5 if source is high-trust (mark manually if needed; default no boost)
  // Future: join sources table for trust weight
  return Math.max(0, Math.min(100, score));
}
