export type ParticipationStatus = 'active' | 'standby' | 'power_save' | 'offline';
export type JobType = 'text_analysis' | 'image_processing' | 'data_classification' | 'idle';

export interface NetworkStatus {
  globalNodes: number;
  status: ParticipationStatus;
  currentJob: JobType | null;
  wifiConnected: boolean;
  wifiStrength: 'excellent' | 'good' | 'fair' | 'poor';
  wifiName: string;
  isCharging: boolean;
  batteryLevel: number;
  cpuUsage: number;
  memoryUsage: number;
  uptime: number; // minutes
  todayParticipationTime: number; // minutes
  avgParticipationTime: number; // minutes
  recentSuccessCount: number;
  subNodeCandidate: boolean;
  reconnectCount: number;
  stability: number; // 0-100
  participationEligible: boolean;
  ineligibilityReason?: string;
}

export interface ConnectionInfo {
  wifiName: string;
  wifiStrength: 'excellent' | 'good' | 'fair' | 'poor';
  isConnected: boolean;
  reconnectCount: number;
  stability: number;
  lastConnected: string;
  participationEligible: boolean;
  ineligibilityReason?: string;
  improvementHints: string[];
}
