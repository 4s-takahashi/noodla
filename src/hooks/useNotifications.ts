import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../api/client';
import { USE_REAL_API } from '../api/config';
import { mockNotifications } from '../mock/notifications';

export interface ApiNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
}

export interface NotificationsResponse {
  items: ApiNotification[];
  unread_count: number;
  total: number;
  has_more: boolean;
}

export function useNotifications(limit = 20) {
  return useQuery<NotificationsResponse>({
    queryKey: ['notifications'],
    queryFn: () => {
      if (!USE_REAL_API) {
        const unreadCount = mockNotifications.filter(n => !n.read).length;
        return Promise.resolve({
          items: mockNotifications.map(n => ({
            id: n.id,
            type: n.type,
            title: n.title,
            body: n.body,
            is_read: n.read,
            created_at: n.date,
          })),
          unread_count: unreadCount,
          total: mockNotifications.length,
          has_more: false,
        });
      }
      return api.get<NotificationsResponse>(`/notifications?limit=${limit}`);
    },
    staleTime: 30_000,
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notifId: string) => {
      if (!USE_REAL_API) return Promise.resolve();
      return api.patch(`/notifications/${notifId}/read`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => {
      if (!USE_REAL_API) return Promise.resolve();
      return api.post('/notifications/read-all');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}
