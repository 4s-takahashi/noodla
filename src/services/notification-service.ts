/**
 * notification-service.ts — expo-notifications ラッパー (Phase 7-B)
 *
 * React Native / Expo 環境でのプッシュ通知許可取得と
 * ローカル通知スケジュールを担当する。
 *
 * Web 環境では Browser Notification API を使用する（expo-notifications 非対応のため）。
 *
 * 使い方:
 *   1. アプリ起動時に `requestPermissions()` を呼ぶ
 *   2. `scheduleLocalNotification()` でフォアグラウンド以外での通知表示
 *   3. `registerPushToken()` でサーバーにトークンを登録
 */

import { Platform } from 'react-native';

// expo-notifications は React Native 専用。
// Web では Browser Notification API にフォールバックする。
let Notifications: typeof import('expo-notifications') | null = null;
if (Platform.OS !== 'web') {
  try {
    // Dynamic import で web ビルド時のエラーを回避
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    Notifications = require('expo-notifications');
  } catch {
    console.warn('[NotificationService] expo-notifications が利用できません');
  }
}

// ── Permission ────────────────────────────────────────────────────────────────

export type NotificationPermissionStatus = 'granted' | 'denied' | 'undetermined';

/**
 * プッシュ通知の許可を要求する。
 * - iOS: システムダイアログが表示される
 * - Android: Android 13+ で許可ダイアログ
 * - Web: Browser Notification API
 */
export async function requestPermissions(): Promise<NotificationPermissionStatus> {
  if (Platform.OS === 'web') {
    return requestWebPermission();
  }

  if (!Notifications) {
    return 'undetermined';
  }

  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus === 'granted') {
      // フォアグラウンド時の通知表示設定
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: false, // フォアグラウンドはアプリ内 Toast で表示するため非表示
          shouldPlaySound: false,
          shouldSetBadge: true,
        }),
      });
    }

    return finalStatus as NotificationPermissionStatus;
  } catch (err) {
    console.error('[NotificationService] Failed to request permissions:', err);
    return 'undetermined';
  }
}

async function requestWebPermission(): Promise<NotificationPermissionStatus> {
  if (typeof Notification === 'undefined') {
    return 'undetermined';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  if (Notification.permission === 'denied') {
    return 'denied';
  }

  const result = await Notification.requestPermission();
  return result as NotificationPermissionStatus;
}

// ── Expo Push Token ───────────────────────────────────────────────────────────

/**
 * Expo Push Token を取得する。
 * 実機 (iOS/Android) でのみ有効。シミュレーターでは null を返す。
 */
export async function getExpoPushToken(): Promise<string | null> {
  if (Platform.OS === 'web' || !Notifications) {
    return null;
  }

  try {
    const token = await Notifications.getExpoPushTokenAsync();
    return token.data;
  } catch (err) {
    // シミュレーターや permission なしの場合
    console.warn('[NotificationService] Could not get push token:', err);
    return null;
  }
}

// ── Local Notification ────────────────────────────────────────────────────────

export interface LocalNotificationOptions {
  title: string;
  body: string;
  data?: Record<string, unknown>;
}

/**
 * ローカル通知をスケジュールする（即時表示）。
 * バックグラウンド時や画面外での通知に使用。
 * フォアグラウンド時はアプリ内 Toast を優先するため、
 * 呼び出し側が AppState を確認すること。
 */
export async function scheduleLocalNotification(opts: LocalNotificationOptions): Promise<void> {
  if (Platform.OS === 'web') {
    scheduleWebNotification(opts);
    return;
  }

  if (!Notifications) {
    return;
  }

  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: opts.title,
        body: opts.body,
        data: opts.data ?? {},
        sound: true,
      },
      trigger: null, // 即時表示
    });
  } catch (err) {
    console.error('[NotificationService] Failed to schedule notification:', err);
  }
}

function scheduleWebNotification(opts: LocalNotificationOptions): void {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') {
    return;
  }

  try {
    new Notification(opts.title, {
      body: opts.body,
      icon: '/icon.png',
    });
  } catch (err) {
    console.error('[NotificationService] Web notification failed:', err);
  }
}
