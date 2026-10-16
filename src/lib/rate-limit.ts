type Bucket = {
  count: number;
  resetAt: number;
};

const WINDOW_MS = 60_000;
const MAX_REQUESTS = 10;

const buckets = new Map<string, Bucket>();

/**
 * Simple in-memory rate limiter for demo / local deployments.
 * Not shared across serverless instances — good enough for this assignment.
 */
export function checkRateLimit(key: string): {
  allowed: boolean;
  remaining: number;
  retryAfterSec: number;
} {
  const now = Date.now();
  const existing = buckets.get(key);

  if (!existing || existing.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return { allowed: true, remaining: MAX_REQUESTS - 1, retryAfterSec: 0 };
  }

  if (existing.count >= MAX_REQUESTS) {
    return {
      allowed: false,
      remaining: 0,
      retryAfterSec: Math.ceil((existing.resetAt - now) / 1000),
    };
  }

  existing.count += 1;
  return {
    allowed: true,
    remaining: MAX_REQUESTS - existing.count,
    retryAfterSec: 0,
  };
}
