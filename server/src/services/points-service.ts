/**
 * points-service.ts — Phase 6 本番ポイント加算サービス
 *
 * ポイント計算式:
 *   Points = ceil(maxTokens × SPEED_MULT × RANK_MULT × JOB_TYPE_WEIGHT)
 *   最小1pt保証
 *
 * 不正対策:
 *   - 同一jobIdで2度加算 → UNIQUE制約で拒否
 *   - 応答時間 < 10ms → ポイント半減
 *   - 1ユーザー1分あたり100件超 → 超過分スキップ
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, and, gte, desc, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { pointsLedger, users } from '../db/schema.js';

// ── 定数 ─────────────────────────────────────────────────────────────────────

/** 速度係数マップ */
const SPEED_MULTIPLIER = {
  fast: 1.5,   // ≤50ms
  good: 1.2,   // ≤100ms
  normal: 1.0, // ≤300ms
  slow: 0.8,   // >300ms
} as const;

/** ランク係数マップ */
const RANK_MULTIPLIER: Record<string, number> = {
  Bronze: 1.0,
  Silver: 1.2,
  Gold: 1.5,
  Platinum: 2.0,
};

/** ジョブ種別重み */
const JOB_TYPE_WEIGHT: Record<string, number> = {
  mock_token_generate: 1.0,
  ping_job: 0.3,
};

/** デフォルトジョブ重み（未定義ジョブ） */
const DEFAULT_JOB_TYPE_WEIGHT = 1.0;

/** 1分あたり上限ジョブ数 */
const MAX_JOBS_PER_MINUTE = 100;

/** 応答時間が短すぎる場合の閾値 (ms) */
const SUSPICIOUS_RESPONSE_MS = 10;

// ── ヘルパー関数 ──────────────────────────────────────────────────────────────

/**
 * 速度係数を計算する
 */
function getSpeedMultiplier(responseMs: number): number {
  if (responseMs <= 50) return SPEED_MULTIPLIER.fast;
  if (responseMs <= 100) return SPEED_MULTIPLIER.good;
  if (responseMs <= 300) return SPEED_MULTIPLIER.normal;
  return SPEED_MULTIPLIER.slow;
}

/**
 * ランク係数を取得する（クランプ付き）
 */
function getRankMultiplier(rank: string): number {
  const mult = RANK_MULTIPLIER[rank] ?? 1.0;
  return Math.max(1.0, Math.min(2.0, mult));
}

/**
 * ジョブ種別重みを取得する
 */
function getJobTypeWeight(jobType: string): number {
  return JOB_TYPE_WEIGHT[jobType] ?? DEFAULT_JOB_TYPE_WEIGHT;
}

/**
 * ポイントを計算する
 */
export function calculatePoints(params: {
  maxTokens: number;
  responseMs: number;
  rank: string;
  jobType: string;
}): number {
  const { maxTokens, responseMs, rank, jobType } = params;

  const base = Math.max(1, Math.min(5, maxTokens)); // 1〜5にクランプ
  const speedMult = getSpeedMultiplier(responseMs);
  const rankMult = getRankMultiplier(rank);
  const jobWeight = getJobTypeWeight(jobType);

  let points = Math.ceil(base * speedMult * rankMult * jobWeight);

  // 応答時間 < 10ms → 半減（不正対策）
  if (responseMs < SUSPICIOUS_RESPONSE_MS) {
    points = Math.ceil(points / 2);
  }

  // 最小1pt保証
  return Math.max(1, points);
}

// ── レート制限チェック ─────────────────────────────────────────────────────────

/**
 * 1分あたりのジョブ数が上限を超えていないかチェック
 * 超えている場合は true を返す（スキップすべき）
 */
async function isRateLimited(userId: string): Promise<boolean> {
  const oneMinuteAgo = new Date(Date.now() - 60_000).toISOString();
  const result = db
    .select({ count: sql<number>`count(*)` })
    .from(pointsLedger)
    .where(
      and(
        eq(pointsLedger.user_id, userId),
        eq(pointsLedger.type, 'earned_accepted'),
        gte(pointsLedger.created_at, oneMinuteAgo),
      ),
    )
    .get();
  const count = result?.count ?? 0;
  if (count >= MAX_JOBS_PER_MINUTE) {
    console.warn(`[PointsService] Rate limit exceeded for user ${userId}: ${count}/min`);
    return true;
  }
  return false;
}

// ── メイン関数 ─────────────────────────────────────────────────────────────────

export interface AwardPointsParams {
  userId: string;
  jobId: string;
  jobType: string;
  maxTokens: number;
  responseMs: number;
}

export interface AwardPointsResult {
  points: number;
  balanceAfter: number;
  skipped: boolean;
  skipReason?: string;
}

/**
 * ジョブ accepted 時にポイントを加算する
 *
 * - 同一jobIdで2度加算はUNIQUE制約で防ぐ
 * - レート制限チェック
 * - ユーザーのランクを参照してポイント計算
 */
export async function awardPoints(params: AwardPointsParams): Promise<AwardPointsResult> {
  const { userId, jobId, jobType, maxTokens, responseMs } = params;

  // レート制限チェック
  if (await isRateLimited(userId)) {
    return { points: 0, balanceAfter: 0, skipped: true, skipReason: 'rate_limit' };
  }

  // ユーザーの現在ランクを取得
  const user = db
    .select({ rank: users.rank })
    .from(users)
    .where(eq(users.id, userId))
    .get();

  if (!user) {
    console.warn(`[PointsService] User not found: ${userId}`);
    return { points: 0, balanceAfter: 0, skipped: true, skipReason: 'user_not_found' };
  }

  const points = calculatePoints({
    maxTokens,
    responseMs,
    rank: user.rank,
    jobType,
  });

  // 現在の残高取得
  const latestEntry = db
    .select({ balance_after: pointsLedger.balance_after })
    .from(pointsLedger)
    .where(eq(pointsLedger.user_id, userId))
    .orderBy(desc(pointsLedger.created_at))
    .limit(1)
    .get();
  const currentBalance = latestEntry?.balance_after ?? 0;
  const balanceAfter = currentBalance + points;

  // DB書き込み（UNIQUE制約違反は握りつぶす）
  try {
    await db.insert(pointsLedger).values({
      id: uuidv4(),
      user_id: userId,
      type: 'earned_accepted',
      amount: points,
      balance_after: balanceAfter,
      description: `ジョブ完了 (${jobType})`,
      related_job_id: jobId,
    });
  } catch (err: unknown) {
    // UNIQUE制約違反 = 二重加算の試み
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes('UNIQUE') || msg.includes('unique')) {
      console.warn(`[PointsService] Duplicate job award prevented: ${jobId}`);
      return { points: 0, balanceAfter: currentBalance, skipped: true, skipReason: 'duplicate' };
    }
    throw err;
  }

  console.log(
    `[PointsService] Awarded ${points}pt to ${userId} for job ${jobId} ` +
    `(responseMs=${responseMs}, rank=${user.rank}, jobType=${jobType})`,
  );

  return { points, balanceAfter, skipped: false };
}
