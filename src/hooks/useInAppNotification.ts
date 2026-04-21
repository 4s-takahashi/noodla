/**
 * useInAppNotification.ts — WS 通知受信 + トースト管理フック (Phase 7-B)
 *
 * transport から `notification_push` メッセージを受信し、
 * - アプリ内トースト (Toast コンポーネント) を表示
 * - `notifications` クエリを invalidate して履歴画面を更新
 * - バックグラウンド時は expo-notifications でローカル通知をスケジュール
 *
 * 使い方:
 *   const { toasts, dismissToast } = useInAppNotification();
 *   <ToastContainer toasts={toasts} onDismiss={dismissToast} />
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import { transport } from '../transport';
import { queryClient } from '../lib/queryClient';
import { scheduleLocalNotification } from '../services/notification-service';
import type { ToastItem } from '../components/ui/Toast';
import type { ServerToClientMessage } from '../services/ws-types';

// ── useInAppNotification ──────────────────────────────────────────────────────

export function useInAppNotification() {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const appStateRef = useRef<AppStateStatus>(AppState.currentState);

  // AppState を追跡（バックグラウンド判定用）
  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      appStateRef.current = nextState;
    });
    return () => sub.remove();
  }, []);

  // transport からの notification_push を受信
  useEffect(() => {
    const unsubscribe = transport.onMessage((msg: ServerToClientMessage) => {
      if (msg.type !== 'notification_push') return;

      // notifications クエリを invalidate（履歴画面を最新化）
      queryClient.invalidateQueries({ queryKey: ['notifications'] });

      if (appStateRef.current === 'active') {
        // フォアグラウンド → アプリ内トーストを表示
        const toast: ToastItem = {
          id: msg.notificationId,
          notifType: msg.notifType,
          title: msg.title,
          body: msg.body,
        };

        setToasts(prev => {
          // 同じ ID が重複しないようにフィルタ
          const filtered = prev.filter(t => t.id !== toast.id);
          return [...filtered, toast];
        });
      } else {
        // バックグラウンド → ローカル通知をスケジュール
        scheduleLocalNotification({
          title: msg.title,
          body: msg.body,
          data: {
            notificationId: msg.notificationId,
            notifType: msg.notifType,
          },
        });
      }
    });

    return unsubscribe;
  }, []);

  const dismissToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  return { toasts, dismissToast };
}
