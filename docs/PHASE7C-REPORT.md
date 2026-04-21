# Phase 7-C 実装レポート — ランクダウンロジック

**実装日**: 2026-04-21
**ステータス**: ✅ 完了
**成功条件**: 非活動が続くとスコアデケイ → ランクダウン → Push 通知が飛ぶ

---

## 実装したランクダウン条件

### 設計判断（仮定の明示）

Phase 6 のランクシステムはスコア累積型であり、スコアが自然に下がるメカニズムは未実装だった。
Phase 7-C では「**非活動によるスコアデケイ（decay）**」をランクダウン条件として採用した。

#### 選定理由

| 候補 | 評価 |
|------|------|
| ポイントが下位ランクの閾値を下回った時 | スコアが累積型なので通常は自然に下がらない。deducted 型ポイントが未実装のためそのままでは機能しない |
| 一定期間アクティビティがない（非活動デケイ） | Phase 6 の `rank_ledger.updated_at` が自然なタイムスタンプとして使える。シンプルで説明可能 ✅ 採用 |
| 違反・不正行為 | スコープ外（Phase 8+） |

#### デケイ仕様

```
条件: rank_ledger.updated_at から 7日間 スコアが更新されていない
適用: score = floor(score × 0.9)  (10% 減)
頻度: 1日1回まで（updated_at が当日付けなら再適用しない）
最低: Bronze からはランクダウンしない（最低ランク保証）
```

#### ランクダウン閾値

| 現在ランク | ダウン後ランク | 条件 |
|-----------|-------------|------|
| Silver    | Bronze      | デケイ後スコア < 1,000 |
| Gold      | Silver      | デケイ後スコア < 6,000 |
| Platinum  | Gold        | デケイ後スコア < 26,000 |
| Bronze    | （変化なし） | ランクダウンなし |

#### チェックタイミング

1. **`GET /rank`** — ランク情報取得時（フロントから毎回チェック）
2. **WebSocket `hello`** — 接続認証完了時（セッション開始ごとに1回）

---

## 変更ファイル一覧

### 変更

| ファイル | 変更内容 |
|---------|---------|
| `server/src/services/rank-service.ts` | ランクダウン定数・通知・`checkAndApplyRankDecay()` 関数追加 |
| `server/src/routes/rank.ts` | `GET /rank` に `checkAndApplyRankDecay()` 呼び出し追加 |
| `server/src/ws/handler.ts` | `hello` 認証時にランクダウンチェック + WS push 通知ヘルパー追加 |

### 新規作成

| ファイル | 内容 |
|---------|------|
| `server/tests/rank-service-decay.test.ts` | ランクダウン（デケイ）の単体テスト 11件 |
| `docs/PHASE7C-REPORT.md` | 本ファイル |

---

## 実装の詳細

### `server/src/services/rank-service.ts`

#### 追加した定数

```typescript
export const DECAY_INACTIVE_DAYS = 7;  // 非活動閾値（日）
export const DECAY_RATE = 0.9;          // デケイ率（10%減）
```

#### `checkAndApplyRankDecay(userId: string): Promise<CheckRankDecayResult>`

```typescript
export interface CheckRankDecayResult {
  decayApplied: boolean;   // デケイを実際に適用したか
  decayAmount: number;     // 減少したスコア量
  newScore: number;        // デケイ後のスコア
  oldRank: string;         // デケイ前のランク
  newRank: string;         // デケイ後のランク
  rankChanged: boolean;    // ランクが変わったか
}
```

処理フロー:
1. `rank_ledger` を取得（なければ `decayApplied: false` を返す）
2. `updated_at` が今日付けなら1日1回制限で早期リターン
3. `updated_at` から経過日数を計算し `DECAY_INACTIVE_DAYS` 未満なら早期リターン
4. `score = floor(score * DECAY_RATE)` を適用
5. `getRankFromScore(newScore)` でランクを再計算
6. ランクが下がった場合: `users.rank` + `rank_ledger` を更新し `rank_down` 通知を DB に追加
7. ランクが下がらない場合: `rank_ledger` のスコアのみ更新

### `server/src/routes/rank.ts`

```typescript
// GET /rank
rank.get('/', async (c) => {
  const userId = c.get('userId') as string;

  // Phase 7-C: ランクダウンデケイチェック
  await checkAndApplyRankDecay(userId);

  // 通常のランク情報取得処理...
});
```

### `server/src/ws/handler.ts`

`handleHello()` の末尾で非同期でデケイチェックを実行:

```typescript
checkAndApplyRankDecay(payload.sub).then(async (decayResult) => {
  if (decayResult.rankChanged) {
    await sendRankDownNotificationWs(payload.sub, decayResult.newRank);
  }
}).catch(err => {
  console.error('[WsHandler] Error in checkAndApplyRankDecay:', err);
});
```

WS push 通知メッセージ（`notification_push` type = `rank_down`）:
- Phase 7-B で実装済みの `peerManager.sendNotificationToUser()` を再利用
- クライアントの `useInAppNotification` フックが自動的にトースト表示する

---

## テスト結果

| テストファイル | 件数 | 内容 |
|-------------|------|------|
| `tests/rank-service-decay.test.ts`（新規） | 11 | デケイ関連の単体テスト |
| 既存テスト | 101 | 既存全テスト（リグレッションなし） |
| **合計** | **112** | **全件パス ✅** |

### 新規テストの内容

| テスト名 | 検証内容 |
|---------|---------|
| DECAY_INACTIVE_DAYS は 7 | 定数値確認 |
| DECAY_RATE は 0.9 | 定数値確認 |
| rank_ledger が存在しない場合はデケイ不適用 | エッジケース |
| 3日間非活動ならデケイ不適用 | 閾値未満 |
| 今日更新済みならデケイ不適用（1日1回制限） | 重複防止 |
| 10日非活動: スコア 5000 → 4500, Silver 維持 | デケイあり・ダウンなし |
| 8日非活動: スコア 1050 → 945, Silver→Bronze | ランクダウン |
| 14日非活動: Platinum→Gold | Platinum ランクダウン |
| 30日非活動でも Bronze は Bronze のまま | 最低ランク保証 |
| ちょうど DECAY_INACTIVE_DAYS 日前ならデケイ適用 | 境界値テスト |
| 9日非活動: Gold スコア 6200→5580, Gold→Silver | Gold ランクダウン |

---

## 既知の制約・TODO（Phase 8 以降に回すもの）

| 項目 | 内容 | 推奨フェーズ |
|------|------|------------|
| 段階的デケイ | 現在は7日ごとに毎日10%減。7日以上の非活動でも1日1回しか適用されないため、長期非活動者は毎日アクセスするとデケイが毎日適用される（意図した動作だが、今後レート調整可） | Phase 8 |
| Expo Push API との連携 | WS push はフォアグラウンド時のみ到達。バックグラウンド端末への通知は未実装 | Phase 8 |
| 非活動日数の設定変更 | `DECAY_INACTIVE_DAYS` と `DECAY_RATE` は定数。将来的に環境変数化を推奨 | Phase 8 |
| 手動ランクリセット API | 管理者がランクを手動調整する API（不正対策や特例処置）は未実装 | Phase 8+ |
| `GET /rank/leaderboard` でのデケイ反映 | リーダーボード取得時はデケイチェックしないため表示が古くなることがある | Phase 8 |

---

## ランクダウン通知フロー

```
[接続/ランク取得]
  ↓
checkAndApplyRankDecay(userId)
  ├─ 非活動 < 7日 → スキップ
  ├─ 今日更新済み → スキップ
  └─ 非活動 >= 7日 & 未処理
       ↓
       score = floor(score × 0.9)
       ↓
       getRankFromScore(newScore) → 新ランク判定
       ↓
       ランクダウン?
       ├─ YES → users.rank 更新
       │         rank_ledger 更新
       │         notifications に rank_down INSERT
       │         peerManager.sendNotificationToUser() (WS push)
       │           └─ クライアント: useInAppNotification → Toast 表示
       └─ NO  → rank_ledger スコアのみ更新
```
