import type { NextRequest } from 'next/server';

const store = new Map<string, { count: number; resetAt: number }>();

// On Vercel, x-real-ip is set by the edge to the verified client IP (not spoofable).
// x-forwarded-for first element is client-controlled and must NOT be used for security.
export function getClientIp(req: NextRequest): string {
  return req.headers.get('x-real-ip') ?? 'unknown';
}

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
