# Phase 6 テスト手順書 — 報酬実感の本実装

**作成日**: 2026-04-17
**対象**: Phase 6 ポイント本運用 + ランク自動化 + WS状態見える化

---

## 自動テスト

```bash
cd server
npm test
# 期待結果: 101 passed (13 test files)
```

### テストファイル一覧

| ファイル | 件数 | 内容 |
|----------|------|------|
| `tests/auth.test.ts` | 11 | 認証API |
| `tests/devices.test.ts` | 5 | デバイス登録API |
| `tests/notifications.test.ts` | 4 | 通知API |
| `tests/points.test.ts` | 5 | ポイントAPI |
| `tests/rank.test.ts` | 5 | ランクAPI（`participation-stats` 含む） |
| `tests/points-service.test.ts` | 20 | ポイント計算式単体テスト |
| `tests/rank-service.test.ts` | 21 | ランクスコア計算単体テスト |
| `tests/ws/ws-peer-manager.test.ts` | 8 | PeerManager ユニットテスト |
| `tests/ws/ws-job-judge.test.ts` | 5 | JobJudge ユニットテスト |
| `tests/ws/ws-job-scheduler.test.ts` | 4 | JobScheduler ユニットテスト |
| `tests/ws/ws-connection.test.ts` | 7 | WS接続統合テスト |
| `tests/ws/ws-points.test.ts` | 3 | WS経由ポイント加算テスト |
| `tests/ws/ws-rank.test.ts` | 3 | WS経由ランク更新テスト |

---

## 手動テスト手順

### 前提条件

1. サーバー起動済み
2. マイグレーション実行済み（`npm run migrate`）
3. テストユーザー登録済み

### Step 1: マイグレーション確認

```bash
cd server
npm run migrate
```

`0002_add_points_unique.sql` が実行されていることを確認:

```bash
sqlite3 data/noodla.db ".indexes points_ledger"
# 期待: idx_points_earned_job が表示される
```

### Step 2: サーバー起動

```bash
cd server
npm run dev
# ポート 3001 で起動
```

### Step 3: WS クライアント2台接続シナリオ

#### 3-1. ユーザー登録 & トークン取得

```bash
# User A
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user-a@test.com","password":"password123","name":"User A"}'

# User B
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user-b@test.com","password":"password123","name":"User B"}'
```

#### 3-2. wscat で接続

```bash
# ターミナル1 (User A)
npx wscat -c ws://localhost:3001/ws/v1/node

# ターミナル2 (User B)
npx wscat -c ws://localhost:3001/ws/v1/node
```

#### 3-3. hello メッセージ送信

```json
// ターミナル1 & 2 それぞれで送信
{"type":"hello","ts":1234567890,"msgId":"msg-1","installationId":"device-a","accessToken":"<ACCESS_TOKEN>","deviceInfo":{"os":"ios","appVersion":"1.0.0"}}
```

#### 3-4. ネットワーク参加

```json
{"type":"join_network","ts":1234567890,"msgId":"msg-2","installationId":"device-a"}
{"type":"join_network","ts":1234567890,"msgId":"msg-3","installationId":"device-b"}
```

#### 3-5. ジョブ受信待機

5秒以内に `job_assign` メッセージが届くことを確認。

#### 3-6. ジョブ結果送信（User A を先に）

```json
{"type":"job_result","ts":1234567890,"msgId":"msg-4","jobId":"<JOB_ID>","result":{"tokens":["hello"],"tokenCount":1},"processingMs":80,"status":"completed","deviceLoad":{"cpuUsage":0.1,"memoryUsage":0.2,"batteryLevel":0.9}}
```

### Step 4: DB 確認

```bash
sqlite3 data/noodla.db

-- points_ledger に追加されていること
SELECT * FROM points_ledger WHERE type = 'earned_accepted' ORDER BY created_at DESC LIMIT 5;

-- rank_ledger のスコアが増加していること
SELECT user_id, rank, score FROM rank_ledger;
```

### Step 5: API 確認

```bash
# ポイント残高確認
curl http://localhost:3001/api/v1/points/balance \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# ランク確認
curl http://localhost:3001/api/v1/rank \
  -H "Authorization: Bearer <ACCESS_TOKEN>"

# 参加統計確認
curl http://localhost:3001/api/v1/rank/participation-stats \
  -H "Authorization: Bearer <ACCESS_TOKEN>"
```

---

## ランクアップテスト

ポイントを大量に付与してランクアップを確認:

```bash
sqlite3 data/noodla.db

-- rank_ledger のスコアを Silver 閾値直前まで設定
UPDATE rank_ledger SET score = 990 WHERE user_id = '<USER_ID>';
```

その後、ジョブを完了させてスコアが 1000 を超えた時に:
1. `rank_ledger.rank` が `Silver` に更新される
2. `users.rank` が `Silver` に更新される
3. `notifications` に `rank_up` タイプの通知が追加される

```bash
sqlite3 data/noodla.db
SELECT * FROM notifications WHERE type = 'rank_up' ORDER BY created_at DESC LIMIT 1;
```

---

## UNIQUE 制約テスト

同一 jobId に対して2回ポイント加算を試みる:

```bash
sqlite3 data/noodla.db

-- 同一 job_id で2度 insert を試みる（エラーになることを確認）
INSERT INTO points_ledger VALUES ('id1','<USER_ID>','earned_accepted',5,5,'test','<JOB_ID>',NULL,datetime('now'));
INSERT INTO points_ledger VALUES ('id2','<USER_ID>','earned_accepted',5,10,'test','<JOB_ID>',NULL,datetime('now'));
-- 2回目は UNIQUE constraint failed エラーになる
```

---

## 成功条件チェックリスト

- [ ] `npm test` で101件全パス
- [ ] WS2台接続 → ジョブ往復 → `points_ledger` に `earned_accepted` エントリ追加
- [ ] `rank_ledger.score` が累積増加（ジョブごとに加算）
- [ ] スコア閾値（1000/6000/26000）超えでランクアップ
- [ ] ランクアップ時に `notifications` に通知追加
- [ ] 同一 jobId での二重加算が UNIQUE 制約で防止される
- [ ] `GET /rank/participation-stats` が 200 を返す
- [ ] フロントエンドの参加統計UIに累積uptime/ジョブ数が表示される
