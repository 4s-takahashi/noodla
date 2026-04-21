import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { devices, nodeParticipationStates } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { registerDeviceSchema, updateDeviceStatusSchema } from '../lib/validator.js';
import { v4 as uuidv4 } from 'uuid';

const devicesRouter = new Hono();

// All routes require auth
devicesRouter.use('*', authMiddleware);

// POST /devices — register device
devicesRouter.post('/', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json().catch(() => null);
  const parsed = registerDeviceSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 422);
  }

  const { installation_id, device_name, os, os_version, app_version, os_device_id, push_token } = parsed.data;
  const now = new Date().toISOString();

  // Upsert device
  const existing = db
    .select()
    .from(devices)
    .where(and(eq(devices.user_id, userId), eq(devices.installation_id, installation_id)))
    .get();

  let deviceId: string;

  if (existing) {
    deviceId = existing.id;
    db.update(devices)
      .set({
        device_name,
        os_version,
        app_version,
        os_device_id: os_device_id ?? existing.os_device_id,
        push_token: push_token ?? existing.push_token,
        is_active: true,
        last_seen_at: now,
      })
      .where(eq(devices.id, deviceId))
      .run();
  } else {
    deviceId = uuidv4();
    db.insert(devices).values({
      id: deviceId,
      user_id: userId,
      installation_id,
      device_name,
      os,
      os_version,
      app_version,
      os_device_id,
      push_token,
      is_active: true,
      last_seen_at: now,
      created_at: now,
    }).run();

    // Initialize NodeParticipationState for new device
    const existingState = db
      .select()
      .from(nodeParticipationStates)
      .where(eq(nodeParticipationStates.device_id, deviceId))
      .get();

    if (!existingState) {
      db.insert(nodeParticipationStates).values({
        id: uuidv4(),
        device_id: deviceId,
        user_id: userId,
        status: 'offline',
        wifi_connected: false,
        battery_level: 100,
        cpu_usage: 0,
        memory_usage: 0,
        total_uptime_minutes: 0,
        today_uptime_minutes: 0,
        updated_at: now,
      }).run();
    }
  }

  const device = db.select().from(devices).where(eq(devices.id, deviceId)).get()!;

  return c.json({
    id: device.id,
    installation_id: device.installation_id,
    device_name: device.device_name,
    os: device.os,
    os_version: device.os_version,
    app_version: device.app_version,
    is_active: device.is_active,
    last_seen_at: device.last_seen_at,
    created_at: device.created_at,
  }, existing ? 200 : 201);
});

// GET /devices — list user's devices
devicesRouter.get('/', async (c) => {
  const userId = c.get('userId') as string;
  const userDevices = db
    .select()
    .from(devices)
    .where(eq(devices.user_id, userId))
    .all();

  return c.json({
    items: userDevices.map(d => ({
      id: d.id,
      installation_id: d.installation_id,
      device_name: d.device_name,
      os: d.os,
      os_version: d.os_version,
      app_version: d.app_version,
      is_active: d.is_active,
      last_seen_at: d.last_seen_at,
      created_at: d.created_at,
    })),
    total: userDevices.length,
  });
});

// PATCH /devices/:id — update device status (heartbeat)
devicesRouter.patch('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const installationId = c.req.param('id');
  const body = await c.req.json().catch(() => null);
  const parsed = updateDeviceStatusSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 422);
  }

  const device = db
    .select()
    .from(devices)
    .where(and(eq(devices.user_id, userId), eq(devices.installation_id, installationId)))
    .get();

  if (!device) {
    return c.json({ error: 'デバイスが見つかりません' }, 404);
  }

  const now = new Date().toISOString();

  // Update device last_seen_at
  db.update(devices)
    .set({ last_seen_at: now, is_active: true })
    .where(eq(devices.id, device.id))
    .run();

  // Update participation state
  const state = db
    .select()
    .from(nodeParticipationStates)
    .where(eq(nodeParticipationStates.device_id, device.id))
    .get();

  if (state) {
    db.update(nodeParticipationStates)
      .set({
        status: parsed.data.status,
        battery_level: parsed.data.battery_level ?? state.battery_level,
        wifi_connected: parsed.data.wifi_connected ?? state.wifi_connected,
        wifi_strength: parsed.data.wifi_strength ?? state.wifi_strength,
        wifi_name: parsed.data.wifi_name !== undefined ? parsed.data.wifi_name : state.wifi_name,
        is_charging: parsed.data.is_charging ?? state.is_charging,
        cpu_usage: parsed.data.cpu_usage ?? state.cpu_usage,
        memory_usage: parsed.data.memory_usage ?? state.memory_usage,
        updated_at: now,
      })
      .where(eq(nodeParticipationStates.id, state.id))
      .run();
  }

  return c.json({ message: 'updated', status: parsed.data.status });
});

// PATCH /devices/:id/push-token — update push token for expo-notifications
// Phase 7-B: iOS/Android のプッシュトークンを登録・更新する
devicesRouter.patch('/:id/push-token', async (c) => {
  const userId = c.get('userId') as string;
  const installationId = c.req.param('id');
  const body = await c.req.json().catch(() => null);

  if (!body || typeof body.push_token !== 'string') {
    return c.json({ error: 'push_token が必要です' }, 422);
  }

  const device = db
    .select()
    .from(devices)
    .where(and(eq(devices.user_id, userId), eq(devices.installation_id, installationId)))
    .get();

  if (!device) {
    return c.json({ error: 'デバイスが見つかりません' }, 404);
  }

  db.update(devices)
    .set({ push_token: body.push_token, last_seen_at: new Date().toISOString() })
    .where(eq(devices.id, device.id))
    .run();

  return c.json({ message: 'プッシュトークンを更新しました' });
});

// DELETE /devices/:id — remove device
devicesRouter.delete('/:id', async (c) => {
  const userId = c.get('userId') as string;
  const installationId = c.req.param('id');

  const device = db
    .select()
    .from(devices)
    .where(and(eq(devices.user_id, userId), eq(devices.installation_id, installationId)))
    .get();

  if (!device) {
    return c.json({ error: 'デバイスが見つかりません' }, 404);
  }

  db.delete(devices).where(eq(devices.id, device.id)).run();

  return c.json({ message: 'デバイスを削除しました' });
});

export default devicesRouter;
