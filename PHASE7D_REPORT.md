# Phase 7-D 実装レポート — uptime 精度改善 + 参加統計自動更新

**実装日**: 2026-04-27
**ステータス**: ✅ 完了
**成功条件**: セッション uptime が正確に記録され、連続参加日数・総参加日数・平均参加時間が自動更新される

---

## Phase 7-A / 7-B / 7-C の実装サマリー（コード読み取り結果）

### Phase 7-A: ITransport 抽象化 + QueryClient singleton

**実装ファイル**:
- `src/transport/ITransport.ts` — トランスポート抽象インターフェース（`connect`, `disconnect`, `joinNetwork`, `leaveNetwork`, `sendJobResult`, `onMessage`, `onStatusChange`）
- `src/transport/WsTransport.ts` — WebSocket 実装（338行）、指数バックオフ再接続、AppState 対応
- `src/transport/index.ts` — singleton export
- `src/stores/ws-store.ts` — ITransport 経由に切り替え、queryClient singleton 使用

**背景**: WebRTC DataChannel 移行への基盤作り。後続の Phase 8 で `WebRtcTransport` を実装するだけで移行できる状態を整備。

### Phase 7-B: Push 通知（WS リアルタイム + expo-notifications）

**実装ファイル**:
- `server/src/ws/peer-manager.ts` — `sendNotificationToUser()` 追加（userId 宛の全ピアへ `notification_push` メッセージ送信）
- `server/src/ws/types.ts` — `NotificationPushMessage` 型追加
- `server/src/ws/job-judge.ts` — `sendRankUpNotificationWs()` 追加（ランクアップ時の WS push）
- `src/hooks/useInAppNotification.ts` — `notification_push` 受信 → フォアグラウンド時 Toast / バックグラウンド時 `scheduleLocalNotification()`
- `src/stores/ws-store.ts` — `notification_push` ハンドリング追加

### Phase 7-C: ランクダウンロジック（非活動デケイ + WS push 通知）

**実装ファイル**:
- `server/src/services/rank-service.ts` — `checkAndApplyRankDecay()` 追加
  - 7日間スコア未更新 → `score = floor(score × 0.9)` (10%減)
  - 1日1回制限
  - Bronze は最低ランク保証
- `server/src/routes/rank.ts` — `GET /rank` に `checkAndApplyRankDecay()` 組み込み
- `server/src/ws/handler.ts` — `hello` 認証時にデケイチェック + WS push 通知ヘルパー追加
- `server/tests/rank-service-decay.test.ts` — 11件の単体テスト

---

## Phase 7-D として何を選んだか + 選定理由

### 選定: **uptime 精度改善 + 参加統計（consecutive_days / total_days_active / avg_participation_hours）自動更新**

#### 候補評価

| 候補 | 評価 |
|------|------|
| **uptime 精度改善**（session_start_at ベース） | `session_start_at` フィールドは Phase 6 で追加済みで未活用。heartbeat ベースの粗い計測を補正でき、ランク評価の質が上がる ✅ **採用** |
| Expo Push API（APNs/FCM バックグラウンド通知） | サーバーサイドのサードパーティ依存が増加し、テスト環境構築コストが高い。Phase 8 の大改修に向いている |
| `GET /rank/leaderboard` へのデケイ反映 | スコープが小さく単独で Phase 7-D とするには不十分 |
| expo-device OS 情報取得 | フロントのみの変更、影響が限定的 |
| WebRTC DataChannel 移行 | Phase 8 相当の大規模変更 |

#### 採用理由（詳細）

1. **既存インフラを最大活用**: `session_start_at` フィールド（`nodeParticipationStates`）は Phase 6 B4 で記録開始済み。`rank_ledger` の `avg_participation_hours`, `consecutive_days`, `total_days_active` フィールドも存在するが、**Phase 6/7 では一切更新されていなかった**（デフォルト値 0 のまま）
2. **アーキテクチャ的価値**: `avg_participation_hours` / `consecutive_days` はランク評価の評価軸として `rank_ledger` に定義されており、これを実際に埋めることで Phase 8 のランク評価精緻化への基盤になる
3. **heartbeat ベースの問題を解決**: 既存の heartbeat ループ（10秒ごと）では、セッション終了時の端数が切り捨てられる。session_start_at を使った実測値で補正することで精度が向上する
4. **小さく安全な変更**: スキーマ変更なし、既存 API の変更なし、外部依存追加なし。7-C より小さいスコープで実装できる

---

## 設計 / 実装内容

### 1. セッション時間の精度補正（`peer-manager.ts`）

#### 従来の heartbeat ベース計測の問題点

```
heartbeat ループ: 10秒ごとに約0.167分を today/total_uptime_minutes に加算
問題: セッション終了時の端数（最後の 0〜0.167分）が失われる
例: 5分4秒のセッション → 5.0分として記録（4秒分が失われる）
```

#### 新しい補正ロジック（残差加算）

```
切断 or leave_network 時:
  1. participatingStartedAt → 切断時刻 で実セッション時間(分)を計算
  2. heartbeat ループで推定加算済み量を計算
     heartbeatFires = floor(actualMinutes / (10秒÷60))
     alreadyCounted = heartbeatFires × (10秒÷60)
  3. 残差 = actualMinutes - alreadyCounted を DB に加算
  → heartbeat + 残差 で実セッション時間を正確に表現
```

#### `ConnectedPeer` インターフェースへの追加

```typescript
export interface ConnectedPeer {
  // ... 既存フィールド
  /** セッション開始時刻（join_network 時にセット）。uptime 精度計算に使用 */
  participatingStartedAt: Date | null;
  // ...
}
```

#### `setStatus()` の変更

```typescript
setStatus(installationId, status): void {
  // joining: participatingStartedAt = new Date()
  // leaving: DB に残差を記録し participatingStartedAt = null
}
```

#### `recordSessionUptimeAsync()` の新規追加（public）

```typescript
public recordSessionUptimeAsync(
  installationId: string,
  userId: string,
  actualSessionMinutes: number,
): void
```

### 2. 参加統計の自動更新（`rank-service.ts`）

#### `recordDailyParticipation()` の新規追加

```typescript
export async function recordDailyParticipation(
  userId: string,
  sessionMinutes: number,
): Promise<RecordDailyParticipationResult>
```

**更新内容**:

| フィールド | 更新ロジック |
|-----------|------------|
| `total_days_active` | 今日初回の記録の場合 +1 |
| `consecutive_days` | 昨日も更新済み → +1 / 2日以上空いた → 1 にリセット / 初回 → 1 |
| `avg_participation_hours` | EWMA（指数移動平均）: α = 1/30 で直近30日を反映 |

**EWMA 式**:
```
newAvg = prevAvg === 0
  ? sessionHours                                    // 初回: 実測値
  : prevAvg × (1 - 1/30) + sessionHours × (1/30)   // EWMA更新
```

**べき等性の保証**:
- `rank_ledger.updated_at` が今日付けの場合: `consecutive_days` / `total_days_active` はスキップ（重複カウント防止）
- `avg_participation_hours` は追加セッションでも更新（複数セッションの累積を反映）

### 3. ハンドラーへの組み込み（`handler.ts`）

#### `leave_network` ハンドラー

```typescript
case 'leave_network':
  const participatingStartedAt = peer?.participatingStartedAt ?? null;
  peerManager.setStatus(installationId, 'waiting');  // ← setStatus 内でも残差記録

  // recordDailyParticipation で consecutive/total/avg を更新
  if (participatingStartedAt) {
    const sessionMinutes = (Date.now() - participatingStartedAt) / 60_000;
    recordDailyParticipation(userId, sessionMinutes);
  }
```

#### `onClose` ハンドラー

```typescript
onClose: (_evt, ws) => {
  const wasParticipating = peer?.status === 'participating';
  const participatingStartedAt = peer?.participatingStartedAt ?? null;

  peerManager.removePeer(installationId);  // ← removePeer 内でも残差記録

  // 切断時にも consecutive/total/avg を更新
  if (wasParticipating && participatingStartedAt) {
    recordDailyParticipation(userId, sessionMinutes);
  }
}
```

---

## 変更ファイル一覧

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `server/src/ws/peer-manager.ts` | `ConnectedPeer` に `participatingStartedAt` 追加、`addPeer()` 型更新、`removePeer()` で残差記録、`setStatus()` で開始/終了トラッキング、`recordSessionUptimeAsync()` 新規追加 |
| `server/src/ws/handler.ts` | `recordDailyParticipation` import追加、`leave_network` ハンドラーに呼び出し追加、`onClose` ハンドラーに呼び出し追加 |
| `server/src/services/rank-service.ts` | `RecordDailyParticipationResult` インターフェース追加、`recordDailyParticipation()` 関数追加 |

### 新規作成

| ファイル | 内容 |
|---------|------|
| `server/tests/rank-service-participation.test.ts` | 参加統計記録の単体テスト 8件 |
| `server/tests/ws/ws-uptime.test.ts` | uptime 精度改善のテスト 9件 |
| `PHASE7D_REPORT.md` | 本ファイル |

---

## テスト追加内容

### 新規テストファイル 2 件

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| `rank-service-participation.test.ts` | 8件 | 参加統計記録の単体テスト |
| `ws-uptime.test.ts` | 9件 | participatingStartedAt・残差計算テスト |

### `rank-service-participation.test.ts` テスト一覧

| テスト名 | 検証内容 |
|---------|---------|
| rank_ledger が存在しない場合は recorded=false でスキップ | エッジケース |
| 初回参加: total_days=1, consecutive=1, avg_hours=セッション時間 | 初回記録 |
| 昨日も参加: consecutive_days が +1 される | 連続参加ストリーク |
| 2日以上空いた: consecutive_days が 1 にリセットされる | 連続中断 |
| 今日すでに記録済み: total_days / consecutive はスキップ | 重複防止 |
| 初回(prev=0): avg = sessionHours そのまま | EWMA 初回 |
| prev=2h, session=1h: EWMA で徐々に近づく | EWMA 更新 |
| Platinum 30連続 → 31連続, total=61 | Platinum ユーザー |

### `ws-uptime.test.ts` テスト一覧

| テスト名 | 検証内容 |
|---------|---------|
| addPeer 時は participatingStartedAt が null | 初期値確認 |
| setStatus("participating") で participatingStartedAt がセットされる | 参加開始トラッキング |
| setStatus("waiting") で participatingStartedAt が null にリセットされる | 参加終了クリア |
| join → leave でセッション時間が DB に記録される | setStatus 経由の残差記録 |
| participating のまま removePeer すると uptime が記録される | 切断時の残差記録 |
| waiting のまま removePeer するときは uptime 記録しない | 非参加中の切断はスキップ |
| sessionMinutes が heartbeat インターバルより短い場合でも残差を計算できる | 残差 0 のエッジケース |
| sessionMinutes = 5 のとき残差が正しく計算される | heartbeat ちょうど補完 |
| sessionMinutes = 5.1 のとき残差が加算される | 残差 0.1 の補正 |

### テスト結果

| テストファイル | 件数 | 結果 |
|-------------|------|------|
| `rank-service-participation.test.ts`（新規） | 8件 | ✅ パス |
| `ws-uptime.test.ts`（新規） | 9件 | ✅ パス |
| 既存テスト（112件） | 112件 | ✅ 全パス |
| **合計** | **129件** | **✅ 全件パス** |

---

## 次の Phase 7-E 以降の候補

| 候補 | 内容 | 推奨 |
|------|------|------|
| **Expo Push API (APNs/FCM)** | バックグラウンド端末への Push 通知。`expo-server-sdk` をサーバーに追加。`devices.push_token` は Phase 3 から格納済みで未使用 | Phase 7-E |
| **`GET /rank/leaderboard` デケイ反映** | リーダーボード取得時にデケイチェックを実行し、スコアを最新状態に保つ | Phase 7-E |
| **push_token 自動更新フック** | ログイン後・アプリ再起動後に push_token をサーバーへ POST する仕組み | Phase 7-E |
| **WebRTC DataChannel 移行** | `WebRtcTransport.ts` 実装。ITransport は Phase 7-A で完備済み。STUN/TURN 設定が必要 | Phase 8 |
| **HybridTransport** | WebRTC primary + WebSocket fallback | Phase 8 |
| **今日の uptime リセット** | 日付が変わった時に `today_uptime_minutes = 0` にする仕組みが未実装（現在は加算のみ） | Phase 8 |
| **段階的デケイレート調整** | `DECAY_INACTIVE_DAYS` / `DECAY_RATE` の環境変数化 | Phase 8 |

---

## Phase 7-D 実装フロー図

```
[join_network]
  ↓
peerManager.setStatus('participating')
  ├─ participatingStartedAt = new Date()
  └─ 参加開始時刻を記録

[leave_network / onClose]
  ↓
handler.ts: participatingStartedAt を事前に取得
  ↓
peerManager.setStatus('waiting') or removePeer()
  ├─ actualSessionMinutes を計算
  ├─ heartbeatFires 推定 → alreadyCounted
  ├─ residual = actualMinutes - alreadyCounted
  └─ residual > 0 → DB.update(today/total_uptime_minutes + residual)
  ↓
recordDailyParticipation(userId, sessionMinutes)
  ├─ rank_ledger.updated_at が今日付け?
  │   ├─ YES → consecutive/total は変更なし、avg_hours だけ EWMA 更新
  │   └─ NO → 昨日付け? → consecutive +1 / それ以外 → reset to 1
  │            total_days_active +1
  │            avg_hours EWMA 更新
  └─ rank_ledger UPDATE (consecutive_days, total_days_active, avg_participation_hours)
```
