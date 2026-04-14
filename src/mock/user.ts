import { User, UserStats } from '../types/user';

export const mockUser: User = {
  id: 'user-001',
  name: '田中太郎',
  email: 'tanaka@example.com',
  rank: 'Silver',
  score: 720,
  nextRankScore: 1000,
  points: 3250,
  supporter: true,
  supporterSince: '2025-10-01',
  joinedAt: '2025-09-15',
  deviceName: 'iPhone 15 Pro',
};

export const mockUserStats: UserStats = {
  todayEarned: 24,
  weekEarned: 168,
  monthEarned: 640,
  totalEarned: 15800,
  totalContributed: 1240,
  daysActive: 87,
};
