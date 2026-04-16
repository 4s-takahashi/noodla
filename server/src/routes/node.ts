import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { devices, nodeParticipationStates } from '../db/schema.js';
import { authMiddleware } from '../middleware/auth.js';
import { nodeStateSchema } from '../lib/validator.js';
import { v4 as uuidv4 } from 'uuid';

const node = new Hono();

node.use('*', authMiddleware);

// PUT /node/state — update participation state (heartbeat)
node.put('/state', async (c) => {
  const userId = c.get('userId') as string;
  const body = await c.req.json().catch(() => null);
  const parsed = nodeStateSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'バリデーションエラー', details: parsed.error.flatten() }, 422);
  }

  const { installation_id, status, wifi_connected, wifi_strength, wifi_name, is_charging, battery_level, cpu_usage, memory_usage } = parsed.data;
  const now = new Date().toISOString();

  // Find device
  const device = db
    .select()
    .from(devices)
    .where(and(eq(devices.user_id, userId), eq(devices.installation_id, installation_id)))
    .get();

  if (!device) {
    return c.json({ error: 'デバイスが見つかりません。先にデバイス登録してください' }, 404);
  }

  // Update device last_seen_at
  db.update(devices)
    .set({ last_seen_at: now, is_active: true })
    .where(eq(devices.id, device.id))
    .run();

  // Upsert node state
  const existingState = db
    .select()
    .from(nodeParticipationStates)
    .where(eq(nodeParticipationStates.device_id, device.id))
    .get();

  if (existingState) {
    // Calculate uptime increment if transitioning to/from active
    const wasActive = existingState.status === 'active';
    const isActive = status === 'active';
    let todayUptime = existingState.today_uptime_minutes;
    let totalUptime = existingState.total_uptime_minutes;

    if (wasActive && existingState.updated_at) {
      const lastUpdate = new Date(existingState.updated_at);
      const elapsed = (new Date().getTime() - lastUpdate.getTime()) / 60000; // minutes
      if (elapsed > 0 && elapsed < 5) { // Only count if heartbeat was recent (<5 min)
        todayUptime = Math.round(todayUptime + elapsed);
        totalUptime = Math.round(totalUptime + elapsed);
      }
    }

    db.update(nodeParticipationStates)
      .set({
        status,
        wifi_connected,
        wifi_strength,
        wifi_name: wifi_name ?? null,
        is_charging,
        battery_level,
        cpu_usage,
        memory_usage,
        today_uptime_minutes: todayUptime,
        total_uptime_minutes: totalUptime,
        session_start_at: isActive && !wasActive ? now : existingState.session_start_at,
        updated_at: now,
      })
      .where(eq(nodeParticipationStates.id, existingState.id))
      .run();
  } else {
    db.insert(nodeParticipationStates).values({
      id: uuidv4(),
      device_id: device.id,
      user_id: userId,
      status,
      wifi_connected,
      wifi_strength,
      wifi_name: wifi_name ?? null,
      is_charging,
      battery_level,
      cpu_usage,
      memory_usage,
      session_start_at: status === 'active' ? now : null,
      total_uptime_minutes: 0,
      today_uptime_minutes: 0,
      updated_at: now,
    }).run();
  }

  return c.json({
    status,
    assigned_job: null, // Phase 2: always null
    server_time: now,
  });
});

// GET /node/state — get current state
node.get('/state', async (c) => {
  const userId = c.get('userId') as string;

  // Get the most recently updated state for this user
  const state = db
    .select()
    .from(nodeParticipationStates)
    .where(eq(nodeParticipationStates.user_id, userId))
    .get();

  if (!state) {
    return c.json({
      status: 'offline',
      wifi_connected: false,
      battery_level: 100,
      cpu_usage: 0,
      memory_usage: 0,
      today_uptime_minutes: 0,
      total_uptime_minutes: 0,
    });
  }

  return c.json({
    status: state.status,
    wifi_connected: state.wifi_connected,
    wifi_strength: state.wifi_strength,
    wifi_name: state.wifi_name,
    is_charging: state.is_charging,
    battery_level: state.battery_level,
    cpu_usage: state.cpu_usage,
    memory_usage: state.memory_usage,
    today_uptime_minutes: state.today_uptime_minutes,
    total_uptime_minutes: state.total_uptime_minutes,
    session_start_at: state.session_start_at,
    updated_at: state.updated_at,
  });
});

// GET /node/stats — global stats (public)
node.get('/stats', async (c) => {
  // Count active nodes
  const activeNodes = db
    .select()
    .from(nodeParticipationStates)
    .where(eq(nodeParticipationStates.status, 'active'))
    .all()
    .length;

  const totalNodes = db
    .select()
    .from(nodeParticipationStates)
    .all()
    .length;

  return c.json({
    global_nodes: totalNodes,
    active_nodes: activeNodes,
    server_time: new Date().toISOString(),
  });
});

export default node;
