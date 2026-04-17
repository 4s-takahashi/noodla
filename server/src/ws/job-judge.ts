import { v4 as uuidv4 } from 'uuid';
import { db } from '../db/index.js';
import { jobEvents } from '../db/schema.js';
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
      this.sendAccepted(installationId, jobId);

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

  // ── Message Sending ────────────────────────────────────────────────────────

  private sendAccepted(installationId: string, jobId: string): void {
    const peer = this.peerManager.getPeer(installationId);
    if (!peer) return;

    const msg: JobAcceptedMessage = {
      type: 'job_accepted',
      ts: Date.now(),
      msgId: uuidv4(),
      jobId,
      experimentalPoints: 1, // テスト用カウンター（本ポイントではない）
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
