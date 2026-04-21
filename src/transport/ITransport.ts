/**
 * ITransport — トランスポート抽象インターフェース
 *
 * Phase 7-A: WebSocket クライアントをこのインターフェース経由で利用することで、
 * 将来の WebRTC DataChannel への移行をスムーズにする。
 *
 * 実装:
 *   - WsTransport  : WebSocket（現在の実装、Phase 5〜）
 *   - WebRtcTransport: WebRTC DataChannel（Phase 8 以降）
 */

import type { ServerToClientMessage } from '../services/ws-types';

// ── Connection State ──────────────────────────────────────────────────────────

export type TransportConnectionState =
  | 'disconnected'
  | 'connecting'
  | 'connected'
  | 'reconnecting';

// ── Connect Options ────────────────────────────────────────────────────────────

export interface TransportConnectOptions {
  url: string;
  accessToken: string;
  installationId: string;
  deviceInfo: {
    os: 'ios' | 'android' | 'unknown';
    appVersion: string;
  };
}

// ── ITransport Interface ───────────────────────────────────────────────────────

export interface ITransport {
  /**
   * サーバーへ接続する。
   * 接続後は onStatusChange が 'connecting' → 'connected' へ遷移する。
   * 再接続ロジックはトランスポート内部で管理する。
   */
  connect(opts: TransportConnectOptions): void;

  /**
   * 接続を切断する。
   * 再接続タイマーもキャンセルする。
   */
  disconnect(): void;

  /**
   * ネットワーク参加を宣言する。
   * connected 状態でなければ無視してよい。
   */
  joinNetwork(): void;

  /**
   * ネットワーク離脱を宣言する。
   */
  leaveNetwork(): void;

  /**
   * ジョブ結果をサーバーへ送信する。
   */
  sendJobResult(
    jobId: string,
    result: unknown,
    processingMs: number,
    deviceLoad?: { cpuUsage: number; memoryUsage: number; batteryLevel: number },
  ): void;

  /**
   * サーバーからのメッセージを受信するハンドラーを登録する。
   * 返り値は登録解除関数。
   */
  onMessage(handler: (msg: ServerToClientMessage) => void): () => void;

  /**
   * 接続状態の変化を監視するハンドラーを登録する。
   * 返り値は登録解除関数。
   */
  onStatusChange(handler: (state: TransportConnectionState) => void): () => void;

  /**
   * 現在の接続状態を返す。
   */
  getConnectionState(): TransportConnectionState;

  /**
   * 再接続回数を返す（診断用）。
   */
  getReconnectCount(): number;
}
