export const formatPoints = (points: number): string => {
  if (points >= 10000) {
    return `${(points / 10000).toFixed(1)}万 pt`;
  }
  return `${points.toLocaleString()} pt`;
};

export const formatPointsShort = (points: number): string => {
  if (Math.abs(points) >= 1000) {
    return `${(points / 1000).toFixed(1)}k`;
  }
  return points.toString();
};

export const formatNodes = (count: number): string => {
  return count.toLocaleString();
};

export const formatDate = (dateString: string): string => {
  const date = new Date(dateString);
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const hours = Math.floor(diff / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days === 0) {
    if (hours === 0) {
      const minutes = Math.floor(diff / (1000 * 60));
      return `${minutes}分前`;
    }
    return `${hours}時間前`;
  } else if (days === 1) {
    return '昨日';
  } else if (days < 7) {
    return `${days}日前`;
  }

  return date.toLocaleDateString('ja-JP', {
    month: 'short',
    day: 'numeric',
  });
};

export const formatTime = (dateString: string): string => {
  const date = new Date(dateString);
  return date.toLocaleTimeString('ja-JP', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatDuration = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  if (h === 0) return `${m}分`;
  if (m === 0) return `${h}時間`;
  return `${h}時間${m}分`;
};

export const formatPercent = (value: number, total: number): number => {
  if (total === 0) return 0;
  return Math.round((value / total) * 100);
};

export const getRankProgress = (score: number, nextRankScore: number, prevRankScore: number = 0): number => {
  const progress = ((score - prevRankScore) / (nextRankScore - prevRankScore)) * 100;
  return Math.min(100, Math.max(0, Math.round(progress)));
};

export const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    active: '参加中',
    standby: '待機中',
    power_save: '省電力モード中',
    offline: 'オフライン',
  };
  return labels[status] ?? status;
};

export const getJobLabel = (job: string | null): string => {
  if (!job) return '待機中';
  const labels: Record<string, string> = {
    text_analysis: 'テキスト分析 処理中...',
    image_processing: '画像処理 処理中...',
    data_classification: 'データ分類 処理中...',
    idle: '待機中',
  };
  return labels[job] ?? job;
};

export const getRankColor = (rank: string): string => {
  const colors: Record<string, string> = {
    Bronze: '#cd7f32',
    Silver: '#c0c0c0',
    Gold: '#ffd700',
    Platinum: '#e5e4e2',
  };
  return colors[rank] ?? '#ffffff';
};

export const getNextRank = (rank: string): string => {
  const ranks: Record<string, string> = {
    Bronze: 'Silver',
    Silver: 'Gold',
    Gold: 'Platinum',
    Platinum: 'Platinum',
  };
  return ranks[rank] ?? rank;
};
