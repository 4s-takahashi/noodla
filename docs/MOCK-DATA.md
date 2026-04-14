# Noodla — モックデータ構成一覧

> `src/mock/` 配下のモックデータファイルの概要。
> Phase 1 では全データがモック（API接続なし）。

---

## ファイル一覧

| ファイル | エクスポート | 対応型 | 用途 |
|----------|-------------|--------|------|
| `src/mock/user.ts` | `mockUser`, `mockUserStats` | `User`, `UserStats` | ユーザープロフィール・統計 |
| `src/mock/points.ts` | `mockPointsData` | `PointsData` | ポイント残高・取引履歴 |
| `src/mock/network.ts` | `mockNetworkStatus`, `mockConnectionInfo`, `jobTypeLabels` | `NetworkStatus`, `ConnectionInfo` | ネットワーク参加状態 |
| `src/mock/notifications.ts` | `mockNotifications` | `Notification[]` | 通知リスト |
| `src/mock/ai.ts` | `mockAIFeatures`, `mockChatHistory`, `mockSummarizeResult`, `mockTranslateResult`, `mockDraftResult` | `AIFeature[]`, `ChatMessage[]`, `string` | AI機能・チャット |

---

## 詳細

### `src/mock/user.ts`

**型: `User`**

```typescript
interface User {
  id: string;             // 'user-001'
  name: string;           // '田中太郎'
  email: string;          // 'tanaka@example.com'
  rank: RankLevel;        // 'Silver'
  score: number;          // 720
  nextRankScore: number;  // 1000
  points: number;         // 3250
  supporter: boolean;     // true
  supporterSince?: string;// '2025-10-01'
  joinedAt: string;       // '2025-09-15'
  deviceName: string;     // 'iPhone 15 Pro'
}
```

**型: `UserStats`**

```typescript
interface UserStats {
  todayEarned: number;       // 24
  weekEarned: number;        // 168
  monthEarned: number;       // 640
  totalEarned: number;       // 15800
  totalContributed: number;  // 1240（タスク成功数）
  daysActive: number;        // 87
}
```

**代表的な値**

| フィールド | 値 |
|-----------|-----|
| name | 田中太郎 |
| rank | Silver |
| score | 720 / 1000 (次のGoldまで) |
| points | 3,250 pt |
| supporter | true（サポーター加入済み） |
| deviceName | iPhone 15 Pro |

---

### `src/mock/points.ts`

**型: `PointsData`**

```typescript
interface PointsData {
  balance: number;           // 3250
  today: number;             // 24
  week: number;              // 168
  month: number;             // 640
  totalEarned: number;       // 15800
  totalSpent: number;        // 12550
  history: PointTransaction[];
}
```

**型: `PointTransaction`**

```typescript
interface PointTransaction {
  id: string;
  type: 'earned' | 'spent' | 'bonus';
  amount: number;            // 正 or 負の数値
  description: string;
  date: string;              // ISO 8601
  category?: string;
}
```

**取引カテゴリ一覧**

| category | 説明 | type |
|----------|------|------|
| `participation` | ネットワーク参加報酬 | earned |
| `task` | タスク完了報酬 | earned |
| `bonus` | 連続参加ボーナス等 | earned / bonus |
| `rank_bonus` | ランクアップボーナス | bonus |
| `ai_use` | AI機能利用消費 | spent |

**直近10件の履歴サンプル**

| # | 種別 | 金額 | 説明 | 日付 |
|---|------|------|------|------|
| 1 | earned | +8 | ネットワーク参加報酬 | 04/13 20:00 |
| 2 | earned | +12 | テキスト分析タスク完了 | 04/13 15:30 |
| 3 | spent | -30 | AIチャット利用 | 04/13 14:00 |
| 4 | earned | +4 | 連続参加ボーナス | 04/13 12:00 |
| 5 | earned | +25 | データ分類タスク完了 | 04/12 18:00 |
| 6 | spent | -20 | 文章要約利用 | 04/12 11:00 |
| 7 | bonus | +50 | ランクアップボーナス（Silver） | 04/10 09:00 |
| 8 | earned | +18 | ネットワーク参加報酬 | 04/09 21:00 |
| 9 | spent | -15 | 翻訳機能利用 | 04/08 16:00 |
| 10 | earned | +30 | 画像処理タスク完了 | 04/07 14:00 |

---

### `src/mock/network.ts`

**型: `NetworkStatus`**

```typescript
interface NetworkStatus {
  globalNodes: number;              // 12847
  status: ParticipationStatus;      // 'active'
  currentJob: JobType | null;       // 'text_analysis'
  wifiConnected: boolean;           // true
  wifiStrength: 'excellent'|...;    // 'excellent'
  wifiName: string;                 // 'HomeNetwork_5G'
  isCharging: boolean;              // true
  batteryLevel: number;             // 84
  cpuUsage: number;                 // 23 (%)
  memoryUsage: number;              // 41 (%)
  uptime: number;                   // 347 (分)
  todayParticipationTime: number;   // 312 (分)
  avgParticipationTime: number;     // 285 (分)
  recentSuccessCount: number;       // 47
  subNodeCandidate: boolean;        // true
  reconnectCount: number;           // 2
  stability: number;                // 96 (0-100)
  participationEligible: boolean;   // true
}
```

**参加ステータス (`ParticipationStatus`)**

| 値 | 表示 | 説明 |
|----|------|------|
| `active` | 参加中 | ネットワーク参加・タスク処理中 |
| `standby` | 待機中 | 参加可能だが現在タスクなし |
| `power_save` | 省電力 | バッテリー不足で制限中 |
| `offline` | オフライン | Wi-Fi未接続 or 手動停止 |

**ジョブタイプ (`JobType`)**

| 値 | 日本語 |
|----|--------|
| `text_analysis` | テキスト分析 |
| `image_processing` | 画像処理 |
| `data_classification` | データ分類 |
| `idle` | 待機中 |

**型: `ConnectionInfo`**

```typescript
interface ConnectionInfo {
  wifiName: string;            // 'HomeNetwork_5G'
  wifiStrength: string;        // 'excellent'
  isConnected: boolean;        // true
  reconnectCount: number;      // 2
  stability: number;           // 96
  lastConnected: string;       // '2026-04-13T08:15:00'
  participationEligible: bool; // true
  improvementHints: string[];  // 改善ヒント3件
}
```

---

### `src/mock/notifications.ts`

**型: `Notification`**

```typescript
interface Notification {
  id: string;
  type: 'rank_up' | 'points' | 'maintenance' | 'admin' | 'milestone';
  title: string;
  body: string;
  date: string;
  read: boolean;
  icon: string;  // Ionicons icon name
}
```

**6件のサンプル通知**

| # | type | title | read | 日付 |
|---|------|-------|------|------|
| 1 | rank_up | ランクアップ！ | false | 04/10 |
| 2 | points | ポイント獲得 | false | 04/13 |
| 3 | milestone | 参加日数90日達成間近！ | true | 04/13 |
| 4 | admin | サービスアップデート | true | 04/08 |
| 5 | maintenance | メンテナンスのお知らせ | true | 04/06 |
| 6 | milestone | サブノード候補に選出！ | true | 04/05 |

> `read: false` が2件 → `AppContext.unreadCount = 2`（設定タブのバッジ表示に使用）

---

### `src/mock/ai.ts`

**型: `AIFeature`**

```typescript
interface AIFeature {
  id: AIFeatureId;      // 'chat' | 'summarize' | 'translate' | 'draft'
  name: string;
  description: string;
  pointCost: number;
  icon: string;         // Ionicons icon name
  color: string;        // hex color
}
```

**4つのAI機能**

| id | 名前 | コスト | アイコン | 色 |
|----|------|--------|---------|-----|
| `chat` | AIチャット | 30pt | `chatbubbles` | `#00d2ff` (シアン) |
| `summarize` | 文章要約 | 20pt | `document-text` | `#7c3aed` (パープル) |
| `translate` | 翻訳 | 15pt | `language` | `#22c55e` (グリーン) |
| `draft` | 文章生成 | 25pt | `create` | `#f59e0b` (アンバー) |

**型: `ChatMessage`**

```typescript
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
  isProcessing?: boolean;
}
```

**チャット履歴 (3件)**

| role | 内容の概要 |
|------|-----------|
| assistant | Noodla AIアシスタントの自己紹介 |
| user | 「分散AIネットワークってどういう仕組みですか？」 |
| assistant | 分散AIの仕組み説明（約200文字） |

**モック生成結果**

| 変数名 | 内容 |
|--------|------|
| `mockSummarizeResult` | 要約結果サンプル（3点箇条書き + フッター） |
| `mockTranslateResult` | 英訳サンプル（分散AIの説明文） |
| `mockDraftResult` | ビジネスメール生成サンプル（Noodlaチームからの案内文） |

---

## AppContext での使用状況

```typescript
// src/context/AppContext.tsx
const [user] = useState<User>(mockUser);
const [networkStatus] = useState<NetworkStatus>(mockNetworkStatus);
const [pointsData] = useState<PointsData>(mockPointsData);
const [notifications] = useState<Notification[]>(mockNotifications);
const [chatHistory] = useState<ChatMessage[]>(mockChatHistory);
```

`unreadCount` = `notifications.filter(n => !n.read).length` で算出（= 2）
