// src/types.ts — shared types across the pipeline.

export interface Source {
  id: number;
  name: string;
  url: string;
  type: 'rss' | 'json' | 'html';
  parser_hint: string | null;
  category: string | null;
  active: number;
  last_checked: string | null;
  last_status: string | null;
  created_at: string;
}

export interface RawItem {
  source_id: number;
  title: string;
  url?: string;
  excerpt?: string;
  content_hash: string;
  discovered_at: string;
}

export type OppType = 'free_credits' | 'trial' | 'research' | 'startup' | 'hackathon' | 'beta' | 'promo' | 'other';

export interface Verdict {
  is_opportunity: boolean;
  opp_type: OppType | null;
  relevance: number;       // 0..100
  summary: string;         // <=140 chars
  deadline: string | null; // YYYY-MM-DD or null
}

export interface Item extends RawItem {
  raw_excerpt?: string;
  id: number;
  is_opportunity: number | null;
  opp_type: string | null;
  relevance: number | null;
  summary: string | null;
  deadline: string | null;
  status: string;
  processed_at: string | null;
}

export interface DB {
  init(): Promise<void>;
  getActiveSources(): Promise<Source[]>;
  markSourceChecked(id: number, status: string): Promise<void>;
  insertItem(item: RawItem): Promise<number | null>; // null = duplicate
  updateItemVerdict(id: number, v: Verdict): Promise<void>;
  getUnprocessedItems(limit?: number): Promise<Item[]>;
  getItemsForAlert(threshold: number): Promise<Item[]>;
  markItemAlerted(id: number): Promise<void>;
  logAlert(itemId: number, channel: string, success: boolean, error?: string): Promise<void>;
  countItemsSince(iso: string): Promise<number>;
  countFailedSources(): Promise<number>;
  countSourcesCheckedLast24h(): Promise<number>;
}