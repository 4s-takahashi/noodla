import { z } from 'zod';

// ── Auth ──────────────────────────────────────────────────────────────────────

export const registerSchema = z.object({
  email: z.string().email('有効なメールアドレスを入力してください'),
  password: z.string().min(8, 'パスワードは8文字以上で入力してください'),
  name: z.string().min(1, '名前を入力してください').max(50),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
  device_info: z.object({
    installation_id: z.string().uuid(),
    device_name: z.string().min(1),
    os: z.enum(['ios', 'android']),
    os_version: z.string().min(1),
    app_version: z.string().min(1),
    os_device_id: z.string().optional(),
  }).optional(),
});

export const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

export const logoutSchema = z.object({
  refresh_token: z.string().min(1),
});

// ── Devices ───────────────────────────────────────────────────────────────────

export const registerDeviceSchema = z.object({
  installation_id: z.string().uuid(),
  device_name: z.string().min(1),
  os: z.enum(['ios', 'android']),
  os_version: z.string().min(1),
  app_version: z.string().min(1),
  os_device_id: z.string().optional(),
  push_token: z.string().optional(),
});

export const updateDeviceStatusSchema = z.object({
  status: z.enum(['active', 'standby', 'power_save', 'offline', 'unstable', 'ineligible']),
  battery_level: z.number().int().min(0).max(100).optional(),
  wifi_connected: z.boolean().optional(),
  wifi_strength: z.enum(['excellent', 'good', 'fair', 'poor']).optional(),
  wifi_name: z.string().nullable().optional(),
  is_charging: z.boolean().optional(),
  cpu_usage: z.number().min(0).max(100).optional(),
  memory_usage: z.number().min(0).max(100).optional(),
});

// ── Node State ────────────────────────────────────────────────────────────────

export const nodeStateSchema = z.object({
  installation_id: z.string().uuid(),
  status: z.enum(['active', 'standby', 'power_save', 'offline', 'unstable', 'ineligible']),
  wifi_connected: z.boolean(),
  wifi_strength: z.enum(['excellent', 'good', 'fair', 'poor']),
  wifi_name: z.string().nullable().optional(),
  is_charging: z.boolean(),
  battery_level: z.number().int().min(0).max(100),
  cpu_usage: z.number().min(0).max(100),
  memory_usage: z.number().min(0).max(100),
});

// ── Users ─────────────────────────────────────────────────────────────────────

export const updateUserSchema = z.object({
  name: z.string().min(1).max(50).optional(),
  avatar_url: z.string().url().nullable().optional(),
});

// ── Points ────────────────────────────────────────────────────────────────────

export const pointsHistoryQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  type: z.enum(['earned', 'spent', 'bonus', 'referral', 'supporter', 'adjustment']).optional(),
});
