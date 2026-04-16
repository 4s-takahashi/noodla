import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, fetchApp } from './helpers/test-app.js';
import { v4 as uuidv4 } from 'uuid';

const app = createTestApp();

async function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchApp(app, path, { method: 'POST', headers, body: JSON.stringify(body) });
}

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchApp(app, path, { headers });
}

async function patch(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchApp(app, path, { method: 'PATCH', headers, body: JSON.stringify(body) });
}

describe('Devices API', () => {
  let accessToken: string;
  const installationId = uuidv4();

  beforeAll(async () => {
    const email = `device-test-${Date.now()}@example.com`;
    const res = await post('/api/v1/auth/register', {
      email,
      password: 'password123',
      name: 'Device Test User',
    });
    const body = await res.json() as any;
    accessToken = body.access_token;
  });

  it('POST /api/v1/devices — registers a new device', async () => {
    const res = await post('/api/v1/devices', {
      installation_id: installationId,
      device_name: 'Test iPhone',
      os: 'ios',
      os_version: '18.0',
      app_version: '1.0.0',
    }, accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(201);
    expect(body.installation_id).toBe(installationId);
    expect(body.device_name).toBe('Test iPhone');
  });

  it('POST /api/v1/devices — upserts existing device (returns 200)', async () => {
    const res = await post('/api/v1/devices', {
      installation_id: installationId,
      device_name: 'Test iPhone Updated',
      os: 'ios',
      os_version: '18.1',
      app_version: '1.0.1',
    }, accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.device_name).toBe('Test iPhone Updated');
  });

  it('GET /api/v1/devices — lists user devices', async () => {
    const res = await get('/api/v1/devices', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.items).toBeDefined();
    expect(body.items.length).toBeGreaterThanOrEqual(1);
    expect(body.items[0].installation_id).toBe(installationId);
  });

  it('PATCH /api/v1/devices/:id — updates device status', async () => {
    const res = await patch(`/api/v1/devices/${installationId}`, {
      status: 'active',
      battery_level: 85,
      wifi_connected: true,
      wifi_strength: 'excellent',
      is_charging: true,
      cpu_usage: 15,
      memory_usage: 40,
    }, accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.status).toBe('active');
  });

  it('PATCH /api/v1/devices/:id — rejects invalid status', async () => {
    const res = await patch(`/api/v1/devices/${installationId}`, {
      status: 'invalid_status',
    }, accessToken);
    expect(res.status).toBe(422);
  });
});
