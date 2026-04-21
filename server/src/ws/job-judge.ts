import { v4 as uuidv4 } from 'uuid';
import { eq, and, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import { jobEvents, notifications } from '../db/schema.js';
import { awardPoints } from '../services/points-service.js';
import { updateRankScore } from '../services/rank-service.js';
import type { PeerManager } from './peer-manager.js';
import type { JobAcceptedMessage, JobRejectedMessage, JobResultMessage, PseudoJobPayload } from './types.js';

// ── Pending Job Entry ─────────────────────────────────────────────────────────

interface PendingJobEntry {
  jobId: string;
  jobType: string;
  payload: PseudoJobPayload;
  assignedAt: Date;
  assignedTo: Array<{ installationId: string; userId: string }>;
  results: Map<string, { receivedAt: Date; message: JobResultMessage }>;
  timeoutHandle: ReturnType<typeof setTimeout>;
  settled: boolean;
}

// ── JobJudge ──────────────────────────────────────────────────────────────────

export class JobJudge {
  private pendingJobs: Map<string, PendingJobEntry> = new Map();

  constructor(private readonly peerManager: PeerManager) {}

  // ── Register new job ───────────────────────────────────────────────────────

  registerJob(
    jobId: string,
    jobType: string,
    payload: PseudoJobPayload,
    assignedTo: Array<{ installationId: string; userId: string }>,
    timeoutMs: number,
  ): void {
    const assignedAt = new Date();

    const timeoutHandle = setTimeout(() => {
      this.handleTimeout(jobId);
    }, timeoutMs);

    const entry: PendingJobEntry = {
      jobId,
      jobType,
      payload,
      assignedAt,
      assignedTo,
      results: new Map(),
      timeoutHandle,
      settled: false,
    };

    this.pendingJobs.set(jobId, entry);
    console.log(`[JobJudge] Registered job ${jobId}, assigned to ${assignedTo.map(a => a.installationId).join(', ')}`);
  }

  // ── Receive job result ─────────────────────────────────────────────────────

  async receiveResult(installationId: string, message: JobResultMessage): Promise<void> {
    const { jobId } = message;
    const entry = this.pendingJobs.get(jobId);

    if (!entry) {
      console.warn(`[JobJudge] Received result for unknown job: ${jobId}`);
      return;
    }

    if (entry.settled) {
      // Already settled: reject as late
      const assignee = entry.assignedTo.find(a => a.installationId === installationId);
      if (assignee) {
        await this.recordEvent(entry, installationId, assignee.userId, 'rejected', message);
        this.sendRejected(installationId, jobId, 'late');
      }
      return;
    }

    const assignee = entry.assignedTo.find(a => a.installationId === installationId);
    if (!assignee) {
      console.warn(`[JobJudge] Result from unassigned peer: ${installationId} for job ${jobId}`);
      return;
    }

    entry.results.set(installationId, { receivedAt: new Date(), message });

    if (entry.results.size === 1) {
      // 最初の valid 結果 → accepted
      entry.settled = true;
      clearTimeout(entry.timeoutHandle);

      await this.recordEvent(entry, installationId, assignee.userId, 'accepted', message);

      // Phase 6: ポイント加算 + ランクスコア更新
      await this.awardPointsAndUpdateRank(
        assignee.userId,
        entry.jobId,
        entry.jobType,
        entry.payload.maxTokens,
        message.processingMs,
        installationId,
        jobId,
      );

      console.log(`[JobJudge] Job ${jobId} accepted from ${installationId} (${message.processingMs}ms)`);

      // 残りのアサイニーからの結果を待ってrejectするのではなく、
      // 他の端末の結果が来た時に settled フラグで対処する
    } else {
      // 2番目以降 → rejected (late)
      await this.recordEvent(entry, installationId, assignee.userId, 'rejected', message);
      this.sendRejected(installationId, jobId, 'late');
      console.log(`[JobJudge] Job ${jobId} rejected from ${installationId} (late)`);
    }

    // 全員から結果が揃ったらジョブ削除
    if (entry.results.size >= entry.assignedTo.length) {
      this.pendingJobs.delete(jobId);
    }
  }

  // ── Handle timeout ─────────────────────────────────────────────────────────

  private async handleTimeout(jobId: string): Promise<void> {
    const entry = this.pendingJobs.get(jobId);
    if (!entry || entry.settled) return;

    entry.settled = true;
    console.log(`[JobJudge] Job ${jobId} timed out`);

    // タイムアウトしていない結果があれば accepted、なければ全員 timeout
    const receivedInstallationIds = new Set(entry.results.keys());

    for (const assignee of entry.assignedTo) {
      if (!receivedInstallationIds.has(assignee.installationId)) {
        // No result received → timeout
        await this.recordEventTimeout(entry, assignee.installationId, assignee.userId);
        this.sendRejected(assignee.installationId, jobId, 'timeout');
      }
    }

    this.pendingJobs.delete(jobId);
  }

  // ── DB Event Recording ─────────────────────────────────────────────────────

  private async recordEvent(
    entry: PendingJobEntry,
    installationId: string,
    userId: string,
    status: 'accepted' | 'rejected',
    message: JobResultMessage,
  ): Promise<void> {
    try {
      await db.insert(jobEvents).values({
        id: uuidv4(),
        job_id: entry.jobId,
        job_type: entry.jobType,
        payload: JSON.stringify(entry.payload),
        user_id: userId,
        installation_id: installationId,
        assigned_at: entry.assignedAt.toISOString(),
        responded_at: new Date().toISOString(),
        result_status: status,
        response_ms: message.processingMs,
        result_data: JSON.stringify(message.result),
      });
    } catch (err) {
      console.error('[JobJudge] Failed to record event:', err);
    }
  }

  private async recordEventTimeout(
    entry: PendingJobEntry,
    installationId: string,
    userId: string,
  ): Promise<void> {
    try {
      await db.insert(jobEvents).values({
        id: uuidv4(),
        job_id: entry.jobId,
        job_type: entry.jobType,
        payload: JSON.stringify(entry.payload),
        user_id: userId,
        installation_id: installationId,
        assigned_at: entry.assignedAt.toISOString(),
        responded_at: null,
        result_status: 'timeout',
        response_ms: null,
        result_data: null,
      });
    } catch (err) {
      console.error('[JobJudge] Failed to record timeout event:', err);
    }
  }

  // ── Phase 6: ポイント加算 + ランクスコア更新 ───────────────────────────────

  private async awardPointsAndUpdateRank(
    userId: string,
    jobId: string,
    jobType: string,
    maxTokens: number,
    responseMs: number,
    installationId: string,
    wsJobId: string,
  ): Promise<void> {
    try {
      const pointsResult = await awardPoints({ userId, jobId, jobType, maxTokens, responseMs });

      if (pointsResult.skipped) {
        console.log(`[JobJudge] Points skipped for ${userId}: ${pointsResult.skipReason}`);
        // スキップでも job_accepted は送信する（0ptでも通知は届ける）
        this.sendAccepted(installationId, wsJobId, 0);
        return;
      }

      // ランクスコア更新
      const rankResult = await updateRankScore({ userId, points: pointsResult.points });

      this.sendAccepted(installationId, wsJobId, pointsResult.points);

      if (rankResult.rankChanged) {
        console.log(
          `[JobJudge] User ${userId} ranked up: ${rankResult.oldRank} → ${rankResult.newRank}`,
        );
        // Phase 7-B: ランクアップ時に WS 経由でリアルタイム通知を送信
        await this.sendRankUpNotificationWs(userId, rankResult.newRank);
      }
    } catch (err) {
      console.error('[JobJudge] Error in awardPointsAndUpdateRank:', err);
      // エラーでも job_accepted は送信する
      this.sendAccepted(installationId, wsJobId, 0);
    }
  }

  // ── Phase 7-B: WS Notification Push ──────────────────────────────────────

  private readonly RANK_UP_MESSAGES: Record<string, { title: string; body: string }> = {
    Silver: {
      title: '🥈 シルバーランクに昇格！',
      body: 'おめでとうございます！シルバーランクに昇格しました。ポイント獲得量が1.2倍になります。',
    },
    Gold: {
      title: '🥇 ゴールドランクに昇格！',
      body: 'おめでとうございます！ゴールドランクに昇格しました。ポイント獲得量が1.5倍になります。',
    },
    Platinum: {
      title: '💎 プラチナランクに昇格！',
      body: 'おめでとうございます！最高位のプラチナランクに昇格しました。ポイント獲得量が2倍になります！',
    },
  };

  /**
   * ランクアップ時に DB から最新の通知 ID を取得し、WS で push する。
   * DB 書き込みは rank-service.ts の createRankUpNotification() が行う。
   */
  private async sendRankUpNotificationWs(userId: string, newRank: string): Promise<void> {
    const msg = this.RANK_UP_MESSAGES[newRank];
    if (!msg) return;

    try {
      // rank-service が notifications に書き込んだ最新レコードを取得
      const latestNotif = db
        .select()
        .from(notifications)
        .where(and(eq(notifications.user_id, userId), eq(notifications.type, 'rank_up')))
        .orderBy(desc(notifications.created_at))
        .limit(1)
        .get();

      const notifId = latestNotif?.id ?? uuidv4();

      this.peerManager.sendNotificationToUser(
        userId,
        notifId,
        'rank_up',
        msg.title,
        msg.body,
      );
    } catch (err) {
      console.error('[JobJudge] Failed to send rank-up WS notification:', err);
    }
  }

  // ── Message Sending ────────────────────────────────────────────────────────

  private sendAccepted(installationId: string, jobId: string, points: number): void {
    const peer = this.peerManager.getPeer(installationId);
    if (!peer) return;

    const msg: JobAcceptedMessage = {
      type: 'job_accepted',
      ts: Date.now(),
      msgId: uuidv4(),
      jobId,
      experimentalPoints: points, // Phase 6: 実際の獲得ポイント数
    };

    try {
      peer.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error(`[JobJudge] Failed to send job_accepted to ${installationId}:`, err);
    }
  }

  private sendRejected(installationId: string, jobId: string, reason: 'late' | 'error' | 'timeout'): void {
    const peer = this.peerManager.getPeer(installationId);
    if (!peer) return;

    const msg: JobRejectedMessage = {
      type: 'job_rejected',
      ts: Date.now(),
      msgId: uuidv4(),
      jobId,
      reason,
    };

    try {
      peer.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.error(`[JobJudge] Failed to send job_rejected to ${installationId}:`, err);
    }
  }

  // ── Cleanup ────────────────────────────────────────────────────────────────

  destroy(): void {
    for (const entry of this.pendingJobs.values()) {
      clearTimeout(entry.timeoutHandle);
    }
    this.pendingJobs.clear();
  }
}
