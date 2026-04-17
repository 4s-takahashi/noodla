# Phase 6 実装レポート — 報酬実感の本実装

**実装日**: 2026-04-17
**ステータス**: ✅ 完了
**成功条件**: accepted ジョブ → `points_ledger` に書き込み、ランクスコア累積増加、閾値超えでランクアップ + 通知

---

## Summary

Phase 6 is **complete**. All 101 tests pass (52 existing + 49 new).

Phase 5 では `experimentalPoints` がフロントエンドのローカルカウンターに留まっていたが、Phase 6 でDBへの永続化を実現。accepted ジョブが発生するたびにポイントを計算・加算し、ランクスコアを累積更新する仕組みが稼働している。

---

## 実装内容

### バックエンド

#### B1: `server/src/services/points-service.ts`（新規）
- **ポイント計算式**: `ceil(maxTokens × SPEED_MULT × RANK_MULT × JOB_TYPE_WEIGHT)`
- 速度係数: ≤50ms=1.5 / ≤100ms=1.2 / ≤300ms=1.0 / >300ms=0.8
- ランク係数: Bronze=1.0 / Silver=1.2 / Gold=1.5 / Platinum=2.0（クランプ適用）
- ジョブ種別: `mock_token_generate`=1.0 / `ping_job`=0.3
- 最小1pt保証
- 不正対策: UNIQUE制約違反は握りつぶし、応答時間<10msは半減、1分100件超はスキップ

#### B2: `server/src/services/rank-service.ts`（新規）
- スコア増分 = `ceil(points × RANK_WEIGHT_FOR_SCORE)` （Bronze=1.0, Silver=0.9, Gold=0.75, Platinum=0.5）
- 閾値: Bronze(0) → Silver(1,000) → Gold(6,000) → Platinum(26,000)
- `rank_ledger.score` と `users.rank` を同期更新
- ランクアップ時に `notifications` テーブルに通知追加

#### B3: `server/src/ws/job-judge.ts`（修正）
- accepted 時に `awardPoints()` + `updateRankScore()` を呼び出し
- DB エラーや ポイントスキップの場合でも `job_accepted` メッセージは必ず送信（フォールバック）
- `experimentalPoints` フィールドに実際の獲得ポイントを設定

#### B4: `server/src/ws/handler.ts`（修正）
- `hello` / `join_network` / `leave_network` / `onClose` で `node_participation_states.status` を更新
- `hello` 時に `session_start_at` も更新

#### B5: `server/src/ws/peer-manager.ts`（修正）
- heartbeatInterval（10秒ごと）で `participating` ピアの `today_uptime_minutes` / `total_uptime_minutes` を加算

#### B6: `server/drizzle/0002_add_points_unique.sql`（新規）
```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_earned_job
  ON points_ledger (related_job_id, type)
  WHERE type = 'earned_accepted' AND related_job_id IS NOT NULL;
```

#### B7: `server/src/routes/points.ts`（修正）
- `type = 'earned'` → `type = 'earned_accepted'` に統一（今日/今週/今月の集計）

#### B8: `server/src/routes/rank.ts`（修正）
- ランク閾値を設計書に合わせて修正（Silver→Gold: 5000→6000、Gold→Platinum: 15000→26000）
- `GET /rank/participation-stats` API 追加（累積uptime、ジョブ統計、ランクスコア）

### フロントエンド

#### F3: `src/hooks/useParticipationStats.ts`（新規）
- `GET /rank/participation-stats` を TanStack Query で取得
- `formatUptimeMinutes()` / `formatResponseMs()` ユーティリティ関数を同梱
- モックデータ対応（`USE_REAL_API=false` 時）

#### F4: `src/services/ws-client.ts`
- 変更なし（Phase 5 のまま安定動作）

#### F5: `src/stores/ws-store.ts`（修正）
- `experimentalPoints` → `sessionPoints` にリネーム（意味を明確化）
- `job_accepted` 受信時に `points/balance`、`rank/current`、`participation/stats` クエリを invalidate するコールバック機構（`setWsQueryInvalidate`）を追加
- `sessionPoints` は今セッションの獲得ポイント合計（DBへの永続化はサーバー側）

#### F6: `app/participation.tsx`（修正）
- `useParticipationStats` を使った累積統計セクション追加（今日のuptime、累積uptime、累積ジョブ数、平均応答時間）
- `experimentalPoints` → `sessionPoints` 表示に変更

#### F7: `app/connection.tsx`（修正）
- WebSocket 接続情報カードに「セッション獲得pt」行を追加

#### F8: `app/(tabs)/home.tsx`（修正）
- WS ジョブ統計バナーに `sessionPoints` を表示

### ドキュメント
- `docs/PHASE6-REPORT.md`（本ファイル）
- `docs/PHASE6-TESTING.md`（テスト手順書）
- `README.md` のフェーズ進捗表を Phase 6 完了に更新

---

## テスト結果

| カテゴリ | 件数 |
|----------|------|
| Auth | 11 |
| Devices | 5 |
| Notifications | 4 |
| Points（API） | 5 |
| Rank（API） | 5 |（+2件: participation-stats）
| WS PeerManager | 8 |
| WS JobJudge | 5 |（モック更新）
| WS JobScheduler | 4 |
| WS Connection | 7 |（モック更新）
| **WS Points（新規）** | **3** |
| **WS Rank（新規）** | **3** |
| **Points Service（新規）** | **20** |
| **Rank Service（新規）** | **21** |
| **合計** | **101** |

全101件パス ✅

---

## 設計書との差分

| 項目 | 設計書 | 実装 | 理由 |
|------|--------|------|------|
| `participation_stats` API | `GET /participation-stats` (単独ルート) | `GET /rank/participation-stats` | 既存の `/rank` ルーターに追加する方がシンプル |
| `type = 'earned'` | 設計書では `earned_accepted` | `earned_accepted` に統一 | Phase 5 の既存コードが `'earned'` を使っていたため修正 |
| rank 閾値 | 設計書: Silver=6000, Platinum=26000 | 修正済み | Phase 5 の `rank.ts` に誤った閾値（5000/15000）があったため修正 |

---

## 既知の制限・懸念

1. ~~**`test-app.ts` は本番DBを使用**: 統合テストが `data/noodla.db` に接続しており、マイグレーション状態に依存する。`participation-stats` テストで `job_events` テーブルが存在しないエラーが発生したため、graceful fallback を実装（`try-catch` で0を返す）。~~ **✅ 解消済み（Phase 6 後片付け）**: `server/src/db/index.ts` に `setDb()` / `resetDb()` によるDI差し替え機構を追加。`tests/helpers/test-app.ts` がモジュール評価時に `createTestDb()` でインメモリDB（`:memory:`）を生成し `setDb()` で本番DBと差し替えるよう改修。`rank.ts` の `participation-stats` エンドポイントの `try-catch` graceful fallback も削除し、全マイグレーション適用を前提とした正常系のみに整理した。

2. **クエリ invalidate の遅延注入**: `ws-store.ts` の `setWsQueryInvalidate()` は React コンポーネントマウント時に手動設定が必要。Phase 7 以降で QueryClient の共有を整理することを推奨。

3. **nps uptime の精度**: heartbeat間隔（10秒）単位での加算のため、±10秒の誤差が生じる。Phase 7+ で精度改善が必要な場合は `session_start_at` ベースの計算に移行。

---

## Phase 7 に向けた推奨事項

1. **`ITransport` インターフェース切り出し**: `src/transport/` ディレクトリを作成し、現在の WebSocket クライアントを `WsTransport` として実装することで、WebRTC への移行がスムーズになる。

2. ~~**`test-app.ts` のインメモリDB化**: `createTestDb()` ヘルパーを HTTP 統合テストにも適用し、テスト間の状態汚染を防ぐ。~~ **✅ 対応済み（Phase 6 後片付け）**

3. **ランクダウンロジック**: 現状はランクアップのみ実装。設計書にランクダウンの要件があれば Phase 7 で対応。

4. **push 通知**: `notifications` テーブルへの書き込みは Phase 6 で実装済み。Phase 7+ で `expo-notifications` と連携。
