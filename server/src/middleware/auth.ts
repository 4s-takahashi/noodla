import type { Context, Next } from 'hono';
import { verifyAccessToken } from '../lib/jwt.js';

export async function authMiddleware(c: Context, next: Next) {
  const authHeader = c.req.header('Authorization');

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: '認証が必要です', code: 'UNAUTHORIZED' }, 401);
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyAccessToken(token);
    c.set('userId', payload.sub);
    c.set('userEmail', payload.email);
    await next();
  } catch {
    return c.json({ error: 'トークンが無効または期限切れです', code: 'INVALID_TOKEN' }, 401);
  }
}
