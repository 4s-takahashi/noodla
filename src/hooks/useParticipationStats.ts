/**
 * useParticipationStats.ts — Phase 6 累積参加統計フック
 *
 * GET /rank/participation-stats から累積uptime、ジョブ統計、
 * ランクスコア情報を取得する
 */

import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import { USE_REAL_API } from '../api/config';

export interface ParticipationStats {
  total_uptime_minutes: number;
  today_uptime_minutes: number;
  total_jobs_processed: number;
  avg_response_ms: number;
  rank_score: number;
  rank: string;
  next_rank_score: number;
  consecutive_days: number;
  total_days_active: number;
}

/** 分を「Xh Ym」の形式に変換 */
export function formatUptimeMinutes(minutes: number): string {
  if (minutes <= 0) return '0分';
  const h = Math.floor(minutes / 60);
  const m = Math.floor(minutes % 60);
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
}

/** ms を「X.Xms」や「Xs」に変換 */
export function formatResponseMs(ms: number): string {
  if (ms <= 0) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

export function useParticipationStats() {
  return useQuery<ParticipationStats>({
    queryKey: ['participation', 'stats'],
    queryFn: () => {
      if (!USE_REAL_API) {
        // モックデータ
        return Promise.resolve({
          total_uptime_minutes: 320,
          today_uptime_minutes: 45,
          total_jobs_processed: 128,
          avg_response_ms: 87,
          rank_score: 340,
          rank: 'Bronze',
          next_rank_score: 1_000,
          consecutive_days: 5,
          total_days_active: 12,
        });
      }
      return api.get<ParticipationStats>('/rank/participation-stats');
    },
    staleTime: 60_000,        // 1分キャッシュ
    refetchInterval: 5 * 60_000, // 5分ごとに自動更新
  });
}
