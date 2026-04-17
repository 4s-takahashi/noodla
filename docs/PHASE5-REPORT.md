# Phase 5 実装レポート — WebSocket リアルタイム疎通

**実装日**: 2026-04-17  
**ステータス**: ✅ 完了  
**成功条件**: 2台以上のスマホで成立する最小のリアルタイム疎通実験

---

## 1. WebSocket / API 一覧

### WebSocket エンドポイント

| エンドポイント | プロトコル | 説明 |
|---------------|-----------|------|
| `/ws/v1/node` | WebSocket | ノード接続用。JWT認証必須 |

### メッセージ型一覧

#### クライアント → サーバー

| type | 説明 | 主要フィールド |
|------|------|---------------|
| `hello` | 認証・接続開始 | `installationId`, `accessToken`, `deviceInfo` |
| `join_network` | ネットワーク参加 | `installationId` |
| `leave_network` | ネットワーク離脱 | `installationId` |
| `job_result` | ジョブ結果返却 | `jobId`, `result`, `processingMs`, `status`, `deviceLoad` |
| `ping` | heartbeat | — |

#### サーバー → クライアント

| type | 説明 | 主要フィールド |
|------|------|---------------|
| `connected` | 認証成功 | `userId`, `installationId` |
| `network_status` | ネットワーク状況 | `totalOnline`, `totalParticipating`, `peers[]` |
| `job_assign` | ジョブ配布 | `jobId`, `jobType`, `payload`, `timeoutMs`, `duplicateCount` |
| `job_accepted` | ジョブ採用 | `jobId`, `experimentalPoints` |
| `job_rejected` | ジョブ不採用 | `jobId`, `reason` (`late` / `error` / `timeout`) |
| `pong` | heartbeat応答 | — |
| `error` | エラー | `code`, `message` |

### 既存 REST API (Phase 2-3 から継続)

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/api/v1/auth/register` | ユーザー登録 |
| POST | `/api/v1/auth/login` | ログイン |
| POST | `/api/v1/auth/refresh` | トークンリフレッシュ |
| GET | `/api/v1/node/state` | ノード状態取得 |
| PUT | `/api/v1/node/state` | ノード状態更新 |
| GET | `/api/v1/points/balance` | ポイント残高 |
| GET | `/api/v1/rank/me` | ランク情報 |
| GET | `/health` | ヘルスチェック |

---

## 2. 疑似ジョブ仕様

### ジョブタイプ

| job_type | 説明 | ペイロード |
|----------|------|-----------|
| `mock_token_generate` | 疑似トークン生成 | `{ prompt, maxTokens, seed }` |
| `ping_job` | 疎通確認用 ping | `{ prompt, maxTokens, seed }` |

**配布比率**: `mock_token_generate` : `ping_job` = 2 : 1

### ペイロード構造

```typescript
interface PseudoJobPayload {
  prompt: string;     // 3〜5 単語の文字列 (seed-based)
  maxTokens: number;  // 1〜5
  seed: number;       // 再現性のためのシード値
}
```

### ジョブ配布条件

- `participating` 状態のピアが **2台以上** の場合のみ配布
- **5秒間隔** で自動配布
- ランダムに **2台** を選択し、同一ジョブを同時送信
- ジョブタイムアウト: **5秒**

### フロント側処理

- seed ベースの決定論的ハッシュで疑似トークンを生成
- 処理時間: 50ms〜200ms (模倣)
- 処理後に `job_result` メッセージでサーバーへ返却

---

## 3. 先着優先処理仕様

### フロー

```
サーバー → 端末A: job_assign (jobId=xxx)
サーバー → 端末B: job_assign (jobId=xxx)

端末A → サーバー: job_result (80ms)   → ✅ job_accepted
端末B → サーバー: job_result (120ms)  → ❌ job_rejected (reason: late)
```

### ルール

| 条件 | 結果 |
|------|------|
| 最初の valid な結果 | `job_accepted` (experimentalPoints: 1) |
| 2番目以降の結果 | `job_rejected` (reason: `late`) |
| settled 後の遅着結果 | `job_rejected` (reason: `late`) |
| タイムアウト (5秒超過) | `job_rejected` (reason: `timeout`) |
| 未知ジョブへの結果 | 無視 (ログ出力のみ) |
| 未アサインピアからの結果 | 無視 (ログ出力のみ) |

### 重要: 本番ポイント加算なし

- `experimentalPoints` はフロント側のローカルカウンターのみ
- `points_ledger` テーブルへの書き込みは一切行わない
- ランクスコアへの反映もなし

---

## 4. イベント記録

### テーブル: `job_events`

```sql
CREATE TABLE job_events (
  id              TEXT PRIMARY KEY,
  job_id          TEXT NOT NULL,
  job_type        TEXT NOT NULL,
  payload         TEXT NOT NULL,    -- JSON
  user_id         TEXT NOT NULL,
  installation_id TEXT NOT NULL,
  assigned_at     TEXT NOT NULL,    -- ISO 8601
  responded_at    TEXT,             -- ISO 8601 (timeout の場合は NULL)
  result_status   TEXT NOT NULL,    -- 'accepted' | 'rejected' | 'timeout'
  response_ms     INTEGER,         -- 応答時間 (timeout の場合は NULL)
  result_data     TEXT,             -- JSON (timeout の場合は NULL)
  created_at      TEXT DEFAULT (datetime('now')) NOT NULL
);
```

### インデックス

| インデックス | カラム |
|-------------|--------|
| `idx_job_events_job_id` | `job_id` |
| `idx_job_events_user_id` | `user_id` |
| `idx_job_events_status` | `result_status` |
| `idx_job_events_created_at` | `created_at` |

### 保存先

- **ファイル**: `server/data/noodla.db` (SQLite)
- **マイグレーション**: `server/drizzle/0001_add_job_events.sql`

### 記録内容

| result_status | responded_at | response_ms | result_data |
|--------------|-------------|-------------|-------------|
| `accepted` | ✅ 記録 | ✅ 記録 | ✅ 記録 |
| `rejected` | ✅ 記録 | ✅ 記録 | ✅ 記録 |
| `timeout` | NULL | NULL | NULL |

---

## 5. フロントで接続反映した画面一覧

### `app/(tabs)/home.tsx` — ホーム画面

| 要素 | 説明 |
|------|------|
| WS接続状態バッジ | 🟢接続中 / 🟡接続中... / 🟡再接続中... / 🔴未接続 |
| ノード数表示 | WebSocketの `network_status` から `totalOnline` / `totalParticipating` を表示 |
| ジョブ統計バナー | 「最近のジョブ処理: N件（採用: M件）」 |

### `app/participation.tsx` — 参加状況画面

| 要素 | 説明 |
|------|------|
| WS接続状態インジケーター | ドット + ラベル |
| 「参加する」「停止する」ボタン | WebSocket接続 + join_network / leave_network |
| ネットワーク状況 | 「オンライン: N台 ／ 参加中: M台」 |
| ジョブ処理中インジケーター | ActivityIndicator + 「ジョブ処理中...」 |
| 統計表示 | 「処理: N件 ／ 採用: M件」+ 実験ポイント |
| 直近のジョブ結果リスト | ✅採用 / ❌遅延 / ⏱タイムアウト (最大5件表示) |

### `app/connection.tsx` — 接続詳細画面

| 要素 | 説明 |
|------|------|
| WebSocket接続状態カード | 接続状態・接続先URL・接続時間・最終heartbeat・再接続回数 |

### Phase 1 UIとの共存

- 既存のモック表示 (Wi-Fi, バッテリー, ポイント等) はそのまま維持
- WebSocket関連UIは既存UIの上部または独立セクションに追加
- `USE_REAL_API` フラグでモックとリアルデータを切り替え可能

---

## 6. 接続ライフサイクル実装内容

### 接続条件

- **ログイン済み** (`accessToken` が存在)
- **participating** 状態 (ユーザーが「参加する」をタップ)

### ライフサイクル

```
[アプリ起動]
    → ログイン
    → 「参加する」タップ
    → wsClient.connect(serverUrl, accessToken, installationId)
    → WebSocket接続
    → hello メッセージ送信 (JWT認証)
    → connected メッセージ受信
    → wsClient.joinNetwork()
    → network_status 受信
    → 5秒ごとに疑似ジョブ受信・処理

[フォアグラウンド復帰]
    → AppState.addEventListener('change') で検知
    → connectionState が disconnected/reconnecting なら再接続
    → reconnectAttempts = 0 にリセット

[バックグラウンド遷移]
    → AppState 変化を検知
    → WebSocket 切断 (close)
    → pingInterval クリア
    → reconnectTimeout クリア
    → connectionState → 'disconnected'

[接続断 (ネットワーク障害等)]
    → onclose イベント発火
    → exponential backoff で再接続
    → 1s → 2s → 4s → 8s → 16s → max 30s

[heartbeat タイムアウト (サーバー側)]
    → 30秒間 ping がなければサーバーが切断
    → クライアントは onclose で再接続シーケンスに入る

[認証タイムアウト (サーバー側)]
    → 接続後10秒以内に hello が来なければ切断
    → error メッセージ (AUTH_TIMEOUT) 送信後 close

[「停止する」タップ]
    → wsClient.leaveNetwork()
    → status → 'waiting'
    → ジョブ配布対象から外れる (接続は維持)

[ログアウト / 完全切断]
    → wsClient.disconnect()
    → WebSocket close
    → 全タイマークリア
    → AppState リスナー解除
```

### 無限再試行の防止

- exponential backoff (1s → max 30s)
- バックグラウンドでは再接続しない
- サーバー側の heartbeat タイムアウトでゾンビ接続を防止

---

## 7. 動作確認手順

`docs/PHASE5-TESTING.md` に詳細な手順書を記載。要約:

1. **サーバー起動**: `cd server && npm run migrate && npm run dev`
2. **ヘルスチェック**: `curl http://localhost:3001/health`
3. **wscat での手動テスト**: 2つのターミナルで接続、hello認証、join_network、job_assign受信、job_result送信
4. **Expo アプリでの実機テスト**: 2台のスマホで参加状況画面から「参加する」
5. **自動テスト**: `cd server && npm test` (52件パス)
6. **DB確認**: `sqlite3 data/noodla.db "SELECT * FROM job_events ORDER BY created_at DESC LIMIT 10;"`

---

## 8. 未実装の明示

| 項目 | 状態 | 備考 |
|------|------|------|
| WebRTC / P2P 本実装 | ❌ 未実装 | Phase 6 以降 |
| AI API 接続 / 実分散推論 | ❌ 未実装 | 疑似ジョブのみ |
| 本番ポイント加算 | ❌ 未実装 | `experimentalPoints` はローカルのみ |
| バックグラウンド常時接続 | ❌ 未実装 | バックグラウンドで切断 |
| 準親ノード実装 | ❌ 未実装 | サーバーが中継 |
| 実デバイス情報取得 | ❌ 未実装 | `expo-device`/`expo-battery` はモック値 |
| Push通知 | ❌ 未実装 | — |
| WebSocket 接続の暗号化 (wss) | ❌ 本番環境のみ | 開発時は `ws://localhost` |
| ジョブ結果の検証ロジック | ❌ 未実装 | 結果の正当性チェックは Phase 6+ |
| 100台以上のスケーリング | ❌ 未実装 | Phase 8 |

---

## 9. Phase 6 でやるべきこと

1. **WebRTC DataChannel への段階移行**: シグナリングサーバー構築、ICE/STUN/TURN 設定
2. **expo-dev-client (Prebuild) 移行**: WebRTC にはネイティブモジュールが必要
3. **本番ポイント加算**: `job_events` → `points_ledger` への変換ロジック
4. **ランク自動更新**: 採用率・応答速度に基づくスコア計算
5. **ジョブ結果の検証**: seed-based の期待値と実際の結果を照合
6. **接続メトリクスの永続化**: 接続時間・安定性を DB に保存
7. **node_participation_states との連携**: WebSocket 状態を REST API 側にも反映
8. **エラーハンドリング強化**: 接続数上限、レート制限、異常検知

---

## 10. 変更ファイル一覧

### 新規ファイル

| ファイル | 説明 |
|---------|------|
| `server/src/ws/types.ts` | WebSocket メッセージ型定義 |
| `server/src/ws/peer-manager.ts` | ピア管理 (接続/切断/heartbeat/broadcast) |
| `server/src/ws/job-judge.ts` | 早着判定・DB記録 |
| `server/src/ws/job-scheduler.ts` | 疑似ジョブ生成・配布 |
| `server/src/ws/handler.ts` | WebSocket ハンドラー |
| `server/drizzle/0001_add_job_events.sql` | job_events マイグレーション |
| `server/tests/ws/ws-peer-manager.test.ts` | PeerManager テスト (8件) |
| `server/tests/ws/ws-job-judge.test.ts` | JobJudge テスト (5件) |
| `server/tests/ws/ws-job-scheduler.test.ts` | JobScheduler テスト (4件) |
| `server/tests/ws/ws-connection.test.ts` | 接続フロー統合テスト (7件) |
| `src/services/ws-types.ts` | フロント用メッセージ型定義 |
| `src/services/ws-client.ts` | WebSocket クライアント (自動再接続・heartbeat) |
| `src/services/job-processor.ts` | 疑似ジョブ処理エンジン |
| `src/stores/ws-store.ts` | Zustand WebSocket 状態管理 |
| `docs/PHASE5-REPORT.md` | 本レポート |
| `docs/PHASE5-TESTING.md` | テスト手順書 |

### 変更ファイル

| ファイル | 変更内容 |
|---------|---------|
| `server/src/index.ts` | `@hono/node-ws` セットアップ、`/ws/v1/node` エンドポイント追加 |
| `server/src/db/schema.ts` | `job_events` テーブル定義追加 |
| `server/package.json` | `@hono/node-ws`, `ws`, `@types/ws` 追加 |
| `package.json` | (Expo 依存パッケージ調整) |
| `app/(tabs)/home.tsx` | WebSocket 接続状態バッジ、ノード数、ジョブ統計 |
| `app/participation.tsx` | 参加/停止ボタン、ジョブ処理UI、結果リスト |
| `app/connection.tsx` | WebSocket 接続詳細カード |

---

## アーキテクチャ図

```
[iPhone A]                    [VPS / localhost]                [iPhone B]
    |                               |                               |
    |------ ws://host/ws/v1/node -->|                               |
    |<-- connected (hello auth) ----|                               |
    |------ join_network ---------->|                               |
    |                               |<------- ws://host/ws/v1/node -|
    |                               |---- connected (hello auth) -->|
    |                               |<------ join_network ----------|
    |                               |                               |
    |<-- job_assign (jobId=xxx) ----|--- job_assign (jobId=xxx) --->|
    |                               |                               |
    |--- job_result (80ms) -------->|                               |
    |<-- job_accepted (pts=1) ------|                               |
    |                               |<-------- job_result (120ms) --|
    |                               |-- job_rejected (late) ------->|
    |                               |                               |
    |                       [job_events INSERT x2]                  |
```

---

## テスト結果サマリー

| カテゴリ | ファイル | テスト数 |
|---------|---------|--------|
| 認証 | `tests/auth.test.ts` | 7 |
| デバイス | `tests/devices.test.ts` | 4 |
| 通知 | `tests/notifications.test.ts` | 6 |
| ポイント | `tests/points.test.ts` | 6 |
| ランク | `tests/rank.test.ts` | 5 |
| WS PeerManager | `tests/ws/ws-peer-manager.test.ts` | 8 |
| WS JobJudge | `tests/ws/ws-job-judge.test.ts` | 5 |
| WS JobScheduler | `tests/ws/ws-job-scheduler.test.ts` | 4 |
| WS 接続フロー | `tests/ws/ws-connection.test.ts` | 7 |
| **合計** | | **52** |

全52件パス ✅ (既存28件 + 新規24件)

---

## 絶対ルールの遵守確認

| ルール | 確認 |
|--------|------|
| ❌ WebRTC / P2P 本実装 | ✅ WebSocket のみ使用 |
| ❌ AI API 接続 / 実分散推論 | ✅ 疑似ジョブのみ |
| ❌ 本番ポイント加算 | ✅ experimentalPoints はローカルカウンターのみ |
| ❌ バックグラウンド常時接続 | ✅ バックグラウンドで WS 切断 |
| ❌ 準親ノード実装 | ✅ サーバーのみが中継 |
