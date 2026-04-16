import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { USE_REAL_API } from '../api/config';
import { mockUser } from '../mock/user';

export interface ApiDevice {
  id: string;
  installation_id: string;
  device_name: string;
  os: 'ios' | 'android';
  os_version: string;
  app_version: string;
  is_active: boolean;
  last_seen_at: string;
  created_at: string;
}

export interface DevicesResponse {
  items: ApiDevice[];
  total: number;
}

export function useDevices() {
  return useQuery<DevicesResponse>({
    queryKey: ['devices'],
    queryFn: () => {
      if (!USE_REAL_API) {
        return Promise.resolve({
          items: [{
            id: 'mock-device-001',
            installation_id: 'mock-install-id',
            device_name: mockUser.deviceName,
            os: 'ios' as const,
            os_version: '18.2',
            app_version: '1.0.0',
            is_active: true,
            last_seen_at: new Date().toISOString(),
            created_at: mockUser.joinedAt,
          }],
          total: 1,
        });
      }
      return api.get<DevicesResponse>('/devices');
    },
    staleTime: 5 * 60_000,
  });
}
