# Noodla — ディレクトリ構成

> Phase 1 UIプロトタイプ時点のディレクトリツリー

```
noodla/
├── app/                          # Expo Router — 画面ファイル
│   ├── _layout.tsx               # ルートレイアウト (Stack navigator + AppProvider)
│   ├── index.tsx                 # スプラッシュ / 起動ゲート
│   ├── onboarding.tsx            # オンボーディング（3ステップ）
│   ├── login.tsx                 # ログイン画面
│   ├── register.tsx              # 新規登録画面
│   ├── participation.tsx         # 参加状況詳細
│   ├── points.tsx                # ポイント履歴（旧スタック版、後方互換用）
│   ├── chat.tsx                  # AIチャット
│   ├── summarize.tsx             # 文章要約
│   ├── translate.tsx             # 翻訳
│   ├── draft.tsx                 # 文章生成
│   ├── supporter.tsx             # サポータープラン
│   ├── connection.tsx            # 接続・デバイス情報
│   ├── notifications.tsx         # 通知履歴
│   ├── error.tsx                 # エラー画面
│   └── (tabs)/                   # ボトムタブナビ
│       ├── _layout.tsx           # タブ定義 (5タブ)
│       ├── home.tsx              # ホーム
│       ├── points.tsx            # ポイント残高・収支・履歴 ★新規追加
│       ├── ai.tsx                # AIツール一覧
│       ├── rank.tsx              # ランキング
│       └── settings.tsx          # 設定
│
├── src/                          # 共通ロジック・UIライブラリ
│   ├── components/
│   │   ├── cards/
│   │   │   ├── InfoCard.tsx          # 汎用情報カード
│   │   │   ├── PointHistoryRow.tsx   # ポイント取引履歴の1行
│   │   │   ├── RankProgressCard.tsx  # ランク進捗バー
│   │   │   ├── StatCard.tsx          # 統計値ミニカード
│   │   │   ├── StatusCard.tsx        # ネットワーク参加状態カード
│   │   │   └── index.ts
│   │   └── ui/
│   │       ├── Badge.tsx             # バッジ (rank/supporter/status)
│   │       ├── Button.tsx            # 汎用ボタン
│   │       ├── Input.tsx             # テキスト入力
│   │       ├── ScreenContainer.tsx   # 画面ラッパー
│   │       └── index.ts
│   ├── context/
│   │   └── AppContext.tsx            # グローバル状態 (user/points/network/settings)
│   ├── mock/
│   │   ├── ai.ts                     # AIフィーチャー・チャット履歴・生成結果
│   │   ├── network.ts                # ネットワーク参加状態・接続情報
│   │   ├── notifications.ts          # 通知リスト
│   │   ├── points.ts                 # ポイント残高・取引履歴
│   │   └── user.ts                   # ユーザープロフィール・統計
│   ├── theme/
│   │   ├── colors.ts                 # カラーパレット
│   │   ├── spacing.ts                # スペーシング (4px基準)
│   │   ├── typography.ts             # タイポグラフィ定義
│   │   └── index.ts
│   ├── types/
│   │   ├── ai.ts                     # AIFeature, ChatMessage
│   │   ├── network.ts                # NetworkStatus, ConnectionInfo
│   │   ├── points.ts                 # PointsData, PointTransaction
│   │   ├── user.ts                   # User, UserStats
│   │   └── index.ts
│   └── utils/
│       └── format.ts                 # 表示用フォーマット関数
│
├── assets/                       # 静的アセット
│   ├── icon.png
│   ├── splash-icon.png
│   ├── adaptive-icon.png
│   └── favicon.png
│
├── docs/                         # ドキュメント
│   ├── DIRECTORY.md              # 本ファイル
│   ├── MOCK-DATA.md              # モックデータ構成一覧
│   ├── SCREEN-FLOW.md            # 画面遷移一覧
│   └── TODO-PHASE2.md            # Phase 2 実装予定一覧
│
├── App.tsx                       # Expo エントリーポイント
├── index.ts                      # Metro バンドラーエントリー
├── app.json                      # Expo 設定
├── package.json
├── tsconfig.json
└── .gitignore
```

## 画面数カウント

| カテゴリ | ファイル | 画面数 |
|---|---|---|
| 認証フロー | index, onboarding, login, register | 4 |
| タブ (常駐) | home, points, ai, rank, settings | 5 |
| ネットワーク | participation, connection | 2 |
| ポイント | points (旧スタック版) | 1 |
| AIツール | chat, summarize, translate, draft | 4 |
| その他 | supporter, notifications, error | 3 |
| **合計** | | **19** |

> ※ `app/points.tsx`（旧スタック版）と `app/(tabs)/points.tsx`（タブ版）は別カウント
