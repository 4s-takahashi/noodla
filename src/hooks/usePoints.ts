import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { USE_REAL_API } from '../api/config';
import { mockPointsData } from '../mock/points';

export interface PointsBalance {
  balance: number;
  today: number;
  week: number;
  month: number;
}

export interface PointsTransaction {
  id: string;
  type: string;
  amount: number;
  balance_after: number;
  description: string;
  created_at: string;
}

export interface PointsHistory {
  items: PointsTransaction[];
  total: number;
  has_more: boolean;
}

export function usePointsBalance() {
  return useQuery<PointsBalance>({
    queryKey: ['points', 'balance'],
    queryFn: () => {
      if (!USE_REAL_API) {
        return Promise.resolve({
          balance: mockPointsData.balance,
          today: mockPointsData.today,
          week: mockPointsData.week,
          month: mockPointsData.month,
        });
      }
      return api.get<PointsBalance>('/points/balance');
    },
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}

export function usePointsHistory(page = 0, limit = 20) {
  return useQuery<PointsHistory>({
    queryKey: ['points', 'history', page, limit],
    queryFn: () => {
      if (!USE_REAL_API) {
        const offset = page * limit;
        const items = mockPointsData.history.slice(offset, offset + limit);
        return Promise.resolve({
          items: items.map(tx => ({
            id: tx.id,
            type: tx.type,
            amount: tx.amount,
            balance_after: mockPointsData.balance,
            description: tx.description,
            created_at: tx.date,
          })),
          total: mockPointsData.history.length,
          has_more: offset + limit < mockPointsData.history.length,
        });
      }
      return api.get<PointsHistory>(`/points/history?limit=${limit}&offset=${page * limit}`);
    },
    staleTime: 30_000,
  });
}
