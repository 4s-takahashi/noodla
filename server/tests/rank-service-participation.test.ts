/**
 * rank-service-participation.test.ts — Phase 7-D: 参加日数・連続日数・平均参加時間の単体テスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  recordDailyParticipation,
} from '../src/services/rank-service.js';

// ── DB モック ─────────────────────────────────────────────────────────────────

const mockSelectGet = vi.fn(() => undefined as unknown);
const mockUpdateRun = vi.fn();

vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockSelectGet,
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: mockUpdateRun,
        })),
      })),
    })),
  },
}));

vi.mock('../src/db/schema.js', () => ({
  users: 'users',
  rankLedger: 'rank_ledger',
  notifications: 'notifications',
}));

// ── ヘルパー ──────────────────────────────────────────────────────────────────

/** today から daysAgo 日前の日付文字列 (YYYY-MM-DD HH:MM:SS) を返す */
function daysAgoDateStr(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  return d.toISOString().replace('T', ' ').slice(0, 19);
}

/** 今日の日付文字列 (YYYY-MM-DD HH:MM:SS) */
function todayDateStr(): string {
  return new Date().toISOString().replace('T', ' ').slice(0, 19);
}

/** 昨日の日付文字列 (YYYY-MM-DD HH:MM:SS) */
function yesterdayDateStr(): string {
  return daysAgoDateStr(1);
}

// ── テスト ────────────────────────────────────────────────────────────────────

describe('recordDailyParticipation — rank_ledger が存在しない場合', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('rank_ledger が存在しない場合は recorded=false を返しスキップ', async () => {
    const result = await recordDailyParticipation('user-no-ledger', 30);

    expect(result.recorded).toBe(false);
    expect(result.totalDaysActive).toBe(0);
    expect(result.consecutiveDays).toBe(0);
    expect(result.avgParticipationHours).toBe(0);
    expect(mockUpdateRun).not.toHaveBeenCalled();
  });
});

describe('recordDailyParticipation — 初回参加（total_days=0, consecutive=0）', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-1',
      user_id: 'user-new',
      rank: 'Bronze',
      score: 0,
      next_rank_score: 1_000,
      consecutive_days: 0,
      total_days_active: 0,
      avg_participation_hours: 0,
      updated_at: daysAgoDateStr(3), // 3日前
    });
    mockUpdateRun.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初回参加: total_days=1, consecutive=1, avg_hours=セッション時間', async () => {
    const result = await recordDailyParticipation('user-new', 60); // 1 hour session

    expect(result.recorded).toBe(true);
    expect(result.totalDaysActive).toBe(1);
    expect(result.consecutiveDays).toBe(1);
    // avg_hours: 初回 → セッション時間そのまま (60min = 1.0h)
    expect(result.avgParticipationHours).toBeCloseTo(1.0, 3);
  });
});

describe('recordDailyParticipation — 連続参加（昨日も参加）', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-2',
      user_id: 'user-streak',
      rank: 'Silver',
      score: 2_000,
      next_rank_score: 6_000,
      consecutive_days: 5,
      total_days_active: 10,
      avg_participation_hours: 1.5,
      updated_at: yesterdayDateStr(), // 昨日更新済み
    });
    mockUpdateRun.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('昨日も参加: consecutive_days が +1 される', async () => {
    const result = await recordDailyParticipation('user-streak', 90); // 1.5h session

    expect(result.recorded).toBe(true);
    expect(result.consecutiveDays).toBe(6); // 5 + 1
    expect(result.totalDaysActive).toBe(11);
    // EWMA: prev=1.5, session=1.5h, alpha=1/30
    // newAvg = 1.5 * (29/30) + 1.5 * (1/30) = 1.5
    expect(result.avgParticipationHours).toBeCloseTo(1.5, 2);
  });
});

describe('recordDailyParticipation — 連続中断（2日以上空いた）', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-3',
      user_id: 'user-break',
      rank: 'Gold',
      score: 8_000,
      next_rank_score: 26_000,
      consecutive_days: 10,
      total_days_active: 30,
      avg_participation_hours: 2.0,
      updated_at: daysAgoDateStr(3), // 3日前（昨日ではない）
    });
    mockUpdateRun.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('2日以上空いた: consecutive_days が 1 にリセットされる', async () => {
    const result = await recordDailyParticipation('user-break', 30);

    expect(result.recorded).toBe(true);
    expect(result.consecutiveDays).toBe(1); // リセット
    expect(result.totalDaysActive).toBe(31); // 累積は継続
    // EWMA: prev=2.0, session=0.5h, alpha=1/30
    // newAvg = 2.0 * (29/30) + 0.5 * (1/30) ≈ 1.9500
    expect(result.avgParticipationHours).toBeCloseTo(2.0 * (29 / 30) + (30 / 60) * (1 / 30), 3);
  });
});

describe('recordDailyParticipation — 今日すでに記録済み（重複防止）', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-4',
      user_id: 'user-today',
      rank: 'Silver',
      score: 3_000,
      next_rank_score: 6_000,
      consecutive_days: 7,
      total_days_active: 15,
      avg_participation_hours: 1.2,
      updated_at: todayDateStr(), // 今日すでに更新済み
    });
    mockUpdateRun.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('今日すでに記録済み: total_days / consecutive は加算せず avg_hours のみ更新', async () => {
    const result = await recordDailyParticipation('user-today', 30);

    // recorded=false: 今日の初回ではない
    expect(result.recorded).toBe(false);
    // consecutive / total は変更なし
    expect(result.consecutiveDays).toBe(7);
    expect(result.totalDaysActive).toBe(15);
    // avg_hours は EWMA で更新される（追加セッションでも時間は積み上がる）
    const expectedAvg = 1.2 * (29 / 30) + (30 / 60) * (1 / 30);
    expect(result.avgParticipationHours).toBeCloseTo(expectedAvg, 3);
  });
});

describe('recordDailyParticipation — avg_participation_hours の EWMA 計算', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('初回(prev=0): avg = sessionHours そのまま', async () => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-ewma-1',
      user_id: 'user-ewma-1',
      rank: 'Bronze',
      score: 500,
      next_rank_score: 1_000,
      consecutive_days: 0,
      total_days_active: 0,
      avg_participation_hours: 0,
      updated_at: daysAgoDateStr(2),
    });
    mockUpdateRun.mockReturnValue(undefined);

    const result = await recordDailyParticipation('user-ewma-1', 120); // 2 hours

    expect(result.avgParticipationHours).toBeCloseTo(2.0, 3);
  });

  it('prev=2h, session=1h: EWMA で徐々に近づく', async () => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-ewma-2',
      user_id: 'user-ewma-2',
      rank: 'Bronze',
      score: 500,
      next_rank_score: 1_000,
      consecutive_days: 3,
      total_days_active: 5,
      avg_participation_hours: 2.0,
      updated_at: daysAgoDateStr(1),
    });
    mockUpdateRun.mockReturnValue(undefined);

    const result = await recordDailyParticipation('user-ewma-2', 60); // 1 hour

    // EWMA: 2.0 * (29/30) + 1.0 * (1/30) ≈ 1.9667
    const expected = 2.0 * (29 / 30) + 1.0 * (1 / 30);
    expect(result.avgParticipationHours).toBeCloseTo(expected, 3);
  });
});

describe('recordDailyParticipation — Platinum ユーザーの参加記録', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-plat',
      user_id: 'user-platinum',
      rank: 'Platinum',
      score: 50_000,
      next_rank_score: 999_999,
      consecutive_days: 30,
      total_days_active: 60,
      avg_participation_hours: 3.0,
      updated_at: yesterdayDateStr(),
    });
    mockUpdateRun.mockReturnValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('Platinum 30連続 → 31連続, total=61', async () => {
    const result = await recordDailyParticipation('user-platinum', 180); // 3h session

    expect(result.recorded).toBe(true);
    expect(result.consecutiveDays).toBe(31);
    expect(result.totalDaysActive).toBe(61);
    // avg: 3.0 * (29/30) + 3.0 * (1/30) = 3.0 (EWMA 維持)
    expect(result.avgParticipationHours).toBeCloseTo(3.0, 2);
  });
});
