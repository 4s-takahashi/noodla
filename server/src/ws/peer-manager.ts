import { v4 as uuidv4 } from 'uuid';
import type { WSContext } from 'hono/ws';
import type { NetworkStatusMessage } from './types.js';

// ── ConnectedPeer ─────────────────────────────────────────────────────────────

export interface ConnectedPeer {
  installationId: string;
  userId: string;
  ws: WSContext;
  status: 'waiting' | 'participating';
  connectedAt: Date;
  lastHeartbeat: Date;
  os: 'ios' | 'android' | 'unknown';
  pendingJobs: Set<string>;
}

// ── PeerManager ───────────────────────────────────────────────────────────────

export class PeerManager {
  private peers: Map<string, ConnectedPeer> = new Map();
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private broadcastInterval: ReturnType<typeof setInterval> | null = null;

  // heartbeat timeout (30 seconds)
  private readonly HEARTBEAT_TIMEOUT_MS = 30_000;
  // network status broadcast interval (10 seconds)
  private readonly BROADCAST_INTERVAL_MS = 10_000;

  constructor() {
    this.startHeartbeatMonitor();
    this.startBroadcastInterval();
  }

  // ── Peer Registration ──────────────────────────────────────────────────────

  addPeer(peer: Omit<ConnectedPeer, 'connectedAt' | 'lastHeartbeat' | 'pendingJobs'>): void {
    const existing = this.peers.get(peer.installationId);
    if (existing) {
      // 後勝ち: 既存接続を閉じる
      try {
        existing.ws.close(1000, 'Replaced by new connection');
      } catch {
        // ignore close error
      }
      console.log(`[PeerManager] Replacing existing connection for ${peer.installationId}`);
    }

    const connectedPeer: ConnectedPeer = {
      ...peer,
      connectedAt: new Date(),
      lastHeartbeat: new Date(),
      pendingJobs: new Set(),
    };

    this.peers.set(peer.installationId, connectedPeer);
    console.log(`[PeerManager] Added peer: ${peer.installationId} (userId: ${peer.userId}), total: ${this.peers.size}`);
    this.broadcastNetworkStatus();
  }

  removePeer(installationId: string): void {
    if (this.peers.has(installationId)) {
      this.peers.delete(installationId);
      console.log(`[PeerManager] Removed peer: ${installationId}, total: ${this.peers.size}`);
      this.broadcastNetworkStatus();
    }
  }

  // ── Peer Status Updates ────────────────────────────────────────────────────

  setStatus(installationId: string, status: 'waiting' | 'participating'): void {
    const peer = this.peers.get(installationId);
    if (peer) {
      peer.status = status;
      this.broadcastNetworkStatus();
    }
  }

  updateHeartbeat(installationId: string): void {
    const peer = this.peers.get(installationId);
    if (peer) {
      peer.lastHeartbeat = new Date();
    }
  }

  // ── Peer Queries ───────────────────────────────────────────────────────────

  getPeer(installationId: string): ConnectedPeer | undefined {
    return this.peers.get(installationId);
  }

  getParticipatingPeers(): ConnectedPeer[] {
    return Array.from(this.peers.values()).filter(p => p.status === 'participating');
  }

  getAllPeers(): ConnectedPeer[] {
    return Array.from(this.peers.values());
  }

  getPeerCount(): number {
    return this.peers.size;
  }

  getParticipatingCount(): number {
    return this.getParticipatingPeers().length;
  }

  // ── Pending Job Management ─────────────────────────────────────────────────

  addPendingJob(installationId: string, jobId: string): void {
    const peer = this.peers.get(installationId);
    if (peer) {
      peer.pendingJobs.add(jobId);
    }
  }

  removePendingJob(installationId: string, jobId: string): void {
    const peer = this.peers.get(installationId);
    if (peer) {
      peer.pendingJobs.delete(jobId);
    }
  }

  // ── Network Status Broadcast ───────────────────────────────────────────────

  broadcastNetworkStatus(): void {
    const peers = this.getAllPeers();
    const msg: NetworkStatusMessage = {
      type: 'network_status',
      ts: Date.now(),
      msgId: uuidv4(),
      totalOnline: peers.length,
      totalParticipating: peers.filter(p => p.status === 'participating').length,
      peers: peers.map(p => ({
        installationId: p.installationId,
        os: p.os,
        status: p.status,
      })),
    };

    const payload = JSON.stringify(msg);
    for (const peer of peers) {
      try {
        peer.ws.send(payload);
      } catch (err) {
        console.error(`[PeerManager] Failed to send network_status to ${peer.installationId}:`, err);
      }
    }
  }

  // ── Heartbeat Monitor ──────────────────────────────────────────────────────

  private startHeartbeatMonitor(): void {
    this.heartbeatInterval = setInterval(() => {
      const now = Date.now();
      const toRemove: string[] = [];

      for (const [installationId, peer] of this.peers) {
        const elapsed = now - peer.lastHeartbeat.getTime();
        if (elapsed > this.HEARTBEAT_TIMEOUT_MS) {
          console.log(`[PeerManager] Heartbeat timeout for ${installationId} (${elapsed}ms)`);
          toRemove.push(installationId);
        }
      }

      for (const id of toRemove) {
        const peer = this.peers.get(id);
        if (peer) {
          try {
            peer.ws.close(1001, 'Heartbeat timeout');
          } catch {
            // ignore
          }
          this.removePeer(id);
        }
      }
    }, this.HEARTBEAT_TIMEOUT_MS / 3);
  }

  private startBroadcastInterval(): void {
    this.broadcastInterval = setInterval(() => {
      if (this.peers.size > 0) {
        this.broadcastNetworkStatus();
      }
    }, this.BROADCAST_INTERVAL_MS);
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
    if (this.broadcastInterval) {
      clearInterval(this.broadcastInterval);
      this.broadcastInterval = null;
    }
    this.peers.clear();
  }
}

// Singleton
export const peerManager = new PeerManager();
