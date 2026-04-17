import { Hono } from 'hono';
import { eq, and, desc, gte, sql, count } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pointsLedger } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { pointsHistoryQuerySchema } from '../lib/validator.js';

const points = new Hono();

points.use('*', authMiddleware);

// GET /points/balance
points.get('/balance', async (c) => {
  const userId = c.get('userId') as string;
  const now = new Date();

  // Current balance (last entry's balance_after)
  const latestEntry = db
    .select({ balance_after: pointsLedger.balance_after })
    .from(pointsLedger)
    .where(eq(pointsLedger.user_id, userId))
    .orderBy(desc(pointsLedger.created_at))
    .limit(1)
    .get();
  const balance = latestEntry?.balance_after ?? 0;

  // Today's earned
  const todayStart = new Date(now);
  todayStart.setHours(0, 0, 0, 0);
  const todayEntries = db
    .select({ amount: pointsLedger.amount })
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.user_id, userId),
        eq(pointsLedger.type, 'earned_accepted'),
        gte(pointsLedger.created_at, todayStart.toISOString()),
      ),
    )
    .all();
  const today = todayEntries.reduce((sum, e) => sum + e.amount, 0);

  // This week's earned (last 7 days)
  const weekStart = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  const weekEntries = db
    .select({ amount: pointsLedger.amount })
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.user_id, userId),
        eq(pointsLedger.type, 'earned_accepted'),
        gte(pointsLedger.created_at, weekStart.toISOString()),
      ),
    )
    .all();
  const week = weekEntries.reduce((sum, e) => sum + e.amount, 0);

  // This month's earned (last 30 days)
  const monthStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const monthEntries = db
    .select({ amount: pointsLedger.amount })
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.user_id, userId),
        eq(pointsLedger.type, 'earned_accepted'),
        gte(pointsLedger.created_at, monthStart.toISOString()),
      ),
    )
    .all();
  const month = monthEntries.reduce((sum, e) => sum + e.amount, 0);

  return c.json({ balance, today, week, month });
});

// GET /points/history
points.get('/history', async (c) => {
  const userId = c.get('userId') as string;
  const query = c.req.query();
  const parsed = pointsHistoryQuerySchema.safeParse(query);
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 422);
  }

  const { limit, offset, type } = parsed.data;

  const conditions = [eq(pointsLedger.user_id, userId)];
  if (type) {
    conditions.push(eq(pointsLedger.type, type));
  }

  const items = db
    .select()
    .from(pointsLedger)
    .where(and(...conditions))
    .orderBy(desc(pointsLedger.created_at))
    .limit(limit)
    .offset(offset)
    .all();

  const totalResult = db
    .select({ count: sql<number>`count(*)` })
    .from(pointsLedger)
    .where(and(...conditions))
    .get();
  const total = totalResult?.count ?? 0;

  return c.json({
    items: items.map(item => ({
      id: item.id,
      type: item.type,
      amount: item.amount,
      balance_after: item.balance_after,
      description: item.description,
      created_at: item.created_at,
    })),
    total,
    has_more: offset + limit < total,
  });
});

// GET /points/summary
points.get('/summary', async (c) => {
  const userId = c.get('userId') as string;

  const allEntries = db
    .select({ type: pointsLedger.type, amount: pointsLedger.amount })
    .from(pointsLedger)
    .where(eq(pointsLedger.user_id, userId))
    .all();

  const summary: Record<string, number> = {};
  for (const entry of allEntries) {
    summary[entry.type] = (summary[entry.type] ?? 0) + entry.amount;
  }

  return c.json({
    total_earned: summary['earned'] ?? 0,
    total_spent: Math.abs(summary['spent'] ?? 0),
    total_bonus: summary['bonus'] ?? 0,
    total_referral: summary['referral'] ?? 0,
    total_supporter: summary['supporter'] ?? 0,
    by_type: summary,
  });
});

export default points;
