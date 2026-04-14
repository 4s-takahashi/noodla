export type RankLevel = 'Bronze' | 'Silver' | 'Gold' | 'Platinum';

export interface User {
  id: string;
  name: string;
  email: string;
  rank: RankLevel;
  score: number;
  nextRankScore: number;
  points: number;
  supporter: boolean;
  supporterSince?: string;
  joinedAt: string;
  avatarUrl?: string;
  deviceName: string;
}

export interface UserStats {
  todayEarned: number;
  weekEarned: number;
  monthEarned: number;
  totalEarned: number;
  totalContributed: number;
  daysActive: number;
}
