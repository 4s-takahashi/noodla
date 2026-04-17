import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobJudge } from '../../src/ws/job-judge.js';
import { PeerManager } from '../../src/ws/peer-manager.js';

// DB のモック
vi.mock('../../src/db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          orderBy: vi.fn(() => ({
            limit: vi.fn(() => ({
              get: vi.fn(() => undefined),
            })),
          })),
          get: vi.fn(() => undefined),
        })),
      })),
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

// Mock WSContext
function createMockWs() {
  const sent: string[] = [];
  return {
    sent,
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
  };
}

function createJobResultMessage(jobId: string, processingMs: number = 100) {
  return {
    type: 'job_result' as const,
    ts: Date.now(),
    msgId: 'msg-' + Math.random(),
    jobId,
    result: { tokens: ['hello', 'world'], tokenCount: 2 },
    processingMs,
    status: 'completed' as const,
    deviceLoad: { cpuUsage: 0.2, memoryUsage: 0.4, batteryLevel: 0.8 },
  };
}

const TEST_PAYLOAD = { prompt: 'test prompt', maxTokens: 3, seed: 12345 };

describe('JobJudge', () => {
  let pm: PeerManager;
  let judge: JobJudge;

  beforeEach(() => {
    pm = new PeerManager();
    judge = new JobJudge(pm);
    vi.useFakeTimers();
  });

  afterEach(() => {
    pm.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('最初に届いた結果は accepted', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'peer-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });

    judge.registerJob(
      'job-001',
      'mock_token_generate',
      TEST_PAYLOAD,
      [
        { installationId: 'peer-1', userId: 'user-1' },
        { installationId: 'peer-2', userId: 'user-2' },
      ],
      5000,
    );

    // peer-1 が先に結果を返す
    await judge.receiveResult('peer-1', createJobResultMessage('job-001', 80));

    // peer-1 に job_accepted が届く
    const peer1Messages = ws1.sent.map(s => JSON.parse(s));
    const accepted = peer1Messages.find((m: any) => m.type === 'job_accepted');
    expect(accepted).toBeDefined();
    expect(accepted?.jobId).toBe('job-001');
    // Phase 6: experimentalPoints は実際の獲得ポイント数（DB モック時は 0）
    expect(typeof accepted?.experimentalPoints).toBe('number');
    expect(accepted?.experimentalPoints).toBeGreaterThanOrEqual(0);
  });

  it('2番目に届いた結果は rejected (late)', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'peer-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });

    judge.registerJob(
      'job-002',
      'mock_token_generate',
      TEST_PAYLOAD,
      [
        { installationId: 'peer-1', userId: 'user-1' },
        { installationId: 'peer-2', userId: 'user-2' },
      ],
      5000,
    );

    // peer-1 が先、peer-2 が後
    await judge.receiveResult('peer-1', createJobResultMessage('job-002', 80));
    await judge.receiveResult('peer-2', createJobResultMessage('job-002', 120));

    const peer2Messages = ws2.sent.map(s => JSON.parse(s));
    const rejected = peer2Messages.find((m: any) => m.type === 'job_rejected');
    expect(rejected).toBeDefined();
    expect(rejected?.reason).toBe('late');
  });

  it('タイムアウト時は rejected (timeout)', async () => {
    const ws1 = createMockWs();

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });

    judge.registerJob(
      'job-003',
      'mock_token_generate',
      TEST_PAYLOAD,
      [{ installationId: 'peer-1', userId: 'user-1' }],
      500, // 0.5秒タイムアウト
    );

    // 0.5秒後にタイムアウト
    await vi.runAllTimersAsync();

    const peer1Messages = ws1.sent.map(s => JSON.parse(s));
    const rejected = peer1Messages.find((m: any) => m.type === 'job_rejected');
    expect(rejected).toBeDefined();
    expect(rejected?.reason).toBe('timeout');
  });

  it('未知のジョブへの結果は無視される', async () => {
    // 例外が throw されないことを確認
    await expect(
      judge.receiveResult('peer-1', createJobResultMessage('unknown-job', 80)),
    ).resolves.toBeUndefined();
  });

  it('アサインされていないピアからの結果は無視される', async () => {
    const ws1 = createMockWs();
    const wsInterloper = createMockWs();

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'interloper', userId: 'user-x', ws: wsInterloper as any, status: 'participating', os: 'ios' });

    judge.registerJob(
      'job-004',
      'mock_token_generate',
      TEST_PAYLOAD,
      [{ installationId: 'peer-1', userId: 'user-1' }],
      5000,
    );

    // interloper が結果を返そうとする
    await judge.receiveResult('interloper', createJobResultMessage('job-004', 80));

    // peer-1 には何も届かない
    const interloperMessages = wsInterloper.sent.map(s => JSON.parse(s));
    const accepted = interloperMessages.find((m: any) => m.type === 'job_accepted');
    expect(accepted).toBeUndefined();
  });
});
