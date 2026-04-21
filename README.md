# Noodla

> スマートフォンのアイドル時間を分散AIネットワークに提供し、ポイントを獲得してAI機能を利用できるサービス

**現在のステータス: Phase 7 — ITransport 抽象化 + Push 通知 完了 / Phase 8 準備中**

---

## 概要

Noodla は、スマートフォンの余剰リソース（CPU・メモリ・通信帯域）をアイドル時間に提供することで、**分散AIネットワーク**の一部として機能します。

```
あなたのスマートフォン → ネットワークに参加 → タスクを処理 → ポイント獲得 → AIを無料で利用
```

### コンセプト
- **参加者はノード** — スマートフォンが分散AIの計算単位になる
- **ポイント経済** — 貢献量に応じてポイント獲得、AIサービスと交換
- **ランク制度** — 貢献実績でBronze / Silver / Gold / Platinum にランクアップ
- **サポーター制度** — 月額¥100で特典強化（将来実装予定、現在はUI表示のみ）

---

## アーキテクチャ

```
┌─────────────────────────────┐     ┌──────────────────────────┐
│  フロントエンド (app/ + src/)  │────▶│  バックエンド (server/)    │
│  React Native + Expo         │◀────│  Hono + SQLite + Drizzle  │
│  Zustand + TanStack Query    │     │  JWT + bcrypt             │
└─────────────────────────────┘     └──────────────────────────┘
```

**monorepo 構成** — フロント（`app/` + `src/`）とバックエンド（`server/`）を同一リポジトリに配置。

| ディレクトリ | 責務 |
|-------------|------|
| `app/` | Expo Router 画面ファイル（18画面） |
| `src/` | フロント共通（コンポーネント、ストア、API クライアント、hooks） |
| `server/` | Hono バックエンド（API ルーティング、DB、認証） |
| `docs/` | 設計書・レポート |

---

## 画面一覧（18画面）

| # | 画面名 | ファイル | 説明 |
|---|--------|----------|------|
| 1 | スプラッシュ | `app/index.tsx` | ロゴ・アニメーション・自動遷移 |
| 2 | オンボーディング | `app/onboarding.tsx` | 3ステップのスワイプ式サービス説明 |
| 3 | ログイン | `app/login.tsx` | メール/パスワード認証 → API接続 |
| 4 | 新規登録 | `app/register.tsx` | ユーザー登録 → API接続 |
| 5 | ホーム | `app/(tabs)/home.tsx` | メイン画面：ノード状態・ポイント概要 → API接続 |
| 6 | ポイント | `app/(tabs)/points.tsx` | ポイント残高・履歴 → API接続 |
| 7 | AIツール一覧 | `app/(tabs)/ai.tsx` | 利用可能なAI機能カード一覧 |
| 8 | ランク | `app/(tabs)/rank.tsx` | ランキング・スコア・進捗バー → API接続 |
| 9 | 設定 | `app/(tabs)/settings.tsx` | 参加設定・アカウント管理 → API接続 |
| 10 | 参加状況詳細 | `app/participation.tsx` | ネットワーク参加の詳細統計 |
| 11 | 接続詳細 | `app/connection.tsx` | Wi-Fi・接続品質・改善ヒント |
| 12 | AIチャット | `app/chat.tsx` | Noodla AIとのチャットUI |
| 13 | 文章要約 | `app/summarize.tsx` | テキスト要約ツール |
| 14 | 翻訳 | `app/translate.tsx` | 多言語翻訳ツール |
| 15 | 文章生成 | `app/draft.tsx` | テーマ・トーン指定の文章生成 |
| 16 | サポータープラン | `app/supporter.tsx` | 月額¥100のサポーター特典紹介 |
| 17 | 通知履歴 | `app/notifications.tsx` | 通知一覧 → API接続 |
| 18 | エラー/待機 | `app/error.tsx` | エラー表示・再試行UI |

**Phase 3 で API 接続済み**: #3, #4, #5, #6, #8, #9, #17（7画面）
**モックデータのまま**: #7, #10, #11, #12, #13, #14, #15, #16, #18（Phase 6 以降）

---

## 技術スタック

### フロントエンド

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React Native | 0.81.5 | クロスプラットフォームUI |
| Expo SDK | 54.x | 開発環境・ネイティブAPI |
| Expo Router | 55.x | ファイルベースルーティング |
| TypeScript | 5.9.x | 型安全な開発 |
| React | 19.1.0 | UIライブラリ |
| Zustand | - | クライアント状態管理（auth / node / installation） |
| TanStack Query | - | サーバー状態管理（points / rank / notifications / devices） |
| expo-secure-store | - | Refresh Token / installation_id の永続保存 |

### バックエンド

| 技術 | 用途 |
|------|------|
| Hono | 軽量 HTTP フレームワーク |
| better-sqlite3 | SQLite ドライバ |
| Drizzle ORM | 型安全な DB アクセス |
| bcrypt | パスワードハッシュ |
| jose | JWT 生成・検証 |
| zod | リクエストバリデーション |

---

## セットアップ

### 必要な環境
- Node.js 18+
- npm
- [Expo Go](https://expo.dev/client) アプリ（iOS / Android）、またはエミュレータ

### フロントエンド

```bash
git clone https://github.com/4s-takahashi/noodla.git
cd noodla

# 依存関係インストール
npm install

# 開発サーバー起動
npm start
```

Expo Go でQRコードをスキャン、またはエミュレータで起動:
```bash
npm run android   # Android エミュレータ
npm run ios       # iOS シミュレータ（macOS のみ）
npm run web       # Web ブラウザ（レイアウト確認用）
```

### バックエンド

```bash
cd server

# 依存関係インストール
npm install

# DB マイグレーション + Seed データ投入
npm run db:migrate
npm run db:seed

# 開発サーバー起動（port 3001）
npm run dev
```

Seed データ:
- テストユーザー: `test@example.com` / `password123`
- Device 1件、ポイント履歴5件、ランク情報、通知3件

### API 切替

デフォルトでは開発時はモックデータを使用。実 API に接続する場合:
```bash
EXPO_PUBLIC_USE_REAL_API=true npm start
```

---

## API 一覧（Phase 3 実装済み）

| メソッド | パス | 説明 |
|---------|------|------|
| POST | `/auth/register` | ユーザー登録 |
| POST | `/auth/login` | ログイン（JWT 発行） |
| POST | `/auth/refresh` | トークンリフレッシュ |
| POST | `/auth/logout` | ログアウト（Refresh Token 無効化） |
| GET | `/auth/session` | セッション確認 |
| GET | `/users/me` | ユーザー情報取得 |
| POST | `/devices/register` | 端末登録 |
| GET | `/devices` | 端末一覧 |
| PATCH | `/devices/:installationId/status` | 端末ステータス更新 |
| GET | `/points/balance` | ポイント残高 |
| GET | `/points/history` | ポイント履歴 |
| GET | `/rank/current` | ランク情報 |
| GET | `/notifications` | 通知一覧 |

---

## 認証フロー

```
[アプリ起動]
    ↓
SecureStore から Refresh Token を読み出し
    ↓
POST /auth/refresh → Access Token 取得（メモリ保持）
    ↓
API リクエスト（Authorization: Bearer {access_token}）
    ↓
401 → 自動 refresh → リトライ
```

- **Access Token**: メモリ保持のみ（永続保存しない、15分有効）
- **Refresh Token**: SecureStore に保存（30日有効、ローテーション方式）
- **installation_id**: アプリ初回起動時に UUID v4 を生成し SecureStore に永続保存

---

## ディレクトリ構成

```
noodla/
├── app/                    # Expo Router — 画面ファイル（18画面）
│   ├── _layout.tsx         # ルートレイアウト
│   ├── index.tsx           # スプラッシュ
│   ├── login.tsx           # ログイン（API接続）
│   ├── register.tsx        # 新規登録（API接続）
│   ├── (tabs)/             # ボトムタブ (5画面)
│   │   ├── home.tsx        # ホーム（API接続）
│   │   ├── points.tsx      # ポイント（API接続）
│   │   ├── ai.tsx          # AIツール（モック）
│   │   ├── rank.tsx        # ランク（API接続）
│   │   └── settings.tsx    # 設定（API接続）
│   └── [モーダル画面 8ファイル]
│
├── src/
│   ├── api/                # ★ Phase 3: API クライアント
│   │   ├── client.ts       #   fetch ラッパー（401自動リトライ）
│   │   └── config.ts       #   API切替フラグ
│   ├── transport/          # ★ Phase 7-A: トランスポート抽象化
│   │   ├── ITransport.ts   #   インターフェース定義
│   │   ├── WsTransport.ts  #   WebSocket 実装
│   │   └── index.ts        #   singleton export
│   ├── lib/                # ★ Phase 7-A: 共有ライブラリ
│   │   └── queryClient.ts  #   QueryClient singleton
│   ├── stores/             # ★ Phase 3: Zustand ストア
│   │   ├── auth-store.ts   #   認証状態
│   │   ├── node-store.ts   #   ノード参加状態
│   │   ├── installation-store.ts  # installation_id
│   │   └── ws-store.ts     #   WebSocket 状態（ITransport 経由）
│   ├── hooks/              # ★ Phase 3: TanStack Query hooks
│   │   ├── usePoints.ts
│   │   ├── useRank.ts
│   │   ├── useNotifications.ts
│   │   ├── useDevices.ts
│   │   └── useInAppNotification.ts # ★ Phase 7-B: WS 通知受信フック
│   ├── components/         # 再利用UIコンポーネント
│   ├── context/            # AppContext（Phase 1 残、段階的に移行）
│   ├── mock/               # モックデータ（API切替で共存）
│   ├── theme/              # デザインシステム
│   └── types/              # TypeScript型定義
│
├── server/                 # ★ Phase 3: Hono バックエンド
│   ├── src/
│   │   ├── index.ts        # Hono サーバー起動
│   │   ├── routes/         # API ルーティング（6ファイル）
│   │   ├── db/             # Drizzle スキーマ + migration + seed
│   │   ├── middleware/     # 認証 + レート制限
│   │   ├── services/       # ビジネスロジック
│   │   └── lib/            # JWT + バリデーション
│   ├── tests/              # API テスト（28件）
│   ├── data/               # SQLite DB（.gitignore 対象）
│   └── package.json
│
├── docs/
│   ├── PHASE2-DESIGN.md    # Phase 2 設計書
│   ├── PHASE3-REPORT.md    # Phase 3 実装レポート
│   ├── PHASE4-DESIGN.md    # Phase 4 設計書（WebSocket中継方式）
│   ├── PHASE5-REPORT.md    # Phase 5 実装レポート（WebSocketリアルタイム疎通）
│   ├── PHASE5-TESTING.md   # Phase 5 テスト手順書
│   ├── PHASE6-REPORT.md    # Phase 6 実装レポート（報酬実感の本実装）
│   ├── PHASE6-TESTING.md   # Phase 6 テスト手順書
│   ├── PHASE7-DESIGN.md    # Phase 7 設計書（ITransport + Push通知）
│   └── PHASE7-REPORT.md    # Phase 7 実装レポート
│
└── package.json            # ルート（フロントエンド）
```

---

## フェーズ進捗

| フェーズ | ステータス | 内容 |
|---------|----------|------|
| Phase 1 | ✅ 完了 | UIプロトタイプ 18画面 + モックデータ |
| Phase 2 | ✅ 完了 | 設計書（認証・データモデル・API・VPS構成） |
| Phase 3 | ✅ 完了 | バックエンド実装 + フロント API 接続 |
| Phase 4 | ✅ 完了 | 最小分散疎通の技術方針（WebSocket中継方式を選定） |
| Phase 5 | ✅ 完了 | WebSocket リアルタイム疎通（2台スマホでの疑似ジョブ往復） |
| Phase 6 | ✅ 完了 | 報酬実感の本実装（ポイント本運用 + ランク自動化 + WS状態見える化） |
| Phase 7 | ✅ 完了 | ITransport 抽象化 + Push 通知（WS リアルタイム + expo-notifications） |
| Phase 8 | 📋 計画 | WebRTC DataChannel 移行・Expo Push API サーバーサイド連携 |

---

## ライセンス

MIT License — see [LICENSE](LICENSE)
