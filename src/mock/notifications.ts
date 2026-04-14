export interface Notification {
  id: string;
  type: 'rank_up' | 'points' | 'maintenance' | 'admin' | 'milestone';
  title: string;
  body: string;
  date: string;
  read: boolean;
  icon: string;
}

export const mockNotifications: Notification[] = [
  {
    id: 'notif-001',
    type: 'rank_up',
    title: 'ランクアップ！',
    body: 'おめでとうございます！Bronzeランクから Silverランクに昇格しました。ボーナス 50pt を獲得しました！',
    date: '2026-04-10T09:00:00',
    read: false,
    icon: 'trophy',
  },
  {
    id: 'notif-002',
    type: 'points',
    title: 'ポイント獲得',
    body: '本日のネットワーク参加で 24pt を獲得しました。継続してご参加ください！',
    date: '2026-04-13T21:00:00',
    read: false,
    icon: 'star',
  },
  {
    id: 'notif-003',
    type: 'milestone',
    title: '参加日数 90日達成間近！',
    body: '連続参加まであと3日で 90日を達成します。特別ボーナスポイントが付与されます。',
    date: '2026-04-13T12:00:00',
    read: true,
    icon: 'flame',
  },
  {
    id: 'notif-004',
    type: 'admin',
    title: 'サービスアップデート',
    body: 'Noodla v2.0 をリリースしました。新機能として画像生成AIが追加されます（今後のアップデートで解放予定）。',
    date: '2026-04-08T10:00:00',
    read: true,
    icon: 'information-circle',
  },
  {
    id: 'notif-005',
    type: 'maintenance',
    title: 'メンテナンスのお知らせ',
    body: '4月20日 02:00〜04:00 の間、システムメンテナンスを実施します。参加ポイントは補填されます。',
    date: '2026-04-06T15:00:00',
    read: true,
    icon: 'construct',
  },
  {
    id: 'notif-006',
    type: 'milestone',
    title: 'サブノード候補に選出！',
    body: '高い参加率と安定性が認められ、サブノード候補に選出されました。引き続き安定した参加をお願いします。',
    date: '2026-04-05T09:00:00',
    read: true,
    icon: 'globe',
  },
];
