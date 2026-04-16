import { create } from 'zustand';
import { api } from '../api/client';
import { USE_REAL_API } from '../api/config';
import { mockNetworkStatus } from '../mock/network';
import { useInstallationStore } from './installation-store';

export type ParticipationStatus =
  | 'active'
  | 'standby'
  | 'power_save'
  | 'offline'
  | 'unstable'
  | 'ineligible';

export interface NodeState {
  status: ParticipationStatus;
  wifiConnected: boolean;
  wifiStrength: 'excellent' | 'good' | 'fair' | 'poor';
  wifiName: string | null;
  isCharging: boolean;
  batteryLevel: number;
  cpuUsage: number;
  memoryUsage: number;
  todayUptimeMinutes: number;
  totalUptimeMinutes: number;
  globalNodes: number;
  isParticipating: boolean;
}

interface NodeStore extends NodeState {
  isLoading: boolean;
  error: string | null;

  // Actions
  fetchNodeState: () => Promise<void>;
  updateStatus: (status: ParticipationStatus) => void;
  startParticipation: () => void;
  stopParticipation: () => void;
  sendHeartbeat: (metrics?: Partial<NodeMetrics>) => Promise<void>;
  fetchGlobalStats: () => Promise<void>;
}

export interface NodeMetrics {
  wifi_connected: boolean;
  wifi_strength: 'excellent' | 'good' | 'fair' | 'poor';
  wifi_name?: string | null;
  is_charging: boolean;
  battery_level: number;
  cpu_usage: number;
  memory_usage: number;
}

export const useNodeStore = create<NodeStore>((set, get) => ({
  // Initial state from mock data
  status: 'offline',
  wifiConnected: mockNetworkStatus.wifiConnected,
  wifiStrength: mockNetworkStatus.wifiStrength as 'excellent' | 'good' | 'fair' | 'poor',
  wifiName: mockNetworkStatus.wifiName,
  isCharging: mockNetworkStatus.isCharging,
  batteryLevel: mockNetworkStatus.batteryLevel,
  cpuUsage: mockNetworkStatus.cpuUsage,
  memoryUsage: mockNetworkStatus.memoryUsage,
  todayUptimeMinutes: mockNetworkStatus.todayParticipationTime,
  totalUptimeMinutes: mockNetworkStatus.uptime,
  globalNodes: mockNetworkStatus.globalNodes,
  isParticipating: false,
  isLoading: false,
  error: null,

  fetchNodeState: async () => {
    if (!USE_REAL_API) {
      set({
        status: mockNetworkStatus.status as ParticipationStatus,
        wifiConnected: mockNetworkStatus.wifiConnected,
        batteryLevel: mockNetworkStatus.batteryLevel,
        cpuUsage: mockNetworkStatus.cpuUsage,
        memoryUsage: mockNetworkStatus.memoryUsage,
        globalNodes: mockNetworkStatus.globalNodes,
        isParticipating: mockNetworkStatus.status === 'active',
      });
      return;
    }

    try {
      set({ isLoading: true });
      const state = await api.get<{
        status: ParticipationStatus;
        wifi_connected: boolean;
        wifi_strength: 'excellent' | 'good' | 'fair' | 'poor';
        wifi_name: string | null;
        is_charging: boolean;
        battery_level: number;
        cpu_usage: number;
        memory_usage: number;
        today_uptime_minutes: number;
        total_uptime_minutes: number;
      }>('/node/state');

      set({
        status: state.status,
        wifiConnected: state.wifi_connected,
        wifiStrength: state.wifi_strength ?? 'fair',
        wifiName: state.wifi_name,
        isCharging: state.is_charging ?? false,
        batteryLevel: state.battery_level,
        cpuUsage: state.cpu_usage,
        memoryUsage: state.memory_usage,
        todayUptimeMinutes: state.today_uptime_minutes,
        totalUptimeMinutes: state.total_uptime_minutes,
        isParticipating: state.status === 'active',
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, error: err.message });
    }
  },

  updateStatus: (status) => {
    set({ status, isParticipating: status === 'active' });
  },

  startParticipation: () => {
    set({ status: 'active', isParticipating: true });
  },

  stopParticipation: () => {
    set({ status: 'standby', isParticipating: false });
  },

  sendHeartbeat: async (metrics) => {
    if (!USE_REAL_API) {
      // Mock toggle for dev
      const current = get().status;
      const next: ParticipationStatus = current === 'active' ? 'standby' : 'active';
      set({ status: next, isParticipating: next === 'active' });
      return;
    }

    try {
      const installationId = await useInstallationStore.getState().ensureInstallationId();
      const state = get();

      const res = await api.put<{
        status: ParticipationStatus;
        assigned_job: null;
        server_time: string;
      }>('/node/state', {
        installation_id: installationId,
        status: state.status,
        wifi_connected: metrics?.wifi_connected ?? state.wifiConnected,
        wifi_strength: metrics?.wifi_strength ?? state.wifiStrength,
        wifi_name: metrics?.wifi_name ?? state.wifiName,
        is_charging: metrics?.is_charging ?? state.isCharging,
        battery_level: metrics?.battery_level ?? state.batteryLevel,
        cpu_usage: metrics?.cpu_usage ?? state.cpuUsage,
        memory_usage: metrics?.memory_usage ?? state.memoryUsage,
      });

      set({ status: res.status, isParticipating: res.status === 'active' });
    } catch (err: any) {
      console.warn('Heartbeat failed:', err.message);
    }
  },

  fetchGlobalStats: async () => {
    if (!USE_REAL_API) {
      set({ globalNodes: mockNetworkStatus.globalNodes });
      return;
    }

    try {
      const stats = await api.get<{ global_nodes: number; active_nodes: number }>('/node/stats');
      set({ globalNodes: stats.global_nodes });
    } catch {
      // Ignore stats fetch errors
    }
  },
}));
