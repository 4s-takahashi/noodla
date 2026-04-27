import { v4 as uuidv4 } from 'uuid';
import { eq, sql, and } from 'drizzle-orm';
import type { WSContext } from 'hono/ws';
import { db } from '../db/index.js';
import { nodeParticipationStates } from '../db/schema.js';
import type { NetworkStatusMessage, NotificationPushMessage } from './types.js';

// ── ConnectedPeer ─────────────────────────────────────────────────────────────

export interface ConnectedPeer {
  installationId: string;
  userId: string;
  ws: WSContext;
  status: 'waiting' | 'participating';
  connectedAt: Date;
  lastHeartbeat: Date;
  /** セッション開始時刻（join_network 時にセット）。uptime 精度計算に使用 */
  participatingStartedAt: Date | null;
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

  addPeer(peer: Omit<ConnectedPeer, 'connectedAt' | 'lastHeartbeat' | 'pendingJobs' | 'participatingStartedAt'>): void {
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
      participatingStartedAt: null,
      pendingJobs: new Set(),
    };

    this.peers.set(peer.installationId, connectedPeer);
    console.log(`[PeerManager] Added peer: ${peer.installationId} (userId: ${peer.userId}), total: ${this.peers.size}`);
    this.broadcastNetworkStatus();
  }

  removePeer(installationId: string): void {
    const peer = this.peers.get(installationId);
    if (peer) {
      // Phase 7-D: 切断時に participating セッションの正確な uptime を記録
      if (peer.status === 'participating' && peer.participatingStartedAt) {
        const sessionMs = Date.now() - peer.participatingStartedAt.getTime();
        const sessionMinutes = sessionMs / 60_000;
        if (sessionMinutes > 0) {
          this.recordSessionUptimeAsync(installationId, peer.userId, sessionMinutes);
        }
      }

      this.peers.delete(installationId);
      console.log(`[PeerManager] Removed peer: ${installationId}, total: ${this.peers.size}`);
      this.broadcastNetworkStatus();
    }
  }

  // ── Peer Status Updates ────────────────────────────────────────────────────

  setStatus(installationId: string, status: 'waiting' | 'participating'): void {
    const peer = this.peers.get(installationId);
    if (peer) {
      const prevStatus = peer.status;
      peer.status = status;

      // Phase 7-D: participating 開始/終了時刻をトラッキング
      if (status === 'participating' && prevStatus !== 'participating') {
        peer.participatingStartedAt = new Date();
      } else if (status === 'waiting' && prevStatus === 'participating') {
        // leave_network: 参加セッションを終了し DB に正確な uptime を記録
        if (peer.participatingStartedAt) {
          const sessionMs = Date.now() - peer.participatingStartedAt.getTime();
          const sessionMinutes = sessionMs / 60_000;
          if (sessionMinutes > 0) {
            this.recordSessionUptimeAsync(installationId, peer.userId, sessionMinutes);
          }
          peer.participatingStartedAt = null;
        }
      }

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

  // ── Notification Push ─────────────────────────────────────────────────────

  /**
   * 指定した userId に接続中のすべてのピアへ notification_push メッセージを送信する。
   * Phase 7-B: ランクアップなどのリアルタイム通知に使用。
   */
  sendNotificationToUser(
    userId: string,
    notificationId: string,
    notifType: string,
    title: string,
    body: string,
  ): void {
    const msg: NotificationPushMessage = {
      type: 'notification_push',
      ts: Date.now(),
      msgId: uuidv4(),
      notificationId,
      notifType,
      title,
      body,
    };

    const payload = JSON.stringify(msg);
    let sent = 0;

    for (const peer of this.peers.values()) {
      if (peer.userId === userId) {
        try {
          peer.ws.send(payload);
          sent++;
        } catch (err) {
          console.error(`[PeerManager] Failed to send notification to ${peer.installationId}:`, err);
        }
      }
    }

    if (sent > 0) {
      console.log(`[PeerManager] Sent notification ${notifType} to userId ${userId} (${sent} peer(s))`);
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

      // B5: participating ピアの today_uptime_minutes を加算
      // HEARTBEAT_TIMEOUT_MS / 3 秒ごとに呼ばれるので、分単位に換算
      const intervalMinutes = (this.HEARTBEAT_TIMEOUT_MS / 3) / 60_000;
      for (const peer of this.peers.values()) {
        if (peer.status === 'participating') {
          this.incrementUptimeAsync(peer.installationId, peer.userId, intervalMinutes);
        }
      }
    }, this.HEARTBEAT_TIMEOUT_MS / 3);
  }

  /** today_uptime_minutes と total_uptime_minutes を非同期で加算する (heartbeat ベース) */
  private incrementUptimeAsync(installationId: string, userId: string, incrementMinutes: number): void {
    const increment = Math.max(0, Math.round(incrementMinutes * 10) / 10); // 小数点1桁
    if (increment <= 0) return;

    db.update(nodeParticipationStates)
      .set({
        today_uptime_minutes: sql`${nodeParticipationStates.today_uptime_minutes} + ${increment}`,
        total_uptime_minutes: sql`${nodeParticipationStates.total_uptime_minutes} + ${increment}`,
        updated_at: sql`(datetime('now'))`,
      })
      .where(
        and(
          eq(nodeParticipationStates.installation_id, installationId),
          eq(nodeParticipationStates.user_id, userId),
        ),
      )
      .run();
  }

  /**
   * Phase 7-D: セッション終了時（切断 or leave_network）に session_start_at ベースで
   * 正確なセッション時間を today/total_uptime_minutes に反映する。
   * heartbeat ベースのインクリメントとの二重計上を避けるため、
   * ハートビートインターバルで既に加算済みの分を除いた「残差」を加算する。
   *
   * 設計上の注意:
   *   heartbeat モニターが HEARTBEAT_TIMEOUT_MS/3 = 10秒ごとに約0.167分を加算するため、
   *   セッション中は heartbeat ループで概算が積み上がっている。
   *   切断時にはセッション実時間から heartbeat 加算済み推定値を引いた残差を加算し、
   *   合計が session_start_at → 切断時刻と一致するよう補正する。
   */
  public recordSessionUptimeAsync(
    installationId: string,
    userId: string,
    actualSessionMinutes: number,
  ): void {
    // heartbeat ループで加算済みの推定値 (HEARTBEAT_TIMEOUT_MS/3 ms ごとに intervalMinutes を加算)
    const heartbeatIntervalMs = this.HEARTBEAT_TIMEOUT_MS / 3;
    const intervalMinutes = heartbeatIntervalMs / 60_000;
    // セッション中に heartbeat が何回発火したかを推定（切り捨て）
    const heartbeatFires = Math.floor(actualSessionMinutes / intervalMinutes);
    const alreadyCounted = heartbeatFires * intervalMinutes;

    // 残差 = セッション実時間 - 既加算推定値
    const residualMinutes = actualSessionMinutes - alreadyCounted;
    const residual = Math.max(0, Math.round(residualMinutes * 10) / 10);

    if (residual <= 0) {
      console.log(
        `[PeerManager] Session uptime residual for ${installationId}: 0 min (session=${actualSessionMinutes.toFixed(2)}min, counted=${alreadyCounted.toFixed(2)}min)`,
      );
      return;
    }

    console.log(
      `[PeerManager] Recording session uptime residual for ${installationId}: +${residual.toFixed(1)}min ` +
      `(session=${actualSessionMinutes.toFixed(2)}min, heartbeat_counted=${alreadyCounted.toFixed(2)}min)`,
    );

    try {
      db.update(nodeParticipationStates)
        .set({
          today_uptime_minutes: sql`${nodeParticipationStates.today_uptime_minutes} + ${residual}`,
          total_uptime_minutes: sql`${nodeParticipationStates.total_uptime_minutes} + ${residual}`,
          updated_at: sql`(datetime('now'))`,
        })
        .where(
          and(
            eq(nodeParticipationStates.installation_id, installationId),
            eq(nodeParticipationStates.user_id, userId),
          ),
        )
        .run();
    } catch (err) {
      console.error(`[PeerManager] Failed to record session uptime for ${installationId}:`, err);
    }
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
