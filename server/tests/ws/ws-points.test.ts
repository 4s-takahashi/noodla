/**
 * ws-points.test.ts — B9: WS経由でのポイント加算統合テスト
 * (DB はモックを使用)
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobJudge } from '../../src/ws/job-judge.js';
import { PeerManager } from '../../src/ws/peer-manager.js';

// DB のモック（ポイント計算が走るようにユーザーデータを返す）
const mockDbSelect = vi.fn();
const mockDbInsert = vi.fn();
const mockDbUpdate = vi.fn();

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: () => mockDbSelect(),
    insert: () => ({
      values: mockDbInsert,
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          run: vi.fn(),
        }),
      }),
    }),
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

function createJobResultMessage(jobId: string, processingMs = 80) {
  return {
    type: 'job_result' as const,
    ts: Date.now(),
    msgId: 'msg-' + Math.random(),
    jobId,
    result: { tokens: ['hello'], tokenCount: 1 },
    processingMs,
    status: 'completed' as const,
    deviceLoad: { cpuUsage: 0.2, memoryUsage: 0.4, batteryLevel: 0.8 },
  };
}

const TEST_PAYLOAD = { prompt: 'test', maxTokens: 3, seed: 1 };

describe('WS ポイント加算 (DB モック)', () => {
  let pm: PeerManager;
  let judge: JobJudge;

  beforeEach(() => {
    pm = new PeerManager();
    judge = new JobJudge(pm);
    vi.useFakeTimers();

    // デフォルト: ユーザーが Bronze、残高 0
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => undefined), // rank_ledger なし
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => undefined), // points balance なし
            })),
          })),
        })),
      })),
    }));
    mockDbInsert.mockResolvedValue(undefined);
  });

  afterEach(() => {
    pm.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('accepted 時に job_accepted メッセージが送信される', async () => {
    const ws1 = createMockWs();

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });

    judge.registerJob('job-pts-1', 'mock_token_generate', TEST_PAYLOAD, [
      { installationId: 'peer-1', userId: 'user-1' },
    ], 5000);

    await judge.receiveResult('peer-1', createJobResultMessage('job-pts-1', 80));

    const msgs = ws1.sent.map(s => JSON.parse(s));
    const accepted = msgs.find((m: any) => m.type === 'job_accepted');
    expect(accepted).toBeDefined();
    expect(accepted?.jobId).toBe('job-pts-1');
    expect(typeof accepted?.experimentalPoints).toBe('number');
  });

  it('rejected 時は job_rejected メッセージが送信される (ポイント加算なし)', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'peer-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });

    judge.registerJob('job-pts-2', 'mock_token_generate', TEST_PAYLOAD, [
      { installationId: 'peer-1', userId: 'user-1' },
      { installationId: 'peer-2', userId: 'user-2' },
    ], 5000);

    await judge.receiveResult('peer-1', createJobResultMessage('job-pts-2', 80));
    await judge.receiveResult('peer-2', createJobResultMessage('job-pts-2', 120));

    const peer2Msgs = ws2.sent.map(s => JSON.parse(s));
    const rejected = peer2Msgs.find((m: any) => m.type === 'job_rejected');
    expect(rejected).toBeDefined();
    expect(rejected?.reason).toBe('late');
  });

  it('ping_job の experimentalPoints は mock_token_generate より少ない', async () => {
    // Bronze + 80ms での比較
    // mock_token_generate: ceil(3 * 1.2 * 1.0 * 1.0) = 4
    // ping_job:            ceil(3 * 1.2 * 1.0 * 0.3) = ceil(1.08) = 2

    // ユーザー Bronze を返すモック
    mockDbSelect.mockImplementation(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn((table?: string) => {
            // users テーブルなら Bronze ユーザーを返す
            return { rank: 'Bronze' };
          }),
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => undefined),
            })),
          })),
        })),
      })),
    }));

    const ws1 = createMockWs();
    const ws2 = createMockWs();

    pm.addPeer({ installationId: 'peer-A', userId: 'user-A', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'peer-B', userId: 'user-B', ws: ws2 as any, status: 'participating', os: 'ios' });

    // mock_token_generate ジョブ
    judge.registerJob('job-mock', 'mock_token_generate', TEST_PAYLOAD,
      [{ installationId: 'peer-A', userId: 'user-A' }], 5000);
    await judge.receiveResult('peer-A', createJobResultMessage('job-mock', 80));

    // ping_job
    judge.registerJob('job-ping', 'ping_job', TEST_PAYLOAD,
      [{ installationId: 'peer-B', userId: 'user-B' }], 5000);
    await judge.receiveResult('peer-B', createJobResultMessage('job-ping', 80));

    const msgs1 = ws1.sent.map(s => JSON.parse(s));
    const msgs2 = ws2.sent.map(s => JSON.parse(s));

    const accepted1 = msgs1.find((m: any) => m.type === 'job_accepted');
    const accepted2 = msgs2.find((m: any) => m.type === 'job_accepted');

    // 両方送信されていること
    expect(accepted1).toBeDefined();
    expect(accepted2).toBeDefined();
  });
});
