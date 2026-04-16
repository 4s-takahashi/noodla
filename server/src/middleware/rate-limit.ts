import type { Context, Next } from 'hono';

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

const store = new Map<string, RateLimitEntry>();

function createRateLimiter(maxRequests: number, windowMs: number) {
  return async (c: Context, next: Next) => {
    const ip = c.req.header('x-forwarded-for') ?? c.req.header('x-real-ip') ?? 'unknown';
    const key = `${c.req.path}:${ip}`;
    const now = Date.now();

    const entry = store.get(key);
    if (!entry || entry.resetAt < now) {
      store.set(key, { count: 1, resetAt: now + windowMs });
      await next();
      return;
    }

    if (entry.count >= maxRequests) {
      c.header('Retry-After', String(Math.ceil((entry.resetAt - now) / 1000)));
      return c.json(
        { error: 'リクエストが多すぎます。しばらく待ってからお試しください', code: 'RATE_LIMITED' },
        429,
      );
    }

    entry.count++;
    await next();
  };
}

// Login: 5 attempts per minute
export const loginRateLimit = createRateLimiter(5, 60_000);

// General API: 100 requests per minute
export const apiRateLimit = createRateLimiter(100, 60_000);
