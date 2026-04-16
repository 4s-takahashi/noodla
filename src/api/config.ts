// API 接続設定
// 開発時: モックがデフォルト。EXPO_PUBLIC_USE_REAL_API=true で実APIへ切り替え
// 本番時: 常に実APIを使用

declare const __DEV__: boolean;

export const USE_REAL_API =
  !__DEV__ || process.env.EXPO_PUBLIC_USE_REAL_API === 'true';

export const API_BASE_URL = __DEV__
  ? 'http://localhost:3001/api/v1'
  : (process.env.EXPO_PUBLIC_API_URL ?? 'https://api.noodla.app/api/v1');
