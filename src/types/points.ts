export type TransactionType = 'earned' | 'spent' | 'bonus';

export interface PointTransaction {
  id: string;
  type: TransactionType;
  amount: number;
  description: string;
  date: string;
  category?: string;
}

export interface PointsData {
  balance: number;
  today: number;
  week: number;
  month: number;
  totalEarned: number;
  totalSpent: number;
  history: PointTransaction[];
}
