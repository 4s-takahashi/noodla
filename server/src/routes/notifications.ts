import { Hono } from 'hono';
import { eq, and, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { notifications } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

const notificationsRouter = new Hono();

notificationsRouter.use('*', authMiddleware);

// GET /notifications
notificationsRouter.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 100);
  const offset = Number(c.req.query('offset') ?? 0);

  const items = db
    .select()
    .from(notifications)
    .where(eq(notifications.user_id, userId))
    .orderBy(desc(notifications.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const unreadResult = db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)))
    .get();
  const unreadCount = unreadResult?.count ?? 0;

  const totalResult = db
    .select({ count: sql<number>`count(*)` })
    .from(notifications)
    .where(eq(notifications.user_id, userId))
    .get();
  const total = totalResult?.count ?? 0;

  return c.json({
    items: items.map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      is_read: n.is_read,
      created_at: n.created_at,
    })),
    unread_count: unreadCount,
    total,
    has_more: offset + limit < total,
  });
});

// PATCH /notifications/:id/read
notificationsRouter.patch('/:id/read', async (c) => {
  const userId = c.get('userId') as string;
  const notifId = c.req.param('id');

  const notif = db
    .select()
    .from(notifications)
    .where(and(eq(notifications.id, notifId), eq(notifications.user_id, userId)))
    .get();

  if (!notif) {
    return c.json({ error: '通知が見つかりません' }, 404);
  }

  db.update(notifications)
    .set({ is_read: true })
    .where(eq(notifications.id, notifId))
    .run();

  return c.json({ message: '既読にしました' });
});

// POST /notifications/read-all
notificationsRouter.post('/read-all', async (c) => {
  const userId = c.get('userId') as string;

  db.update(notifications)
    .set({ is_read: true })
    .where(and(eq(notifications.user_id, userId), eq(notifications.is_read, false)))
    .run();

  return c.json({ message: '全通知を既読にしました' });
});

export default notificationsRouter;
