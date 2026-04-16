import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { updateUserSchema } from '../lib/validator.js';

const usersRouter = new Hono();

usersRouter.use('*', authMiddleware);

// PATCH /users/me
usersRouter.patch('/me', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json().catch(() => null);
  const parsed = updateUserSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 422);
  }

  const updateData: Partial<typeof users.$inferInsert> = {
    updated_at: new Date().toISOString(),
  };
  if (parsed.data.name !== undefined) updateData.name = parsed.data.name;
  if (parsed.data.avatar_url !== undefined) updateData.avatar_url = parsed.data.avatar_url;

  db.update(users).set(updateData).where(eq(users.id, userId)).run();

  const user = db.select().from(users).where(eq(users.id, userId)).get()!;

  return c.json({
    id: user.id,
    email: user.email,
    name: user.name,
    avatar_url: user.avatar_url,
    rank: user.rank,
    is_supporter: user.is_supporter,
    updated_at: user.updated_at,
  });
});

// POST /users/me/supporter/sync — placeholder for store purchase verification
usersRouter.post('/me/supporter/sync', async (c) => {
  // Phase 2: placeholder
  // In production this would verify the in-app purchase receipt from RevenueCat
  return c.json({
    is_supporter: false,
    message: 'サポーター機能はPhase 4で実装予定です',
  });
});

export default usersRouter;
