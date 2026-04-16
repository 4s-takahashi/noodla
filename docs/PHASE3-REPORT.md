# Noodla Phase 3 実装レポート

**作成日**: 2026-04-16  
**フェーズ**: Phase 3 — バックエンド最小実装 + フロントAPI接続  
**ステータス**: ✅ 完了

---

## 実装サマリー

Phase 3 の全項目を完了。Hono バックエンド + SQLite DB + Drizzle ORM を実装し、React Native フロントと接続済み。

| 項目 | 状態 |
|------|------|
| server/ バックエンド | ✅ 完了 |
| DB スキーマ (7テーブル) | ✅ 完了 |
| DB マイグレーション | ✅ 完了 |
| シードデータ | ✅ 完了 |
| API エンドポイント (18+) | ✅ 完了 |
| Zustand ストア (3個) | ✅ 完了 |
| API クライアント | ✅ 完了 |
| TanStack Query hooks (5個) | ✅ 完了 |
| 画面 API 接続 (7画面) | ✅ 完了 |
| バックエンドテスト (28件) | ✅ 全パス |

---

## 1. バックエンド実装

### ディレクトリ構成

```
server/
├── src/
│   ├── index.ts              # Hono サーバー起動 (port 3001)
│   ├── routes/
│   │   ├── auth.ts           # 認証 API
│   │   ├── devices.ts        # 端末管理 API
│   │   ├── node.ts           # ノード参加状態 API (heartbeat兼用)
│   │   ├── points.ts         # ポイント API
│   │   ├── rank.ts           # ランク API
│   │   ├── notifications.ts  # 通知 API
│   │   └── users.ts          # ユーザー API
│   ├── db/
│   │   ├── schema.ts         # Drizzle スキーマ (7テーブル)
│   │   ├── index.ts          # DB 接続 (WAL mode + FK有効)
│   │   ├── migrate.ts        # マイグレーション実行
│   │   └── seed.ts           # 開発用シードデータ
│   ├── middleware/
│   │   ├── auth.ts           # JWT Bearer 認証ミドルウェア
│   │   └── rate-limit.ts     # レート制限 (login: 5/分, API: 100/分)
│   ├── services/
│   │   └── auth-service.ts   # 認証ロジック (bcrypt, JWT発行, refresh rotation)
│   └── lib/
│       ├── jwt.ts            # JWT 生成・検証 (jose)
│       └── validator.ts      # Zod バリデーションスキーマ
├── data/
│   └── noodla.db            # SQLite データベース
├── drizzle/
│   └── 0000_*.sql           # 自動生成マイグレーションファイル
├── tests/
│   ├── auth.test.ts         # 認証テスト (11件)
│   ├── devices.test.ts      # 端末テスト (5件)
│   ├── points.test.ts       # ポイントテスト (5件)
│   ├── rank.test.ts         # ランクテスト (3件)
│   ├── notifications.test.ts # 通知テスト (4件)
│   └── helpers/
│       ├── test-db.ts       # インメモリSQLiteヘルパー
│       └── test-app.ts      # テスト用アプリファクトリ
├── package.json
├── tsconfig.json
└── drizzle.config.ts
```

### 実装済み API エンドポイント

#### 認証 (`/api/v1/auth`)
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/auth/register` | 新規登録 + JWT発行 + 初期ランク/通知作成 |
| POST | `/auth/login` | ログイン + JWT発行 + デバイス登録(option) |
| POST | `/auth/refresh` | リフレッシュトークン検証 + ローテーション |
| POST | `/auth/logout` | リフレッシュトークン無効化 |
| GET | `/auth/me` | 認証済みユーザー情報取得 |

#### 端末 (`/api/v1/devices`)
| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/devices` | 端末登録 / upsert + NodeParticipationState初期化 |
| GET | `/devices` | 自分の端末一覧 |
| PATCH | `/devices/:installationId` | 端末ステータス更新 (heartbeat兼用) |
| DELETE | `/devices/:installationId` | 端末削除 |

#### ノード参加 (`/api/v1/node`)
| メソッド | パス | 説明 |
|---------|------|------|
| PUT | `/node/state` | 参加状態更新 + uptime累積 (heartbeat) |
| GET | `/node/state` | 現在の参加状態取得 |
| GET | `/node/stats` | グローバルノード統計 |

#### ポイント (`/api/v1/points`)
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/points/balance` | 残高 + 今日/今週/今月の獲得 |
| GET | `/points/history` | 取引履歴 (ページネーション対応) |
| GET | `/points/summary` | タイプ別集計 |

#### ランク (`/api/v1/rank`)
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/rank` | 現在のランク + 進捗 + 評価値 |
| GET | `/rank/leaderboard` | スコア順ランキング一覧 |

#### 通知 (`/api/v1/notifications`)
| メソッド | パス | 説明 |
|---------|------|------|
| GET | `/notifications` | 通知一覧 + 未読数 |
| PATCH | `/notifications/:id/read` | 個別既読 |
| POST | `/notifications/read-all` | 全既読 |

#### ユーザー (`/api/v1/users`)
| メソッド | パス | 説明 |
|---------|------|------|
| PATCH | `/users/me` | プロフィール更新 |
| POST | `/users/me/supporter/sync` | サポーター状態同期 (Phase 4 placeholder) |

### セキュリティ実装

- **パスワード**: bcrypt (cost factor 12)
- **Access Token**: JWT HS256、15分有効、メモリのみ保持
- **Refresh Token**: JWT HS256、30日有効、SecureStore 永続保存
- **トークンローテーション**: リフレッシュ時に旧トークンを無効化
- **レート制限**: login 5回/分、API全体 100回/分
- **DB**: WAL モード + 外部キー制約有効
- **CORS**: expo/RN 開発サーバーの localhost オリジン許可

---

## 2. フロント実装

### 追加ファイル

```
src/
├── api/
│   ├── config.ts       # API_BASE_URL / USE_REAL_API フラグ
│   └── client.ts       # fetch ラッパー (401→refresh→retry)
├── stores/
│   ├── auth-store.ts        # Zustand: user, accessToken, login/register/logout/refresh
│   ├── node-store.ts        # Zustand: status, heartbeat, startParticipation
│   └── installation-store.ts # Zustand: installation_id (SecureStore永続)
└── hooks/
    ├── usePoints.ts         # TanStack Query: usePointsBalance, usePointsHistory
    ├── useRank.ts           # TanStack Query: useRank, useLeaderboard
    ├── useNotifications.ts  # TanStack Query + mutation: useNotifications, useMarkRead
    └── useDevices.ts        # TanStack Query: useDevices
```

### API 切替方式

```typescript
// src/api/config.ts
export const USE_REAL_API =
  !__DEV__ || process.env.EXPO_PUBLIC_USE_REAL_API === 'true';
```

- 開発中: `USE_REAL_API = false` (モックがデフォルト)
- 実API使用: `EXPO_PUBLIC_USE_REAL_API=true expo start`
- 本番: 常に `USE_REAL_API = true`

### 接続済み画面

| 画面 | ファイル | 接続内容 |
|------|---------|---------|
| ログイン | `app/login.tsx` | `authStore.login()` |
| 新規登録 | `app/register.tsx` | `authStore.register()` |
| ホーム | `app/(tabs)/home.tsx` | `usePointsBalance()` + `useNodeStore` |
| ポイント | `app/(tabs)/points.tsx` | `usePointsBalance()` + `usePointsHistory()` |
| ランク | `app/(tabs)/rank.tsx` | `useRank()` |
| 通知 | `app/notifications.tsx` | `useNotifications()` + `useMarkNotificationRead()` |
| 設定 | `app/(tabs)/settings.tsx` | `authStore.user` + `useDevices()` + `authStore.logout()` |

### QueryClient セットアップ

`app/_layout.tsx` に `QueryClientProvider` を追加済み。`AppProvider` (Phase 1 Context) は保持しモックフォールバックとして機能。

---

## 3. テスト結果

```
 Test Files  5 passed (5)
      Tests  28 passed (28)
   Duration  7.78s
```

| ファイル | テスト数 | 内容 |
|---------|---------|------|
| auth.test.ts | 11 | register/login/refresh/logout/me の全シナリオ |
| devices.test.ts | 5 | 端末登録/upsert/一覧/status更新/バリデーション |
| points.test.ts | 5 | 残高/履歴/ページネーション/認証チェック |
| rank.test.ts | 3 | ランク取得/leaderboard/認証チェック |
| notifications.test.ts | 4 | 一覧/既読/全既読/認証チェック |

---

## 4. 開発用シードデータ

`npm run seed` で以下が投入される:

| データ | 値 |
|--------|-----|
| メール | `test@example.com` |
| パスワード | `password123` |
| ランク | Bronze |
| スコア | 250 |
| ポイント残高 | 82pt |
| 端末 | iPhone 15 Pro (iOS) |
| 通知 | 3件 (未読) |

---

## 5. 起動方法

### バックエンド

```bash
cd server

# 初回セットアップ
npm install
npm run migrate
npm run seed   # 任意

# 開発サーバー起動
npm run dev    # http://localhost:3001

# テスト
npm test
```

### フロントエンド (モックモード)

```bash
# ルートディレクトリ
npm start
```

### フロントエンド (実APIモード)

```bash
EXPO_PUBLIC_USE_REAL_API=true npm start
```

---

## 6. curl による動作確認例

```bash
# ヘルスチェック
curl http://localhost:3001/health

# 新規登録
curl -X POST http://localhost:3001/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"user@example.com","password":"password123","name":"テストユーザー"}'

# ログイン
curl -X POST http://localhost:3001/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"password123"}'

# ポイント残高 (要 access_token)
curl http://localhost:3001/api/v1/points/balance \
  -H "Authorization: Bearer {access_token}"

# ランク取得
curl http://localhost:3001/api/v1/rank \
  -H "Authorization: Bearer {access_token}"
```

---

## 7. API 実装範囲の分類

### ✅ 必須実装（Phase 3 の目的に直結）

| API | 理由 |
|-----|------|
| POST `/auth/register` | 認証の最小実装 |
| POST `/auth/login` | 認証の最小実装 |
| POST `/auth/refresh` | Refresh Token フロー |
| POST `/auth/logout` | セッション管理 |
| GET `/auth/me` | セッション確認 |
| POST `/devices` | installation_id による端末登録 |
| GET `/devices` | 端末一覧取得 |
| PATCH `/devices/:installationId` | ノード参加状態更新（heartbeat 兼用） |
| GET `/points/balance` | ポイント残高取得 |
| GET `/points/history` | ポイント履歴取得 |
| GET `/rank` | ランク情報取得 |
| GET `/notifications` | 通知一覧取得 |

### 🔶 任意で先行実装したもの（Phase 3 の範囲を少し超えるが、実装コストが小さく一貫性のために含めた）

| API | 理由 |
|-----|------|
| PUT `/node/state` | heartbeat との統合で自然に実装。Phase 3 指示の「ノード参加状態管理」に含まれるが、専用エンドポイントとしては追加 |
| GET `/node/state` | 上記と対で取得側 |
| GET `/node/stats` | グローバルノード統計（モック値）。UI の「ネットワーク全体のノード数」表示用 |
| GET `/points/summary` | タイプ別集計。ポイント画面の内訳表示に利用 |
| GET `/rank/leaderboard` | ランキング一覧。ランク画面に他ユーザーとの比較を表示 |
| PATCH `/notifications/:id/read` | 個別既読。通知 UI の既読操作に必要 |
| POST `/notifications/read-all` | 全既読。利便性のため追加 |
| DELETE `/devices/:installationId` | 端末削除。設定画面のデバイス管理用 |
| PATCH `/users/me` | プロフィール更新。設定画面で必要 |

### 📋 Phase 4 へ回してもよかったもの

| API | 理由 |
|-----|------|
| GET `/node/stats` | グローバル統計は実ノード処理がないと意味が薄い。モック値を返しているだけ |
| GET `/rank/leaderboard` | ユーザーが1人しかいない段階では不要。スケール時に再設計の可能性あり |
| POST `/users/me/supporter/sync` | placeholder として存在するが、課金連携まで実質不要 |

---

## 8. Phase 4 への引継ぎ事項

| 項目 | 状態 | Phase 4 での対応 |
|------|------|----------------|
| Google/Apple ログイン | ❌ 未実装 | expo-auth-session 統合 |
| Heartbeat 自動送信 | ❌ 未実装 | setInterval (foreground のみ) |
| ポイント計算ロジック | ❌ placeholder | 参加時間ベース計算 |
| ランク自動更新 | ❌ placeholder | 日次バッチ or heartbeat連動 |
| VPS デプロイ | ❌ 未実装 | Xserver VPS + Caddy + pm2 |
| プッシュ通知 | ❌ 未実装 | expo-notifications + APNs/FCM |
| AI API接続 | ❌ 未実装 | Phase 4 以降 |
| サポーター課金 | ❌ placeholder | RevenueCat Phase 4+ |

---

**Phase 3 完了**: バックエンド最小実装 + フロントAPI接続が完成しました。
