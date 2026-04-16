import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { rankLedger, users } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';

const rank = new Hono();

rank.use('*', authMiddleware);

const RANK_THRESHOLDS: Record<string, { prev: number; next: number; nextRank: string }> = {
  Bronze:   { prev: 0,      next: 1000,  nextRank: 'Silver' },
  Silver:   { prev: 1000,   next: 5000,  nextRank: 'Gold' },
  Gold:     { prev: 5000,   next: 15000, nextRank: 'Platinum' },
  Platinum: { prev: 15000,  next: 99999, nextRank: 'Platinum' },
};

// GET /rank — current rank
rank.get('/', async (c) => {
  const userId = c.get('userId') as string;

  const entry = db
    .select()
    .from(rankLedger)
    .where(eq(rankLedger.user_id, userId))
    .get();

  if (!entry) {
    return c.json({
      rank: 'Bronze',
      score: 0,
      next_rank_score: 1000,
      progress: 0,
      evaluation: {
        processing_speed: 0,
        connection_stability: 0,
        avg_participation_hours: 0,
        task_adoption_rate: 0,
        wifi_quality: 0,
        consecutive_days: 0,
        total_days: 0,
      },
    });
  }

  const threshold = RANK_THRESHOLDS[entry.rank] ?? RANK_THRESHOLDS['Bronze'];
  const rangeSize = threshold.next - threshold.prev;
  const progress = rangeSize > 0
    ? Math.min(100, Math.round(((entry.score - threshold.prev) / rangeSize) * 100))
    : 100;

  return c.json({
    rank: entry.rank,
    score: entry.score,
    next_rank_score: threshold.next,
    progress,
    evaluation: {
      processing_speed: entry.avg_processing_speed,
      connection_stability: entry.connection_stability,
      avg_participation_hours: entry.avg_participation_hours,
      task_adoption_rate: entry.task_adoption_rate,
      wifi_quality: entry.wifi_quality_score,
      consecutive_days: entry.consecutive_days,
      total_days: entry.total_days_active,
    },
  });
});

// GET /rank/leaderboard — top users by score
rank.get('/leaderboard', async (c) => {
  const limit = Math.min(Number(c.req.query('limit') ?? 20), 50);
  const offset = Number(c.req.query('offset') ?? 0);

  const entries = db
    .select({
      user_id: rankLedger.user_id,
      rank: rankLedger.rank,
      score: rankLedger.score,
      name: users.name,
      avatar_url: users.avatar_url,
    })
    .from(rankLedger)
    .innerJoin(users, eq(rankLedger.user_id, users.id))
    .orderBy(desc(rankLedger.score))
    .limit(limit)
    .offset(offset)
    .all();

  return c.json({
    items: entries.map((e, i) => ({
      position: offset + i + 1,
      user_id: e.user_id,
      name: e.name,
      avatar_url: e.avatar_url,
      rank: e.rank,
      score: e.score,
    })),
    total: db.select().from(rankLedger).all().length,
  });
});

export default rank;
