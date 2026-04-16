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

describe('Points API', () => {
  let accessToken: string;

  beforeAll(async () => {
    const email = `points-test-${Date.now()}@example.com`;
    const res = await post('/api/v1/auth/register', {
      email,
      password: 'password123',
      name: 'Points Test User',
    });
    const body = await res.json() as any;
    accessToken = body.access_token;
  });

  it('GET /api/v1/points/balance — returns zero balance for new user', async () => {
    const res = await get('/api/v1/points/balance', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.balance).toBe(0);
    expect(body.today).toBe(0);
    expect(body.week).toBe(0);
    expect(body.month).toBe(0);
  });

  it('GET /api/v1/points/history — returns empty history for new user', async () => {
    const res = await get('/api/v1/points/history', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.items).toEqual([]);
    expect(body.total).toBe(0);
    expect(body.has_more).toBe(false);
  });

  it('GET /api/v1/points/history — supports pagination params', async () => {
    const res = await get('/api/v1/points/history?limit=5&offset=0', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.items).toBeDefined();
    expect(body.total).toBeDefined();
    expect(body.has_more).toBeDefined();
  });

  it('GET /api/v1/points/balance — requires auth', async () => {
    const res = await get('/api/v1/points/balance');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/points/summary — returns summary', async () => {
    const res = await get('/api/v1/points/summary', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.total_earned).toBeDefined();
    expect(body.total_spent).toBeDefined();
  });
});
