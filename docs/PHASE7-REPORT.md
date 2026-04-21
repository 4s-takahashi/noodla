# Phase 7 完了レポート

完了日: 2026-04-21
サブフェーズ: 7-A (ITransport 抽象化) + 7-B (Push 通知)
コミット: 2件 (main ブランチ直接)

---

## 実装結果サマリー

| サブフェーズ | ステータス | テスト |
|---|---|---|
| 7-A: ITransport 切り出し | ✅ 完了 | 101/101 パス |
| 7-B: Push 通知実装 | ✅ 完了 | 101/101 パス |

---

## Phase 7-A: ITransport インターフェース切り出し

### 実装ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/transport/ITransport.ts` | 新規 | トランスポート抽象インターフェース定義 |
| `src/transport/WsTransport.ts` | 新規 | WebSocket 実装（NoodlaWsClient を再実装） |
| `src/transport/index.ts` | 新規 | デフォルト transport singleton export |
| `src/lib/queryClient.ts` | 新規 | QueryClient singleton |
| `src/stores/ws-store.ts` | 変更 | ITransport 経由・queryClient singleton 使用 |
| `app/_layout.tsx` | 変更 | queryClient singleton インポート |

### ITransport インターフェース定義

```typescript
// src/transport/ITransport.ts

export type TransportConnectionState =
  | 'disconnected' | 'connecting' | 'connected' | 'reconnecting';

export interface TransportConnectOptions {
  url: string;
  accessToken: string;
  installationId: string;
  deviceInfo: { os: 'ios' | 'android' | 'unknown'; appVersion: string };
}

export interface ITransport {
  connect(opts: TransportConnectOptions): void;
  disconnect(): void;
  joinNetwork(): void;
  leaveNetwork(): void;
  sendJobResult(jobId, result, processingMs, deviceLoad?): void;
  onMessage(handler): () => void;       // 登録解除関数を返す
  onStatusChange(handler): () => void;  // 登録解除関数を返す
  getConnectionState(): TransportConnectionState;
  getReconnectCount(): number;
}
```

### QueryClient singleton 化

Phase 6 では `setWsQueryInvalidate()` というコールバック注入パターンを使用していた。
Phase 7-A では `src/lib/queryClient.ts` でシングルトンを管理し、
`app/_layout.tsx` と `ws-store.ts` の両方からインポートすることで解決。

```typescript
// Before (Phase 6)
let _queryInvalidate: ((keys: string[][]) => void) | null = null;
export function setWsQueryInvalidate(fn) { _queryInvalidate = fn; }
// ... later:
_queryInvalidate?.([['points', 'balance'], ['rank', 'current'], ...]);

// After (Phase 7-A)
import { queryClient } from '../lib/queryClient';
// ... later:
queryClient.invalidateQueries({ queryKey: ['points', 'balance'] });
```

---

## Phase 7-B: Push 通知実装

### 実装ファイル一覧

| ファイル | 種別 | 内容 |
|---|---|---|
| `src/services/ws-types.ts` | 変更 | `NotificationPushMessage` 型追加 |
| `src/services/notification-service.ts` | 新規 | expo-notifications ラッパー |
| `src/components/ui/Toast.tsx` | 新規 | In-app トーストコンポーネント |
| `src/components/ui/index.ts` | 変更 | Toast / ToastContainer を export |
| `src/hooks/useInAppNotification.ts` | 新規 | WS 通知受信フック |
| `src/stores/ws-store.ts` | 変更 | notification_push ケース追加 |
| `app/_layout.tsx` | 変更 | ToastContainer 組み込み、許可要求 |
| `server/src/ws/types.ts` | 変更 | `NotificationPushMessage` 型追加 |
| `server/src/ws/peer-manager.ts` | 変更 | `sendNotificationToUser()` 追加 |
| `server/src/ws/job-judge.ts` | 変更 | ランクアップ時 WS push 通知 |
| `server/src/routes/devices.ts` | 変更 | `PATCH /devices/:id/push-token` 追加 |

### 通知フロー（シーケンス図）

```
フロントエンド                 バックエンド
─────────────                 ──────────────────────────────────────
                               job-judge: awardPointsAndUpdateRank()
                               └─ updateRankScore() → rankChanged=true
                               └─ rank-service: createRankUpNotification()
                                  └─ DB: notifications テーブルに INSERT
                               └─ job-judge: sendRankUpNotificationWs()
                                  └─ DB: notifications 最新レコードを SELECT
                                  └─ peerManager.sendNotificationToUser(userId, ...)
                                     └─ WS: 'notification_push' メッセージ送信

transport.onMessage() ←─────── WS: notification_push { notifId, type, title, body }
useInAppNotification:
  AppState === 'active' ?
    YES → Toast 表示（3秒後自動消去）
    NO  → notification-service.scheduleLocalNotification()
           └─ iOS/Android: expo-notifications
           └─ Web: Browser Notification API
  queryClient.invalidateQueries(['notifications'])
  → useNotifications() が再フェッチ
  → app/notifications.tsx に最新通知が反映
```

### 新規 WebSocket メッセージ型

```typescript
// Server → Client (Phase 7-B 追加)
interface NotificationPushMessage extends WsMessageBase {
  type: 'notification_push';
  notificationId: string;
  notifType: string; // 'rank_up' | 'points' | 'system' など
  title: string;
  body: string;
}
```

### expo-notifications 連携

`src/services/notification-service.ts` が担当:
- `requestPermissions()`: iOS/Android の通知許可ダイアログ
- `getExpoPushToken()`: Expo Push Token 取得（実機のみ有効）
- `scheduleLocalNotification()`: バックグラウンド時の即時ローカル通知

プラットフォーム対応:
- **iOS**: システムダイアログで許可要求、フォアグラウンド通知は Toast に差し替え
- **Android**: Android 13+ で許可ダイアログ
- **Web**: Browser Notification API にフォールバック

### push_token API

```
PATCH /api/v1/devices/:installationId/push-token
Authorization: Bearer <token>
Body: { "push_token": "ExponentPushToken[xxx]" }
```

---

## テスト結果

```
Test Files  13 passed (13)
Tests       101 passed (101)
```

全てのテストが Phase 7 実装後も通過。
Phase 6 時点から変更なし（リグレッションなし）。

---

## アーキテクチャ改善の効果

### Before (Phase 6)

```
ws-store.ts
  ├─ wsClient (NoodlaWsClient 直接参照)
  ├─ setWsQueryInvalidate() コールバック注入
  └─ QueryClient を間接参照

app/_layout.tsx
  └─ new QueryClient() インライン生成
```

### After (Phase 7-A)

```
ws-store.ts
  ├─ transport (ITransport 経由)
  └─ queryClient (singleton 直接インポート)

app/_layout.tsx
  └─ queryClient (singleton インポート)

src/transport/
  ├─ ITransport.ts  ← インターフェース
  ├─ WsTransport.ts ← WebSocket 実装
  └─ index.ts       ← singleton export

src/lib/
  └─ queryClient.ts ← QueryClient singleton
```

WebRTC 移行時は `src/transport/index.ts` の `transport` を
`new WsTransport()` → `new WebRtcTransport()` に差し替えるだけ。
`ws-store.ts` および全ての上位レイヤーは変更不要。

---

## 残課題（Phase 8 以降への推奨事項）

### Phase 7 で未着手の項目

| 項目 | 理由 | 推奨フェーズ |
|---|---|---|
| Expo Push API (APNs/FCM) サーバーサイド送信 | バックグラウンド+オフライン対応に必要 | Phase 8 |
| オフライン時の通知キュー | インフラ整備が必要 | Phase 8 |
| WebRTC DataChannel への移行 | ITransport 準備完了。STUN/TURN が必要 | Phase 8 |
| expo-device から OS 情報を取得 | ws-store.ts で `os: 'ios'` をハードコードしている | Phase 8 |
| push_token の自動更新フック | ログイン後・トークン更新後にサーバーへ送信 | Phase 8 |
| 通知バッジ数の管理 | expo-notifications の badge API が必要 | Phase 8 |

### Phase 8 への推奨事項

1. **Expo Push API 連携**
   - `expo-server-sdk` をサーバーに追加
   - rank-service の `createRankUpNotification()` から Expo Push API を呼び出す
   - `devices.push_token` を使用してオフライン端末にも通知を届ける

2. **WebRTC 移行**
   - `WebRtcTransport` クラスを `src/transport/WebRtcTransport.ts` に実装
   - STUN/TURN サーバー設定
   - `src/transport/index.ts` で A/B テストまたはフィーチャーフラグで切り替え
   - ITransport インターフェースは Phase 7-A で既に定義済み

3. **expo-device 連携**
   - `import * as Device from 'expo-device'` で OS 情報を取得
   - `ws-store.ts` の `connect()` で `Device.osName` を使用

4. **HybridTransport**
   - WebRTC primary + WebSocket fallback の `HybridTransport` 実装
   - NAT 越えに失敗した場合は自動的に WebSocket にフォールバック

---

## コミット一覧

```
29e25dc feat(7-A): ITransport インターフェース切り出し + QueryClient singleton
65dd9d8 feat(7-B): Push 通知実装 — WS リアルタイム通知 + expo-notifications 連携
```
