# Noodla Phase 6 設計書 — 報酬実感の本実装

**作成日**: 2026-04-17
**フェーズ**: Phase 6 — 本番ポイント加算 + ランク自動化 + WS状態の見える化
**前フェーズ**: Phase 5（WebSocket リアルタイム疎通 完了）
**次フェーズ**: Phase 7（WebRTC DataChannel 段階移行）
**ステータス**: 設計中

---

## 1. Phase 6 の一言要約

> **「参加したら本当にポイントが貯まり、ランクが上がる」を成立させる。**

Phase 5 で「2台のスマホでジョブが往復する」骨格ができた。
しかし `experimentalPoints` は**ローカルカウンターのまま**で、DBに残らない。
ランクも更新されない。ユーザーは参加した実感を得られない。

Phase 6 は**技術的な派手さはない**が、Noodlaをプロダクトとして**体験が閉じる最初の瞬間**にする。

---

## 2. Phase 6 の結論サマリ

| 項目 | 結論 |
|------|------|
| **スコープ** | ポイント本運用 + ランク自動化 + WS状態の永続化 + UI接続完成 |
| **範囲外** | WebRTC, 実AI推論, バックグラウンド, サポーター課金（全てPhase 7+） |
| **工数見積** | 5〜6日（1人エンジニア換算） |
| **成功条件** | 採用されたジョブで `points_ledger` が増え、ランクスコアが更新され、閾値到達でランクアップする |
| **リスク** | ポイント計算の公平性（不正対策は最小限に留める、本格化はPhase 8+） |

---

## 3. スコープの詳細

### 3.1 実装する範囲

| # | 機能 | 説明 | 優先度 |
|---|------|------|--------|
| A1 | **本番ポイント加算** | `job_events` の accepted 結果を `points_ledger` に記録 | 最優先 |
| A2 | **ポイント計算式** | `maxTokens × 速度係数 × ランク係数` のシンプル式で開始 | 最優先 |
| A3 | **ランクスコア自動更新** | 採用率・応答速度・参加時間から `rank_ledger` を日次更新 | 最優先 |
| A4 | **ランク自動昇降格** | スコア閾値越えで Bronze→Silver→Gold→Platinum | 最優先 |
| A5 | **node_participation_states 連携** | WS接続状態・participating状態を DB にも反映 | 必須 |
| A6 | **参加状況詳細(#10)の実データ化** | 累積参加時間・処理数・採用率を表示 | 必須 |
| A7 | **接続詳細(#11)の実データ化** | WS接続品質・稼働時間を表示 | 必須 |
| A8 | **ランクアップ通知** | 昇格時に `notifications` テーブルに追加 | 推奨 |
| A9 | **ホーム画面のリアル化** | ポイント残高バナー、今日の処理数を実データで | 推奨 |

### 3.2 範囲外（Phase 7+ で扱う）

| 項目 | 理由 |
|------|------|
| WebRTC DataChannel | Phase 7 本命 |
| Expo Prebuild 移行 | WebRTC と同時 |
| STUN/TURN | WebRTC と同時 |
| 実 AI 推論 | 疑似ジョブのまま継続 |
| プッシュ通知 (expo-notifications) | Phase 7+（端末側のPrebuild移行と同時が合理的） |
| AIツール画面(#7,#12-15)のAPI接続 | AI側が未実装のため |
| サポータープラン(#16)の課金 | Phase 8+ |
| バックグラウンド常時接続 | iOS制約のため Phase 8+ |
| ジョブ結果の厳密な検証 | Phase 7+ |

---

## 4. ポイント計算式

### 4.1 設計原則

1. **シンプルで説明可能** — ユーザーが「なぜ N ポイント貯まったか」が分かる
2. **速度と量が評価される** — 早くたくさん処理するほど得する
3. **ランクが上がるほど有利** — 長く続けるモチベーションを作る
4. **Phase 6 はベースラインを作るだけ** — 後からチューニング可能な式に

### 4.2 計算式（Phase 6 版）

```
獲得ポイント = BASE × SPEED_MULTIPLIER × RANK_MULTIPLIER × JOB_TYPE_WEIGHT
```

| 項目 | 値 | 説明 |
|------|-----|------|
| **BASE** | `maxTokens` | ジョブの `payload.maxTokens`（1〜5トークン） |
| **SPEED_MULTIPLIER** | 応答速度による係数 | 50ms以下 = 1.5、100ms以下 = 1.2、300ms以下 = 1.0、それ以上 = 0.8 |
| **RANK_MULTIPLIER** | ランク係数 | Bronze 1.0 / Silver 1.2 / Gold 1.5 / Platinum 2.0 |
| **JOB_TYPE_WEIGHT** | ジョブ種別の重み | `mock_token_generate` = 1.0 / `ping_job` = 0.3 |

**結果は切り上げ、最小1ポイント保証。**

### 4.3 計算例

| 条件 | 計算 | 結果 |
|------|------|------|
| Bronze, maxTokens=3, 80ms, mock_token_generate | 3 × 1.2 × 1.0 × 1.0 = 3.6 | **4pt** |
| Silver, maxTokens=5, 60ms, mock_token_generate | 5 × 1.2 × 1.2 × 1.0 = 7.2 | **8pt** |
| Gold, maxTokens=1, 400ms, ping_job | 1 × 0.8 × 1.5 × 0.3 = 0.36 | **1pt** (最小保証) |
| Platinum, maxTokens=5, 45ms, mock_token_generate | 5 × 1.5 × 2.0 × 1.0 = 15 | **15pt** |

### 4.4 加算タイミング

**`job_judge.ts` が `accepted` を確定した直後**に同一トランザクションで:
1. `job_events` テーブルに `result_status='accepted'` で記録（既存）
2. `points_ledger` に `type='earned_accepted'` でエントリ追加 **← 新規**
3. `rank_ledger` の累積統計を更新（採用数・応答時間・参加時間） **← 新規**

---

## 5. ランクスコア自動更新

### 5.1 既存の `rank_ledger` スキーマ活用

Phase 3 時点で以下が定義済み（Phase 6 で実データ投入開始）:
- `score` (integer): 累積ランクスコア
- `next_rank_score` (integer): 次ランクまでのしきい値
- `avg_processing_speed` (real): 平均応答ms
- `connection_stability` (real): 接続安定性 0-100
- `avg_participation_hours` (real): 平均日次参加時間
- `task_adoption_rate` (real): ジョブ採用率 0-1
- `wifi_quality_score` (real): WiFi品質 0-100
- `consecutive_days` (integer): 連続参加日数
- `total_days_active` (integer): 通算参加日数

### 5.2 スコア計算ロジック

**スコアは累積加算型**（毎回のジョブ採用で増える）。

```
1ジョブ採用あたりのスコア増分 = POINTS × RANK_WEIGHT_FOR_SCORE
```

| ランク | RANK_WEIGHT_FOR_SCORE | 理由 |
|--------|----------------------|------|
| Bronze | 1.0 | 基準 |
| Silver | 0.9 | 上位ランクは昇格ハードル上げる |
| Gold | 0.75 | |
| Platinum | 0.5 | 最上位は届きにくくする |

### 5.3 ランク閾値

| ランク | 必要スコア | 次ランクまで |
|--------|-----------|-------------|
| Bronze | 0 | 1,000 |
| Silver | 1,000 | 5,000 (→ 合計 6,000) |
| Gold | 6,000 | 20,000 (→ 合計 26,000) |
| Platinum | 26,000 | — |

### 5.4 副統計の更新

毎ジョブ結果時の増分更新（計算コスト最小化のため移動平均）:
```typescript
// task_adoption_rate: 直近50件の採用率
// avg_processing_speed: 指数移動平均 α=0.1
new_avg = old_avg * 0.9 + response_ms * 0.1
```

日次バッチ（または初回接続時にlazy）:
- `total_days_active`: 最終加算日と今日が異なれば+1
- `consecutive_days`: 前日も記録があれば+1、なければ1にリセット
- `avg_participation_hours`: 直近7日の合計/7

### 5.5 ランクアップ判定

`points_ledger` 加算時に `rank_ledger.score` と閾値を比較し、超えていたら:
1. `users.rank` と `rank_ledger.rank` を更新
2. `rank_changed_at` を now
3. `notifications` に昇格通知を追加

---

## 6. node_participation_states 連携

### 6.1 現状の課題

Phase 5 で WebSocket の `connectionState` と `participationStatus` はフロントのZustandストアに保持されるが、**サーバー側の `node_participation_states` テーブルに反映されていない**。そのため:
- 他デバイスから見える参加状態が過去の値
- 参加状況詳細画面（#10）で累積データが取れない

### 6.2 Phase 6 での改修

WebSocket ハンドラー内で以下を実行:

| WSイベント | DB更新 |
|-----------|-------|
| `hello` 認証成功 | `status='waiting'`, `session_start_at=now` |
| `join_network` 受信 | `status='participating'`, `today_uptime_minutes` 計測開始 |
| `leave_network` 受信 | `status='waiting'`, 経過時間を `total_uptime_minutes` に加算 |
| `job_assign` 送信 | `current_job_id=jobId` |
| `job_result` 受信 | `current_job_id=null` |
| WS切断 | `status='offline'`, 経過時間を total/today に加算 |

### 6.3 計測のタイミング

秒単位の完全な精度は不要。以下で十分:
- **1分ごとに `today_uptime_minutes` を+1**（ハートビートタイマー内）
- 切断時に経過分を `total_uptime_minutes` に加算
- 日付変わりで `today_uptime_minutes` を0リセット（SQL: `updated_at < date('now', 'start of day')` なら0にする）

---

## 7. UI改修

### 7.1 参加状況詳細 (#10) — `app/participation.tsx`

**現状**: Phase 5 で WS接続状態 + ジョブ処理リストは実装済み

**Phase 6 追加**:
- 累積参加時間（`rank_ledger.avg_participation_hours`, `total_uptime_minutes`）
- 通算処理数（`job_events` から user_id で COUNT）
- 採用率（`task_adoption_rate`）
- 連続参加日数（`consecutive_days`）

```
┌─────────────────────────────┐
│ 参加状況詳細                 │
├─────────────────────────────┤
│ 【今日】                     │
│  稼働時間: 2時間15分         │
│  処理数: 42件 (採用 38件)   │
│  獲得ポイント: 156 pt       │
├─────────────────────────────┤
│ 【通算】                     │
│  総稼働時間: 48時間          │
│  通算処理数: 1,024件         │
│  採用率: 91.2%              │
│  連続参加: 7日目             │
└─────────────────────────────┘
```

### 7.2 接続詳細 (#11) — `app/connection.tsx`

**現状**: Phase 5 で WS接続状態・再接続回数は実装済み

**Phase 6 追加**:
- 接続安定性スコア（`rank_ledger.connection_stability`）
- 直近24時間の接続時間率
- WiFi品質評価（`wifi_quality_score`）

### 7.3 ホーム (#5) — `app/(tabs)/home.tsx`

**現状**: WS接続状態バッジ、ノード数、ジョブ統計は実装済み

**Phase 6 追加**:
- 今日獲得ポイント（実データ）
- 現在のランク + 次ランクまでのプログレスバー
- 最近のポイント履歴（直近5件）

### 7.4 ポイント画面 (#6) — `app/(tabs)/points.tsx`

**現状**: Phase 3 で API接続済み、`points_ledger` は空

**Phase 6 改修**:
- Phase 6 のポイント加算が反映された残高・履歴が自動的に表示される
- UI側の変更は **不要**（既に実装されているため）

### 7.5 ランク画面 (#8) — `app/(tabs)/rank.tsx`

**現状**: Phase 3 で API接続済み、`rank_ledger` は初期値のまま

**Phase 6 改修**:
- 実データに基づいた進捗表示
- UI側の変更は**軽微**（score更新の反映確認のみ）

---

## 8. ポイント不正対策（最小版）

Phase 6 での**最小限の安全弁**のみ実装。本格的な対策はPhase 8+。

### 8.1 加算時のガード

| チェック | 対応 |
|---------|------|
| 同一jobIdで2度加算しようとした | 拒否（`job_events.result_status='accepted'` はUNIQUE制約検討） |
| 応答時間が異常に短い（<10ms） | 採用はするがポイント半減 |
| 1ユーザーが1分あたり100件超 | 超過分はポイント加算なし（ログのみ） |
| ランクMultipllierに不正な値 | クランプ（`Math.max(1.0, Math.min(2.0, mult))`） |

### 8.2 UNIQUE制約（推奨）

```sql
CREATE UNIQUE INDEX IF NOT EXISTS idx_points_earned_job
  ON points_ledger (related_job_id, type)
  WHERE type = 'earned_accepted' AND related_job_id IS NOT NULL;
```

これで同一jobIdで2回ポイント加算されるのを DB 層で防げる。

---

## 9. 実装タスク一覧

### 9.1 バックエンド

| # | ファイル | 変更 | 内容 |
|---|---------|------|------|
| B1 | `server/src/services/points-service.ts` | 新規 | ポイント計算式 + 加算処理 |
| B2 | `server/src/services/rank-service.ts` | 新規 | ランクスコア更新 + 昇降格判定 |
| B3 | `server/src/ws/job-judge.ts` | 修正 | accepted時に points/rank サービス呼び出し |
| B4 | `server/src/ws/handler.ts` | 修正 | hello/join/leave 時に nps 更新 |
| B5 | `server/src/ws/peer-manager.ts` | 修正 | heartbeat時に today_uptime 加算 |
| B6 | `server/drizzle/0002_add_points_unique.sql` | 新規 | UNIQUE制約追加 |
| B7 | `server/src/routes/points.ts` | 修正 | 残高・履歴取得（既存APIを点検） |
| B8 | `server/src/routes/rank.ts` | 修正 | ランク情報取得（既存APIを点検） |
| B9 | `server/tests/ws/ws-points.test.ts` | 新規 | accepted → points加算テスト |
| B10 | `server/tests/ws/ws-rank.test.ts` | 新規 | score更新・ランクアップテスト |
| B11 | `server/tests/services/points-service.test.ts` | 新規 | 計算式の単体テスト |
| B12 | `server/tests/services/rank-service.test.ts` | 新規 | ランク判定の単体テスト |

### 9.2 フロントエンド

| # | ファイル | 変更 | 内容 |
|---|---------|------|------|
| F1 | `src/hooks/usePoints.ts` | 確認のみ | 既存のまま動くはず |
| F2 | `src/hooks/useRank.ts` | 確認のみ | 既存のまま動くはず |
| F3 | `src/hooks/useParticipationStats.ts` | 新規 | 参加統計取得hook |
| F4 | `src/services/ws-client.ts` | 修正 | job_accepted 時にポイントクエリをinvalidate |
| F5 | `src/stores/ws-store.ts` | 修正 | experimentalPoints 廃止、実ポイントは TanStack Query で |
| F6 | `app/participation.tsx` | 修正 | 累積統計UI追加 |
| F7 | `app/connection.tsx` | 修正 | 接続品質UI追加 |
| F8 | `app/(tabs)/home.tsx` | 修正 | ポイント残高・ランクプログレス追加 |

### 9.3 ドキュメント

| # | ファイル | 変更 |
|---|---------|------|
| D1 | `docs/PHASE6-REPORT.md` | 新規（実装後） |
| D2 | `docs/PHASE6-TESTING.md` | 新規（実装後） |
| D3 | `README.md` | ステータス更新 |

---

## 10. 成功条件

### 10.1 機能面

- [ ] 2台のスマホで接続・参加し、ジョブを往復させるとポイントが貯まる
- [ ] `points_ledger` に `earned_accepted` エントリが記録される
- [ ] ポイント画面で残高・履歴が正しく表示される
- [ ] `rank_ledger.score` が累積で増加する
- [ ] 累積スコアが1,000を超えると Bronze → Silver に昇格する
- [ ] 昇格時に通知が作成される
- [ ] 参加状況詳細画面で今日・通算の統計が表示される
- [ ] 接続が切れた時 `node_participation_states.status='offline'` になる

### 10.2 非機能

- [ ] 既存 52 件のテストが全てパス
- [ ] Phase 6 で追加したテストが全てパス
- [ ] ポイント加算の重複が発生しない（UNIQUE制約確認）
- [ ] 同時ジョブ10件投入でもポイント計算が正しい

### 10.3 体感

- [ ] 「参加したら本当にポイントが貯まる」が実感できる
- [ ] ランクが上がると次の目標が明示される
- [ ] 参加状況詳細を見るのが楽しくなる

---

## 11. リスク・懸念点

| リスク | 影響 | 対策 |
|--------|------|------|
| ポイント計算式のバランス | ユーザーが不公平を感じる | Phase 6 はベースライン。係数は定数ファイルで外出しし、後から調整可能に |
| 不正アクセスでポイント水増し | 経済崩壊 | 本番前にUNIQUE制約 + レート制限を実装。完全な対策はPhase 8+ |
| 既存のフロント画面が壊れる | Phase 5 の実装を後退させる | TanStack Query の invalidation で自動同期。UIロジックは変えない |
| SQLiteの書き込み頻度 | 100台規模でボトルネック化 | Phase 6 は小規模前提。スケールはPhase 8+ |
| ランクアップ通知の実装場所 | 複雑化 | サービス層（rank-service）で判定、notifications テーブルに直接insertで完結 |

---

## 12. ロードマップ再確認

```
Phase 5: WebSocket中継で最小疎通          ← 完了
  ↓
Phase 6: 報酬実感の本実装                 ← 今ここ
  ├─ ポイント本運用
  ├─ ランク自動化
  ├─ 参加状況見える化
  └─ 5〜6日
  ↓
Phase 7: WebRTC DataChannel + Prebuild移行
  ├─ react-native-webrtc 導入
  ├─ STUN/TURN セットアップ
  ├─ ITransport 抽象化実装
  └─ 7〜10日
  ↓
Phase 8: 準親ノード + 実AI推論の最小版
Phase 9: スケーリング + バックグラウンド + 課金
```

---

## 13. Phase 7 の事前仕込み

Phase 6 中に Phase 7 で楽になるよう**下記を意識**:

1. **ジョブプロトコルをトランスポートから独立させる**
   - `ws-client.ts` のメッセージ処理ロジックを、将来 WebRTC に差し替えられる構造に
   - 具体的には `ITransport` インターフェースを Phase 6 で先に切っておく

2. **ポイント加算ロジックはトランスポート非依存**
   - WebRTC になってもジョブ結果がサーバーに届けば同じ処理

3. **`job_events` のスキーマは不変**
   - Phase 7 で流す場所が変わっても、記録形式は同じ

---

## 14. 実装順序（推奨）

```
Day 1-2: バックエンド基盤
  ├─ points-service.ts (B1) + 単体テスト (B11)
  ├─ rank-service.ts (B2) + 単体テスト (B12)
  └─ UNIQUE制約マイグレーション (B6)

Day 3: WebSocket統合
  ├─ job-judge.ts にサービス呼び出し追加 (B3)
  ├─ ws-points.test.ts (B9)
  └─ ws-rank.test.ts (B10)

Day 4: 参加状態の永続化
  ├─ handler.ts (B4) + peer-manager.ts (B5)
  ├─ 既存の participation/nps API確認 (B7, B8)
  └─ useParticipationStats hook (F3)

Day 5: フロント統合
  ├─ ws-store.ts experimentalPoints 削除 (F5)
  ├─ ws-client.ts invalidation 追加 (F4)
  ├─ home.tsx (F8)
  └─ participation.tsx (F6), connection.tsx (F7)

Day 6: 統合テスト + ドキュメント
  ├─ 実機2台で疎通確認
  ├─ PHASE6-REPORT.md + PHASE6-TESTING.md
  └─ README更新
```

---

## 15. 次の一手

設計確定後の着手手順:
1. 設計書レビュー（高橋さんの確認）
2. Claude Code サブエージェントに Day 1-2（バックエンド基盤）を投げる
3. 完了確認後、Day 3 以降を継続

**このドキュメントを元に実装を開始します。**
