/**
 * rank-service.ts — Phase 6 ランクスコア更新 + 昇降格サービス
 *                   Phase 7-C ランクダウンロジック追加
 *
 * ランクスコア:
 *   増分 = points × RANK_WEIGHT_FOR_SCORE[currentRank]
 *   Bronze=1.0 / Silver=0.9 / Gold=0.75 / Platinum=0.5
 *
 * ランク閾値:
 *   Bronze(0) → Silver(1,000) → Gold(6,000) → Platinum(26,000)
 *
 * ランクアップ時:
 *   - users.rank 更新
 *   - rank_ledger.rank 更新
 *   - notifications に通知追加
 *
 * ランクダウン条件（Phase 7-C）:
 *   - 非活動スコアデケイ: rank_ledger.updated_at から DECAY_INACTIVE_DAYS 日以上
 *     スコアが更新されていない場合、DECAY_RATE (10%) のスコア減少を適用する。
 *   - デケイは1日1回まで（updated_at が今日付けに更新されていれば再適用しない）。
 *   - デケイ後にスコアが現在ランクの minScore を下回ったらランクダウン。
 *   - ランクダウン時に users.rank 更新 + notifications に rank_down 通知追加。
 *   - Bronzeはランクダウンしない（最低ランク）。
 */

import { v4 as uuidv4 } from 'uuid';
import { eq, sql } from 'drizzle-orm';
import { db } from '../db/index.js';
import { rankLedger, users, notifications } from '../db/schema.js';

// ── 定数 ─────────────────────────────────────────────────────────────────────

/** ランク係数（スコア増分の重み） */
const RANK_WEIGHT_FOR_SCORE: Record<string, number> = {
  Bronze: 1.0,
  Silver: 0.9,
  Gold: 0.75,
  Platinum: 0.5,
};

/** ランク昇格閾値（このスコアに達したら次のランクへ） */
const RANK_THRESHOLDS: Array<{ rank: string; minScore: number; nextRank: string | null; nextScore: number }> = [
  { rank: 'Bronze',   minScore: 0,      nextRank: 'Silver',   nextScore: 1_000  },
  { rank: 'Silver',   minScore: 1_000,  nextRank: 'Gold',     nextScore: 6_000  },
  { rank: 'Gold',     minScore: 6_000,  nextRank: 'Platinum', nextScore: 26_000 },
  { rank: 'Platinum', minScore: 26_000, nextRank: null,       nextScore: 999_999 },
];

/** ランク名 → インデックスのマップ */
const RANK_INDEX: Record<string, number> = {
  Bronze: 0,
  Silver: 1,
  Gold: 2,
  Platinum: 3,
};

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/**
 * スコアから適切なランクを決定する
 */
export function getRankFromScore(score: number): string {
  for (let i = RANK_THRESHOLDS.length - 1; i >= 0; i--) {
    if (score >= RANK_THRESHOLDS[i].minScore) {
      return RANK_THRESHOLDS[i].rank;
    }
  }
  return 'Bronze';
}

/**
 * 現在のランクに対する次のランクのスコア閾値を返す
 */
export function getNextRankScore(rank: string): number {
  const threshold = RANK_THRESHOLDS.find(t => t.rank === rank);
  return threshold?.nextScore ?? 999_999;
}

/**
 * ランクスコアの増分を計算する
 */
export function calculateScoreIncrement(points: number, rank: string): number {
  const weight = RANK_WEIGHT_FOR_SCORE[rank] ?? 1.0;
  return Math.ceil(points * weight);
}

// ── ランクダウン定数 ──────────────────────────────────────────────────────────

/**
 * 非活動ダウンデケイ: この日数以上スコアが更新されていない場合にデケイを適用
 * 仮定: 7日間アクティビティがない = 参加意欲低下 → スコアを10%減少
 */
export const DECAY_INACTIVE_DAYS = 7;

/**
 * デケイ率: スコアを何割に減らすか (0.9 = 10%減)
 */
export const DECAY_RATE = 0.9;

/** ランク降格閾値（このスコアを下回ったら前のランクへ） */
const RANK_DOWN_THRESHOLDS: Record<string, { prevRank: string; minScore: number }> = {
  Bronze:   { prevRank: 'Bronze',   minScore: 0 },      // ダウンなし
  Silver:   { prevRank: 'Bronze',   minScore: 1_000 },
  Gold:     { prevRank: 'Silver',   minScore: 6_000 },
  Platinum: { prevRank: 'Gold',     minScore: 26_000 },
};

// ── ランクアップ通知 ──────────────────────────────────────────────────────────

const RANK_UP_MESSAGES: Record<string, { title: string; body: string }> = {
  Silver: {
    title: '🥈 シルバーランクに昇格！',
    body: 'おめでとうございます！シルバーランクに昇格しました。ポイント獲得量が1.2倍になります。',
  },
  Gold: {
    title: '🥇 ゴールドランクに昇格！',
    body: 'おめでとうございます！ゴールドランクに昇格しました。ポイント獲得量が1.5倍になります。',
  },
  Platinum: {
    title: '💎 プラチナランクに昇格！',
    body: 'おめでとうございます！最高位のプラチナランクに昇格しました。ポイント獲得量が2倍になります！',
  },
};

async function createRankUpNotification(userId: string, newRank: string): Promise<void> {
  const msg = RANK_UP_MESSAGES[newRank];
  if (!msg) return;

  try {
    await db.insert(notifications).values({
      id: uuidv4(),
      user_id: userId,
      type: 'rank_up',
      title: msg.title,
      body: msg.body,
      is_read: false,
    });
  } catch (err) {
    console.error('[RankService] Failed to create rank-up notification:', err);
  }
}

// ── ランクダウン通知 ──────────────────────────────────────────────────────────

const RANK_DOWN_MESSAGES: Record<string, { title: string; body: string }> = {
  Gold: {
    title: '⚠️ ゴールドランクに降格しました',
    body: '長期間の非活動によりプラチナランクから降格しました。ネットワークに再参加してランクを取り戻しましょう！',
  },
  Silver: {
    title: '⚠️ シルバーランクに降格しました',
    body: '長期間の非活動によりゴールドランクから降格しました。ネットワークに再参加してランクを取り戻しましょう！',
  },
  Bronze: {
    title: '⚠️ ブロンズランクに降格しました',
    body: '長期間の非活動によりシルバーランクから降格しました。ネットワークに再参加してランクを取り戻しましょう！',
  },
};

async function createRankDownNotification(userId: string, newRank: string): Promise<void> {
  const msg = RANK_DOWN_MESSAGES[newRank];
  if (!msg) return;

  try {
    await db.insert(notifications).values({
      id: uuidv4(),
      user_id: userId,
      type: 'rank_down',
      title: msg.title,
      body: msg.body,
      is_read: false,
    });
  } catch (err) {
    console.error('[RankService] Failed to create rank-down notification:', err);
  }
}

// ── メイン関数 ─────────────────────────────────────────────────────────────────

export interface UpdateRankScoreParams {
  userId: string;
  points: number;
}

export interface UpdateRankScoreResult {
  scoreIncrement: number;
  newScore: number;
  oldRank: string;
  newRank: string;
  rankChanged: boolean;
}

/**
 * ランクスコアを更新し、必要に応じてランクアップ処理を行う
 *
 * - rank_ledger が存在しない場合は新規作成
 * - スコアを加算
 * - 閾値超えの場合はランク昇格
 * - ランクアップ時は users.rank も更新 + 通知作成
 */
export async function updateRankScore(params: UpdateRankScoreParams): Promise<UpdateRankScoreResult> {
  const { userId, points } = params;

  // rank_ledger の現在値を取得（存在しなければ初期化）
  let entry = db
    .select()
    .from(rankLedger)
    .where(eq(rankLedger.user_id, userId))
    .get();

  if (!entry) {
    // 初回作成
    await db.insert(rankLedger).values({
      id: uuidv4(),
      user_id: userId,
      rank: 'Bronze',
      score: 0,
      next_rank_score: 1_000,
    });
    entry = db
      .select()
      .from(rankLedger)
      .where(eq(rankLedger.user_id, userId))
      .get()!;
  }

  const oldRank = entry.rank;
  const scoreIncrement = calculateScoreIncrement(points, oldRank);
  const newScore = entry.score + scoreIncrement;

  // 新しいランクを決定
  const newRank = getRankFromScore(newScore);
  const rankChanged = RANK_INDEX[newRank] > RANK_INDEX[oldRank];
  const nextRankScore = getNextRankScore(newRank);

  // rank_ledger 更新
  await db
    .update(rankLedger)
    .set({
      score: newScore,
      rank: newRank,
      next_rank_score: nextRankScore,
      updated_at: sql`(datetime('now'))`,
      ...(rankChanged ? { rank_changed_at: sql`(datetime('now'))` } : {}),
    })
    .where(eq(rankLedger.user_id, userId));

  // ランクアップ時: users.rank 更新 + 通知
  if (rankChanged) {
    await db
      .update(users)
      .set({
        rank: newRank,
        updated_at: sql`(datetime('now'))`,
      })
      .where(eq(users.id, userId));

    await createRankUpNotification(userId, newRank);

    console.log(`[RankService] Rank up! ${userId}: ${oldRank} → ${newRank} (score: ${entry.score} → ${newScore})`);
  } else {
    console.log(`[RankService] Score updated for ${userId}: +${scoreIncrement} (${entry.score} → ${newScore}, rank=${newRank})`);
  }

  return {
    scoreIncrement,
    newScore,
    oldRank,
    newRank,
    rankChanged,
  };
}

// ── Phase 7-D: 連続参加日数・総参加日数・平均参加時間 更新 ────────────────────────

/**
 * 1日の参加セッション終了時に rank_ledger を更新する。
 *
 * 更新内容:
 *   - total_days_active: ユーザーがネットワークに参加した累積日数
 *   - consecutive_days : 連続参加日数（昨日も参加していれば +1、途切れたらリセット）
 *   - avg_participation_hours: 直近 30 日の平均参加時間（hours/day）
 *
 * 呼び出しタイミング:
 *   - WebSocket 切断時 or leave_network 時（handler.ts の onClose / handleLeaveNetwork）
 *   - 同日に複数回呼ばれてもべき等になるよう設計（当日すでに記録済みならスキップ）
 *
 * @param userId           対象ユーザー ID
 * @param sessionMinutes   今回のセッション参加時間（分）
 */
export interface RecordDailyParticipationResult {
  recorded: boolean;          // 今日初回の記録か
  totalDaysActive: number;
  consecutiveDays: number;
  avgParticipationHours: number;
}

export async function recordDailyParticipation(
  userId: string,
  sessionMinutes: number,
): Promise<RecordDailyParticipationResult> {
  const entry = db
    .select()
    .from(rankLedger)
    .where(eq(rankLedger.user_id, userId))
    .get();

  // rank_ledger が存在しない場合はスキップ（Bronze デフォルトのままにする）
  if (!entry) {
    return {
      recorded: false,
      totalDaysActive: 0,
      consecutiveDays: 0,
      avgParticipationHours: 0,
    };
  }

  const todayStr = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // rank_changed_at を「最終参加日」のプロキシとして使うのは意味論的に誤るため、
  // avg_participation_hours の更新 updated_at で今日の参加済みかを判定する。
  // ただし rank_ledger.updated_at はデケイでも更新されるため注意が必要。
  // Phase 7-D では separate フィールドを追加せず、
  // updated_at が今日付けかつデケイ以外（sessionMinutes > 0）の場合をガードとする。
  // → より正確には consecutive_days フィールドを参照する。
  //   「今日の参加日記録済み」= total_days_active が今日すでに加算されているか確認
  //   するために last_participated_date 相当の情報が必要だが、
  //   スキーマ変更はPhase 7-Dのスコープとしては大きすぎるため、
  //   「今日 rank_ledger.updated_at が今日付けで avg_participation_hours > 0」を
  //   参考程度に使い、同日二重記録はセッション数で制限するのではなく
  //   「べき等でなく加算」を許容する（分単位加算は問題ない）設計とする。
  //   consecutive_days / total_days_active の当日重複カウントは
  //   updated_at === today の場合はスキップする。

  const lastUpdatedDate = entry.updated_at ? entry.updated_at.slice(0, 10) : null;
  const isFirstToday = lastUpdatedDate !== todayStr;

  // consecutive_days 計算
  let newConsecutiveDays = entry.consecutive_days;
  let newTotalDaysActive = entry.total_days_active;

  if (isFirstToday) {
    // 昨日も参加していたか判定（updated_at が昨日付け = 連続）
    const yesterdayStr = (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().slice(0, 10);
    })();

    if (lastUpdatedDate === yesterdayStr) {
      newConsecutiveDays = entry.consecutive_days + 1;
    } else if (lastUpdatedDate !== null) {
      // 2日以上空いた = 連続リセット
      newConsecutiveDays = 1;
    } else {
      // 初回
      newConsecutiveDays = 1;
    }

    newTotalDaysActive = entry.total_days_active + 1;
  }

  // avg_participation_hours: 前回の値を EWMA（指数移動平均）で更新
  // α = 1/30 で直近30日を反映するEWMA
  const sessionHours = sessionMinutes / 60;
  const alpha = 1 / 30;
  const prevAvg = entry.avg_participation_hours;
  const newAvgHours =
    prevAvg === 0
      ? sessionHours
      : prevAvg * (1 - alpha) + sessionHours * alpha;

  // rank_ledger 更新
  await db
    .update(rankLedger)
    .set({
      consecutive_days: newConsecutiveDays,
      total_days_active: newTotalDaysActive,
      avg_participation_hours: Math.round(newAvgHours * 1000) / 1000, // 小数3桁
      updated_at: sql`(datetime('now'))`,
    })
    .where(eq(rankLedger.user_id, userId));

  console.log(
    `[RankService] Daily participation recorded for ${userId}: ` +
    `consecutive=${newConsecutiveDays}, total_days=${newTotalDaysActive}, ` +
    `avg_hours=${newAvgHours.toFixed(3)}h/day (session=${sessionMinutes.toFixed(1)}min)`,
  );

  return {
    recorded: isFirstToday,
    totalDaysActive: newTotalDaysActive,
    consecutiveDays: newConsecutiveDays,
    avgParticipationHours: newAvgHours,
  };
}

// ── Phase 7-C: ランクダウン ───────────────────────────────────────────────────

export interface CheckRankDecayResult {
  decayApplied: boolean;
  decayAmount: number;
  newScore: number;
  oldRank: string;
  newRank: string;
  rankChanged: boolean;
}

/**
 * 非活動によるスコアデケイとランクダウンをチェック・適用する
 *
 * 呼び出しタイミング:
 *   - GET /rank (ランク情報取得時)
 *   - WebSocket hello 認証完了時（接続ごとに1回）
 *
 * デケイ条件:
 *   - rank_ledger.updated_at から DECAY_INACTIVE_DAYS 日以上経過
 *   - かつ今日はまだデケイを適用していない（当日更新済みなら再適用しない）
 *
 * デケイ処理:
 *   - score = floor(score × DECAY_RATE)
 *   - デケイ後スコアが現ランクの minScore を下回ればランクダウン
 *   - Bronze は最低ランクのためデケイはするがランクダウンなし
 */
export async function checkAndApplyRankDecay(userId: string): Promise<CheckRankDecayResult> {
  const entry = db
    .select()
    .from(rankLedger)
    .where(eq(rankLedger.user_id, userId))
    .get();

  // rank_ledger が存在しない場合はデケイ不要
  if (!entry) {
    return {
      decayApplied: false,
      decayAmount: 0,
      newScore: 0,
      oldRank: 'Bronze',
      newRank: 'Bronze',
      rankChanged: false,
    };
  }

  const oldRank = entry.rank;
  const oldScore = entry.score;

  // 今日の日付 (UTC YYYY-MM-DD)
  const todayStr = new Date().toISOString().slice(0, 10);

  // updated_at の日付を取得
  const updatedAtStr = entry.updated_at ? entry.updated_at.slice(0, 10) : null;

  // 今日すでに更新済みならデケイ不適用（1日1回制限）
  if (updatedAtStr === todayStr) {
    return {
      decayApplied: false,
      decayAmount: 0,
      newScore: oldScore,
      oldRank,
      newRank: oldRank,
      rankChanged: false,
    };
  }

  // 最終更新から DECAY_INACTIVE_DAYS 日以上経過しているか確認
  const updatedAt = updatedAtStr ? new Date(updatedAtStr) : null;
  if (!updatedAt) {
    return {
      decayApplied: false,
      decayAmount: 0,
      newScore: oldScore,
      oldRank,
      newRank: oldRank,
      rankChanged: false,
    };
  }

  const today = new Date(todayStr);
  const diffMs = today.getTime() - updatedAt.getTime();
  const diffDays = diffMs / (1000 * 60 * 60 * 24);

  if (diffDays < DECAY_INACTIVE_DAYS) {
    return {
      decayApplied: false,
      decayAmount: 0,
      newScore: oldScore,
      oldRank,
      newRank: oldRank,
      rankChanged: false,
    };
  }

  // デケイ適用: score = floor(score * DECAY_RATE)
  const newScore = Math.floor(oldScore * DECAY_RATE);
  const decayAmount = oldScore - newScore;

  // ランクダウン判定
  const newRank = getRankFromScore(newScore);
  const rankChanged = RANK_INDEX[oldRank] > RANK_INDEX[newRank];
  const nextRankScore = getNextRankScore(newRank);

  // rank_ledger 更新
  await db
    .update(rankLedger)
    .set({
      score: newScore,
      rank: newRank,
      next_rank_score: nextRankScore,
      updated_at: sql`(datetime('now'))`,
      ...(rankChanged ? { rank_changed_at: sql`(datetime('now'))` } : {}),
    })
    .where(eq(rankLedger.user_id, userId));

  // ランクダウン時: users.rank 更新 + 通知作成
  if (rankChanged) {
    await db
      .update(users)
      .set({
        rank: newRank,
        updated_at: sql`(datetime('now'))`,
      })
      .where(eq(users.id, userId));

    await createRankDownNotification(userId, newRank);

    console.log(
      `[RankService] Rank DOWN! ${userId}: ${oldRank} → ${newRank} ` +
      `(score: ${oldScore} → ${newScore}, inactive ${Math.floor(diffDays)} days)`,
    );
  } else {
    console.log(
      `[RankService] Score decayed for ${userId}: ${oldScore} → ${newScore} ` +
      `(-${decayAmount}, inactive ${Math.floor(diffDays)} days, rank=${newRank})`,
    );
  }

  return {
    decayApplied: true,
    decayAmount,
    newScore,
    oldRank,
    newRank,
    rankChanged,
  };
}
