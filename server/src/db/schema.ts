import { sqliteTable, text, integer, real, uniqueIndex, index } from 'drizzle-orm/sqlite-core';
import { sql } from 'drizzle-orm';

// ── Users ─────────────────────────────────────────────────────────────────────

export const users = sqliteTable(
  'users',
  {
    id: text('id').primaryKey(),
    email: text('email').notNull().unique(),
    password_hash: text('password_hash').notNull(),
    name: text('name').notNull(),
    avatar_url: text('avatar_url'),
    rank: text('rank').notNull().default('Bronze'),
    is_supporter: integer('is_supporter', { mode: 'boolean' }).notNull().default(false),
    supporter_since: text('supporter_since'),
    created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
    last_login_at: text('last_login_at'),
  },
);

// ── Devices ───────────────────────────────────────────────────────────────────

export const devices = sqliteTable(
  'devices',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    installation_id: text('installation_id').notNull(),
    device_name: text('device_name').notNull(),
    os: text('os', { enum: ['ios', 'android'] }).notNull(),
    os_version: text('os_version').notNull(),
    app_version: text('app_version').notNull(),
    os_device_id: text('os_device_id'),
    push_token: text('push_token'),
    is_active: integer('is_active', { mode: 'boolean' }).notNull().default(true),
    last_seen_at: text('last_seen_at').notNull().default(sql`(datetime('now'))`),
    created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    userIdIdx: index('idx_devices_user_id').on(t.user_id),
    userInstallUniq: uniqueIndex('idx_devices_user_install').on(t.user_id, t.installation_id),
  }),
);

// ── NodeParticipationState ────────────────────────────────────────────────────

export const nodeParticipationStates = sqliteTable(
  'node_participation_states',
  {
    id: text('id').primaryKey(),
    device_id: text('device_id').notNull().references(() => devices.id, { onDelete: 'cascade' }),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    status: text('status').notNull().default('offline'),
    wifi_connected: integer('wifi_connected', { mode: 'boolean' }).notNull().default(false),
    wifi_strength: text('wifi_strength').default('fair'),
    wifi_name: text('wifi_name'),
    is_charging: integer('is_charging', { mode: 'boolean' }).notNull().default(false),
    battery_level: integer('battery_level').notNull().default(100),
    cpu_usage: real('cpu_usage').notNull().default(0),
    memory_usage: real('memory_usage').notNull().default(0),
    current_job_id: text('current_job_id'),
    session_start_at: text('session_start_at'),
    total_uptime_minutes: integer('total_uptime_minutes').notNull().default(0),
    today_uptime_minutes: integer('today_uptime_minutes').notNull().default(0),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    deviceIdUniq: uniqueIndex('idx_nps_device_id').on(t.device_id),
    userIdIdx: index('idx_nps_user_id').on(t.user_id),
    statusIdx: index('idx_nps_status').on(t.status),
  }),
);

// ── PointsLedger ──────────────────────────────────────────────────────────────

export const pointsLedger = sqliteTable(
  'points_ledger',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    amount: integer('amount').notNull(),
    balance_after: integer('balance_after').notNull(),
    description: text('description').notNull(),
    related_job_id: text('related_job_id'),
    related_device_id: text('related_device_id'),
    created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    userIdIdx: index('idx_points_user_id').on(t.user_id),
    createdAtIdx: index('idx_points_created_at').on(t.created_at),
    userTypeIdx: index('idx_points_user_type').on(t.user_id, t.type),
  }),
);

// ── RankLedger ────────────────────────────────────────────────────────────────

export const rankLedger = sqliteTable(
  'rank_ledger',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().unique().references(() => users.id, { onDelete: 'cascade' }),
    rank: text('rank').notNull().default('Bronze'),
    score: integer('score').notNull().default(0),
    next_rank_score: integer('next_rank_score').notNull().default(1000),
    avg_processing_speed: real('avg_processing_speed').notNull().default(0),
    connection_stability: real('connection_stability').notNull().default(0),
    avg_participation_hours: real('avg_participation_hours').notNull().default(0),
    task_adoption_rate: real('task_adoption_rate').notNull().default(0),
    wifi_quality_score: real('wifi_quality_score').notNull().default(0),
    consecutive_days: integer('consecutive_days').notNull().default(0),
    total_days_active: integer('total_days_active').notNull().default(0),
    rank_changed_at: text('rank_changed_at'),
    updated_at: text('updated_at').notNull().default(sql`(datetime('now'))`),
  },
);

// ── Notifications ─────────────────────────────────────────────────────────────

export const notifications = sqliteTable(
  'notifications',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    type: text('type').notNull(),
    title: text('title').notNull(),
    body: text('body').notNull(),
    is_read: integer('is_read', { mode: 'boolean' }).notNull().default(false),
    created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    userIdIdx: index('idx_notif_user_id').on(t.user_id),
    userUnreadIdx: index('idx_notif_user_unread').on(t.user_id, t.is_read),
  }),
);

// ── RefreshTokens ─────────────────────────────────────────────────────────────

export const refreshTokens = sqliteTable(
  'refresh_tokens',
  {
    id: text('id').primaryKey(),
    user_id: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
    token_hash: text('token_hash').notNull(),
    device_id: text('device_id').references(() => devices.id),
    expires_at: text('expires_at').notNull(),
    revoked_at: text('revoked_at'),
    created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    userIdIdx: index('idx_rt_user_id').on(t.user_id),
    tokenHashIdx: index('idx_rt_token_hash').on(t.token_hash),
  }),
);

// ── JobEvents ─────────────────────────────────────────────────────────────────

export const jobEvents = sqliteTable(
  'job_events',
  {
    id: text('id').primaryKey(),
    job_id: text('job_id').notNull(),
    job_type: text('job_type').notNull(),
    payload: text('payload').notNull(), // JSON
    user_id: text('user_id').notNull(),
    installation_id: text('installation_id').notNull(),
    assigned_at: text('assigned_at').notNull(),
    responded_at: text('responded_at'),
    result_status: text('result_status').notNull(), // 'accepted' | 'rejected' | 'timeout'
    response_ms: integer('response_ms'),
    result_data: text('result_data'), // JSON
    created_at: text('created_at').notNull().default(sql`(datetime('now'))`),
  },
  (t) => ({
    jobIdIdx: index('idx_job_events_job_id').on(t.job_id),
    userIdIdx: index('idx_job_events_user_id').on(t.user_id),
    statusIdx: index('idx_job_events_status').on(t.result_status),
    createdAtIdx: index('idx_job_events_created_at').on(t.created_at),
  }),
);

// ── Type exports ──────────────────────────────────────────────────────────────

export type JobEvent = typeof jobEvents.$inferSelect;
export type NewJobEvent = typeof jobEvents.$inferInsert;
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type Device = typeof devices.$inferSelect;
export type NewDevice = typeof devices.$inferInsert;
export type NodeParticipationState = typeof nodeParticipationStates.$inferSelect;
export type NewNodeParticipationState = typeof nodeParticipationStates.$inferInsert;
export type PointsLedgerEntry = typeof pointsLedger.$inferSelect;
export type NewPointsLedgerEntry = typeof pointsLedger.$inferInsert;
export type RankLedgerEntry = typeof rankLedger.$inferSelect;
export type NewRankLedgerEntry = typeof rankLedger.$inferInsert;
export type Notification = typeof notifications.$inferSelect;
export type NewNotification = typeof notifications.$inferInsert;
export type RefreshToken = typeof refreshTokens.$inferSelect;
export type NewRefreshToken = typeof refreshTokens.$inferInsert;
