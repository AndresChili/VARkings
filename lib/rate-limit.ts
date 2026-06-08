const store = new Map<string, { count: number; resetAt: number }>();

// In-memory rate limiter — per serverless instance, not shared across instances.
// Good enough to block rapid-fire abuse on a single instance.
export function rateLimit(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const entry = store.get(key);
  if (!entry || now > entry.resetAt) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (entry.count >= max) return false;
  entry.count++;
  return true;
}
