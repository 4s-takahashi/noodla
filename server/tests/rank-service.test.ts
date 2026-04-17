/**
 * rank-service.test.ts — B12: rank-service の単体テスト
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  calculateScoreIncrement,
  getRankFromScore,
  getNextRankScore,
} from '../src/services/rank-service.js';

// DB のモック
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => undefined),
        })),
      })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          run: vi.fn(),
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

// ── getRankFromScore テスト ────────────────────────────────────────────────────

describe('getRankFromScore', () => {
  it('0 → Bronze', () => {
    expect(getRankFromScore(0)).toBe('Bronze');
  });

  it('999 → Bronze', () => {
    expect(getRankFromScore(999)).toBe('Bronze');
  });

  it('1000 → Silver', () => {
    expect(getRankFromScore(1000)).toBe('Silver');
  });

  it('5999 → Silver', () => {
    expect(getRankFromScore(5999)).toBe('Silver');
  });

  it('6000 → Gold', () => {
    expect(getRankFromScore(6000)).toBe('Gold');
  });

  it('25999 → Gold', () => {
    expect(getRankFromScore(25999)).toBe('Gold');
  });

  it('26000 → Platinum', () => {
    expect(getRankFromScore(26000)).toBe('Platinum');
  });

  it('100000 → Platinum', () => {
    expect(getRankFromScore(100000)).toBe('Platinum');
  });
});

// ── getNextRankScore テスト ───────────────────────────────────────────────────

describe('getNextRankScore', () => {
  it('Bronze → 1000', () => {
    expect(getNextRankScore('Bronze')).toBe(1_000);
  });

  it('Silver → 6000', () => {
    expect(getNextRankScore('Silver')).toBe(6_000);
  });

  it('Gold → 26000', () => {
    expect(getNextRankScore('Gold')).toBe(26_000);
  });

  it('Platinum → 999999', () => {
    expect(getNextRankScore('Platinum')).toBe(999_999);
  });
});

// ── calculateScoreIncrement テスト ────────────────────────────────────────────

describe('calculateScoreIncrement', () => {
  it('Bronze → 重み 1.0: 10pt → 10増分', () => {
    expect(calculateScoreIncrement(10, 'Bronze')).toBe(10);
  });

  it('Silver → 重み 0.9: 10pt → 9増分', () => {
    expect(calculateScoreIncrement(10, 'Silver')).toBe(9);
  });

  it('Gold → 重み 0.75: 10pt → 8増分 (ceil(7.5)=8)', () => {
    expect(calculateScoreIncrement(10, 'Gold')).toBe(8);
  });

  it('Platinum → 重み 0.5: 10pt → 5増分', () => {
    expect(calculateScoreIncrement(10, 'Platinum')).toBe(5);
  });

  it('切り上げ: 3 × 0.75 = ceil(2.25) = 3', () => {
    expect(calculateScoreIncrement(3, 'Gold')).toBe(3);
  });

  it('未知ランク → デフォルト 1.0', () => {
    expect(calculateScoreIncrement(5, 'Diamond')).toBe(5);
  });
});

// ── ランクアップ閾値テスト ────────────────────────────────────────────────────

describe('ランクアップ閾値', () => {
  it('Bronze→Silver は 1000 スコアで判定', () => {
    expect(getRankFromScore(999)).toBe('Bronze');
    expect(getRankFromScore(1000)).toBe('Silver');
  });

  it('Silver→Gold は 6000 スコアで判定', () => {
    expect(getRankFromScore(5999)).toBe('Silver');
    expect(getRankFromScore(6000)).toBe('Gold');
  });

  it('Gold→Platinum は 26000 スコアで判定', () => {
    expect(getRankFromScore(25999)).toBe('Gold');
    expect(getRankFromScore(26000)).toBe('Platinum');
  });
});
