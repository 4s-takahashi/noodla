# Noodla Phase 4 設計書 — 最小分散疎通の技術方針

**作成日**: 2026-04-17
**フェーズ**: Phase 4 — 設計フェーズ（実装は Phase 5 以降）
**ステータス**: 設計完了

---

## 1. Phase 4 の結論要約

| 項目 | 結論 |
|------|------|
| **接続方式** | **案C: WebSocket 中央中継型で Phase 5 開始** → Phase 6 以降で WebRTC DataChannel へ段階移行 |
| **シグナリング** | VPS 上の Hono WebSocket サーバーが中継・マッチング・ジョブ配布を担当 |
| **準親ノード** | **Phase 5 では不要**。VPS が調停役。Phase 7+ で導入検討 |
| **ジョブ最小単位** | JSON 1件（数百バイト）の疑似トークン生成タスク |
| **早着優先** | 2端末に同一ジョブを送り、先着結果を採用。Phase 5 は実験用イベント記録のみ（本ポイント加算・スコア反映は Phase 6+） |
| **iPhone 対応** | WebSocket は Expo Managed で動作。WebRTC は expo-dev-client（Prebuild）が必要 |
| **Phase 5 の成功条件** | 2台のスマホで WebSocket 経由の疑似ジョブ往復が成功すること |

**最小成功ルートの仮説**:
> WebSocket 中継で「2台が繋がってジョブを往復する」を最速で実証し、
> その上で WebRTC DataChannel への移行パスを設計しておく。
> 最初から P2P にこだわるよりも、まず「分散疎通の体験」を成立させることが重要。

---

## 2. 接続方式比較

### 比較対象

| 案 | 方式 | 概要 |
|----|------|------|
| **A** | 完全 P2P（WebRTC DataChannel） | 端末同士が直接接続。VPS はシグナリングのみ |
| **B** | 疑似 P2P（VPS シグナリング + 軽中継） | 基本は WebRTC だが、NAT 越え失敗時に VPS が TURN 代替 |
| **C** | 中央中継型（WebSocket） | 全通信が VPS 経由。端末は VPS に WebSocket 接続 |

### 比較表

| 観点 | A: 完全 P2P | B: 疑似 P2P | C: WebSocket 中継 |
|------|------------|------------|-------------------|
| **iPhone 対応** | △ react-native-webrtc 必要、expo-dev-client 必須 | △ 同上 | ◎ Expo Managed のまま動作 |
| **Expo 互換性** | △ Prebuild 必須（ネイティブモジュール） | △ 同上 | ◎ 標準 WebSocket API |
| **実装難易度** | 高（STUN/TURN/ICE/SDP） | 中〜高 | **低**（WebSocket のみ） |
| **デバッグ容易性** | 低（P2P は再現困難） | 低〜中 | **高**（VPS ログで全通信可視） |
| **NAT 越え** | STUN 必須、TURN fallback 必要 | STUN + VPS fallback | **不要**（VPS 経由） |
| **遅延** | 最小（直接通信） | 中 | やや大（VPS 往復） |
| **VPS 負荷** | 最小（シグナリングのみ） | 中 | **中〜高**（全通信が通過） |
| **Noodla 思想との整合** | ◎ 分散型の理想 | ○ 段階的に理想に近づく | △ 中央依存（ただし最初のステップとして妥当） |
| **Phase 5 成功確率** | 低（環境依存大） | 中 | **高**（確実に動く） |
| **将来の拡張性** | ◎ | ◎ | ○（WebRTC 移行が必要） |

### 判定

| 段階 | 推奨案 | 理由 |
|------|--------|------|
| **Phase 5（最小疎通）** | **案C: WebSocket 中継** | 最速で「2台の疎通」を実証。iPhone でも Expo Managed のまま動く |
| **Phase 6（段階移行）** | **案B: 疑似 P2P** | WebRTC DataChannel を追加。NAT 越え失敗時は WebSocket にフォールバック |
| **Phase 7+（本格 P2P）** | **案A: 完全 P2P** | STUN/TURN 本番運用。VPS はシグナリングのみに縮小 |

---

## 3. 採用案: WebSocket 中継型（Phase 5）

### なぜ C（WebSocket 中継）を選ぶか

1. **iPhone + Expo Managed で確実に動く**
   - `react-native-webrtc` はネイティブモジュール → Expo Go では動かない
   - expo-dev-client（Prebuild）が必要 = 開発フローが重くなる
   - WebSocket は React Native 標準 API、追加モジュール不要

2. **最速で疎通を実証できる**
   - Phase 3 で Hono バックエンドが稼働中。WebSocket 追加は数十行
   - STUN/TURN/ICE の設定不要
   - NAT 越えの問題が発生しない

3. **デバッグが容易**
   - 全通信が VPS を通過 → サーバーログで全メッセージを確認可能
   - P2P のデバッグ（NAT 種別、ICE 候補の到達性）を Phase 5 で避けられる

4. **段階的に P2P へ移行できる**
   - Phase 5 で WebSocket 中継の通信プロトコル（メッセージ形式）を設計すれば、
   - Phase 6 で WebRTC DataChannel に差し替えても、上位のジョブプロトコルはそのまま使える
   - **トランスポート層を抽象化しておくことが鍵**

### リスクと対策

| リスク | 対策 |
|--------|------|
| VPS がボトルネックになる | Phase 5 は 2〜10 台規模。VPS 1 台で十分。100台を超えたら WebRTC 移行 |
| 「P2P じゃない」批判 | マーケティング上は「分散ネットワーク」と表現。技術的には段階的移行を明記 |
| WebSocket のメモリ消費 | Hono の WebSocket は軽量。1接続あたり数KB。1000接続でも数MB |
| 中央集権的に見える | Phase 6 で WebRTC 追加後は VPS はシグナリングのみに。ロードマップで明示 |

---

## 4. 最小接続モデル

### Phase 5 の成功条件

> **2台のスマートフォンが、VPS 経由の WebSocket で接続し、
> 疑似ジョブの送信→処理→結果返却→早着採用の一連のフローが完了すること。**

### 接続確立シーケンス

```
端末A (iPhone)                    VPS (Hono WS)                   端末B (Android)
     │                                │                                │
     │──── WS connect ────────────▶│                                │
     │     { type: "hello",          │                                │
     │       installationId: "aaa",  │                                │
     │       userId: "u1" }          │                                │
     │                                │◀──── WS connect ──────────────│
     │                                │     { type: "hello",          │
     │                                │       installationId: "bbb",  │
     │                                │       userId: "u2" }          │
     │                                │                                │
     │                                │── peer_list ──────────▶       │
     │       ◀── peer_list ──────────│                                │
     │                                │                                │
     │       ◀── job_assign ─────────│  (VPS がジョブを配布)          │
     │                                │── job_assign ──────────▶      │
     │                                │                                │
     │──── job_result ───────────▶│                                │
     │     { jobId, result,          │                                │
     │       processingMs: 120 }     │                                │
     │                                │◀──── job_result ──────────────│
     │                                │     { jobId, result,          │
     │                                │       processingMs: 180 }     │
     │                                │                                │
     │                                │  [早着判定: 端末A が先着]       │
     │                                │                                │
     │       ◀── job_accepted ───────│                                │
     │                                │── job_rejected ────────▶      │
     │                                │                                │
```

### メッセージ型定義

```typescript
// 共通ヘッダ
interface WsMessage {
  type: string;
  ts: number;       // ISO 8601 タイムスタンプ
  msgId: string;    // UUID v4
}

// 端末 → VPS
interface HelloMessage extends WsMessage {
  type: 'hello';
  installationId: string;
  userId: string;
  accessToken: string;  // JWT 認証
  deviceInfo: {
    os: 'ios' | 'android';
    appVersion: string;
  };
}

interface JobResultMessage extends WsMessage {
  type: 'job_result';
  jobId: string;
  result: unknown;       // ジョブの結果（JSON）
  processingMs: number;  // 処理時間（ミリ秒）
  status: 'completed' | 'failed' | 'timeout';
}

interface HeartbeatMessage extends WsMessage {
  type: 'heartbeat';
  installationId: string;
  status: 'participating' | 'waiting' | 'low_power';
}

// VPS → 端末
interface PeerListMessage extends WsMessage {
  type: 'peer_list';
  peers: Array<{
    installationId: string;
    os: 'ios' | 'android';
    joinedAt: string;
  }>;
  totalOnline: number;
}

interface JobAssignMessage extends WsMessage {
  type: 'job_assign';
  jobId: string;
  jobType: 'pseudo_token_gen';
  payload: unknown;       // ジョブのペイロード（JSON）
  timeoutMs: number;      // タイムアウト（ミリ秒）
  duplicateCount: number; // 何台に同じジョブが送られたか
}

interface JobAcceptedMessage extends WsMessage {
  type: 'job_accepted';
  jobId: string;
  // Phase 5: pointsEarned はテスト用カウンター。本ポイント加算は Phase 6+
  pointsEarned: number;
}

interface JobRejectedMessage extends WsMessage {
  type: 'job_rejected';
  jobId: string;
  reason: 'late' | 'error' | 'timeout';
}
```

### 接続ライフサイクル

```
[アプリ起動]
  ↓
[ログイン / セッション復元]
  ↓
[WebSocket 接続] → hello メッセージ送信
  ↓
[VPS が peer_list を配信]
  ↓
[参加状態: "waiting"]
  ↓
[ユーザーが「参加する」を押す]
  ↓
[参加状態: "participating"] → VPS に status 送信
  ↓
[VPS がジョブを配布] → job_assign
  ↓
[端末がジョブ処理] → job_result 送信
  ↓
[VPS が早着判定] → job_accepted / job_rejected
  ↓
[ポイント加算]
  ↓
[次のジョブを待つ or 離脱]
```

### 切断・再接続

| イベント | 対応 |
|---------|------|
| WebSocket 切断 | 自動再接続（exponential backoff: 1s → 2s → 4s → 8s → max 30s） |
| hello 認証失敗 | access token を refresh → 再接続 |
| heartbeat タイムアウト（30秒） | VPS が offline 扱い。ジョブ配布停止 |
| アプリがバックグラウンドに入った | WebSocket を明示的に切断。復帰時に再接続 |
| VPS 再起動 | 全端末が再接続。セッション状態は DB から復元 |

---

## 5. シグナリング設計

### VPS の最小責務

Phase 5 の VPS（Hono サーバー）が担う責務:

| 責務 | 説明 |
|------|------|
| **認証** | WebSocket hello メッセージの JWT 検証 |
| **ピア管理** | 接続中の端末リスト管理。peer_list の配信 |
| **ジョブ配布** | 疑似ジョブの生成 + participating 端末への配布 |
| **早着判定** | 同一ジョブの結果を比較し、先着を採用 |
| **ポイント記録** | 採用結果に基づくポイント加算（Phase 3 の points_ledger に追記） |
| **heartbeat 監視** | 端末の死活監視。タイムアウトで offline 化 |

### VPS に持たせない責務

| 責務 | 理由 |
|------|------|
| 重い計算処理 | VPS は管理用途のみ |
| AI 推論 | 端末が処理する（Phase 5 では疑似処理） |
| 大容量データ中継 | Phase 5 のジョブは数百バイト |
| NAT 越え | WebSocket なので不要 |
| STUN/TURN | Phase 5 では不要 |

### WebSocket エンドポイント

```
wss://{VPS_DOMAIN}/ws/v1/node
```

- Hono の WebSocket アップグレード
- JWT 認証（hello メッセージで送信）
- 1端末1接続（同一 installationId の二重接続は後勝ち）

### ピア発見

Phase 5 では VPS が全オンラインピアを把握しているため、ピア発見は単純:

1. 端末が hello を送信
2. VPS がオンラインピアリストに追加
3. 全接続端末に peer_list を定期配信（10秒ごと or 増減時）
4. 端末側で「ネットワーク全体の参加者数」を表示

### 接続状態の管理

```typescript
// VPS 側のインメモリ状態
interface ConnectedPeer {
  installationId: string;
  userId: string;
  ws: WebSocket;
  status: 'waiting' | 'participating' | 'low_power';
  connectedAt: Date;
  lastHeartbeat: Date;
  os: 'ios' | 'android';
  pendingJobs: Set<string>;  // 処理中のジョブID
}

// Map<installationId, ConnectedPeer>
const peers = new Map<string, ConnectedPeer>();
```

---

## 6. 準親ノードの最小設計

### 結論: Phase 5 では不要

| 観点 | 判断 |
|------|------|
| Phase 5 で入れるべきか | **No** |
| Phase 6 で入れるべきか | **検討** |
| Phase 7+ で入れるべきか | **Yes（WebRTC 移行時に必要）** |

### 理由

1. **Phase 5 は 2〜10 台規模** — VPS 1台で全端末を直接管理できる
2. **WebSocket 中継型では準親ノードの意味がない** — 全通信が VPS 経由なので、中間ノードは不要
3. **準親ノードは WebRTC 移行時に価値が出る** — P2P 接続のシグナリング中継、小グループのジョブ配布を準親が担当

### Phase 7+ での準親ノード最小設計（メモ）

```
VPS（グローバル調停）
  ↓ WebSocket（管理用）
準親ノード（条件の良い端末）
  ↓ WebRTC DataChannel
子ノード（一般端末）
```

**準親ノードの最小責務**（将来）:
- 子ノードへのジョブ配布（VPS から受け取ったジョブを中継）
- 子ノードの結果集約（早着判定を準親で実施、結果を VPS に報告）
- ローカルグループの死活監視
- VPS が落ちても短時間は自律動作

**準親ノードの選出条件**（将来）:
- Wi-Fi 接続が安定（RSSI が一定以上）
- バッテリー残量 50% 以上
- 参加時間の累計が長い（信頼性）
- CPU/メモリに余裕がある

**Phase 5 では VPS が「巨大な準親ノード」の役割を果たす。**

---

## 7. ジョブ設計

### ジョブ最小単位の定義

| 項目 | 値 |
|------|-----|
| **ジョブサイズ** | 数百バイト〜数KB |
| **ジョブ形式** | JSON |
| **処理時間の想定** | 100ms 〜 3s |
| **Phase 5 のジョブ種別** | `pseudo_token_gen`（疑似トークン生成） |

### 疑似ジョブの設計

Phase 5 では実 AI 推論は行わない。代わりに「疑似トークン生成」ジョブを使う:

```typescript
// ジョブペイロード（VPS → 端末）
interface PseudoTokenGenPayload {
  prompt: string;        // 疑似プロンプト（短い文章）
  maxTokens: number;     // 生成すべきトークン数（1〜10）
  seed: number;          // 再現性のためのシード値
}

// ジョブ結果（端末 → VPS）
interface PseudoTokenGenResult {
  tokens: string[];      // 生成された疑似トークン
  processingMs: number;  // 処理時間
  deviceLoad: {          // 端末の負荷情報
    cpuUsage: number;    // 0-100
    memoryUsage: number; // 0-100
    batteryLevel: number; // 0-100
  };
}
```

### 疑似トークン生成の処理

端末側の処理は**意図的に軽量**にする（Phase 5 の目的は疎通確認）:

```typescript
function processPseudoTokenGen(payload: PseudoTokenGenPayload): PseudoTokenGenResult {
  const start = Date.now();

  // 疑似処理: seed ベースのハッシュで「トークン」を生成
  const tokens: string[] = [];
  for (let i = 0; i < payload.maxTokens; i++) {
    const hash = simpleHash(payload.prompt + payload.seed + i);
    tokens.push(VOCAB[hash % VOCAB.length]);  // 語彙テーブルからランダム選択
  }

  // 意図的な遅延（50ms〜200ms）でリアルな処理時間を模倣
  await sleep(50 + Math.random() * 150);

  return {
    tokens,
    processingMs: Date.now() - start,
    deviceLoad: getDeviceLoad(),
  };
}
```

### なぜ「疑似トークン生成」か

1. **AI っぽい将来性** — 本番では LLM のトークン生成チャンクに差し替え可能
2. **再現性がある** — seed ベースなので、同一ジョブを別端末に投げて結果を比較検証できる
3. **軽量** — Phase 5 の目的は疎通確認。重い処理は不要
4. **ポイント計算の基盤** — 「トークン N 個を T ミリ秒で処理」= ポイント計算の入力値になる

### ジョブ配布の流れ

```
[VPS: ジョブ生成タイマー (5秒ごと)]
  ↓
[participating 端末を2台以上選択]
  ↓
[同一ジョブを選択した端末全てに送信]
  ↓
[結果を受信 → 早着判定]
  ↓
[ポイント記録 + accepted/rejected 通知]
```

---

## 8. 早着優先設計

### 概念

> 同じジョブを複数端末に送り、最初に正しい結果を返した端末を「採用」する。
> 採用された端末にポイントを付与する。

### Phase 5 での最小実装

| 項目 | Phase 5 の実装 |
|------|---------------|
| **同時配布数** | 2台（最小） |
| **判定基準** | VPS に先に到着した結果を採用 |
| **結果検証** | seed ベースで正解と比較（不正防止の最小版） |
| **タイムアウト** | **5秒**（5秒以内に結果が来なければタイムアウト） |
| **ポイント付与** | Phase 5 では本ポイント加算なし。UI 上の仮ポイント表示またはテスト用カウンターに留める |
| **スコア反映** | Phase 5 では実験用イベント記録のみ（ランクスコア・本ポイントへの反映は Phase 6+） |

### 早着判定フロー

```
[VPS: job_assign を端末A・端末B に送信]
  ↓
[端末A: 120ms で結果返却]
[端末B: 180ms で結果返却]
  ↓
[VPS: 端末A の結果を先に受信]
  ↓
[結果検証: seed ベースで正解チェック]
  ↓
[検証OK → 端末A を「採用」]
  ↓
[端末A: job_accepted]
[端末B: job_rejected (reason: 'late')]
  ↓
[job_log テーブルにイベント記録（分析用）]
[※ Phase 5 では points_ledger への本ポイント加算は行わない]
```

### タイムアウト処理

```
[5秒以内に結果なし]
  ↓
[当該端末: job_rejected (reason: 'timeout')]
  ↓
[もう1台の結果で判定]
  ↓
[両方タイムアウト → ジョブ破棄]
```

### 不正防止（最小版）

Phase 5 での最小限の不正対策:

1. **seed 検証** — 同一 seed から生成されるべき正解と結果を比較
2. **処理時間の妥当性チェック** — 0ms で結果が返ってきたら不正の可能性（最低処理時間を設定）
3. **結果の一致チェック** — 2台の結果が大きく異なる場合はフラグ

本格的な不正対策は Phase 7+。

### 記録するデータ

```typescript
// job_log テーブル（Phase 5 で追加）
interface JobLog {
  jobId: string;
  jobType: string;
  payload: string;        // JSON
  createdAt: Date;
  
  // 結果
  results: Array<{
    installationId: string;
    userId: string;
    result: string;       // JSON
    processingMs: number;
    receivedAt: Date;
    accepted: boolean;
  }>;
  
  // 判定
  winnerId: string | null;   // 採用された installationId
  winnerProcessingMs: number | null;
  totalParticipants: number;
  timedOut: boolean;
}
```

---

## 9. iPhone / Android 制約整理

### Expo / React Native での技術制約

| 技術 | Expo Managed | Expo Prebuild (Dev Client) | 備考 |
|------|-------------|---------------------------|------|
| **WebSocket** | ✅ 標準対応 | ✅ | React Native 標準 API |
| **WebRTC DataChannel** | ❌ 不可 | ✅（react-native-webrtc） | ネイティブモジュール必須 |
| **バックグラウンド処理** | △ 制限的 | △ 制限的 | iOS は特に厳しい |
| **フォアグラウンド通知** | ✅ | ✅ | expo-notifications |
| **端末情報取得** | ✅ expo-device | ✅ | battery, os, model 等 |
| **SecureStore** | ✅ expo-secure-store | ✅ | installation_id 保存 |
| **KeepAwake** | ✅ expo-keep-awake | ✅ | フォアグラウンド維持 |

### フォアグラウンド参加の制約

| プラットフォーム | 制約 | 対策 |
|----------------|------|------|
| **iOS** | バックグラウンドでは WebSocket が 30秒以内に切断される | expo-keep-awake でフォアグラウンド維持。バックグラウンド移行時は明示的に切断 |
| **iOS** | CPU 使用率が高いとシステムがアプリを停止する可能性 | 処理を軽量に保つ（Phase 5 は疑似処理なので問題なし） |
| **Android** | Doze モードでバックグラウンド通信が制限される | フォアグラウンド前提なので影響なし |
| **両方** | Wi-Fi が不安定な場合の切断 | 自動再接続（exponential backoff） |

### Phase 5 で必要なライブラリ

| ライブラリ | 用途 | Expo Managed |
|-----------|------|-------------|
| (標準) WebSocket | VPS との通信 | ✅ |
| expo-keep-awake | フォアグラウンド維持 | ✅ |
| expo-device | 端末情報取得 | ✅ |
| expo-battery | バッテリー残量取得 | ✅ |
| expo-secure-store | installation_id / token 保存 | ✅ (既存) |

**結論: Phase 5 は Expo Managed のまま実装可能。Prebuild は不要。**

### WebRTC 移行時（Phase 6+）に必要なもの

| 項目 | 必要なこと |
|------|-----------|
| react-native-webrtc | npm install + Prebuild |
| Expo Dev Client | `expo prebuild` + `npx expo run:ios` / `run:android` |
| STUN サーバー | Google の公開 STUN（stun:stun.l.google.com:19302） |
| TURN サーバー | coturn 等の自前運用、または Twilio/Metered のサービス |
| iOS 権限 | Info.plist にカメラ/マイク権限（DataChannel のみなら不要な場合も） |

---

## 10. Phase 5 で実装する範囲

### Phase 5 の実装スコープ

| 項目 | 実装内容 |
|------|---------|
| **WebSocket サーバー** | server/src/ws/ に追加。Hono WebSocket ハンドラー |
| **接続管理** | hello / heartbeat / disconnect の処理 |
| **ジョブ配布** | 5秒ごとに疑似ジョブを生成し、participating 端末に配布 |
| **早着判定** | 先着結果を採用。ポイント記録 |
| **フロント WebSocket** | src/stores/ws-store.ts — WebSocket 接続・メッセージ処理 |
| **参加画面更新** | ホーム画面にリアルタイムのピア数・ジョブ処理数を表示 |
| **job_log テーブル** | ジョブ結果の記録 |
| **UI 更新** | 参加中のリアルタイム表示（ジョブ処理中アニメーション等） |

### Phase 5 の成功条件（再掲）

1. ✅ 2台のスマホが VPS の WebSocket に接続できる
2. ✅ 疑似ジョブが配布される
3. ✅ 2台が同じジョブを処理して結果を返す
4. ✅ 先着結果が採用される
5. ✅ 採用された端末にポイントが加算される
6. ✅ UIにリアルタイムでジョブ処理状況が表示される

### Phase 5 でまだ実装しないもの

| 項目 | Phase |
|------|-------|
| WebRTC DataChannel | Phase 6 |
| 準親ノード | Phase 7+ |
| 実 AI 推論 | Phase 7+ |
| STUN/TURN | Phase 6 |
| バックグラウンド処理 | Phase 8+ (本格対応は困難) |
| ランクスコアへの自動反映 | Phase 6 |
| 不正対策本格版 | Phase 7+ |
| 大規模最適化（100台+） | Phase 8+ |
| サポーター課金 | Phase 6+ |
| プッシュ通知 | Phase 6 |

---

## 11. リスク・懸念点

| リスク | 影響 | 対策 |
|--------|------|------|
| **WebSocket 中継が「分散」に見えない** | サービスのブランディングに影響 | UI で P2P 的な表現。ロードマップで WebRTC 移行を明示 |
| **VPS 単一障害点** | VPS が落ちると全停止 | Phase 5 は開発段階なので許容。Phase 7+ で分散化 |
| **iOS のフォアグラウンド制約** | ユーザーが画面を閉じるとすぐ切断 | expo-keep-awake で緩和。将来的にはバックグラウンドモード検討 |
| **WebRTC 移行のコスト** | Phase 6 でかなりの書き換えが必要 | トランスポート層を抽象化しておく（ITransport インターフェース） |
| **疑似ジョブだけでは面白くない** | ユーザーの離脱 | ジョブ処理のアニメーション + ポイント獲得のフィードバックで体験を作る |
| **Expo Managed → Prebuild 移行** | Phase 6 で開発フローが変わる | Phase 5 完了後に移行。十分なテスト期間を確保 |

---

## 12. 最終提案

### Phase ロードマップ（更新版）

```
Phase 5: WebSocket 中継で最小疎通            ← 次の実装
  ↓  2台の疑似ジョブ往復 + 早着優先 + 実験用イベント記録（本ポイント加算なし）
Phase 6: WebRTC DataChannel 追加 + ランクスコア自動化
  ↓  P2P 接続（WebSocket フォールバック付き）
Phase 7: 準親ノード + 実 AI 推論の最小版
  ↓  小グループ構成 + 軽量 LLM
Phase 8: スケーリング + バックグラウンド + 課金
  ↓  100台+ 対応 + App Store 課金
```

### トランスポート抽象化（Phase 5 で仕込むべき設計）

Phase 6 での WebRTC 移行を見据えて、Phase 5 でトランスポート層を抽象化しておく:

```typescript
// src/transport/types.ts
interface ITransport {
  connect(): Promise<void>;
  disconnect(): void;
  send(message: WsMessage): void;
  onMessage(handler: (message: WsMessage) => void): void;
  onConnect(handler: () => void): void;
  onDisconnect(handler: (reason: string) => void): void;
  isConnected(): boolean;
}

// Phase 5: WebSocket 実装
class WebSocketTransport implements ITransport { ... }

// Phase 6: WebRTC DataChannel 実装
class WebRTCTransport implements ITransport { ... }

// Phase 6: ハイブリッド（WebRTC 優先、失敗時 WebSocket フォールバック）
class HybridTransport implements ITransport { ... }
```

### 推奨ディレクトリ構成（Phase 5 追加分）

```
server/
├── src/
│   ├── ws/
│   │   ├── handler.ts        # WebSocket ハンドラー
│   │   ├── peer-manager.ts   # 接続ピア管理
│   │   ├── job-scheduler.ts  # ジョブ生成・配布
│   │   └── job-judge.ts      # 早着判定
│   └── db/
│       └── schema.ts         # job_log テーブル追加

src/
├── transport/
│   ├── types.ts              # ITransport インターフェース
│   └── ws-transport.ts       # WebSocket 実装
├── stores/
│   └── ws-store.ts           # WebSocket 接続状態
└── hooks/
    └── useJobStatus.ts       # ジョブ処理状況
```

---

## 付録: Phase 5 実装時の想定タスクリスト

1. server/src/ws/ — WebSocket ハンドラー実装
2. server/src/ws/peer-manager.ts — ピア管理
3. server/src/ws/job-scheduler.ts — 疑似ジョブ生成・配布
4. server/src/ws/job-judge.ts — 早着判定
5. server/src/db/schema.ts — job_log テーブル追加
6. src/transport/types.ts — ITransport 定義
7. src/transport/ws-transport.ts — WebSocket 実装
8. src/stores/ws-store.ts — Zustand WebSocket ストア
9. src/hooks/useJobStatus.ts — ジョブ状況 hook
10. app/(tabs)/home.tsx — リアルタイム表示更新
11. app/participation.tsx — ジョブ処理アニメーション
12. テスト — WebSocket 疎通テスト + 早着判定テスト
13. docs/PHASE5-REPORT.md

---

**Phase 4 設計完了。Phase 5 で WebSocket 中継型の最小疎通を実装する準備が整いました。**
