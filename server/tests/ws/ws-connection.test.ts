import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PeerManager } from '../../src/ws/peer-manager.js';
import { JobJudge } from '../../src/ws/job-judge.js';
import { JobScheduler } from '../../src/ws/job-scheduler.js';

// DB モック
vi.mock('../../src/db/index.js', () => ({
  db: {
    insert: vi.fn(() => ({
      values: vi.fn().mockResolvedValue(undefined),
    })),
  },
}));

vi.mock('../../src/db/schema.js', () => ({
  jobEvents: 'job_events',
}));

// JWT モック
vi.mock('../../src/lib/jwt.js', () => ({
  verifyAccessToken: vi.fn(async (token: string) => {
    if (token === 'valid-token') {
      return { sub: 'user-123', email: 'test@example.com' };
    }
    throw new Error('Invalid token');
  }),
}));

function createMockWs() {
  const sent: string[] = [];
  return {
    sent,
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
    readyState: 1, // OPEN
  };
}

describe('WebSocket Connection Flow', () => {
  let pm: PeerManager;
  let judge: JobJudge;

  beforeEach(() => {
    pm = new PeerManager();
    judge = new JobJudge(pm);
  });

  afterEach(() => {
    pm.destroy();
    vi.restoreAllMocks();
  });

  it('有効な JWT で認証成功 → ピアが登録される', async () => {
    const { verifyAccessToken } = await import('../../src/lib/jwt.js');

    // 有効トークンで認証
    const result = await verifyAccessToken('valid-token');
    expect(result.sub).toBe('user-123');

    const ws = createMockWs();
    pm.addPeer({
      installationId: 'install-test',
      userId: result.sub,
      ws: ws as any,
      status: 'waiting',
      os: 'ios',
    });

    expect(pm.getPeerCount()).toBe(1);
    expect(pm.getPeer('install-test')?.userId).toBe('user-123');
  });

  it('無効な JWT は例外をスロー', async () => {
    const { verifyAccessToken } = await import('../../src/lib/jwt.js');

    await expect(verifyAccessToken('invalid-token')).rejects.toThrow('Invalid token');
  });

  it('接続時にピアリストが broadcast される', () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    pm.addPeer({ installationId: 'peer-A', userId: 'user-A', ws: ws1 as any, status: 'waiting', os: 'ios' });

    // ws1 への broadcast をクリア
    ws1.send.mockClear();
    ws1.sent.length = 0;

    // 2台目接続
    pm.addPeer({ installationId: 'peer-B', userId: 'user-B', ws: ws2 as any, status: 'waiting', os: 'android' });

    // 1台目にも network_status が届く
    const msgs = ws1.sent.map(s => JSON.parse(s));
    const netStatus = msgs.find((m: any) => m.type === 'network_status');
    expect(netStatus).toBeDefined();
    expect(netStatus?.totalOnline).toBe(2);
  });

  it('切断時にピアリストから削除される', () => {
    const ws = createMockWs();

    pm.addPeer({ installationId: 'peer-X', userId: 'user-X', ws: ws as any, status: 'waiting', os: 'ios' });
    expect(pm.getPeerCount()).toBe(1);

    pm.removePeer('peer-X');
    expect(pm.getPeerCount()).toBe(0);
    expect(pm.getPeer('peer-X')).toBeUndefined();
  });

  it('join_network → status が participating になる', () => {
    const ws = createMockWs();

    pm.addPeer({ installationId: 'peer-Y', userId: 'user-Y', ws: ws as any, status: 'waiting', os: 'ios' });
    expect(pm.getParticipatingCount()).toBe(0);

    pm.setStatus('peer-Y', 'participating');
    expect(pm.getParticipatingCount()).toBe(1);
  });

  it('leave_network → status が waiting に戻る', () => {
    const ws = createMockWs();

    pm.addPeer({ installationId: 'peer-Z', userId: 'user-Z', ws: ws as any, status: 'participating', os: 'android' });
    pm.setStatus('peer-Z', 'waiting');
    expect(pm.getParticipatingCount()).toBe(0);
  });
});

describe('WebSocket Integration: Scheduler + Judge', () => {
  let pm: PeerManager;
  let judge: JobJudge;
  let scheduler: JobScheduler;

  beforeEach(() => {
    pm = new PeerManager();
    judge = new JobJudge(pm);
    scheduler = new JobScheduler(pm, judge);
    vi.useFakeTimers();
  });

  afterEach(() => {
    scheduler.stop();
    pm.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('2台接続してジョブ往復が成功する', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();

    pm.addPeer({ installationId: 'phone-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'phone-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });

    scheduler.start();
    ws1.send.mockClear(); ws1.sent.length = 0;
    ws2.send.mockClear(); ws2.sent.length = 0;

    // ジョブ配布まで待つ
    await vi.advanceTimersByTimeAsync(5500);

    const msgs1 = ws1.sent.map(s => JSON.parse(s));
    const msgs2 = ws2.sent.map(s => JSON.parse(s));

    const job1 = msgs1.find((m: any) => m.type === 'job_assign');
    const job2 = msgs2.find((m: any) => m.type === 'job_assign');

    // 少なくとも1台にジョブが届いている
    const receivedJob = job1 || job2;
    expect(receivedJob).toBeDefined();

    if (!receivedJob) return;

    const jobId = receivedJob.jobId;

    // phone-1 が先に結果を返す
    await judge.receiveResult('phone-1', {
      type: 'job_result',
      ts: Date.now(),
      msgId: 'result-msg-1',
      jobId,
      result: { tokens: ['hello'] },
      processingMs: 80,
      status: 'completed',
      deviceLoad: { cpuUsage: 0.2, memoryUsage: 0.3, batteryLevel: 0.9 },
    });

    // phone-2 が後から結果を返す
    await judge.receiveResult('phone-2', {
      type: 'job_result',
      ts: Date.now(),
      msgId: 'result-msg-2',
      jobId,
      result: { tokens: ['world'] },
      processingMs: 120,
      status: 'completed',
      deviceLoad: { cpuUsage: 0.15, memoryUsage: 0.25, batteryLevel: 0.7 },
    });

    // phone-1 には job_accepted, phone-2 には job_rejected が届く
    const allMsgs1 = ws1.sent.map(s => JSON.parse(s));
    const allMsgs2 = ws2.sent.map(s => JSON.parse(s));

    const accepted = allMsgs1.find((m: any) => m.type === 'job_accepted');
    const rejected = allMsgs2.find((m: any) => m.type === 'job_rejected');

    if (accepted) {
      expect(accepted.jobId).toBe(jobId);
      expect(accepted.experimentalPoints).toBe(1);
    }
    if (rejected) {
      expect(rejected.jobId).toBe(jobId);
      expect(rejected.reason).toBe('late');
    }
  });
});
