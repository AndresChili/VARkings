import type { NextRequest } from 'next/server';

// --- Fallback en memoria (por instancia serverless) ---
const store = new Map<string, { count: number; resetAt: number }>();

// Limpia entradas caducadas para evitar fugas de memoria en instancias de larga duración
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

// --- Upstash Redis (compartido entre todas las instancias serverless) ---
// Requiere las variables de entorno UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
// Si no están configuradas, recurre al fallback en memoria.
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

// En Vercel, x-real-ip lo fija el edge con la IP real del cliente verificada (no falsificable).
// x-forwarded-for lo controla el cliente — se usa solo como fallback en despliegues fuera de Vercel
// para evitar que todos los usuarios compartan un único bucket de rate-limit 'unknown'.
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
