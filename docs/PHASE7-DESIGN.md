# Phase 7 設計書 — ITransport 抽象化 + Push 通知

作成日: 2026-04-21
フェーズ: 7-A (ITransport) + 7-B (Push 通知)

---

## 概要

Phase 7 は以下の 2 サブフェーズで構成される。

| サブフェーズ | 内容 | 目的 |
|---|---|---|
| 7-A | ITransport インターフェース切り出し | WebRTC 移行への準備 / アーキテクチャ改善 |
| 7-B | Push 通知実装 | notifications テーブルのフロント接続 + expo-notifications |

---

## Phase 7-A: ITransport インターフェース

### 背景

Phase 5 で導入した `NoodlaWsClient` は `src/services/ws-client.ts` に直接実装されており、
`src/stores/ws-store.ts` から singleton `wsClient` を直接使用している。

Phase 4 設計書で "Phase 7 以降: WebRTC DataChannel に移行" と決定済み。
WebRTC 移行をスムーズにするため、Transport 層を抽象化する。

### 設計方針

```
src/transport/
  ITransport.ts       ← インターフェース定義
  WsTransport.ts      ← WebSocket 実装（既存 NoodlaWsClient をラップ）
  index.ts            ← デフォルトトランスポートの export
src/lib/
  queryClient.ts      ← QueryClient singleton（setWsQueryInvalidate 不要化）
src/stores/
  ws-store.ts         ← ITransport 経由に書き換え
```

### ITransport インターフェース

```typescript
export interface TransportConnectOptions {
  url: string;
  accessToken: string;
  installationId: string;
  deviceInfo: {
    os: 'ios' | 'android' | 'unknown';
    appVersion: string;
  };
}

export interface ITransport {
  // 接続管理
  connect(opts: TransportConnectOptions): void;
  disconnect(): void;

  // メッセージ送信
  joinNetwork(): void;
  leaveNetwork(): void;
  sendJobResult(
    jobId: string,
    result: unknown,
    processingMs: number,
    deviceLoad?: { cpuUsage: number; memoryUsage: number; batteryLevel: number }
  ): void;

  // サブスクリプション
  onMessage(handler: (msg: ServerToClientMessage) => void): () => void;
  onStatusChange(handler: (state: TransportConnectionState) => void): () => void;

  // 状態照会
  getConnectionState(): TransportConnectionState;
  getReconnectCount(): number;
}

export type TransportConnectionState = 'disconnected' | 'connecting' | 'connected' | 'reconnecting';
```

### QueryClient singleton

`app/_layout.tsx` で生成している `queryClient` インスタンスを
`src/lib/queryClient.ts` でシングルトンとして管理し、
`setWsQueryInvalidate()` のコールバック注入を不要にする。

```typescript
// src/lib/queryClient.ts
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({ ... });
```

`app/_layout.tsx` はこれをインポートして `QueryClientProvider` に渡す。
`ws-store.ts` は `_queryInvalidate` コールバックを使わず `queryClient.invalidateQueries()` を直接呼ぶ。

### 移行戦略

1. `ITransport` インターフェースを定義
2. `WsTransport` が `NoodlaWsClient` をラップして `ITransport` を実装
3. `ws-store.ts` の `wsClient` 参照を `transport: ITransport` に置換
4. `setWsQueryInvalidate` とコールバック機構を削除
5. 既存の機能・挙動は変わらない（リファクタのみ）

---

## Phase 7-B: Push 通知

### 背景

- Phase 6 でバックエンド側 `notifications` テーブルへの書き込みは完了済み
  - ランクアップ時: `rank_up` レコードが追加される
- フロント側の受信・表示は未着手

### 通知フロー

```
[A] リアルタイム通知 (WebSocket)
  Server ─ notification_push ──→ ws-store
                                    └→ in-app toast (即時表示)
                                    └→ useNotifications キャッシュ invalidate
                                    └→ expo-notifications.scheduleNotification() (バックグラウンド時)

[B] 履歴通知 (REST API)
  GET /notifications → useNotifications hook → app/notifications.tsx (既存画面)
```

### 追加 WebSocket メッセージ型

```typescript
// Server → Client
interface NotificationPushMessage extends WsMessageBase {
  type: 'notification_push';
  notificationId: string;
  notifType: string;    // 'rank_up' | 'points' | 'system' など
  title: string;
  body: string;
}
```

### フロントエンド実装

#### Toast コンポーネント

`src/components/ui/Toast.tsx` を新規作成。
- `useInAppNotification` フック経由でトリガー
- 3 秒後に自動消去
- タップで通知画面へ遷移

#### useInAppNotification フック

`src/hooks/useInAppNotification.ts` を新規作成。
- WS store から `notification_push` メッセージを受信
- トースト表示
- `notifications` クエリを invalidate

#### expo-notifications 連携

- iOS/Android のプッシュ通知許可を取得
- `push_token` をデバイス登録時に送信（`/devices` PATCH エンドポイント）
- バックグラウンド時は `expo-notifications` でプッシュ通知をスケジュール
- フォアグラウンド時はアプリ内 toast のみ（重複防止）

### バックエンド追加

`server/src/ws/handler.ts`: `notification_push` メッセージをクライアントに送信するヘルパー追加
`server/src/routes/devices.ts`: `push_token` 更新エンドポイント追加

### 実装しないもの（Phase 8 以降）

- APNs / FCM の実際のサーバーサイド push 送信
- プッシュ通知のバックエンド統合（Expo Push API 連携）
- オフライン時通知キュー

---

## 共通制約

- TypeScript strict モードを通す
- 既存テスト（101 件）を壊さない
- バックエンド API の互換性を維持
- 既存の画面・UI は変更しない

---

## ファイル変更一覧（予定）

### 新規作成

| ファイル | 内容 |
|---|---|
| `src/transport/ITransport.ts` | Transport インターフェース定義 |
| `src/transport/WsTransport.ts` | WebSocket 実装 |
| `src/transport/index.ts` | デフォルト transport export |
| `src/lib/queryClient.ts` | QueryClient singleton |
| `src/components/ui/Toast.tsx` | In-app toast コンポーネント |
| `src/hooks/useInAppNotification.ts` | WS 通知受信フック |
| `src/services/notification-service.ts` | expo-notifications ラッパー |

### 変更

| ファイル | 変更内容 |
|---|---|
| `src/stores/ws-store.ts` | ITransport 経由に変更、queryClient singleton 使用 |
| `app/_layout.tsx` | queryClient singleton をインポート |
| `src/services/ws-types.ts` | `notification_push` メッセージ型を追加 |
| `server/src/ws/types.ts` | `NotificationPushMessage` を追加 |
| `server/src/ws/handler.ts` | `sendNotification()` ヘルパー追加 |
| `server/src/ws/peer-manager.ts` | ユーザー ID でピアを検索するメソッド追加 |
| `server/src/services/rank-service.ts` | ランクアップ時に WS push 通知送信 |
| `server/src/routes/devices.ts` | push_token 更新エンドポイント追加 |
| `docs/PHASE7-DESIGN.md` | 本ファイル（新規） |
| `docs/PHASE7-REPORT.md` | 完了レポート（完了時） |
| `README.md` | ステータス更新 |
