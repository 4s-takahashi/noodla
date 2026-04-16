# Noodla Phase 2 設計書

**作成日**: 2026-04-16
**フェーズ**: Phase 2 — バックエンド設計・データモデル・API骨格
**ステータス**: 設計完了（本格実装は Phase 3 以降）

---

## 1. Phase 2 の結論要約

Phase 2 は「設計フェーズ」であり、以下を確定する:

| 項目 | 採用案 |
|------|--------|
| **認証方式** | メール + パスワード（JWT）→ 後に Google/Apple ログイン追加 |
| **バックエンド** | **Hono** (TypeScript) on Node.js |
| **データベース** | **SQLite** (better-sqlite3) → 将来 PostgreSQL 移行パス |
| **ORM** | **Drizzle ORM** (TypeScript-first, SQLite対応) |
| **API スタイル** | REST (JSON) |
| **フロント状態管理** | **Zustand** + React Query (TanStack Query) |
| **ホスティング** | Xserver VPS 1台 (Node.js + SQLite + Caddy) |

### なぜこの構成か

| 選定理由 | 詳細 |
|---------|------|
| **Hono** | Express より軽量、TypeScript ネイティブ、Expo と同じ TS エコシステム。将来 Cloudflare Workers 等への移行も容易 |
| **SQLite** | VPS 1台に最適。外部 DB サーバー不要。better-sqlite3 は同期 API で扱いやすい。データ量が増えたら PostgreSQL へ Drizzle の adapter 切替で移行可能 |
| **Drizzle** | TypeScript-first の ORM。Prisma より軽量で SQLite との相性が良い。マイグレーション機能あり |
| **Zustand** | React Native と相性抜群。Context API より再レンダリング効率が良い。Phase 1 の AppContext から段階的に移行 |
| **React Query** | API キャッシュ・再試行・楽観的更新を自動化。手動の fetch 管理が不要に |

---

## 2. 採用すべき認証方式

### 比較

| 方式 | メリット | デメリット | 採用 |
|------|---------|-----------|------|
| **メール + パスワード + JWT** | 実装が明確、ライブラリ豊富 | パスワード管理の責任 | ✅ **Phase 2 で採用** |
| Magic Link | パスワード不要 | メール配信インフラ必要、UX に遅延 | ❌ 後回し |
| Google / Apple ログイン | UX 最良 | OAuth 設定が複雑、審査必要 | 🔄 Phase 3 で追加 |
| Passkey | 最先端 | ライブラリ未成熟 | ❌ 将来検討 |

### 採用構成

```
[Phase 2: 最小構成]
メール + パスワード → bcrypt ハッシュ → JWT (access + refresh)

[Phase 3: 追加]
+ Google OAuth (expo-auth-session)
+ Apple Sign In (expo-apple-authentication)

[将来]
+ Magic Link (オプション)
```

### JWT 設計

```typescript
// Access Token (短命: 15分)
{
  sub: "user_id",
  email: "user@example.com",
  iat: 1713000000,
  exp: 1713000900  // 15分
}

// Refresh Token (長命: 30日)
{
  sub: "user_id",
  jti: "unique_token_id",  // リフレッシュトークン無効化用
  iat: 1713000000,
  exp: 1715592000  // 30日
}
```

**セキュリティ方針**:
- パスワード: bcrypt (cost factor 12)
- **Access Token: メモリ保持（変数/Zustand ストア内）。永続保存しない**
- **Refresh Token: SecureStore に保存（永続）**
- **アプリ再起動時: SecureStore から Refresh Token を読み出し → `/auth/refresh` で新しい Access Token を取得**
- リフレッシュトークンのローテーション（使用時に新トークン発行、旧トークン無効化）
- レート制限: ログイン試行 5回/分

---

## 3. データモデル設計

### 3a. User（ユーザー）

```typescript
interface User {
  id: string;                  // UUID v4
  email: string;               // unique, lowercase
  password_hash: string;       // bcrypt
  name: string;                // 表示名
  avatar_url: string | null;   // プロフィール画像URL
  rank: RankLevel;             // 'Bronze' | 'Silver' | 'Gold' | 'Platinum'
  is_supporter: boolean;       // サポーター会員
  supporter_since: string | null; // サポーター開始日
  created_at: string;          // ISO 8601
  updated_at: string;          // ISO 8601
  last_login_at: string | null;
}
```

**SQL**:
```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  rank TEXT NOT NULL DEFAULT 'Bronze',
  is_supporter INTEGER NOT NULL DEFAULT 0,
  supporter_since TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_login_at TEXT
);
CREATE UNIQUE INDEX idx_users_email ON users(email);
```

### 3b. Device（端末）

```typescript
interface Device {
  id: string;                  // UUID v4
  user_id: string;             // FK → users.id
  installation_id: string;     // アプリ初回起動時に生成する UUID v4（SecureStore 永続保存）
  device_name: string;         // "iPhone 15 Pro" 等
  os: 'ios' | 'android';
  os_version: string;          // "18.2"
  app_version: string;         // "1.0.0"
  os_device_id: string | null; // OS由来ID（補助情報、IDFV等）
  push_token: string | null;   // プッシュ通知トークン
  is_active: boolean;          // 現在アクティブか
  last_seen_at: string;        // 最終接続時刻
  created_at: string;
}
```

**SQL**:
```sql
CREATE TABLE devices (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  installation_id TEXT NOT NULL,
  device_name TEXT NOT NULL,
  os TEXT NOT NULL CHECK (os IN ('ios', 'android')),
  os_version TEXT NOT NULL,
  app_version TEXT NOT NULL,
  os_device_id TEXT,
  push_token TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_devices_user_id ON devices(user_id);
CREATE UNIQUE INDEX idx_devices_user_install ON devices(user_id, installation_id);
```

**ポイント**:
- 1ユーザー = 複数端末（同じアカウントで iPhone + Android 両方 OK）
- **`installation_id` はアプリ初回起動時に UUID v4 を生成し、expo-secure-store に永続保存する app-scoped device installation ID**
  - OS由来ID（IDFV等）はアプリ削除でリセットされるため、主キーには使わない
  - OS由来IDは `os_device_id` に補助情報として保存（分析・デバッグ用途）
- `user_id + installation_id` でユニーク制約（同端末の二重登録防止）
- アプリ再インストール時は新しい installation_id が生成される（新端末として登録）

### 3c. NodeParticipationState（ノード参加状態）

```typescript
type ParticipationStatus =
  | 'active'        // 参加中（フォアグラウンドでタスク処理可能）
  | 'standby'       // 待機中（アプリ開いているがタスクなし）
  | 'power_save'    // 省電力モード（バッテリー残量低下等）
  | 'offline'       // オフライン（アプリ閉じた / 圏外）
  | 'unstable'      // 接続不安定（Wi-Fi 品質低下）
  | 'ineligible';   // 参加不可（条件未達: 充電なし等）

interface NodeParticipationState {
  id: string;                  // UUID v4
  device_id: string;           // FK → devices.id
  user_id: string;             // FK → users.id (非正規化、クエリ高速化用)
  status: ParticipationStatus;
  wifi_connected: boolean;
  wifi_strength: 'excellent' | 'good' | 'fair' | 'poor';
  wifi_name: string | null;
  is_charging: boolean;
  battery_level: number;       // 0-100
  cpu_usage: number;           // 0-100
  memory_usage: number;        // 0-100
  current_job_id: string | null; // 処理中ジョブID
  session_start_at: string;    // 今回の参加セッション開始時刻
  total_uptime_minutes: number; // 累計参加時間（分）
  today_uptime_minutes: number; // 本日の参加時間（分）
  updated_at: string;
}
```

**SQL**:
```sql
CREATE TABLE node_participation_states (
  id TEXT PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES devices(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'offline',
  wifi_connected INTEGER NOT NULL DEFAULT 0,
  wifi_strength TEXT DEFAULT 'fair',
  wifi_name TEXT,
  is_charging INTEGER NOT NULL DEFAULT 0,
  battery_level INTEGER NOT NULL DEFAULT 100,
  cpu_usage REAL NOT NULL DEFAULT 0,
  memory_usage REAL NOT NULL DEFAULT 0,
  current_job_id TEXT,
  session_start_at TEXT,
  total_uptime_minutes INTEGER NOT NULL DEFAULT 0,
  today_uptime_minutes INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE UNIQUE INDEX idx_nps_device_id ON node_participation_states(device_id);
CREATE INDEX idx_nps_user_id ON node_participation_states(user_id);
CREATE INDEX idx_nps_status ON node_participation_states(status);
```

**フォアグラウンド前提の設計**:
- `status` はアプリが開いている間のみ `active` / `standby` / `power_save` になる
- アプリが閉じた → heartbeat 途絶 → サーバー側で `offline` に自動遷移（30秒タイムアウト）
- バックグラウンド参加は Phase 2 では想定しない

**状態遷移図**:
```
[アプリ起動] → standby
     ↓ 条件満たす（Wi-Fi + 充電等）
  active ←→ standby （タスクの有無で往復）
     ↓ バッテリー低下
  power_save
     ↓ アプリ閉じる / 圏外
  offline
     ↓ Wi-Fi 不安定
  unstable → (回復) → active
     ↓ 条件未達
  ineligible → (条件回復) → standby
```

### 3d. PointsLedger（ポイント台帳）

```typescript
type PointTransactionType =
  | 'earned'        // ノード参加で獲得
  | 'spent'         // AI機能で消費
  | 'bonus'         // ボーナス（ランクアップ等）
  | 'referral'      // 紹介報酬
  | 'supporter'     // サポーター特典
  | 'adjustment';   // 運営調整

interface PointsLedgerEntry {
  id: string;                  // UUID v4
  user_id: string;             // FK → users.id
  type: PointTransactionType;
  amount: number;              // 正 = 獲得、負 = 消費
  balance_after: number;       // この取引後の残高
  description: string;         // "ノード参加報酬 (15分)"
  related_job_id: string | null; // 関連ジョブID
  related_device_id: string | null; // 関連端末ID
  created_at: string;          // ISO 8601
}
```

**SQL**:
```sql
CREATE TABLE points_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  amount INTEGER NOT NULL,
  balance_after INTEGER NOT NULL,
  description TEXT NOT NULL,
  related_job_id TEXT,
  related_device_id TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_points_user_id ON points_ledger(user_id);
CREATE INDEX idx_points_created_at ON points_ledger(created_at);
CREATE INDEX idx_points_user_type ON points_ledger(user_id, type);
```

**設計方針**:
- **台帳方式（append-only）**: 残高は直接更新せず、取引を追記。`balance_after` で最新残高を即取得
- **後で計算ロジックを差し替え可能**: `amount` を算出するロジックは別モジュールに分離。台帳自体は結果を記録するだけ
- **集計クエリ例**:
  ```sql
  -- 現在残高
  SELECT balance_after FROM points_ledger
  WHERE user_id = ? ORDER BY created_at DESC LIMIT 1;

  -- 今日の獲得
  SELECT SUM(amount) FROM points_ledger
  WHERE user_id = ? AND type = 'earned'
  AND created_at >= date('now');

  -- 月間サマリー
  SELECT type, SUM(amount) as total FROM points_ledger
  WHERE user_id = ? AND created_at >= date('now', '-30 days')
  GROUP BY type;
  ```

### 3e. RankLedger（ランク台帳）

```typescript
type RankLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

interface RankLedger {
  id: string;                  // UUID v4
  user_id: string;             // FK → users.id (1:1)
  rank: RankLevel;
  score: number;               // 総合スコア (0-10000)
  next_rank_score: number;     // 次ランクまでの必要スコア

  // 評価入力値（定期更新）
  avg_processing_speed: number;  // 平均処理速度 (ms)
  connection_stability: number;  // 接続安定性 (0-100)
  avg_participation_hours: number; // 平均日次参加時間
  task_adoption_rate: number;    // タスク採用率 (0-100)
  wifi_quality_score: number;    // Wi-Fi品質スコア (0-100)
  consecutive_days: number;      // 連続参加日数
  total_days_active: number;     // 累計参加日数

  // メタ
  rank_changed_at: string | null; // 最後にランクが変わった日時
  updated_at: string;
}
```

**SQL**:
```sql
CREATE TABLE rank_ledger (
  id TEXT PRIMARY KEY,
  user_id TEXT UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  rank TEXT NOT NULL DEFAULT 'Bronze',
  score INTEGER NOT NULL DEFAULT 0,
  next_rank_score INTEGER NOT NULL DEFAULT 1000,
  avg_processing_speed REAL NOT NULL DEFAULT 0,
  connection_stability REAL NOT NULL DEFAULT 0,
  avg_participation_hours REAL NOT NULL DEFAULT 0,
  task_adoption_rate REAL NOT NULL DEFAULT 0,
  wifi_quality_score REAL NOT NULL DEFAULT 0,
  consecutive_days INTEGER NOT NULL DEFAULT 0,
  total_days_active INTEGER NOT NULL DEFAULT 0,
  rank_changed_at TEXT,
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

**ランク閾値（簡易案）**:

| ランク | 必要スコア | 目安 |
|--------|----------|------|
| Bronze | 0 | 初期状態 |
| Silver | 1,000 | 1週間程度の安定参加 |
| Gold | 5,000 | 1ヶ月程度の継続参加 |
| Platinum | 15,000 | 3ヶ月以上の高品質参加 |

**スコア算出（簡易案、Phase 3 以降で調整）**:
```typescript
function calculateScore(ledger: RankLedger): number {
  return Math.floor(
    ledger.total_days_active * 10 +        // 参加日数 × 10
    ledger.consecutive_days * 5 +           // 連続日数 × 5
    ledger.connection_stability * 20 +      // 安定性 × 20
    ledger.task_adoption_rate * 15 +        // 採用率 × 15
    ledger.wifi_quality_score * 10 +        // Wi-Fi × 10
    ledger.avg_participation_hours * 30     // 参加時間 × 30
  );
}
```

### 3f. Notification（通知）

```typescript
type NotificationType =
  | 'rank_up'       // ランクアップ
  | 'points'        // ポイント獲得
  | 'system'        // システム通知
  | 'maintenance'   // メンテナンス
  | 'achievement';  // 実績解除

interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}
```

**SQL**:
```sql
CREATE TABLE notifications (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notif_user_id ON notifications(user_id);
CREATE INDEX idx_notif_user_unread ON notifications(user_id, is_read);
```

### 3g. RefreshToken（リフレッシュトークン）

```sql
CREATE TABLE refresh_tokens (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL,
  device_id TEXT REFERENCES devices(id),
  expires_at TEXT NOT NULL,
  revoked_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_rt_user_id ON refresh_tokens(user_id);
CREATE INDEX idx_rt_token_hash ON refresh_tokens(token_hash);
```

---

## 4. API 設計

### API 一覧

**ベース URL**: `https://{vps-domain}/api/v1`

#### 認証

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | `/auth/register` | ユーザー新規登録 | 不要 |
| POST | `/auth/login` | ログイン | 不要 |
| POST | `/auth/logout` | ログアウト | 必要 |
| POST | `/auth/refresh` | トークンリフレッシュ | Refresh Token |
| GET | `/auth/me` | セッション確認（自分の情報） | 必要 |

#### 端末

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| POST | `/devices` | 端末登録 | 必要 |
| GET | `/devices` | 自分の端末一覧 | 必要 |
| PATCH | `/devices/:id` | 端末情報更新 | 必要 |
| DELETE | `/devices/:id` | 端末削除 | 必要 |

#### ノード参加

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| PUT | `/node/state` | 参加状態更新（heartbeat兼用） | 必要 |
| GET | `/node/state` | 現在の参加状態取得 | 必要 |
| GET | `/node/stats` | グローバルノード統計 | 不要 |

#### ポイント

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/points/balance` | ポイント残高 | 必要 |
| GET | `/points/history` | ポイント履歴 | 必要 |
| GET | `/points/summary` | 期間別サマリー | 必要 |

#### ランク

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/rank` | 自分のランク情報 | 必要 |
| GET | `/rank/leaderboard` | ランキング一覧 | 必要 |

#### 通知

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| GET | `/notifications` | 通知一覧 | 必要 |
| PATCH | `/notifications/:id/read` | 既読にする | 必要 |
| POST | `/notifications/read-all` | 全既読 | 必要 |

#### ユーザー

| メソッド | パス | 説明 | 認証 |
|---------|------|------|------|
| PATCH | `/users/me` | プロフィール更新 | 必要 |
| POST | `/users/me/supporter/sync` | サポーター状態同期（ストア課金検証結果の反映） | 必要 |

### API 入出力詳細

#### POST `/auth/register`
```typescript
// Request
{
  email: string;      // "user@example.com"
  password: string;   // 8文字以上
  name: string;       // 表示名
}

// Response 201
{
  user: { id, email, name, rank, is_supporter, created_at },
  access_token: string,
  refresh_token: string,
  expires_in: 900     // 15分 (秒)
}

// Error 409 — メール重複
// Error 422 — バリデーションエラー
```

#### POST `/auth/login`
```typescript
// Request
{
  email: string;
  password: string;
  device_info?: {     // ログイン時に端末情報も送る
    installation_id: string;
    device_name: string;
    os: 'ios' | 'android';
    os_version: string;
    app_version: string;
    os_device_id?: string;  // OS由来ID（補助情報）
  }
}

// Response 200
{
  user: { id, email, name, rank, is_supporter, points_balance },
  access_token: string,
  refresh_token: string,
  expires_in: 900
}

// Error 401 — 認証失敗
// Error 429 — レート制限
```

#### PUT `/node/state`（heartbeat 兼用）
```typescript
// Request — アプリから10秒おきに送信
{
  installation_id: string;
  status: ParticipationStatus;
  wifi_connected: boolean;
  wifi_strength: 'excellent' | 'good' | 'fair' | 'poor';
  wifi_name: string | null;
  is_charging: boolean;
  battery_level: number;
  cpu_usage: number;
  memory_usage: number;
}

// Response 200
{
  status: ParticipationStatus;    // サーバー側で判定した最終状態
  assigned_job: Job | null;       // 割り当てられたジョブ（将来用、Phase 2 では常に null）
  server_time: string;            // サーバー時刻（同期用）
}
```

#### GET `/points/history`
```typescript
// Query: ?limit=20&offset=0&type=earned

// Response 200
{
  items: PointsLedgerEntry[],
  total: number,
  has_more: boolean
}
```

#### GET `/rank`
```typescript
// Response 200
{
  rank: RankLevel,
  score: number,
  next_rank_score: number,
  progress: number,          // 0-100 (次ランクへの進捗%)
  evaluation: {
    processing_speed: number,
    connection_stability: number,
    avg_participation_hours: number,
    task_adoption_rate: number,
    wifi_quality: number,
    consecutive_days: number,
    total_days: number
  }
}
```

---

## 5. フロント状態管理設計

### Phase 1 → Phase 2 の移行方針

```
Phase 1: AppContext (React Context) + モックデータ
    ↓
Phase 2: Zustand (ストア) + React Query (API通信)
    ↓
Phase 3: 実API接続（Zustandストアはそのまま）
```

### Zustand ストア構成

```typescript
// stores/auth-store.ts
interface AuthStore {
  user: User | null;
  accessToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshToken: () => Promise<void>;
}

// stores/node-store.ts
interface NodeStore {
  status: ParticipationStatus;
  deviceInfo: NetworkStatus;
  globalNodes: number;
  isParticipating: boolean;
  updateStatus: (status: ParticipationStatus) => void;
  sendHeartbeat: () => Promise<void>;
  startParticipation: () => void;
  stopParticipation: () => void;
}

// stores/points-store.ts
interface PointsStore {
  balance: number;
  todayEarned: number;
  history: PointTransaction[];
  fetchBalance: () => Promise<void>;
  fetchHistory: (page: number) => Promise<void>;
}

// stores/rank-store.ts
interface RankStore {
  rank: RankLevel;
  score: number;
  nextRankScore: number;
  evaluation: RankEvaluation;
  fetchRank: () => Promise<void>;
}

// stores/notification-store.ts
interface NotificationStore {
  items: Notification[];
  unreadCount: number;
  fetchNotifications: () => Promise<void>;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}
```

### React Query の使いどころ

```typescript
// hooks/usePoints.ts
function usePointsBalance() {
  return useQuery({
    queryKey: ['points', 'balance'],
    queryFn: () => api.get('/points/balance'),
    staleTime: 30_000,    // 30秒キャッシュ
    refetchInterval: 60_000, // 1分おきに自動更新
  });
}

function usePointsHistory(page: number) {
  return useQuery({
    queryKey: ['points', 'history', page],
    queryFn: () => api.get(`/points/history?limit=20&offset=${page * 20}`),
  });
}
```

### API クライアント

```typescript
// lib/api-client.ts
import { useAuthStore } from '@/stores/auth-store';

const API_BASE = 'https://{vps-domain}/api/v1';

async function apiClient(path: string, options?: RequestInit) {
  const token = useAuthStore.getState().accessToken;
  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers,
    },
  });

  if (res.status === 401) {
    // トークン期限切れ → リフレッシュ試行
    await useAuthStore.getState().refreshToken();
    // リトライ
    return apiClient(path, options);
  }

  if (!res.ok) throw new ApiError(res.status, await res.json());
  return res.json();
}
```

---

## 6. VPS 構成案

### Xserver VPS スペック想定

| 項目 | 推奨 |
|------|------|
| **プラン** | 2GB メモリ（月 ¥830〜） |
| **OS** | Ubuntu 24.04 LTS |
| **Node.js** | 22 LTS |
| **DB** | SQLite（ファイルベース） |
| **リバプロ** | Caddy（自動HTTPS） |
| **プロセス管理** | pm2 |

### ディレクトリ構成

```
/home/noodla/
├── server/                  # バックエンド
│   ├── src/
│   │   ├── index.ts         # エントリポイント (Hono app)
│   │   ├── routes/
│   │   │   ├── auth.ts      # 認証ルート
│   │   │   ├── devices.ts   # 端末ルート
│   │   │   ├── node.ts      # ノード参加ルート
│   │   │   ├── points.ts    # ポイントルート
│   │   │   ├── rank.ts      # ランクルート
│   │   │   ├── notifications.ts
│   │   │   └── users.ts
│   │   ├── db/
│   │   │   ├── schema.ts    # Drizzle スキーマ定義
│   │   │   ├── migrate.ts   # マイグレーション
│   │   │   └── seed.ts      # シードデータ
│   │   ├── middleware/
│   │   │   ├── auth.ts      # JWT 検証ミドルウェア
│   │   │   └── rate-limit.ts
│   │   ├── services/
│   │   │   ├── auth-service.ts
│   │   │   ├── points-service.ts
│   │   │   ├── rank-service.ts
│   │   │   └── node-service.ts
│   │   └── lib/
│   │       ├── jwt.ts
│   │       └── validator.ts
│   ├── data/
│   │   └── noodla.db        # SQLite データベースファイル
│   ├── drizzle/              # マイグレーションファイル
│   ├── package.json
│   ├── tsconfig.json
│   └── .env
│
├── Caddyfile                # Caddy 設定
└── ecosystem.config.js      # pm2 設定
```

### Caddy 設定

```
noodla.example.com {
    # API
    handle /api/* {
        reverse_proxy localhost:3001
    }

    # ヘルスチェック
    handle /health {
        respond "OK" 200
    }
}
```

### pm2 設定

```javascript
// ecosystem.config.js
module.exports = {
  apps: [{
    name: 'noodla-api',
    script: 'dist/index.js',
    instances: 1,          // SQLite は単一プロセス推奨
    env: {
      NODE_ENV: 'production',
      PORT: 3001,
      JWT_SECRET: '...',
      DB_PATH: './data/noodla.db',
    }
  }]
};
```

---

## 7. 画面と API の対応表

| # | 画面 | ファイル | 使用 API | ストア |
|---|------|---------|---------|--------|
| 1 | スプラッシュ | `app/index.tsx` | `GET /auth/me` (セッション確認) | AuthStore |
| 2 | オンボーディング | `app/onboarding.tsx` | なし | — |
| 3 | ログイン | `app/login.tsx` | `POST /auth/login` | AuthStore |
| 4 | 新規登録 | `app/register.tsx` | `POST /auth/register` | AuthStore |
| 5 | **ホーム** | `app/(tabs)/home.tsx` | `GET /node/state`, `GET /node/stats`, `GET /points/balance` | NodeStore, PointsStore |
| 6 | **ポイント** | `app/(tabs)/points.tsx` | `GET /points/balance`, `GET /points/history`, `GET /points/summary` | PointsStore |
| 7 | **AIツール** | `app/(tabs)/ai.tsx` | (Phase 3 以降) | — |
| 8 | **ランク** | `app/(tabs)/rank.tsx` | `GET /rank`, `GET /rank/leaderboard` | RankStore |
| 9 | **設定** | `app/(tabs)/settings.tsx` | `PATCH /users/me`, `GET /devices`, `POST /auth/logout` | AuthStore |
| 10 | 参加状況 | `app/participation.tsx` | `GET /node/state` | NodeStore |
| 11 | 接続詳細 | `app/connection.tsx` | `GET /node/state` | NodeStore |
| 12 | AIチャット | `app/chat.tsx` | (Phase 3 以降) | — |
| 13 | 文章要約 | `app/summarize.tsx` | (Phase 3 以降) | — |
| 14 | 翻訳 | `app/translate.tsx` | (Phase 3 以降) | — |
| 15 | 文章生成 | `app/draft.tsx` | (Phase 3 以降) | — |
| 16 | サポーター | `app/supporter.tsx` | `POST /users/me/supporter/sync` | AuthStore |
| 17 | 通知履歴 | `app/notifications.tsx` | `GET /notifications`, `PATCH /.../read` | NotificationStore |
| 18 | エラー | `app/error.tsx` | なし | — |

---

## 8. Phase 3 へ持ち越す項目

### Phase 3 で実装するもの

| 項目 | 詳細 |
|------|------|
| **認証 API 実装** | Hono + bcrypt + JWT 実装 |
| **DB マイグレーション** | Drizzle で上記スキーマを実際に作成 |
| **API 実装** | 全ルートの実装 |
| **フロント API 接続** | モック → 実 API に差し替え |
| **Google / Apple ログイン** | expo-auth-session 統合 |
| **Heartbeat 実装** | 10秒間隔の状態送信 |
| **ポイント計算ロジック** | 参加時間ベースの簡易計算 |
| **ランク評価ロジック** | 日次バッチで評価値更新 |
| **VPS デプロイ** | Xserver VPS セットアップ |

### Phase 4 以降の候補

| 項目 | 詳細 |
|------|------|
| P2P 通信基盤 | WebRTC / WebSocket ベースの分散通信 |
| AI API 接続 | チャット・要約・翻訳・生成の実装 |
| サブスク課金 | RevenueCat 統合 |
| プッシュ通知 | expo-notifications + APNs/FCM |
| バックグラウンド処理 | expo-background-fetch |
| 分散推論 | ONNX Runtime Mobile |

---

## 9. 注意点・懸念点

### セキュリティ

| 懸念 | 対策 |
|------|------|
| パスワード漏洩 | bcrypt (cost 12) でハッシュ。平文は保存しない |
| JWT 漏洩 | Access Token は 15分有効。Refresh Token はローテーション |
| SQLite 同時書き込み | WAL モード有効化。単一プロセスで運用（pm2 instances: 1） |
| レート制限 | ログイン 5回/分、API 全体 100回/分/ユーザー |

### スケーラビリティ

| 懸念 | 対策 |
|------|------|
| SQLite の限界 | ユーザー1万人程度までは問題なし。超えたら PostgreSQL に Drizzle adapter 切替。**将来 PostgreSQL 移行は設計段階から前提としており、Drizzle ORM の adapter 切替で移行可能。SQL 方言差（datetime関数等）は移行時に要確認** |
| VPS 1台の限界 | 初期段階はこれで十分。スケール時は API サーバーと DB を分離 |
| Heartbeat 負荷 | 10秒 × 同時100ユーザー = 600 req/分 → Hono なら余裕 |

### Expo / React Native 固有

| 懸念 | 対策 |
|------|------|
| SecureStore の容量 | JWT トークンのみ保存（数百バイト）→ 問題なし |
| バックグラウンド | Phase 2 では考慮しない。フォアグラウンドのみ |
| expo-device の uniqueId | 主キーとしては使わない。installation_id（アプリ生成UUID）を採用。OS由来IDは補助情報のみ |
| オフライン対応 | Phase 2 では考慮しない。オフライン時はエラー表示 |

### 運用

| 懸念 | 対策 |
|------|------|
| DB バックアップ | SQLite ファイルを日次で rsync バックアップ |
| ログ | pm2 のログローテーション + 構造化ログ (pino) |
| 監視 | pm2 の restart + Caddy のアクセスログ |

---

## ER図（テーブル関係）

```
users (1)
  ├── (1:N) devices
  │         └── (1:1) node_participation_states
  ├── (1:N) points_ledger
  ├── (1:1) rank_ledger
  ├── (1:N) notifications
  └── (1:N) refresh_tokens
```

---

## 技術スタック総覧

### フロントエンド（既存 + Phase 2 追加）

| 技術 | 用途 | Phase |
|------|------|-------|
| React Native + Expo | UI フレームワーク | 1 (既存) |
| Expo Router | ルーティング | 1 (既存) |
| TypeScript | 型安全 | 1 (既存) |
| **Zustand** | 状態管理 | **2 (新規)** |
| **TanStack Query** | API 通信・キャッシュ | **2 (新規)** |
| **expo-secure-store** | トークン保存 | **2 (新規)** |
| **expo-device** | 端末情報取得（補助情報のみ。主キーには使わない） | **2 (新規)** |

### バックエンド（Phase 2 新規）

| 技術 | 用途 |
|------|------|
| **Hono** | HTTP フレームワーク |
| **better-sqlite3** | SQLite ドライバ |
| **Drizzle ORM** | ORM + マイグレーション |
| **bcrypt** | パスワードハッシュ |
| **jose** | JWT 生成・検証 |
| **zod** | リクエストバリデーション |
| **pino** | 構造化ログ |
| **Caddy** | リバースプロキシ + HTTPS |
| **pm2** | プロセス管理 |

---

**以上が Phase 2 設計資料です。**

本格実装は Phase 3 以降。この設計書をベースに、API の実装 → フロント接続 → デプロイの順で進めていきます。
