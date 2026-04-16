import { db, sqlite } from './index.js';
import {
  users, devices, nodeParticipationStates,
  pointsLedger, rankLedger, notifications, refreshTokens,
} from './schema.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';

async function seed() {
  console.log('🌱 Seeding database...');

  // Clear existing data (in reverse FK order)
  db.delete(refreshTokens).run();
  db.delete(notifications).run();
  db.delete(rankLedger).run();
  db.delete(pointsLedger).run();
  db.delete(nodeParticipationStates).run();
  db.delete(devices).run();
  db.delete(users).run();

  // ── User ────────────────────────────────────────────────────────────────────
  const userId = uuidv4();
  const passwordHash = await bcrypt.hash('password123', 12);
  const now = new Date().toISOString();

  db.insert(users).values({
    id: userId,
    email: 'test@example.com',
    password_hash: passwordHash,
    name: 'テストユーザー',
    rank: 'Bronze',
    is_supporter: false,
    created_at: now,
    updated_at: now,
    last_login_at: now,
  }).run();

  console.log('✅ User created: test@example.com / password123');

  // ── Device ──────────────────────────────────────────────────────────────────
  const deviceId = uuidv4();
  const installationId = uuidv4();

  db.insert(devices).values({
    id: deviceId,
    user_id: userId,
    installation_id: installationId,
    device_name: 'iPhone 15 Pro',
    os: 'ios',
    os_version: '18.2',
    app_version: '1.0.0',
    is_active: true,
    last_seen_at: now,
    created_at: now,
  }).run();

  console.log('✅ Device created:', installationId);

  // ── NodeParticipationState ───────────────────────────────────────────────────
  db.insert(nodeParticipationStates).values({
    id: uuidv4(),
    device_id: deviceId,
    user_id: userId,
    status: 'offline',
    wifi_connected: false,
    wifi_strength: 'fair',
    is_charging: false,
    battery_level: 80,
    cpu_usage: 0,
    memory_usage: 0,
    total_uptime_minutes: 347,
    today_uptime_minutes: 312,
    updated_at: now,
  }).run();

  // ── PointsLedger (5 entries) ─────────────────────────────────────────────────
  const pointsHistory = [
    { type: 'earned', amount: 8, description: 'ネットワーク参加報酬' },
    { type: 'earned', amount: 6, description: 'ネットワーク参加報酬' },
    { type: 'bonus', amount: 50, description: 'ランクアップボーナス' },
    { type: 'earned', amount: 10, description: 'ネットワーク参加報酬' },
    { type: 'earned', amount: 8, description: 'ネットワーク参加報酬（夜間）' },
  ];

  let balance = 0;
  for (const entry of pointsHistory) {
    balance += entry.amount;
    db.insert(pointsLedger).values({
      id: uuidv4(),
      user_id: userId,
      type: entry.type,
      amount: entry.amount,
      balance_after: balance,
      description: entry.description,
      created_at: new Date(Date.now() - Math.random() * 7 * 24 * 60 * 60 * 1000).toISOString(),
    }).run();
  }

  console.log(`✅ Points ledger created (${pointsHistory.length} entries, balance: ${balance})`);

  // ── RankLedger ───────────────────────────────────────────────────────────────
  db.insert(rankLedger).values({
    id: uuidv4(),
    user_id: userId,
    rank: 'Bronze',
    score: 250,
    next_rank_score: 1000,
    connection_stability: 75,
    avg_participation_hours: 2.5,
    consecutive_days: 5,
    total_days_active: 12,
    wifi_quality_score: 80,
    task_adoption_rate: 60,
    updated_at: now,
  }).run();

  console.log('✅ Rank ledger created: Bronze, score 250');

  // ── Notifications (3 entries) ────────────────────────────────────────────────
  const notifData = [
    {
      type: 'rank_up',
      title: 'ランクアップおめでとうございます！',
      body: 'Bronzeランクに昇格しました。ボーナス 50pt を獲得しました！',
    },
    {
      type: 'points',
      title: 'ポイント獲得',
      body: '本日のネットワーク参加で 8pt を獲得しました。',
    },
    {
      type: 'system',
      title: 'Noodlaへようこそ！',
      body: 'アカウントが作成されました。ネットワークに参加してポイントを獲得しましょう！',
    },
  ];

  for (const n of notifData) {
    db.insert(notifications).values({
      id: uuidv4(),
      user_id: userId,
      type: n.type,
      title: n.title,
      body: n.body,
      is_read: false,
      created_at: new Date(Date.now() - Math.random() * 3 * 24 * 60 * 60 * 1000).toISOString(),
    }).run();
  }

  console.log(`✅ Notifications created (${notifData.length} entries)`);
  console.log('\n🎉 Seed completed!');
  console.log('   Email: test@example.com');
  console.log('   Password: password123');
}

seed().catch(console.error).finally(() => sqlite.close());
