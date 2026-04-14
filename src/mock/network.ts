import { NetworkStatus, ConnectionInfo } from '../types/network';

export const mockNetworkStatus: NetworkStatus = {
  globalNodes: 12847,
  status: 'active',
  currentJob: 'text_analysis',
  wifiConnected: true,
  wifiStrength: 'excellent',
  wifiName: 'HomeNetwork_5G',
  isCharging: true,
  batteryLevel: 84,
  cpuUsage: 23,
  memoryUsage: 41,
  uptime: 347,
  todayParticipationTime: 312,
  avgParticipationTime: 285,
  recentSuccessCount: 47,
  subNodeCandidate: true,
  reconnectCount: 2,
  stability: 96,
  participationEligible: true,
};

export const mockConnectionInfo: ConnectionInfo = {
  wifiName: 'HomeNetwork_5G',
  wifiStrength: 'excellent',
  isConnected: true,
  reconnectCount: 2,
  stability: 96,
  lastConnected: '2026-04-13T08:15:00',
  participationEligible: true,
  improvementHints: [
    'Wi-Fiルーターに近い場所でご利用ください',
    '充電中は自動的に参加が優先されます',
    'サブノード候補です！継続して参加しましょう',
  ],
};

export const jobTypeLabels: Record<string, string> = {
  text_analysis: 'テキスト分析',
  image_processing: '画像処理',
  data_classification: 'データ分類',
  idle: '待機中',
};
