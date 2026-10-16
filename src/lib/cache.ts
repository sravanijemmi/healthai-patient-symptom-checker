import type { AnalysisResult } from "./types";

type CacheEntry = {
  value: AnalysisResult;
  expiresAt: number;
};

const TTL_MS = 5 * 60_000;
const store = new Map<string, CacheEntry>();

export function getCachedAnalysis(key: string): AnalysisResult | null {
  const hit = store.get(key);
  if (!hit) return null;
  if (hit.expiresAt < Date.now()) {
    store.delete(key);
    return null;
  }
  return hit.value;
}

export function setCachedAnalysis(key: string, value: AnalysisResult) {
  store.set(key, { value, expiresAt: Date.now() + TTL_MS });
}
