// ── WebSocket Message Types for Noodla Phase 5 ────────────────────────────────

// === 共通ベース ===

export interface WsMessageBase {
  type: string;
  ts: number;    // Unix timestamp (ms)
  msgId: string; // UUID v4
}

// === 疑似ジョブペイロード ===

export interface PseudoJobPayload {
  prompt: string;     // 短い文字列
  maxTokens: number;  // 1〜5
  seed: number;       // 再現性のためのシード
}

// === 端末 → サーバー ===

export interface HelloMessage extends WsMessageBase {
  type: 'hello';
  installationId: string;
  accessToken: string;
  deviceInfo: {
    os: 'ios' | 'android' | 'unknown';
    appVersion: string;
  };
}

export interface JoinNetworkMessage extends WsMessageBase {
  type: 'join_network';
  installationId: string;
}

export interface LeaveNetworkMessage extends WsMessageBase {
  type: 'leave_network';
  installationId: string;
}

export interface JobResultMessage extends WsMessageBase {
  type: 'job_result';
  jobId: string;
  result: unknown;
  processingMs: number;
  status: 'completed' | 'failed';
  deviceLoad: {
    cpuUsage: number;
    memoryUsage: number;
    batteryLevel: number;
  };
}

export interface PingMessage extends WsMessageBase {
  type: 'ping';
}

// === サーバー → 端末 ===

export interface ConnectedMessage extends WsMessageBase {
  type: 'connected';
  userId: string;
  installationId: string;
}

export interface NetworkStatusMessage extends WsMessageBase {
  type: 'network_status';
  totalOnline: number;
  totalParticipating: number;
  peers: Array<{
    installationId: string;
    os: string;
    status: string;
  }>;
}

export interface JobAssignMessage extends WsMessageBase {
  type: 'job_assign';
  jobId: string;
  jobType: string;
  payload: PseudoJobPayload;
  timeoutMs: number;
  duplicateCount: number;
}

export interface JobAcceptedMessage extends WsMessageBase {
  type: 'job_accepted';
  jobId: string;
  experimentalPoints: number; // テスト用カウンター（本ポイントではない）
}

export interface JobRejectedMessage extends WsMessageBase {
  type: 'job_rejected';
  jobId: string;
  reason: 'late' | 'error' | 'timeout';
}

export interface PongMessage extends WsMessageBase {
  type: 'pong';
}

export interface ErrorMessage extends WsMessageBase {
  type: 'error';
  code: string;
  message: string;
}

// === Union Types ===

export type ClientToServerMessage =
  | HelloMessage
  | JoinNetworkMessage
  | LeaveNetworkMessage
  | JobResultMessage
  | PingMessage;

export type ServerToClientMessage =
  | ConnectedMessage
  | NetworkStatusMessage
  | JobAssignMessage
  | JobAcceptedMessage
  | JobRejectedMessage
  | PongMessage
  | ErrorMessage;

export type WsMessage = ClientToServerMessage | ServerToClientMessage;
