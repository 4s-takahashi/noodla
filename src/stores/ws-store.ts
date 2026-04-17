/**
 * ws-store.ts — WebSocket 状態管理 (Zustand)
 *
 * WebSocketの接続状態、ネットワーク状態、ジョブ処理状態を管理する。
 */

import { create } from 'zustand';
import { wsClient } from '../services/ws-client';
import { processJob } from '../services/job-processor';
import { useAuthStore } from './auth-store';
import { useInstallationStore } from './installation-store';
import type {
  JobAssignMessage,
  NetworkStatusMessage,
  ServerToClientMessage,
} from '../services/ws-types';

// ── WS URL ───────────────────────────────────────────────────────────────────

declare const __DEV__: boolean;

const WS_URL = __DEV__
  ? 'ws://localhost:3001/ws/v1/node'
  : (process.env.EXPO_PUBLIC_WS_URL ?? 'wss://api.noodla.app/ws/v1/node');

// ── Types ─────────────────────────────────────────────────────────────────────

export type WsConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface RecentJobResult {
  jobId: string;
  accepted: boolean;
  reason?: 'late' | 'error' | 'timeout';
  processingMs: number;
  completedAt: Date;
}

interface WsState {
  connectionState: WsConnectionState;
  networkStatus: {
    totalOnline: number;
    totalParticipating: number;
  } | null;
  currentJob: {
    jobId: string;
    jobType: string;
    startedAt: number;
  } | null;
  lastJobResult: RecentJobResult | null;
  recentJobResults: RecentJobResult[];
  experimentalPoints: number; // テスト用カウンター
  jobsProcessed: number;
  jobsAccepted: number;
  reconnectCount: number;
  connectedAt: Date | null;
  lastHeartbeatAt: Date | null;
  serverUrl: string;

  // Actions
  connect: () => Promise<void>;
  disconnect: () => void;
  joinNetwork: () => void;
  leaveNetwork: () => void;
}

// ── MAX recent job results to keep ──────────────────────────────────────────
const MAX_RECENT_JOBS = 20;

// ── Zustand Store ────────────────────────────────────────────────────────────

export const useWsStore = create<WsState>((set, get) => {
  // メッセージハンドラーをセットアップ
  wsClient.onMessage((msg: ServerToClientMessage) => {
    switch (msg.type) {
      case 'network_status': {
        const nm = msg as NetworkStatusMessage;
        set({
          networkStatus: {
            totalOnline: nm.totalOnline,
            totalParticipating: nm.totalParticipating,
          },
        });
        break;
      }

      case 'job_assign': {
        const ja = msg as JobAssignMessage;
        const startedAt = Date.now();

        set({
          currentJob: {
            jobId: ja.jobId,
            jobType: ja.jobType,
            startedAt,
          },
        });

        // 疑似ジョブ処理を実行
        processJob(ja.payload)
          .then((result) => {
            wsClient.sendJobResult(
              ja.jobId,
              { tokens: result.tokens, tokenCount: result.tokenCount },
              result.processingMs,
              result.deviceLoad,
            );
            set({ currentJob: null });
          })
          .catch((err) => {
            console.error('[WsStore] Job processing failed:', err);
            set({ currentJob: null });
          });

        break;
      }

      case 'job_accepted': {
        const result: RecentJobResult = {
          jobId: msg.jobId,
          accepted: true,
          processingMs: 0, // サーバーから提供されないためローカルで計算
          completedAt: new Date(),
        };

        set(state => ({
          lastJobResult: result,
          recentJobResults: [result, ...state.recentJobResults].slice(0, MAX_RECENT_JOBS),
          experimentalPoints: state.experimentalPoints + msg.experimentalPoints,
          jobsProcessed: state.jobsProcessed + 1,
          jobsAccepted: state.jobsAccepted + 1,
        }));
        break;
      }

      case 'job_rejected': {
        const result: RecentJobResult = {
          jobId: msg.jobId,
          accepted: false,
          reason: msg.reason,
          processingMs: 0,
          completedAt: new Date(),
        };

        set(state => ({
          lastJobResult: result,
          recentJobResults: [result, ...state.recentJobResults].slice(0, MAX_RECENT_JOBS),
          jobsProcessed: state.jobsProcessed + 1,
        }));
        break;
      }

      case 'pong': {
        set({ lastHeartbeatAt: new Date() });
        break;
      }

      case 'connected': {
        set({
          connectionState: 'connected',
          connectedAt: new Date(),
          serverUrl: WS_URL,
        });
        break;
      }

      case 'error': {
        console.error('[WsStore] Server error:', msg.code, msg.message);
        break;
      }

      default:
        break;
    }
  });

  // 接続状態の変更を監視
  wsClient.setOnStateChange((state) => {
    set({
      connectionState: state as WsConnectionState,
      reconnectCount: wsClient.getReconnectCount(),
    });
  });

  return {
    connectionState: 'disconnected',
    networkStatus: null,
    currentJob: null,
    lastJobResult: null,
    recentJobResults: [],
    experimentalPoints: 0,
    jobsProcessed: 0,
    jobsAccepted: 0,
    reconnectCount: 0,
    connectedAt: null,
    lastHeartbeatAt: null,
    serverUrl: WS_URL,

    connect: async () => {
      const authState = useAuthStore.getState();
      if (!authState.accessToken) {
        console.warn('[WsStore] Cannot connect: no access token');
        return;
      }

      const installationStore = useInstallationStore.getState();
      const installationId = await installationStore.ensureInstallationId();

      wsClient.connect(WS_URL, authState.accessToken, installationId, {
        os: 'ios', // Phase 7 以降で expo-device から取得
        appVersion: '1.0.0',
      });
    },

    disconnect: () => {
      wsClient.disconnect();
    },

    joinNetwork: () => {
      if (get().connectionState !== 'connected') {
        console.warn('[WsStore] Cannot join network: not connected');
        return;
      }
      wsClient.joinNetwork();
    },

    leaveNetwork: () => {
      wsClient.leaveNetwork();
    },
  };
});
