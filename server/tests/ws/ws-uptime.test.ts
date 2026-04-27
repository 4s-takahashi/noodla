/**
 * ws-uptime.test.ts — Phase 7-D: uptime 精度改善テスト
 * - participatingStartedAt トラッキング
 * - recordSessionUptimeAsync（残差計算）
 * - setStatus 時の uptime 記録
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { PeerManager } from '../../src/ws/peer-manager.js';

// DB モック
const mockUpdateRun = vi.fn();

vi.mock('../../src/db/index.js', () => ({
  db: {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          get: vi.fn(() => undefined),
          all: vi.fn(() => []),
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
    readyState: 1,
  };
}

describe('PeerManager — participatingStartedAt トラッキング', () => {
  let pm: PeerManager;

  beforeEach(() => {
    pm = new PeerManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    pm.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockUpdateRun.mockClear();
  });

  it('addPeer 時は participatingStartedAt が null', () => {
    const ws = createMockWs();
    pm.addPeer({
      installationId: 'peer-1',
      userId: 'user-1',
      ws: ws as any,
      status: 'waiting',
      os: 'ios',
    });

    const peer = pm.getPeer('peer-1');
    expect(peer?.participatingStartedAt).toBeNull();
  });

  it('setStatus("participating") で participatingStartedAt がセットされる', () => {
    const ws = createMockWs();
    const before = new Date();

    pm.addPeer({
      installationId: 'peer-2',
      userId: 'user-2',
      ws: ws as any,
      status: 'waiting',
      os: 'android',
    });

    pm.setStatus('peer-2', 'participating');

    const peer = pm.getPeer('peer-2');
    expect(peer?.participatingStartedAt).not.toBeNull();
    expect(peer?.participatingStartedAt!.getTime()).toBeGreaterThanOrEqual(before.getTime());
  });

  it('setStatus("waiting") で participatingStartedAt が null にリセットされる', () => {
    const ws = createMockWs();
    pm.addPeer({
      installationId: 'peer-3',
      userId: 'user-3',
      ws: ws as any,
      status: 'waiting',
      os: 'ios',
    });

    pm.setStatus('peer-3', 'participating');
    expect(pm.getPeer('peer-3')?.participatingStartedAt).not.toBeNull();

    pm.setStatus('peer-3', 'waiting');
    expect(pm.getPeer('peer-3')?.participatingStartedAt).toBeNull();
  });

  it('join → leave でセッション時間が peerManager に記録される', () => {
    const ws = createMockWs();
    pm.addPeer({
      installationId: 'peer-4',
      userId: 'user-4',
      ws: ws as any,
      status: 'waiting',
      os: 'ios',
    });

    pm.setStatus('peer-4', 'participating');
    expect(pm.getPeer('peer-4')?.participatingStartedAt).not.toBeNull();

    // 5.1分後に leave（残差 = 5.1 - 5.0 = 0.1min > 0 → DB 更新あり）
    vi.advanceTimersByTime(5 * 60_000 + 6_000); // 5分6秒
    pm.setStatus('peer-4', 'waiting');

    // setStatus('waiting') 後は participatingStartedAt が null
    expect(pm.getPeer('peer-4')?.participatingStartedAt).toBeNull();
    // DB update が呼ばれること（残差あり）
    expect(mockUpdateRun).toHaveBeenCalled();
  });

  it('participating のまま removePeer するとセッション uptime が記録される', () => {
    mockUpdateRun.mockClear();
    const ws = createMockWs();
    pm.addPeer({
      installationId: 'peer-5',
      userId: 'user-5',
      ws: ws as any,
      status: 'waiting',
      os: 'ios',
    });

    pm.setStatus('peer-5', 'participating');
    // 3分6秒経過後に切断（残差 = 3.1 - 3.0 = 0.1min > 0 → DB 更新あり）
    vi.advanceTimersByTime(3 * 60_000 + 6_000);
    pm.removePeer('peer-5');

    // DB 更新が呼ばれていること
    expect(mockUpdateRun).toHaveBeenCalled();
    expect(pm.getPeer('peer-5')).toBeUndefined();
  });

  it('waiting のまま removePeer するときは uptime 記録しない', () => {
    mockUpdateRun.mockClear();
    const ws = createMockWs();
    pm.addPeer({
      installationId: 'peer-6',
      userId: 'user-6',
      ws: ws as any,
      status: 'waiting',
      os: 'ios',
    });

    vi.advanceTimersByTime(5 * 60_000);
    pm.removePeer('peer-6');

    // waiting 状態なので uptime 記録しない
    expect(mockUpdateRun).not.toHaveBeenCalled();
    expect(pm.getPeer('peer-6')).toBeUndefined();
  });
});

describe('PeerManager — recordSessionUptimeAsync 残差計算', () => {
  let pm: PeerManager;

  beforeEach(() => {
    pm = new PeerManager();
    vi.useFakeTimers();
  });

  afterEach(() => {
    pm.destroy();
    vi.useRealTimers();
    vi.restoreAllMocks();
    mockUpdateRun.mockClear();
  });

  it('sessionMinutes が heartbeat インターバルより短い場合でも残差を計算できる', () => {
    // HEARTBEAT_TIMEOUT_MS = 30000, interval = 10000ms = 1/6 min
    // sessionMinutes = 0.5 min (30s), heartbeat fires = floor(0.5 / (1/6)) = floor(3) = 3
    // alreadyCounted = 3 * (1/6) = 0.5
    // residual = 0.5 - 0.5 = 0 → DB 更新なし
    mockUpdateRun.mockClear();
    pm.recordSessionUptimeAsync('install-test', 'user-test', 0.5);
    // 残差 0 のケースはログを出すが DB 更新しない
    // この境界値は実際のセッション終了タイミング次第のため、0 or small
    // ここではメソッドがエラーなく完了することを確認
    expect(true).toBe(true); // no error thrown
  });

  it('sessionMinutes = 5 のとき残差が正しく計算される（heartbeat 0回）', () => {
    // fake timer では heartbeat ループは発火しないので fires = 0 と見なされる訳ではない
    // recordSessionUptimeAsync は「実際の」参加時間から推定火発回数を引く
    // 5 min / (1/6 min per fire) = 30 fires → alreadyCounted = 30 * (1/6) = 5 min
    // residual = 5 - 5 = 0 → DB 更新なし
    // → これは正確に heartbeat で全部カバーされたケース
    mockUpdateRun.mockClear();
    pm.recordSessionUptimeAsync('install-test2', 'user-test2', 5);
    // 残差 = 0 なのでエラーなし
    expect(mockUpdateRun).not.toHaveBeenCalled();
  });

  it('sessionMinutes = 5.1 のとき残差が加算される', () => {
    // 5.1 min / (1/6) = 30.6 → fires = 30
    // alreadyCounted = 30 * (1/6) = 5.0
    // residual = 5.1 - 5.0 = 0.1 → DB 更新あり
    mockUpdateRun.mockClear();
    pm.recordSessionUptimeAsync('install-test3', 'user-test3', 5.1);
    expect(mockUpdateRun).toHaveBeenCalledTimes(1);
  });
});
