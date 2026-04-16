import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { loginRateLimit } from '../middleware/rate-limit.js';
import { registerSchema, loginSchema, refreshSchema, logoutSchema } from '../lib/validator.js';
import { registerUser, loginUser, refreshUserToken, revokeToken } from '../services/auth-service.js';

const auth = new Hono();

// POST /auth/register
auth.post('/register', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 422);
  }

  try {
    const { user, tokens } = await registerUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.name,
    );

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        rank: user.rank,
        is_supporter: user.is_supporter,
        created_at: user.created_at,
      },
      ...tokens,
    }, 201);
  } catch (err: any) {
    return c.json({ error: err.message, code: err.code }, err.status ?? 500);
  }
});

// POST /auth/login
auth.post('/login', loginRateLimit, async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 422);
  }

  try {
    const { user, tokens, pointsBalance } = await loginUser(
      parsed.data.email,
      parsed.data.password,
      parsed.data.device_info,
    );

    return c.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        rank: user.rank,
        is_supporter: user.is_supporter,
        points_balance: pointsBalance,
      },
      ...tokens,
    });
  } catch (err: any) {
    return c.json({ error: err.message, code: err.code }, err.status ?? 500);
  }
});

// POST /auth/refresh
auth.post('/refresh', async (c) => {
  const body = await c.req.json().catch(() => null);
  const parsed = refreshSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'refresh_token is required' }, 422);
  }

  try {
    const { tokens } = await refreshUserToken(parsed.data.refresh_token);
    return c.json(tokens);
  } catch (err: any) {
    return c.json({ error: err.message, code: err.code }, err.status ?? 500);
  }
});

// POST /auth/logout
auth.post('/logout', authMiddleware, async (c) => {
  const body = await c.req.json().catch(() => ({}));
  const parsed = logoutSchema.safeParse(body);
  if (parsed.success) {
    revokeToken(parsed.data.refresh_token);
  }
  return c.json({ message: 'ログアウトしました' });
});

// GET /auth/me
auth.get('/me', authMiddleware, async (c) => {
  const userId = c.get('userId') as string;
  const user = db.select().from(users).where(eq(users.id, userId)).get();
  if (!user) {
    return c.json({ error: 'ユーザーが見つかりません' }, 404);
  }

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    rank: user.rank,
    is_supporter: user.is_supporter,
    supporter_since: user.supporter_since,
    created_at: user.created_at,
    last_login_at: user.last_login_at,
  });
});

export default auth;
