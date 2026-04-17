/**
 * NoodlaWsClient — WebSocket クライアント
 *
 * - 自動再接続 (exponential backoff: 1s → 2s → 4s → 8s → max 30s)
 * - heartbeat (ping/pong 10秒ごと)
 * - フォアグラウンド復帰時に再接続
 * - バックグラウンド遷移時に切断
 */

import { AppState, type AppStateStatus } from 'react-native';
import type {
  ClientToServerMessage,
  HelloMessage,
  JoinNetworkMessage,
  JobResultMessage,
  LeaveNetworkMessage,
  PingMessage,
  ServerToClientMessage,
} from './ws-types';

// WebSocket メッセージ型をフロントエンド用に再エクスポート
export type { ServerToClientMessage } from './ws-types';

type MessageHandler = (msg: ServerToClientMessage) => void;
type ConnectionStateType = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export class NoodlaWsClient {
  private ws: WebSocket | null = null;
  private connectionState: ConnectionStateType = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  private serverUrl = '';
  private accessToken = '';
  private installationId = '';
  private os: 'ios' | 'android' | 'unknown' = 'unknown';
  private appVersion = '1.0.0';

  private messageHandlers: Set<MessageHandler> = new Set();
  private onStateChange: ((state: ConnectionStateType) => void) | null = null;
  private reconnectCount = 0;
  private connectedAt: Date | null = null;
  private lastPongAt: Date | null = null;

  // backoff: 1, 2, 4, 8, 16, 30 seconds
  private readonly BACKOFF_BASE_MS = 1_000;
  private readonly BACKOFF_MAX_MS = 30_000;
  private readonly PING_INTERVAL_MS = 10_000;

  // ── Connection Management ─────────────────────────────────────────────────

  connect(
    serverUrl: string,
    accessToken: string,
    installationId: string,
    opts?: { os?: 'ios' | 'android' | 'unknown'; appVersion?: string },
  ): void {
    this.serverUrl = serverUrl;
    this.accessToken = accessToken;
    this.installationId = installationId;
    this.os = opts?.os ?? 'unknown';
    this.appVersion = opts?.appVersion ?? '1.0.0';

    this.setupAppStateListener();
    this.doConnect();
  }

  disconnect(): void {
    this.clearReconnectTimeout();
    this.clearPingInterval();
    this.removeAppStateListener();
    this.closeWs();
    this.setState('disconnected');
    this.reconnectAttempts = 0;
  }

  private doConnect(): void {
    this.clearReconnectTimeout();
    this.clearPingInterval();
    this.closeWs();

    this.setState(this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting');

    try {
      const ws = new WebSocket(this.serverUrl);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[WsClient] Connected');
        this.reconnectAttempts = 0;
        this.connectedAt = new Date();

        // hello メッセージで認証
        this.sendRaw({
          type: 'hello',
          ts: Date.now(),
          msgId: generateId(),
          installationId: this.installationId,
          accessToken: this.accessToken,
          deviceInfo: {
            os: this.os,
            appVersion: this.appVersion,
          },
        } satisfies HelloMessage);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as ServerToClientMessage;
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[WsClient] Failed to parse message:', err);
        }
      };

      ws.onclose = (evt) => {
        console.log(`[WsClient] Disconnected: code=${evt.code}, reason=${evt.reason}`);
        this.clearPingInterval();

        if (this.connectionState !== 'disconnected') {
          this.scheduleReconnect();
        }
      };

      ws.onerror = (err) => {
        console.error('[WsClient] WebSocket error:', err);
      };
    } catch (err) {
      console.error('[WsClient] Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private handleServerMessage(msg: ServerToClientMessage): void {
    if (msg.type === 'connected') {
      this.setState('connected');
      this.startPingInterval();
      console.log('[WsClient] Authenticated as', msg.userId);
    }

    if (msg.type === 'pong') {
      this.lastPongAt = new Date();
    }

    // 全ハンドラーに通知
    for (const handler of this.messageHandlers) {
      try {
        handler(msg);
      } catch (err) {
        console.error('[WsClient] Handler error:', err);
      }
    }
  }

  private scheduleReconnect(): void {
    this.setState('reconnecting');
    this.reconnectAttempts++;
    this.reconnectCount++;

    const delay = Math.min(
      this.BACKOFF_BASE_MS * Math.pow(2, this.reconnectAttempts - 1),
      this.BACKOFF_MAX_MS,
    );

    console.log(`[WsClient] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

    this.reconnectTimeout = setTimeout(() => {
      this.doConnect();
    }, delay);
  }

  private closeWs(): void {
    if (this.ws) {
      try {
        this.ws.onopen = null;
        this.ws.onmessage = null;
        this.ws.onclose = null;
        this.ws.onerror = null;
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'Client disconnect');
        }
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  // ── Network Actions ───────────────────────────────────────────────────────

  joinNetwork(): void {
    this.sendRaw({
      type: 'join_network',
      ts: Date.now(),
      msgId: generateId(),
      installationId: this.installationId,
    } satisfies JoinNetworkMessage);
  }

  leaveNetwork(): void {
    this.sendRaw({
      type: 'leave_network',
      ts: Date.now(),
      msgId: generateId(),
      installationId: this.installationId,
    } satisfies LeaveNetworkMessage);
  }

  sendJobResult(
    jobId: string,
    result: unknown,
    processingMs: number,
    deviceLoad?: { cpuUsage: number; memoryUsage: number; batteryLevel: number },
  ): void {
    this.sendRaw({
      type: 'job_result',
      ts: Date.now(),
      msgId: generateId(),
      jobId,
      result,
      processingMs,
      status: 'completed',
      deviceLoad: deviceLoad ?? { cpuUsage: 0, memoryUsage: 0, batteryLevel: 100 },
    } satisfies JobResultMessage);
  }

  private sendPing(): void {
    this.sendRaw({
      type: 'ping',
      ts: Date.now(),
      msgId: generateId(),
    } satisfies PingMessage);
  }

  private sendRaw(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }

  // ── Message Subscription ──────────────────────────────────────────────────

  onMessage(handler: MessageHandler): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  setOnStateChange(handler: (state: ConnectionStateType) => void): void {
    this.onStateChange = handler;
  }

  // ── State Accessors ───────────────────────────────────────────────────────

  getConnectionState(): ConnectionStateType {
    return this.connectionState;
  }

  getReconnectCount(): number {
    return this.reconnectCount;
  }

  getConnectedAt(): Date | null {
    return this.connectedAt;
  }

  getLastPongAt(): Date | null {
    return this.lastPongAt;
  }

  getServerUrl(): string {
    return this.serverUrl;
  }

  // ── Private Helpers ───────────────────────────────────────────────────────

  private setState(state: ConnectionStateType): void {
    this.connectionState = state;
    this.onStateChange?.(state);
  }

  private startPingInterval(): void {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.sendPing();
      }
    }, this.PING_INTERVAL_MS);
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  private setupAppStateListener(): void {
    this.removeAppStateListener();
    this.appStateSubscription = AppState.addEventListener(
      'change',
      this.handleAppStateChange,
    );
  }

  private removeAppStateListener(): void {
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
      this.appStateSubscription = null;
    }
  }

  private handleAppStateChange = (nextAppState: AppStateStatus): void => {
    if (nextAppState === 'active') {
      // フォアグラウンド復帰 → 切れていれば再接続
      if (
        this.connectionState === 'disconnected' ||
        this.connectionState === 'reconnecting'
      ) {
        console.log('[WsClient] App foregrounded, reconnecting...');
        this.reconnectAttempts = 0;
        this.doConnect();
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      // バックグラウンド → 切断
      console.log('[WsClient] App backgrounded, disconnecting...');
      this.clearPingInterval();
      this.clearReconnectTimeout();
      this.closeWs();
      this.setState('disconnected');
    }
  };
}

// Singleton instance
export const wsClient = new NoodlaWsClient();
