/**
 * points-service.test.ts — B11: points-service の単体テスト
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { calculatePoints } from '../src/services/points-service.js';

// DB のモック（awardPoints で使用）
vi.mock('../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => ({ rank: 'Bronze' })),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => undefined),
            })),
          })),
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
  pointsLedger: 'points_ledger',
  rankLedger: 'rank_ledger',
}));

// ── calculatePoints 関数テスト ────────────────────────────────────────────────

describe('calculatePoints', () => {
  describe('速度係数', () => {
    it('≤50ms → 係数 1.5', () => {
      const pts = calculatePoints({ maxTokens: 2, responseMs: 50, rank: 'Bronze', jobType: 'mock_token_generate' });
      // ceil(2 * 1.5 * 1.0 * 1.0) = 3
      expect(pts).toBe(3);
    });

    it('≤100ms → 係数 1.2', () => {
      const pts = calculatePoints({ maxTokens: 2, responseMs: 100, rank: 'Bronze', jobType: 'mock_token_generate' });
      // ceil(2 * 1.2 * 1.0 * 1.0) = 3 (2.4 → ceil = 3)
      expect(pts).toBe(3);
    });

    it('≤300ms → 係数 1.0', () => {
      const pts = calculatePoints({ maxTokens: 2, responseMs: 200, rank: 'Bronze', jobType: 'mock_token_generate' });
      // ceil(2 * 1.0 * 1.0 * 1.0) = 2
      expect(pts).toBe(2);
    });

    it('>300ms → 係数 0.8', () => {
      const pts = calculatePoints({ maxTokens: 2, responseMs: 400, rank: 'Bronze', jobType: 'mock_token_generate' });
      // ceil(2 * 0.8 * 1.0 * 1.0) = ceil(1.6) = 2
      expect(pts).toBe(2);
    });

    it('51ms → ≤100ms 係数', () => {
      const pts = calculatePoints({ maxTokens: 3, responseMs: 51, rank: 'Bronze', jobType: 'mock_token_generate' });
      // ceil(3 * 1.2 * 1.0 * 1.0) = ceil(3.6) = 4
      expect(pts).toBe(4);
    });
  });

  describe('ランク係数', () => {
    it('Bronze → 係数 1.0', () => {
      const pts = calculatePoints({ maxTokens: 3, responseMs: 200, rank: 'Bronze', jobType: 'mock_token_generate' });
      // ceil(3 * 1.0 * 1.0 * 1.0) = 3
      expect(pts).toBe(3);
    });

    it('Silver → 係数 1.2', () => {
      const pts = calculatePoints({ maxTokens: 3, responseMs: 200, rank: 'Silver', jobType: 'mock_token_generate' });
      // ceil(3 * 1.0 * 1.2 * 1.0) = ceil(3.6) = 4
      expect(pts).toBe(4);
    });

    it('Gold → 係数 1.5', () => {
      const pts = calculatePoints({ maxTokens: 3, responseMs: 200, rank: 'Gold', jobType: 'mock_token_generate' });
      // ceil(3 * 1.0 * 1.5 * 1.0) = ceil(4.5) = 5
      expect(pts).toBe(5);
    });

    it('Platinum → 係数 2.0', () => {
      const pts = calculatePoints({ maxTokens: 3, responseMs: 200, rank: 'Platinum', jobType: 'mock_token_generate' });
      // ceil(3 * 1.0 * 2.0 * 1.0) = 6
      expect(pts).toBe(6);
    });

    it('未知ランク → デフォルト 1.0（クランプ後）', () => {
      const pts = calculatePoints({ maxTokens: 2, responseMs: 200, rank: 'Unknown', jobType: 'mock_token_generate' });
      // ceil(2 * 1.0 * 1.0 * 1.0) = 2
      expect(pts).toBe(2);
    });
  });

  describe('ジョブ種別重み', () => {
    it('mock_token_generate → 重み 1.0', () => {
      const pts = calculatePoints({ maxTokens: 2, responseMs: 200, rank: 'Bronze', jobType: 'mock_token_generate' });
      expect(pts).toBe(2);
    });

    it('ping_job → 重み 0.3', () => {
      const pts = calculatePoints({ maxTokens: 2, responseMs: 200, rank: 'Bronze', jobType: 'ping_job' });
      // ceil(2 * 1.0 * 1.0 * 0.3) = ceil(0.6) = 1
      expect(pts).toBe(1);
    });

    it('未知ジョブ → デフォルト重み 1.0', () => {
      const pts = calculatePoints({ maxTokens: 2, responseMs: 200, rank: 'Bronze', jobType: 'unknown_job' });
      expect(pts).toBe(2);
    });
  });

  describe('不正対策', () => {
    it('応答時間 < 10ms → ポイント半減', () => {
      const fastPts = calculatePoints({ maxTokens: 4, responseMs: 5, rank: 'Bronze', jobType: 'mock_token_generate' });
      const normalPts = calculatePoints({ maxTokens: 4, responseMs: 60, rank: 'Bronze', jobType: 'mock_token_generate' });
      // 速すぎる場合は半減
      expect(fastPts).toBeLessThan(normalPts);
    });

    it('最小1pt保証', () => {
      const pts = calculatePoints({ maxTokens: 1, responseMs: 400, rank: 'Bronze', jobType: 'ping_job' });
      // ceil(1 * 0.8 * 1.0 * 0.3) = ceil(0.24) = 1
      expect(pts).toBeGreaterThanOrEqual(1);
    });

    it('maxTokens は 1〜5 にクランプ', () => {
      const pts0 = calculatePoints({ maxTokens: 0, responseMs: 200, rank: 'Bronze', jobType: 'mock_token_generate' });
      const pts6 = calculatePoints({ maxTokens: 6, responseMs: 200, rank: 'Bronze', jobType: 'mock_token_generate' });
      const pts1 = calculatePoints({ maxTokens: 1, responseMs: 200, rank: 'Bronze', jobType: 'mock_token_generate' });
      const pts5 = calculatePoints({ maxTokens: 5, responseMs: 200, rank: 'Bronze', jobType: 'mock_token_generate' });
      expect(pts0).toBe(pts1); // 0 → 1にクランプ
      expect(pts6).toBe(pts5); // 6 → 5にクランプ
    });

    it('RANK_MULTIPLIER クランプ: 1.0〜2.0', () => {
      // Gold (1.5) は範囲内
      const goldPts = calculatePoints({ maxTokens: 2, responseMs: 200, rank: 'Gold', jobType: 'mock_token_generate' });
      expect(goldPts).toBeGreaterThanOrEqual(1);
    });
  });

  describe('複合パターン', () => {
    it('maxTokens=5, 30ms, Gold → 最大ポイント', () => {
      const pts = calculatePoints({ maxTokens: 5, responseMs: 30, rank: 'Gold', jobType: 'mock_token_generate' });
      // ceil(5 * 1.5 * 1.5 * 1.0) = ceil(11.25) = 12
      expect(pts).toBe(12);
    });

    it('maxTokens=1, 400ms, Bronze, ping_job → 最小ポイント', () => {
      const pts = calculatePoints({ maxTokens: 1, responseMs: 400, rank: 'Bronze', jobType: 'ping_job' });
      // ceil(1 * 0.8 * 1.0 * 0.3) = ceil(0.24) = 1
      expect(pts).toBe(1);
    });

    it('Platinum + 50ms + maxTokens=5 → 高ポイント', () => {
      const pts = calculatePoints({ maxTokens: 5, responseMs: 50, rank: 'Platinum', jobType: 'mock_token_generate' });
      // ceil(5 * 1.5 * 2.0 * 1.0) = ceil(15) = 15
      expect(pts).toBe(15);
    });
  });
});
