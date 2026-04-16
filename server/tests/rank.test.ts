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

describe('Rank API', () => {
  let accessToken: string;

  beforeAll(async () => {
    const email = `rank-test-${Date.now()}@example.com`;
    const res = await post('/api/v1/auth/register', {
      email,
      password: 'password123',
      name: 'Rank Test User',
    });
    const body = await res.json() as any;
    accessToken = body.access_token;
  });

  it('GET /api/v1/rank — returns rank info for new user (Bronze)', async () => {
    const res = await get('/api/v1/rank', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.rank).toBe('Bronze');
    expect(body.score).toBe(0);
    expect(body.next_rank_score).toBe(1000);
    expect(body.progress).toBe(0);
    expect(body.evaluation).toBeDefined();
  });

  it('GET /api/v1/rank — requires auth', async () => {
    const res = await get('/api/v1/rank');
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/rank/leaderboard — returns leaderboard', async () => {
    const res = await get('/api/v1/rank/leaderboard', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.items).toBeDefined();
    expect(Array.isArray(body.items)).toBe(true);
    expect(body.total).toBeDefined();
  });
});
