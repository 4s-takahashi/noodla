import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { PeerManager } from '../../src/ws/peer-manager.js';

// Mock WSContext
function createMockWs(id: string = 'mock-ws') {
  const sent: string[] = [];
  return {
    id,
    sent,
    send: vi.fn((data: string) => sent.push(data)),
    close: vi.fn(),
  };
}

describe('PeerManager', () => {
  let pm: PeerManager;

  beforeEach(() => {
    pm = new PeerManager();
  });

  afterEach(() => {
    pm.destroy();
  });

  it('addPeer — ピアを追加できる', () => {
    const ws = createMockWs();
    pm.addPeer({
      installationId: 'install-1',
      userId: 'user-1',
      ws: ws as any,
      status: 'waiting',
      os: 'ios',
    });

    expect(pm.getPeerCount()).toBe(1);
    expect(pm.getPeer('install-1')).toBeDefined();
    expect(pm.getPeer('install-1')?.status).toBe('waiting');
  });

  it('addPeer — 同一 installationId の二重接続は後勝ち', () => {
    const ws1 = createMockWs('ws-1');
    const ws2 = createMockWs('ws-2');

    pm.addPeer({ installationId: 'install-1', userId: 'user-1', ws: ws1 as any, status: 'waiting', os: 'ios' });
    pm.addPeer({ installationId: 'install-1', userId: 'user-1', ws: ws2 as any, status: 'waiting', os: 'ios' });

    // 古い接続は close されている
    expect(ws1.close).toHaveBeenCalled();
    // ピア数は1のまま
    expect(pm.getPeerCount()).toBe(1);
    // 新しい ws に差し替わっている
    expect(pm.getPeer('install-1')?.ws).toBe(ws2);
  });

  it('removePeer — ピアを削除できる', () => {
    const ws = createMockWs();
    pm.addPeer({ installationId: 'install-1', userId: 'user-1', ws: ws as any, status: 'waiting', os: 'ios' });
    pm.removePeer('install-1');

    expect(pm.getPeerCount()).toBe(0);
    expect(pm.getPeer('install-1')).toBeUndefined();
  });

  it('setStatus — ピアのステータスを変更できる', () => {
    const ws = createMockWs();
    pm.addPeer({ installationId: 'install-1', userId: 'user-1', ws: ws as any, status: 'waiting', os: 'ios' });

    pm.setStatus('install-1', 'participating');

    expect(pm.getPeer('install-1')?.status).toBe('participating');
  });

  it('getParticipatingPeers — participating なピアのみ返す', () => {
    const ws1 = createMockWs('ws-1');
    const ws2 = createMockWs('ws-2');
    const ws3 = createMockWs('ws-3');

    pm.addPeer({ installationId: 'install-1', userId: 'user-1', ws: ws1 as any, status: 'waiting', os: 'ios' });
    pm.addPeer({ installationId: 'install-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });
    pm.addPeer({ installationId: 'install-3', userId: 'user-3', ws: ws3 as any, status: 'participating', os: 'ios' });

    const participating = pm.getParticipatingPeers();
    expect(participating).toHaveLength(2);
    expect(participating.every(p => p.status === 'participating')).toBe(true);
  });

  it('updateHeartbeat — heartbeat を更新できる', () => {
    const ws = createMockWs();
    pm.addPeer({ installationId: 'install-1', userId: 'user-1', ws: ws as any, status: 'waiting', os: 'ios' });

    const before = pm.getPeer('install-1')?.lastHeartbeat;
    // 少し待ってから更新
    const laterDate = new Date(Date.now() + 100);
    vi.setSystemTime(laterDate);
    pm.updateHeartbeat('install-1');
    vi.useRealTimers();

    const after = pm.getPeer('install-1')?.lastHeartbeat;
    expect(after?.getTime()).toBeGreaterThanOrEqual(before?.getTime() ?? 0);
  });

  it('addPendingJob / removePendingJob — ジョブを追跡できる', () => {
    const ws = createMockWs();
    pm.addPeer({ installationId: 'install-1', userId: 'user-1', ws: ws as any, status: 'participating', os: 'ios' });

    pm.addPendingJob('install-1', 'job-abc');
    expect(pm.getPeer('install-1')?.pendingJobs.has('job-abc')).toBe(true);

    pm.removePendingJob('install-1', 'job-abc');
    expect(pm.getPeer('install-1')?.pendingJobs.has('job-abc')).toBe(false);
  });

  it('broadcastNetworkStatus — 全ピアにメッセージを送信する', () => {
    const ws1 = createMockWs('ws-1');
    const ws2 = createMockWs('ws-2');

    pm.addPeer({ installationId: 'install-1', userId: 'user-1', ws: ws1 as any, status: 'waiting', os: 'ios' });
    pm.addPeer({ installationId: 'install-2', userId: 'user-2', ws: ws2 as any, status: 'participating', os: 'android' });

    // Clear the automatic broadcast calls from addPeer
    ws1.send.mockClear();
    ws2.send.mockClear();

    pm.broadcastNetworkStatus();

    expect(ws1.send).toHaveBeenCalledOnce();
    expect(ws2.send).toHaveBeenCalledOnce();

    const msg1 = JSON.parse(ws1.sent[ws1.sent.length - 1]);
    expect(msg1.type).toBe('network_status');
    expect(msg1.totalOnline).toBe(2);
    expect(msg1.totalParticipating).toBe(1);
  });
});
