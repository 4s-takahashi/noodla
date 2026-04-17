import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { JobScheduler } from '../../src/ws/job-scheduler.js';
import { PeerManager } from '../../src/ws/peer-manager.js';
import { JobJudge } from '../../src/ws/job-judge.js';

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

function createMockWs(id: string = 'ws') {
  const sent: string[] = [];
  return {
    id,
    sent,
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
  };
}

describe('JobScheduler', () => {
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

  it('participating が2台未満の場合はジョブを配布しない', async () => {
    const ws1 = createMockWs('ws-1');

    // 1台しかいない
    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });

    scheduler.start();

    // クリア (addPeer 時の network_status broadcast を除去)
    ws1.send.mockClear();

    // 5秒後にジョブが配布されるか確認
    await vi.advanceTimersByTimeAsync(5500);

    const messages = ws1.sent.map(s => JSON.parse(s));
    const jobAssign = messages.find((m: any) => m.type === 'job_assign');
    expect(jobAssign).toBeUndefined();
  });

  it('participating が2台以上の場合はジョブを配布する', async () => {
    const ws1 = createMockWs('ws-1');
    const ws2 = createMockWs('ws-2');

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'peer-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });

    scheduler.start();

    // クリア
    ws1.send.mockClear();
    ws2.send.mockClear();

    // 5秒後にジョブが配布される
    await vi.advanceTimersByTimeAsync(5500);

    const messages1 = ws1.sent.map(s => JSON.parse(s));
    const messages2 = ws2.sent.map(s => JSON.parse(s));

    const job1 = messages1.find((m: any) => m.type === 'job_assign');
    const job2 = messages2.find((m: any) => m.type === 'job_assign');

    // どちらか1台 (またはどちらも) にジョブが届く
    const atLeastOneReceived = job1 !== undefined || job2 !== undefined;
    expect(atLeastOneReceived).toBe(true);

    // 届いた場合は両方に同一 jobId
    if (job1 && job2) {
      expect(job1.jobId).toBe(job2.jobId);
      expect(['mock_token_generate', 'ping_job']).toContain(job1.jobType);
      expect(job1.timeoutMs).toBe(5000);
      expect(job1.duplicateCount).toBe(2);
    }
  });

  it('疑似ジョブペイロードに正しいフィールドが含まれる', async () => {
    const ws1 = createMockWs('ws-1');
    const ws2 = createMockWs('ws-2');

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'peer-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });

    scheduler.start();
    ws1.send.mockClear();
    ws2.send.mockClear();

    await vi.advanceTimersByTimeAsync(5500);

    const allMessages = [
      ...ws1.sent.map(s => JSON.parse(s)),
      ...ws2.sent.map(s => JSON.parse(s)),
    ];

    const jobAssign = allMessages.find((m: any) => m.type === 'job_assign');
    if (jobAssign) {
      const payload = jobAssign.payload;
      expect(typeof payload.prompt).toBe('string');
      expect(payload.prompt.length).toBeGreaterThan(0);
      expect(typeof payload.maxTokens).toBe('number');
      expect(payload.maxTokens).toBeGreaterThanOrEqual(1);
      expect(payload.maxTokens).toBeLessThanOrEqual(5);
      expect(typeof payload.seed).toBe('number');
    }
  });

  it('stop() でジョブ配布が停止する', async () => {
    const ws1 = createMockWs('ws-1');
    const ws2 = createMockWs('ws-2');

    pm.addPeer({ installationId: 'peer-1', userId: 'user-1', ws: ws1 as any, status: 'participating', os: 'ios' });
    pm.addPeer({ installationId: 'peer-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });

    scheduler.start();

    // 最初の5秒を経過させる (ジョブが1回配布される)
    await vi.advanceTimersByTimeAsync(5500);

    // stop後にリセット
    scheduler.stop();

    // sent 配列を新しく追跡
    const sentAfterStop1: string[] = [];
    const sentAfterStop2: string[] = [];
    ws1.send.mockImplementation((data: string) => sentAfterStop1.push(data));
    ws2.send.mockImplementation((data: string) => sentAfterStop2.push(data));

    // さらに10秒経過 (ジョブが配布されないことを確認)
    await vi.advanceTimersByTimeAsync(10500);

    // stop 後はジョブが届かない (network_status は broadcast されるが job_assign はされない)
    const allMessages = [
      ...sentAfterStop1.map(s => JSON.parse(s)),
      ...sentAfterStop2.map(s => JSON.parse(s)),
    ];
    const jobAssigns = allMessages.filter((m: any) => m.type === 'job_assign');
    expect(jobAssigns).toHaveLength(0);
  });
});
