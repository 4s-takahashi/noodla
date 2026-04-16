# Noodla

> スマートフォンのアイドル時間を分散AIネットワークに提供し、ポイントを獲得してAI機能を利用できるサービス

**現在のステータス: Phase 1 — UIプロトタイプ完成（全18画面 + モックデータ）**

---

## スクリーンショット

| ホーム | ポイント | AIツール |
|--------|----------|----------|
| ![home](docs/screenshots/home.png) | ![points](docs/screenshots/points.png) | ![ai](docs/screenshots/ai.png) |

| ランク | 設定 | 参加状況 |
|--------|------|----------|
| ![rank](docs/screenshots/rank.png) | ![settings](docs/screenshots/settings.png) | ![participation](docs/screenshots/participation.png) |

> スクリーンショットは後日差し替え予定

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
- **サポーター制度** — 月額¥100で特典強化（β段階のためUI表示のみ）

---

## 画面一覧（18画面）

| # | 画面名 | ファイル | 説明 |
|---|--------|----------|------|
| 1 | スプラッシュ | `app/index.tsx` | ロゴ・アニメーション・自動遷移 |
| 2 | オンボーディング | `app/onboarding.tsx` | 3ステップのスワイプ式サービス説明 |
| 3 | ログイン | `app/login.tsx` | メール/パスワード認証フォーム |
| 4 | 新規登録 | `app/register.tsx` | ユーザー登録フォーム |
| 5 | ホーム | `app/(tabs)/home.tsx` | メイン画面：ノード数・状態・ポイント概要 |
| 6 | ポイント | `app/(tabs)/points.tsx` | ポイント残高・収支・取引履歴（タブ独立） |
| 7 | AIツール一覧 | `app/(tabs)/ai.tsx` | 利用可能なAI機能カード一覧 |
| 8 | ランク | `app/(tabs)/rank.tsx` | ランキング・スコア・進捗バー |
| 9 | 設定 | `app/(tabs)/settings.tsx` | 参加設定・アカウント管理 |
| 10 | 参加状況詳細 | `app/participation.tsx` | ネットワーク参加の詳細統計 |
| 11 | 接続詳細 | `app/connection.tsx` | Wi-Fi・接続品質・改善ヒント |
| 12 | AIチャット | `app/chat.tsx` | Noodla AIとのチャットUI |
| 13 | 文章要約 | `app/summarize.tsx` | テキスト要約ツール |
| 14 | 翻訳 | `app/translate.tsx` | 多言語翻訳ツール |
| 15 | 文章生成 | `app/draft.tsx` | テーマ・トーン指定の文章生成 |
| 16 | サポータープラン | `app/supporter.tsx` | 月額¥100のサポーター特典紹介 |
| 17 | 通知履歴 | `app/notifications.tsx` | ランクアップ・ポイント・メンテ通知 |
| 18 | エラー/待機 | `app/error.tsx` | エラー表示・再試行UI |


---

## 画面遷移図

```
[スプラッシュ]
    ↓ 自動
[オンボーディング]
    ↓ "はじめる"
[ログイン] ←→ [新規登録]
    ↓ 認証成功
╔══════════════════════════════════════╗
║  ボトムタブナビゲーション (5タブ)     ║
║  ホーム | ポイント | AI | ランク | 設定 ║
╚══════════════════════════════════════╝
    │
    ├── [ホーム]
    │       ├── → [参加状況詳細]
    │       ├── → [接続詳細]
    │       ├── → [通知履歴]
    │       ├── → [ポイント(タブ)]
    │       ├── → [AIチャット]
    │       ├── → [文章要約]
    │       ├── → [翻訳]
    │       ├── → [文章生成]
    │       └── → [サポータープラン]
    │
    ├── [ポイント]  ← 残高・収支・履歴
    │
    ├── [AIツール一覧]
    │       ├── → [AIチャット]
    │       ├── → [文章要約]
    │       ├── → [翻訳]
    │       └── → [文章生成]
    │
    ├── [ランク]
    │
    └── [設定]
            ├── → [サポータープラン]
            ├── → [ポイント(タブ)]
            ├── → [接続詳細]
            └── → [通知履歴]
```

詳細は [`docs/SCREEN-FLOW.md`](docs/SCREEN-FLOW.md) を参照。

---

## 技術スタック

| 技術 | バージョン | 用途 |
|------|-----------|------|
| React Native | 0.81.x | クロスプラットフォームUI |
| Expo SDK | 54.x | 開発環境・ネイティブAPI |
| Expo Router | 4.x | ファイルベースルーティング |
| TypeScript | 5.9.x | 型安全な開発 |
| React | 19.x | UIライブラリ |
| @expo/vector-icons | 15.x | Ioniconsアイコン |
| react-native-safe-area-context | 5.x | セーフエリア対応 |

---

## セットアップ

### 必要な環境
- Node.js 18+
- npm または yarn
- [Expo Go](https://expo.dev/client) アプリ（iOS / Android）、またはエミュレータ

### インストール & 起動

```bash
# リポジトリをクローン
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

---

## ディレクトリ構成

```
noodla/
├── app/                    # Expo Router — 画面ファイル
│   ├── _layout.tsx         # ルートレイアウト
│   ├── index.tsx           # スプラッシュ
│   ├── onboarding.tsx      # オンボーディング
│   ├── login.tsx / register.tsx
│   ├── (tabs)/             # ボトムタブ (5画面)
│   │   ├── _layout.tsx
│   │   ├── home.tsx
│   │   ├── points.tsx      # ★ Phase 1 で新規追加
│   │   ├── ai.tsx
│   │   ├── rank.tsx
│   │   └── settings.tsx
│   └── [その他モーダル画面 10ファイル]
│
├── src/
│   ├── components/         # 再利用UIコンポーネント (11ファイル)
│   ├── context/            # グローバル状態 (AppContext)
│   ├── mock/               # モックデータ (5ファイル)
│   ├── theme/              # デザインシステム (4ファイル)
│   ├── types/              # TypeScript型定義 (5ファイル)
│   └── utils/              # ユーティリティ
│
├── assets/                 # アイコン・スプラッシュ
└── docs/                   # ドキュメント
```

詳細は [`docs/DIRECTORY.md`](docs/DIRECTORY.md) を参照。

---

## モックデータ構成

| ファイル | 内容 | 主なデータ |
|----------|------|-----------|
| `src/mock/user.ts` | ユーザープロフィール | 田中太郎 / Silver / 3,250pt / サポーター |
| `src/mock/points.ts` | ポイント残高・取引履歴 | 残高3,250pt / 直近10件の履歴 |
| `src/mock/network.ts` | ネットワーク参加状態 | 12,847ノード / active / Wi-Fi接続中 |
| `src/mock/notifications.ts` | 通知リスト | 6件 (ランクアップ・ポイント・メンテ等) |
| `src/mock/ai.ts` | AIフィーチャー・応答例 | 4機能 + チャット履歴 + 生成結果サンプル |

詳細は [`docs/MOCK-DATA.md`](docs/MOCK-DATA.md) を参照。

---

## 未実装事項（Phase 2 予定）

Phase 1 はUIプロトタイプ。すべてのデータはモック（API接続なし）。

**Phase 2 優先実装:**
- 認証基盤（JWT / OAuth）
- 端末登録・ノード状態管理
- ポイント台帳・ランク台帳（バックエンド）
- API骨格設計

詳細は [`docs/TODO-PHASE2.md`](docs/TODO-PHASE2.md) を参照。

---

## ライセンス

MIT License — see [LICENSE](LICENSE)
