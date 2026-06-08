import type { NextRequest } from 'next/server';

// --- In-memory fallback (per serverless instance) ---
const store = new Map<string, { count: number; resetAt: number }>();

// Cleanup expired entries to prevent memory leaks in long-running instances
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of store) {
    if (now > entry.resetAt) store.delete(key);
  }
}, 5 * 60 * 1000).unref?.();

function rateLimitMemory(key: string, max: number, windowMs: number): boolean {
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

// --- Upstash Redis (shared across all serverless instances) ---
// Requires UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN env vars.
// Falls back to in-memory if not configured.
type UpstashFn = (key: string, max: number, windowMs: number) => Promise<boolean>;
let upstashFn: UpstashFn | null | 'loading' = null;

async function getUpstashFn(): Promise<UpstashFn | null> {
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) return null;
  if (upstashFn === 'loading') return null;
  if (upstashFn) return upstashFn;

  upstashFn = 'loading';
  try {
    const [{ Redis }, { Ratelimit }] = await Promise.all([
      import('@upstash/redis'),
      import('@upstash/ratelimit'),
    ]);
    const redis = Redis.fromEnv();
    const cache = new Map<string, InstanceType<typeof Ratelimit>>();

    upstashFn = async (key: string, max: number, windowMs: number) => {
      const cacheKey = `${max}:${windowMs}`;
      if (!cache.has(cacheKey)) {
        cache.set(cacheKey, new Ratelimit({
          redis,
          limiter: Ratelimit.fixedWindow(max, `${windowMs} ms`),
          prefix: 'varkings',
        }));
      }
      const { success } = await cache.get(cacheKey)!.limit(key);
      return success;
    };
    return upstashFn;
  } catch {
    upstashFn = null;
    return null;
  }
}

// On Vercel, x-real-ip is set by the edge to the verified client IP (not spoofable).
// x-forwarded-for is client-controlled — used only as fallback on non-Vercel deployments
// to avoid all users sharing a single 'unknown' rate-limit bucket.
export function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-real-ip') ??
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    'unknown'
  );
}

export async function rateLimit(key: string, max: number, windowMs: number): Promise<boolean> {
  const upstash = await getUpstashFn();
  if (upstash) return upstash(key, max, windowMs);
  return rateLimitMemory(key, max, windowMs);
}
