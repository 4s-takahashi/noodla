/**
 * ws-rank.test.ts — B10: WS経由でのランク更新統合テスト
 * (DB はモックを使用)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobJudge } from '../../src/ws/job-judge.js';
import { PeerManager } from '../../src/ws/peer-manager.js';

// DB のモック
const mockGet = vi.fn(() => undefined);
const mockRankGet = vi.fn(() => undefined);

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: mockGet,
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

vi.mock('../../src/db/schema.js', () => ({
  jobEvents: 'job_events',
  users: 'users',
  pointsLedger: 'points_ledger',
  rankLedger: 'rank_ledger',
  notifications: 'notifications',
  nodeParticipationStates: 'node_participation_states',
}));

function createMockWs() {
  const sent: string[] = [];
  return {
    sent,
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
  };
}

describe('WS ランクスコア更新 (DB モック)', () => {
  let pm: PeerManager;
  let judge: JobJudge;

  beforeEach(() => {
    pm = new PeerManager();
    judge = new JobJudge(pm);
    vi.useFakeTimers();
    // デフォルト: DB に何もない
    mockGet.mockReturnValue(undefined);
  });

  afterEach(() => {
    pm.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('accepted 後も job_accepted が正常に送信される', async () => {
    const ws = createMockWs();
    pm.addPeer({ installationId: 'rank-peer-1', userId: 'rank-user-1', ws: ws as any, status: 'participating', os: 'ios' });

    judge.registerJob('job-rank-1', 'mock_token_generate', { prompt: 'test', maxTokens: 3, seed: 1 },
      [{ installationId: 'rank-peer-1', userId: 'rank-user-1' }], 5000);

    await judge.receiveResult('rank-peer-1', {
      type: 'job_result',
      ts: Date.now(),
      msgId: 'msg-rank-1',
      jobId: 'job-rank-1',
      result: { tokens: ['ok'] },
      processingMs: 80,
      status: 'completed',
      deviceLoad: { cpuUsage: 0.1, memoryUsage: 0.2, batteryLevel: 0.9 },
    });

    const msgs = ws.sent.map(s => JSON.parse(s));
    const accepted = msgs.find((m: any) => m.type === 'job_accepted');
    expect(accepted).toBeDefined();
    expect(accepted?.jobId).toBe('job-rank-1');
  });

  it('DB エラー時も job_accepted は送信される（フォールバック）', async () => {
    const ws = createMockWs();
    pm.addPeer({ installationId: 'rank-peer-2', userId: 'rank-user-2', ws: ws as any, status: 'participating', os: 'ios' });

    // DB エラーをシミュレート
    const { db } = await import('../../src/db/index.js');
    (db.insert as any) = vi.fn(() => ({
      values: vi.fn().mockRejectedValue(new Error('DB Error')),
    }));

    judge.registerJob('job-rank-2', 'mock_token_generate', { prompt: 'test', maxTokens: 2, seed: 2 },
      [{ installationId: 'rank-peer-2', userId: 'rank-user-2' }], 5000);

    await judge.receiveResult('rank-peer-2', {
      type: 'job_result',
      ts: Date.now(),
      msgId: 'msg-rank-2',
      jobId: 'job-rank-2',
      result: {},
      processingMs: 100,
      status: 'completed',
      deviceLoad: { cpuUsage: 0.1, memoryUsage: 0.2, batteryLevel: 0.9 },
    });

    const msgs = ws.sent.map(s => JSON.parse(s));
    const accepted = msgs.find((m: any) => m.type === 'job_accepted');
    // エラーが起きても job_accepted は送信される（experimentalPoints=0）
    expect(accepted).toBeDefined();
  });

  it('timeout 時はランクスコア更新なし', async () => {
    const ws = createMockWs();
    pm.addPeer({ installationId: 'rank-peer-3', userId: 'rank-user-3', ws: ws as any, status: 'participating', os: 'ios' });

    judge.registerJob('job-rank-3', 'mock_token_generate', { prompt: 'test', maxTokens: 2, seed: 3 },
      [{ installationId: 'rank-peer-3', userId: 'rank-user-3' }], 500);

    await vi.runAllTimersAsync();

    const msgs = ws.sent.map(s => JSON.parse(s));
    const rejected = msgs.find((m: any) => m.type === 'job_rejected');
    expect(rejected?.reason).toBe('timeout');

    // job_accepted は送信されない
    const accepted = msgs.find((m: any) => m.type === 'job_accepted');
    expect(accepted).toBeUndefined();
  });
});
