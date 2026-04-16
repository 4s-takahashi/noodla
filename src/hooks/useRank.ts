import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { USE_REAL_API } from '../api/config';
import { mockUser } from '../mock/user';

export interface RankInfo {
  rank: string;
  score: number;
  next_rank_score: number;
  progress: number;
  evaluation: {
    processing_speed: number;
    connection_stability: number;
    avg_participation_hours: number;
    task_adoption_rate: number;
    wifi_quality: number;
    consecutive_days: number;
    total_days: number;
  };
}

export interface LeaderboardEntry {
  position: number;
  user_id: string;
  name: string;
  avatar_url?: string | null;
  rank: string;
  score: number;
}

export interface Leaderboard {
  items: LeaderboardEntry[];
  total: number;
}

export function useRank() {
  return useQuery<RankInfo>({
    queryKey: ['rank', 'current'],
    queryFn: () => {
      if (!USE_REAL_API) {
        const nextScores: Record<string, number> = {
          Bronze: 1000, Silver: 5000, Gold: 15000, Platinum: 99999,
        };
        const prevScores: Record<string, number> = {
          Bronze: 0, Silver: 1000, Gold: 5000, Platinum: 15000,
        };
        const nextScore = nextScores[mockUser.rank] ?? 1000;
        const prevScore = prevScores[mockUser.rank] ?? 0;
        const rangeSize = nextScore - prevScore;
        const progress = rangeSize > 0
          ? Math.round(((mockUser.score - prevScore) / rangeSize) * 100)
          : 100;
        return Promise.resolve({
          rank: mockUser.rank,
          score: mockUser.score,
          next_rank_score: nextScore,
          progress,
          evaluation: {
            processing_speed: 85,
            connection_stability: 75,
            avg_participation_hours: 2.5,
            task_adoption_rate: 60,
            wifi_quality: 80,
            consecutive_days: 5,
            total_days: 12,
          },
        });
      }
      return api.get<RankInfo>('/rank');
    },
    staleTime: 5 * 60_000, // 5 min
  });
}

export function useLeaderboard(limit = 20, offset = 0) {
  return useQuery<Leaderboard>({
    queryKey: ['rank', 'leaderboard', limit, offset],
    queryFn: () => {
      if (!USE_REAL_API) {
        return Promise.resolve({ items: [], total: 0 });
      }
      return api.get<Leaderboard>(`/rank/leaderboard?limit=${limit}&offset=${offset}`);
    },
    staleTime: 5 * 60_000,
  });
}
