import { v4 as uuidv4 } from 'uuid';
import { eq, sql, and, desc } from 'drizzle-orm';
import type { WSContext } from 'hono/ws';
import { verifyAccessToken } from '../lib/jwt.js';
import { db } from '../db/index.js';
import { nodeParticipationStates, notifications } from '../db/schema.js';
import { peerManager } from './peer-manager.js';
import { JobJudge } from './job-judge.js';
import { JobScheduler } from './job-scheduler.js';
import { checkAndApplyRankDecay } from '../services/rank-service.js';
import type {
  ClientToServerMessage,
  ConnectedMessage,
  ErrorMessage,
  HelloMessage,
  JobResultMessage,
  PongMessage,
} from './types.js';

// ── Singleton instances ───────────────────────────────────────────────────────

export const jobJudge = new JobJudge(peerManager);
export const jobScheduler = new JobScheduler(peerManager, jobJudge);

// Start the job scheduler
jobScheduler.start();

// ── Per-connection state ──────────────────────────────────────────────────────

interface ConnectionState {
  authenticated: boolean;
  installationId: string | null;
  userId: string | null;
  authTimeout: ReturnType<typeof setTimeout> | null;
}

// ── WebSocket Message Handlers ────────────────────────────────────────────────

function sendMessage(ws: WSContext, msg: object): void {
  try {
    ws.send(JSON.stringify(msg));
  } catch (err) {
    console.error('[WsHandler] Failed to send message:', err);
  }
}

function sendError(ws: WSContext, code: string, message: string): void {
  const err: ErrorMessage = {
    type: 'error',
    ts: Date.now(),
    msgId: uuidv4(),
    code,
    message,
  };
  sendMessage(ws, err);
}

async function handleHello(
  ws: WSContext,
  state: ConnectionState,
  msg: HelloMessage,
): Promise<boolean> {
  // JWT 検証
  let payload: { sub: string; email: string };
  try {
    payload = await verifyAccessToken(msg.accessToken);
  } catch {
    sendError(ws, 'AUTH_FAILED', 'Invalid or expired access token');
    ws.close(1008, 'Authentication failed');
    return false;
  }

  state.authenticated = true;
  state.installationId = msg.installationId;
  state.userId = payload.sub;

  if (state.authTimeout) {
    clearTimeout(state.authTimeout);
    state.authTimeout = null;
  }

  // ピアマネージャーに登録
  peerManager.addPeer({
    installationId: msg.installationId,
    userId: payload.sub,
    ws,
    status: 'waiting',
    os: msg.deviceInfo?.os ?? 'unknown',
  });

  // 接続確認メッセージ送信
  const connected: ConnectedMessage = {
    type: 'connected',
    ts: Date.now(),
    msgId: uuidv4(),
    userId: payload.sub,
    installationId: msg.installationId,
  };
  sendMessage(ws, connected);

  // B4: NPS ステータスを 'waiting' に更新（セッション開始マーク）
  updateNpsStatus(msg.installationId, payload.sub, 'waiting', true);

  // Phase 7-C: 接続時にランクダウンデケイチェック（非同期・エラーは握りつぶす）
  checkAndApplyRankDecay(payload.sub).then(async (decayResult) => {
    if (decayResult.rankChanged) {
      console.log(
        `[WsHandler] Rank decay down for ${payload.sub}: ` +
        `${decayResult.oldRank} → ${decayResult.newRank}`,
      );
      // WS push 通知送信
      await sendRankDownNotificationWs(payload.sub, decayResult.newRank);
    }
  }).catch(err => {
    console.error('[WsHandler] Error in checkAndApplyRankDecay:', err);
  });

  console.log(`[WsHandler] Authenticated: ${msg.installationId} (userId: ${payload.sub})`);
  return true;
}

// ── Phase 7-C: ランクダウン WS Push 通知ヘルパー ─────────────────────────────

const RANK_DOWN_WS_MESSAGES: Record<string, { title: string; body: string }> = {
  Gold: {
    title: '⚠️ ゴールドランクに降格しました',
    body: '長期間の非活動によりプラチナランクから降格しました。ネットワークに再参加してランクを取り戻しましょう！',
  },
  Silver: {
    title: '⚠️ シルバーランクに降格しました',
    body: '長期間の非活動によりゴールドランクから降格しました。ネットワークに再参加してランクを取り戻しましょう！',
  },
  Bronze: {
    title: '⚠️ ブロンズランクに降格しました',
    body: '長期間の非活動によりシルバーランクから降格しました。ネットワークに再参加してランクを取り戻しましょう！',
  },
};

/**
 * ランクダウン時に WS 経由でリアルタイム通知を送信する。
 * DB への通知書き込みは rank-service.ts の createRankDownNotification() が行う。
 */
async function sendRankDownNotificationWs(userId: string, newRank: string): Promise<void> {
  const msg = RANK_DOWN_WS_MESSAGES[newRank];
  if (!msg) return;

  try {
    // rank-service が notifications に書き込んだ最新レコードを取得
    const latestNotif = db
      .select()
      .from(notifications)
      .where(and(eq(notifications.user_id, userId), eq(notifications.type, 'rank_down')))
      .orderBy(desc(notifications.created_at))
      .limit(1)
      .get();

    const notifId = latestNotif?.id ?? uuidv4();

    peerManager.sendNotificationToUser(
      userId,
      notifId,
      'rank_down',
      msg.title,
      msg.body,
    );
  } catch (err) {
    console.error('[WsHandler] Failed to send rank-down WS notification:', err);
  }
}

// ── B4: NPS (NodeParticipationState) 更新ヘルパー ────────────────────────────

/**
 * node_participation_states の status を更新する（upsert的に動作）
 * installation_id + user_id のレコードが存在しない場合はスキップ（デバイス未登録端末）
 */
function updateNpsStatus(
  installationId: string,
  userId: string,
  status: string,
  sessionStart?: boolean,
): void {
  try {
    if (sessionStart) {
      db.update(nodeParticipationStates)
        .set({
          status,
          session_start_at: sql`(datetime('now'))`,
          updated_at: sql`(datetime('now'))`,
        })
        .where(
          and(
            eq(nodeParticipationStates.installation_id, installationId),
            eq(nodeParticipationStates.user_id, userId),
          ),
        )
        .run();
    } else {
      db.update(nodeParticipationStates)
        .set({
          status,
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
  } catch (err) {
    console.error('[WsHandler] Failed to update NPS status:', err);
  }
}

function handleJobResult(
  state: ConnectionState,
  msg: JobResultMessage,
): void {
  if (!state.installationId) return;

  peerManager.removePendingJob(state.installationId, msg.jobId);
  jobJudge.receiveResult(state.installationId, msg).catch(err => {
    console.error('[WsHandler] Error in receiveResult:', err);
  });
}

// ── Main WebSocket Handler ────────────────────────────────────────────────────

export function createWsHandlers() {
  return {
    onOpen: (_evt: Event, ws: WSContext) => {
      const state: ConnectionState = {
        authenticated: false,
        installationId: null,
        userId: null,
        authTimeout: null,
      };

      // ストアに connection state を関連付けるため、ws オブジェクトにプロパティとして保持
      (ws as any).__state = state;

      // 10秒以内に hello が来なければ切断
      state.authTimeout = setTimeout(() => {
        if (!state.authenticated) {
          sendError(ws, 'AUTH_TIMEOUT', 'Authentication timeout');
          ws.close(1008, 'Authentication timeout');
        }
      }, 10_000);

      console.log('[WsHandler] Connection opened');
    },

    onMessage: async (evt: MessageEvent, ws: WSContext) => {
      const state: ConnectionState = (ws as any).__state;
      if (!state) return;

      let msg: ClientToServerMessage;
      try {
        msg = JSON.parse(evt.data as string) as ClientToServerMessage;
      } catch {
        sendError(ws, 'INVALID_JSON', 'Invalid JSON');
        return;
      }

      // 未認証の場合は hello のみ受け付ける
      if (!state.authenticated) {
        if (msg.type !== 'hello') {
          sendError(ws, 'NOT_AUTHENTICATED', 'Send hello message first');
          return;
        }
        await handleHello(ws, state, msg as HelloMessage);
        return;
      }

      // 認証済み後のメッセージ処理
      switch (msg.type) {
        case 'hello':
          // 再認証 (再接続時など)
          await handleHello(ws, state, msg as HelloMessage);
          break;

        case 'join_network':
          if (state.installationId && state.userId) {
            peerManager.setStatus(state.installationId, 'participating');
            // B4: NPS ステータスを 'participating' に更新
            updateNpsStatus(state.installationId, state.userId, 'participating');
            console.log(`[WsHandler] ${state.installationId} joined network`);
          }
          break;

        case 'leave_network':
          if (state.installationId && state.userId) {
            peerManager.setStatus(state.installationId, 'waiting');
            // B4: NPS ステータスを 'waiting' に更新
            updateNpsStatus(state.installationId, state.userId, 'waiting');
            console.log(`[WsHandler] ${state.installationId} left network`);
          }
          break;

        case 'job_result':
          handleJobResult(state, msg as JobResultMessage);
          break;

        case 'ping': {
          const pong: PongMessage = {
            type: 'pong',
            ts: Date.now(),
            msgId: uuidv4(),
          };
          sendMessage(ws, pong);
          if (state.installationId) {
            peerManager.updateHeartbeat(state.installationId);
          }
          break;
        }

        default:
          sendError(ws, 'UNKNOWN_TYPE', `Unknown message type: ${(msg as any).type}`);
      }
    },

    onClose: (_evt: CloseEvent, ws: WSContext) => {
      const state: ConnectionState = (ws as any).__state;
      if (!state) return;

      if (state.authTimeout) {
        clearTimeout(state.authTimeout);
      }

      if (state.installationId) {
        peerManager.removePeer(state.installationId);
        // B4: NPS ステータスを 'offline' に更新
        if (state.userId) {
          updateNpsStatus(state.installationId, state.userId, 'offline');
        }
      }

      console.log(`[WsHandler] Connection closed: ${state.installationId ?? 'unauthenticated'}`);
    },

    onError: (err: Event, ws: WSContext) => {
      console.error('[WsHandler] WebSocket error:', err);
    },
  };
}
