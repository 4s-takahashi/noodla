import { describe, it, expect, beforeAll } from 'vitest';
import { createTestApp, fetchApp } from './helpers/test-app.js';

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

describe('Notifications API', () => {
  let accessToken: string;
  let notifId: string;

  beforeAll(async () => {
    const email = `notif-test-${Date.now()}@example.com`;
    const res = await post('/api/v1/auth/register', {
      email,
      password: 'password123',
      name: 'Notif Test User',
    });
    const body = await res.json() as any;
    accessToken = body.access_token;
  });

  it('GET /api/v1/notifications — returns notifications list', async () => {
    const res = await get('/api/v1/notifications', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.unread_count).toBeDefined();
    expect(body.total).toBeDefined();

    // Register creates a welcome notification
    expect(body.total).toBeGreaterThanOrEqual(1);
    notifId = body.items[0]?.id;
  });

  it('GET /api/v1/notifications — requires auth', async () => {
    const res = await get('/api/v1/notifications');
    expect(res.status).toBe(401);
  });

  it('PATCH /api/v1/notifications/:id/read — marks notification as read', async () => {
    if (!notifId) return; // skip if no notifications
    const res = await patch(`/api/v1/notifications/${notifId}/read`, {}, accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.message).toBeDefined();

    // Verify unread count decreased
    const listRes = await get('/api/v1/notifications', accessToken);
    const listBody = await listRes.json() as any;
    const notif = listBody.items.find((n: any) => n.id === notifId);
    expect(notif?.is_read).toBe(true);
  });

  it('POST /api/v1/notifications/read-all — marks all as read', async () => {
    const res = await post('/api/v1/notifications/read-all', {}, accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);

    // Verify unread_count is 0
    const listRes = await get('/api/v1/notifications', accessToken);
    const listBody = await listRes.json() as any;
    expect(listBody.unread_count).toBe(0);
  });
});
