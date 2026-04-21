/**
 * WsTransport — WebSocket トランスポート実装
 *
 * Phase 7-A: 既存の NoodlaWsClient を ITransport インターフェースでラップする。
 * 再接続ロジック・heartbeat・AppState 監視はすべて NoodlaWsClient が担う。
 *
 * WebRTC 移行時は WsTransport を WebRtcTransport に差し替えるだけでよい。
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
} from '../services/ws-types';
import type {
  ITransport,
  TransportConnectionState,
  TransportConnectOptions,
} from './ITransport';

// ── Helpers ───────────────────────────────────────────────────────────────────

function generateId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

// ── WsTransport ───────────────────────────────────────────────────────────────

export class WsTransport implements ITransport {
  private ws: WebSocket | null = null;
  private connectionState: TransportConnectionState = 'disconnected';
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private appStateSubscription: ReturnType<typeof AppState.addEventListener> | null = null;

  private opts: TransportConnectOptions | null = null;

  private messageHandlers: Set<(msg: ServerToClientMessage) => void> = new Set();
  private statusHandlers: Set<(state: TransportConnectionState) => void> = new Set();

  private reconnectCount = 0;

  // backoff: 1, 2, 4, 8, 16, 30 seconds
  private readonly BACKOFF_BASE_MS = 1_000;
  private readonly BACKOFF_MAX_MS = 30_000;
  private readonly PING_INTERVAL_MS = 10_000;

  // ── ITransport: Connection ────────────────────────────────────────────────

  connect(opts: TransportConnectOptions): void {
    this.opts = opts;
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

  // ── ITransport: Network Actions ───────────────────────────────────────────

  joinNetwork(): void {
    if (!this.opts) return;
    this.sendRaw({
      type: 'join_network',
      ts: Date.now(),
      msgId: generateId(),
      installationId: this.opts.installationId,
    } satisfies JoinNetworkMessage);
  }

  leaveNetwork(): void {
    if (!this.opts) return;
    this.sendRaw({
      type: 'leave_network',
      ts: Date.now(),
      msgId: generateId(),
      installationId: this.opts.installationId,
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

  // ── ITransport: Subscriptions ─────────────────────────────────────────────

  onMessage(handler: (msg: ServerToClientMessage) => void): () => void {
    this.messageHandlers.add(handler);
    return () => {
      this.messageHandlers.delete(handler);
    };
  }

  onStatusChange(handler: (state: TransportConnectionState) => void): () => void {
    this.statusHandlers.add(handler);
    return () => {
      this.statusHandlers.delete(handler);
    };
  }

  // ── ITransport: State Accessors ───────────────────────────────────────────

  getConnectionState(): TransportConnectionState {
    return this.connectionState;
  }

  getReconnectCount(): number {
    return this.reconnectCount;
  }

  // ── Private: WebSocket lifecycle ──────────────────────────────────────────

  private doConnect(): void {
    if (!this.opts) return;

    this.clearReconnectTimeout();
    this.clearPingInterval();
    this.closeWs();

    this.setState(this.reconnectAttempts === 0 ? 'connecting' : 'reconnecting');

    try {
      const ws = new WebSocket(this.opts.url);
      this.ws = ws;

      ws.onopen = () => {
        console.log('[WsTransport] Connected');
        this.reconnectAttempts = 0;

        // hello メッセージで認証
        this.sendRaw({
          type: 'hello',
          ts: Date.now(),
          msgId: generateId(),
          installationId: this.opts!.installationId,
          accessToken: this.opts!.accessToken,
          deviceInfo: this.opts!.deviceInfo,
        } satisfies HelloMessage);
      };

      ws.onmessage = (evt) => {
        try {
          const msg = JSON.parse(evt.data as string) as ServerToClientMessage;
          this.handleServerMessage(msg);
        } catch (err) {
          console.error('[WsTransport] Failed to parse message:', err);
        }
      };

      ws.onclose = (evt) => {
        console.log(`[WsTransport] Disconnected: code=${evt.code}, reason=${evt.reason}`);
        this.clearPingInterval();

        if (this.connectionState !== 'disconnected') {
          this.scheduleReconnect();
        }
      };

      ws.onerror = (err) => {
        console.error('[WsTransport] WebSocket error:', err);
      };
    } catch (err) {
      console.error('[WsTransport] Failed to create WebSocket:', err);
      this.scheduleReconnect();
    }
  }

  private handleServerMessage(msg: ServerToClientMessage): void {
    if (msg.type === 'connected') {
      this.setState('connected');
      this.startPingInterval();
      console.log('[WsTransport] Authenticated as', msg.userId);
    }

    for (const handler of this.messageHandlers) {
      try {
        handler(msg);
      } catch (err) {
        console.error('[WsTransport] Handler error:', err);
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

    console.log(`[WsTransport] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

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
        if (
          this.ws.readyState === WebSocket.OPEN ||
          this.ws.readyState === WebSocket.CONNECTING
        ) {
          this.ws.close(1000, 'Client disconnect');
        }
      } catch {
        // ignore
      }
      this.ws = null;
    }
  }

  // ── Private: Ping ─────────────────────────────────────────────────────────

  private startPingInterval(): void {
    this.clearPingInterval();
    this.pingInterval = setInterval(() => {
      if (this.connectionState === 'connected') {
        this.sendRaw({
          type: 'ping',
          ts: Date.now(),
          msgId: generateId(),
        } satisfies PingMessage);
      }
    }, this.PING_INTERVAL_MS);
  }

  private clearPingInterval(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
  }

  // ── Private: Reconnect ────────────────────────────────────────────────────

  private clearReconnectTimeout(): void {
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  // ── Private: AppState ─────────────────────────────────────────────────────

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
      if (
        this.connectionState === 'disconnected' ||
        this.connectionState === 'reconnecting'
      ) {
        console.log('[WsTransport] App foregrounded, reconnecting...');
        this.reconnectAttempts = 0;
        this.doConnect();
      }
    } else if (nextAppState === 'background' || nextAppState === 'inactive') {
      console.log('[WsTransport] App backgrounded, disconnecting...');
      this.clearPingInterval();
      this.clearReconnectTimeout();
      this.closeWs();
      this.setState('disconnected');
    }
  };

  // ── Private: State ────────────────────────────────────────────────────────

  private setState(state: TransportConnectionState): void {
    this.connectionState = state;
    for (const handler of this.statusHandlers) {
      try {
        handler(state);
      } catch (err) {
        console.error('[WsTransport] StatusHandler error:', err);
      }
    }
  }

  // ── Private: Send ─────────────────────────────────────────────────────────

  private sendRaw(msg: ClientToServerMessage): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(msg));
    }
  }
}
