import { v4 as uuidv4 } from 'uuid';
import type { PeerManager } from './peer-manager.js';
import type { JobJudge } from './job-judge.js';
import type { JobAssignMessage, PseudoJobPayload } from './types.js';

// ── 疑似ジョブ生成用のデータ ──────────────────────────────────────────────────

const PROMPT_WORDS = [
  'apple', 'banana', 'cherry', 'date', 'elderberry',
  'fig', 'grape', 'honeydew', 'kiwi', 'lemon',
  'mango', 'nectarine', 'orange', 'papaya', 'quince',
  'raspberry', 'strawberry', 'tangerine', 'ugli', 'vanilla',
  'watermelon', 'ximenia', 'yam', 'zucchini', 'avocado',
];

// ── ジョブタイプ ──────────────────────────────────────────────────────────────

export type PseudoJobType = 'mock_token_generate' | 'ping_job';

// ── JobScheduler ──────────────────────────────────────────────────────────────

export class JobScheduler {
  private scheduleInterval: ReturnType<typeof setInterval> | null = null;
  private jobCounter = 0;

  // ジョブ配布間隔 (5秒)
  private readonly SCHEDULE_INTERVAL_MS = 5_000;
  // ジョブタイムアウト (5秒)
  private readonly JOB_TIMEOUT_MS = 5_000;
  // 同一ジョブを配布する端末数
  private readonly DUPLICATE_COUNT = 2;
  // minimum participating peers to distribute jobs
  private readonly MIN_PARTICIPATING = 2;

  constructor(
    private readonly peerManager: PeerManager,
    private readonly jobJudge: JobJudge,
  ) {}

  // ── Start / Stop ───────────────────────────────────────────────────────────

  start(): void {
    if (this.scheduleInterval) return;

    this.scheduleInterval = setInterval(() => {
      this.scheduleJob();
    }, this.SCHEDULE_INTERVAL_MS);

    console.log('[JobScheduler] Started');
  }

  stop(): void {
    if (this.scheduleInterval) {
      clearInterval(this.scheduleInterval);
      this.scheduleInterval = null;
    }
    console.log('[JobScheduler] Stopped');
  }

  // ── Schedule a Job ─────────────────────────────────────────────────────────

  private scheduleJob(): void {
    const participatingPeers = this.peerManager.getParticipatingPeers();

    if (participatingPeers.length < this.MIN_PARTICIPATING) {
      // 参加端末が2台未満: ジョブ配布しない
      return;
    }

    // ランダムに2台選択
    const shuffled = [...participatingPeers].sort(() => Math.random() - 0.5);
    const selected = shuffled.slice(0, this.DUPLICATE_COUNT);

    // 疑似ジョブを生成 (mock_token_generate と ping_job を交互に配布)
    const jobId = uuidv4();
    const payload = this.generatePseudoJobPayload();
    const jobType: PseudoJobType = this.jobCounter++ % 3 === 0 ? 'ping_job' : 'mock_token_generate';

    const assignedTo = selected.map(p => ({
      installationId: p.installationId,
      userId: p.userId,
    }));

    // ジョブ判定器に登録
    this.jobJudge.registerJob(jobId, jobType, payload, assignedTo, this.JOB_TIMEOUT_MS);

    // 各端末にジョブを送信
    for (const peer of selected) {
      const msg: JobAssignMessage = {
        type: 'job_assign',
        ts: Date.now(),
        msgId: uuidv4(),
        jobId,
        jobType,
        payload,
        timeoutMs: this.JOB_TIMEOUT_MS,
        duplicateCount: this.DUPLICATE_COUNT,
      };

      try {
        peer.ws.send(JSON.stringify(msg));
        this.peerManager.addPendingJob(peer.installationId, jobId);
        console.log(`[JobScheduler] Sent job ${jobId} to ${peer.installationId}`);
      } catch (err) {
        console.error(`[JobScheduler] Failed to send job to ${peer.installationId}:`, err);
      }
    }
  }

  // ── Pseudo Job Generation ─────────────────────────────────────────────────

  private generatePseudoJobPayload(): PseudoJobPayload {
    const seed = Math.floor(Math.random() * 2_147_483_647);
    const wordCount = 3 + Math.floor(Math.random() * 3); // 3〜5 words
    const words: string[] = [];

    // Seeded selection for reproducibility
    let s = seed;
    for (let i = 0; i < wordCount; i++) {
      s = (s * 1664525 + 1013904223) & 0xffffffff;
      const idx = Math.abs(s) % PROMPT_WORDS.length;
      words.push(PROMPT_WORDS[idx]);
    }

    return {
      prompt: words.join(' '),
      maxTokens: 1 + Math.floor(Math.random() * 5), // 1〜5
      seed,
    };
  }
}
