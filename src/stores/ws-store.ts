/**
 * ws-store.ts — WebSocket 状態管理 (Zustand)
 *
 * Phase 7-A: ITransport インターフェース経由に変更。
 * - wsClient 直接参照 → transport singleton 経由
 * - setWsQueryInvalidate() コールバック注入 → queryClient singleton を直接使用
 * - 既存の接続管理・ジョブ処理ロジックは変更なし
 */

import { create } from 'zustand';
import { transport } from '../transport';
import { processJob } from '../services/job-processor';
import { useAuthStore } from './auth-store';
import { useInstallationStore } from './installation-store';
import { queryClient } from '../lib/queryClient';
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
  /** Phase 6: このセッションで獲得した累計ポイント数（DBへの永続化はサーバー側） */
  sessionPoints: number;
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
  // Phase 7-A: ITransport 経由でメッセージを受信
  transport.onMessage((msg: ServerToClientMessage) => {
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
            transport.sendJobResult(
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
          processingMs: 0,
          completedAt: new Date(),
        };

        set(state => ({
          lastJobResult: result,
          recentJobResults: [result, ...state.recentJobResults].slice(0, MAX_RECENT_JOBS),
          // Phase 6: sessionPoints 更新
          sessionPoints: state.sessionPoints + (msg.experimentalPoints ?? 0),
          jobsProcessed: state.jobsProcessed + 1,
          jobsAccepted: state.jobsAccepted + 1,
        }));

        // Phase 7-A: queryClient singleton を直接使用（コールバック注入不要）
        queryClient.invalidateQueries({ queryKey: ['points', 'balance'] });
        queryClient.invalidateQueries({ queryKey: ['rank', 'current'] });
        queryClient.invalidateQueries({ queryKey: ['participation', 'stats'] });
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

  // Phase 7-A: ITransport 経由で接続状態変化を監視
  transport.onStatusChange((state) => {
    set({
      connectionState: state as WsConnectionState,
      reconnectCount: transport.getReconnectCount(),
    });
  });

  return {
    connectionState: 'disconnected',
    networkStatus: null,
    currentJob: null,
    lastJobResult: null,
    recentJobResults: [],
    sessionPoints: 0,
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

      // Phase 7-A: ITransport.connect() 経由で接続
      transport.connect({
        url: WS_URL,
        accessToken: authState.accessToken,
        installationId,
        deviceInfo: {
          os: 'ios', // Phase 7 以降で expo-device から取得
          appVersion: '1.0.0',
        },
      });
    },

    disconnect: () => {
      transport.disconnect();
    },

    joinNetwork: () => {
      if (get().connectionState !== 'connected') {
        console.warn('[WsStore] Cannot join network: not connected');
        return;
      }
      transport.joinNetwork();
    },

    leaveNetwork: () => {
      transport.leaveNetwork();
    },
  };
});
