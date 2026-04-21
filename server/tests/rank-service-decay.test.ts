/**
 * rank-service-decay.test.ts — Phase 7-C: ランクダウン (スコアデケイ) の単体テスト
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  checkAndApplyRankDecay,
  DECAY_INACTIVE_DAYS,
  DECAY_RATE,
} from '../src/services/rank-service.js';

// ── DB モック ─────────────────────────────────────────────────────────────────

const mockSelectGet = vi.fn(() => undefined as unknown);
const mockUpdateRun = vi.fn();
const mockInsertValues = vi.fn().mockResolvedValue(undefined);

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
      values: mockInsertValues,
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

// ── テスト ────────────────────────────────────────────────────────────────────

describe('DECAY_INACTIVE_DAYS / DECAY_RATE 定数', () => {
  it('DECAY_INACTIVE_DAYS は 7', () => {
    expect(DECAY_INACTIVE_DAYS).toBe(7);
  });

  it('DECAY_RATE は 0.9', () => {
    expect(DECAY_RATE).toBe(0.9);
  });
});

describe('checkAndApplyRankDecay — rank_ledger が存在しない場合', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue(undefined);
  });

  it('rank_ledger が存在しない場合はデケイ不適用', async () => {
    const result = await checkAndApplyRankDecay('user-no-ledger');

    expect(result.decayApplied).toBe(false);
    expect(result.rankChanged).toBe(false);
    expect(result.newScore).toBe(0);
    expect(result.newRank).toBe('Bronze');
  });
});

describe('checkAndApplyRankDecay — 非活動日数が閾値未満', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-1',
      user_id: 'user-active',
      rank: 'Silver',
      score: 2_000,
      next_rank_score: 6_000,
      updated_at: daysAgoDateStr(3), // 3日前（閾値 7 日未満）
    });
  });

  it('3日間非活動ならデケイ不適用', async () => {
    const result = await checkAndApplyRankDecay('user-active');

    expect(result.decayApplied).toBe(false);
    expect(result.rankChanged).toBe(false);
    expect(result.newScore).toBe(2_000);
    expect(result.oldRank).toBe('Silver');
    expect(result.newRank).toBe('Silver');
  });
});

describe('checkAndApplyRankDecay — 今日すでに更新済み', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-2',
      user_id: 'user-today',
      rank: 'Gold',
      score: 10_000,
      next_rank_score: 26_000,
      updated_at: todayDateStr(), // 今日更新済み
    });
  });

  it('今日更新済みならデケイ不適用（1日1回制限）', async () => {
    const result = await checkAndApplyRankDecay('user-today');

    expect(result.decayApplied).toBe(false);
    expect(result.rankChanged).toBe(false);
    expect(result.newScore).toBe(10_000);
  });
});

describe('checkAndApplyRankDecay — 非活動7日以上でデケイ適用（ランクダウンなし）', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-3',
      user_id: 'user-decay-no-down',
      rank: 'Silver',
      score: 5_000, // 5000 × 0.9 = 4500 → Silver 維持 (>= 1000)
      next_rank_score: 6_000,
      updated_at: daysAgoDateStr(10),
    });
    mockUpdateRun.mockReturnValue(undefined);
  });

  it('10日非活動: スコア 5000 → 4500 (10% 減), Silver 維持', async () => {
    const result = await checkAndApplyRankDecay('user-decay-no-down');

    expect(result.decayApplied).toBe(true);
    expect(result.decayAmount).toBe(500); // 5000 - 4500
    expect(result.newScore).toBe(4_500);  // floor(5000 * 0.9)
    expect(result.oldRank).toBe('Silver');
    expect(result.newRank).toBe('Silver');
    expect(result.rankChanged).toBe(false);
  });
});

describe('checkAndApplyRankDecay — 非活動7日以上でデケイ後ランクダウン', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-4',
      user_id: 'user-decay-down',
      rank: 'Silver',
      score: 1_050, // 1050 × 0.9 = 945 → Bronze に降格 (< 1000)
      next_rank_score: 6_000,
      updated_at: daysAgoDateStr(8),
    });
    mockUpdateRun.mockReturnValue(undefined);
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('8日非活動: スコア 1050 → 945 → Bronze にランクダウン', async () => {
    const result = await checkAndApplyRankDecay('user-decay-down');

    expect(result.decayApplied).toBe(true);
    expect(result.newScore).toBe(945);   // floor(1050 * 0.9)
    expect(result.decayAmount).toBe(105); // 1050 - 945
    expect(result.oldRank).toBe('Silver');
    expect(result.newRank).toBe('Bronze');
    expect(result.rankChanged).toBe(true);
  });
});

describe('checkAndApplyRankDecay — Platinum から Gold へのランクダウン', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-5',
      user_id: 'user-plat-down',
      rank: 'Platinum',
      score: 26_500, // 26500 × 0.9 = 23850 → Gold に降格 (< 26000)
      next_rank_score: 999_999,
      updated_at: daysAgoDateStr(14),
    });
    mockUpdateRun.mockReturnValue(undefined);
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('14日非活動: Platinum スコア 26500 → 23850 → Gold にランクダウン', async () => {
    const result = await checkAndApplyRankDecay('user-plat-down');

    expect(result.decayApplied).toBe(true);
    expect(result.newScore).toBe(23_850); // floor(26500 * 0.9)
    expect(result.oldRank).toBe('Platinum');
    expect(result.newRank).toBe('Gold');
    expect(result.rankChanged).toBe(true);
  });
});

describe('checkAndApplyRankDecay — Bronze はランクダウンしない', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-6',
      user_id: 'user-bronze',
      rank: 'Bronze',
      score: 500,
      next_rank_score: 1_000,
      updated_at: daysAgoDateStr(30), // 30日間非活動
    });
    mockUpdateRun.mockReturnValue(undefined);
  });

  it('30日非活動でも Bronze は Bronze のまま（ランクダウンなし）', async () => {
    const result = await checkAndApplyRankDecay('user-bronze');

    expect(result.decayApplied).toBe(true);
    expect(result.newScore).toBe(450); // floor(500 * 0.9)
    expect(result.oldRank).toBe('Bronze');
    expect(result.newRank).toBe('Bronze');
    expect(result.rankChanged).toBe(false);
  });
});

describe('checkAndApplyRankDecay — ちょうど7日目（境界値）', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-7',
      user_id: 'user-boundary',
      rank: 'Gold',
      score: 10_000,
      next_rank_score: 26_000,
      updated_at: daysAgoDateStr(DECAY_INACTIVE_DAYS), // ちょうど7日前
    });
    mockUpdateRun.mockReturnValue(undefined);
  });

  it('ちょうど DECAY_INACTIVE_DAYS 日前ならデケイ適用', async () => {
    const result = await checkAndApplyRankDecay('user-boundary');

    expect(result.decayApplied).toBe(true);
    expect(result.newScore).toBe(9_000); // floor(10000 * 0.9)
    expect(result.oldRank).toBe('Gold');
    expect(result.newRank).toBe('Gold'); // 9000 >= 6000 なのでGold維持
    expect(result.rankChanged).toBe(false);
  });
});

describe('checkAndApplyRankDecay — Gold から Silver へのランクダウン', () => {
  beforeEach(() => {
    mockSelectGet.mockReturnValue({
      id: 'ledger-8',
      user_id: 'user-gold-down',
      rank: 'Gold',
      score: 6_200, // 6200 × 0.9 = 5580 → Silver に降格 (< 6000)
      next_rank_score: 26_000,
      updated_at: daysAgoDateStr(9),
    });
    mockUpdateRun.mockReturnValue(undefined);
    mockInsertValues.mockResolvedValue(undefined);
  });

  it('9日非活動: Gold スコア 6200 → 5580 → Silver にランクダウン', async () => {
    const result = await checkAndApplyRankDecay('user-gold-down');

    expect(result.decayApplied).toBe(true);
    expect(result.newScore).toBe(5_580); // floor(6200 * 0.9)
    expect(result.oldRank).toBe('Gold');
    expect(result.newRank).toBe('Silver');
    expect(result.rankChanged).toBe(true);
  });
});
