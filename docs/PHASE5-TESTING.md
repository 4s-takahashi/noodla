# Phase 5 テスト手順書

## WebSocket 中央中継型 最小リアルタイム疎通 — 動作確認手順

---

## 1. ローカル開発サーバーの起動

### 前提条件

- Node.js 18+ がインストール済みであること
- `server/data/` ディレクトリが存在すること（自動作成される）

### データベースのマイグレーション

```bash
cd server
npm run migrate
```

### 開発サーバーの起動

```bash
cd server
npm run dev
```

起動すると以下のように表示される:

```
🚀 Noodla API server running on http://localhost:3001
   Health: http://localhost:3001/health
   API:    http://localhost:3001/api/v1
   WS:     ws://localhost:3001/ws/v1/node
```

### ヘルスチェック確認

```bash
curl http://localhost:3001/health
# → {"status":"ok","version":"1.0.0","timestamp":"..."}
```

---

## 2. wscat を使った手動 WebSocket テスト

### wscat のインストール

```bash
npm install -g wscat
```

### 接続テスト

```bash
wscat -c ws://localhost:3001/ws/v1/node
```

接続直後に認証タイムアウトが始まる (10秒)。

### 認証 (hello メッセージ)

まずアクセストークンを取得する:

```bash
# ユーザー登録
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123","name":"テスト"}'
```

レスポンスから `access_token` を取得し、wscat で送信:

```json
{"type":"hello","ts":1234567890,"msgId":"00000000-0000-0000-0000-000000000001","installationId":"test-install-1","accessToken":"<YOUR_ACCESS_TOKEN>","deviceInfo":{"os":"ios","appVersion":"1.0.0"}}
```

認証成功すると以下が返る:

```json
{"type":"connected","ts":...,"msgId":"...","userId":"...","installationId":"test-install-1"}
```

### ネットワーク参加

```json
{"type":"join_network","ts":1234567890,"msgId":"00000000-0000-0000-0000-000000000002","installationId":"test-install-1"}
```

サーバーからネットワークステータスが broadcast される:

```json
{"type":"network_status","ts":...,"totalOnline":1,"totalParticipating":1,"peers":[...]}
```

### Ping / Pong テスト

```json
{"type":"ping","ts":1234567890,"msgId":"00000000-0000-0000-0000-000000000003"}
```

応答:

```json
{"type":"pong","ts":...,"msgId":"..."}
```

---

## 3. 2台のスマホ (またはエミュレータ) での接続テスト

### 準備

1. ローカル開発サーバーを起動 (`cd server && npm run dev`)
2. Expo アプリを起動 (`npx expo start`)
3. iPhone / Android で Expo Go からアプリを開く

### 手順

1. **端末A でログイン**: メールアドレスとパスワードでログイン
2. **端末B でログイン**: 別のアカウントでログイン (または同一アカウントの別インストールID)
3. **participation 画面に移動**: 両端末で「参加状況」画面を開く
4. **「参加する」ボタンを押す**: 両端末で「参加する」をタップ

WebSocket が接続されると:
- 接続状態バッジが「🟢 接続中」に変わる
- ネットワーク状況に「オンライン: 2台 ／ 参加中: 2台」と表示される

### 疑似ジョブの確認

- 約5秒後にジョブが自動配布される
- 参加中インジケーターが「ジョブ処理中...」に変わる
- 50〜200ms の処理後、結果が送信される
- どちらかの端末に「✅ 採用」、もう一方に「❌ 遅延」と表示される

### ホーム画面での確認

- 接続状態バッジ (🟢/🟡/🔴) が表示される
- 「最近のジョブ処理: N件（採用: M件）」が表示される

---

## 4. wscat を使った2端末シミュレーション

別々のターミナルで接続テストを実施:

### 端末1 (ターミナル1)

```bash
wscat -c ws://localhost:3001/ws/v1/node
```

```json
{"type":"hello","ts":1234567890,"msgId":"msg-001","installationId":"install-phone1","accessToken":"<TOKEN_1>","deviceInfo":{"os":"ios","appVersion":"1.0.0"}}
{"type":"join_network","ts":1234567890,"msgId":"msg-002","installationId":"install-phone1"}
```

### 端末2 (ターミナル2)

```bash
wscat -c ws://localhost:3001/ws/v1/node
```

```json
{"type":"hello","ts":1234567890,"msgId":"msg-003","installationId":"install-phone2","accessToken":"<TOKEN_2>","deviceInfo":{"os":"android","appVersion":"1.0.0"}}
{"type":"join_network","ts":1234567890,"msgId":"msg-004","installationId":"install-phone2"}
```

約5秒後、両端末に `job_assign` が届く:

```json
{"type":"job_assign","ts":...,"msgId":"...","jobId":"xxx","jobType":"pseudo_token_gen","payload":{"prompt":"apple banana cherry","maxTokens":3,"seed":12345},"timeoutMs":5000,"duplicateCount":2}
```

### ジョブ結果を返す (端末1が先に返す例)

```json
{"type":"job_result","ts":1234567890,"msgId":"result-001","jobId":"xxx","result":{"tokens":["apple","banana","cherry"],"tokenCount":3},"processingMs":85,"status":"completed","deviceLoad":{"cpuUsage":0.2,"memoryUsage":0.4,"batteryLevel":0.8}}
```

端末1は `job_accepted` を受信:

```json
{"type":"job_accepted","ts":...,"jobId":"xxx","experimentalPoints":1}
```

端末2が後から結果を返すと `job_rejected (late)` を受信:

```json
{"type":"job_rejected","ts":...,"jobId":"xxx","reason":"late"}
```

---

## 5. job_events テーブルの確認

```bash
cd server
# SQLite を直接確認
sqlite3 data/noodla.db "SELECT * FROM job_events ORDER BY created_at DESC LIMIT 10;"
```

または Drizzle Studio を使用:

```bash
cd server
npx drizzle-kit studio
```

---

## 6. 自動テストの実行

```bash
cd server
npm test
```

期待される結果:
- 全テスト (52件) が pass すること
- 既存の 28 テストが壊れていないこと
- 新規 WebSocket テスト (24件) が追加されること

---

## 7. トラブルシューティング

### 接続が切れてしまう

- heartbeat タイムアウト (30秒) に注意
- ping を定期的に送る必要がある

### ジョブが配布されない

- 2台以上が `participating` 状態になっているか確認
- `network_status` で `totalParticipating >= 2` を確認

### 認証に失敗する

- アクセストークンの有効期限 (15分) に注意
- 期限切れの場合は再ログインしてトークンを取得する

### WebSocket 接続が拒否される

- サーバーが起動しているか確認: `curl http://localhost:3001/health`
- ポート 3001 が使用中でないか確認: `lsof -i :3001`
