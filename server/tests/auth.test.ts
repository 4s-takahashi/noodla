import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestApp, fetchApp } from './helpers/test-app.js';

// Use real server running on port 3001 for integration tests
// Or use Hono test client directly

const app = createTestApp();

async function post(path: string, body: unknown, token?: string) {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchApp(app, path, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

async function get(path: string, token?: string) {
  const headers: Record<string, string> = {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetchApp(app, path, { headers });
}

describe('Auth API', () => {
  const testEmail = `test-${Date.now()}@example.com`;
  const testPassword = 'password123';
  const testName = 'テストユーザー';
  let accessToken: string;
  let refreshTokenStr: string;

  it('POST /api/v1/auth/register — creates a new user', async () => {
    const res = await post('/api/v1/auth/register', {
      email: testEmail,
      password: testPassword,
      name: testName,
    });
    const body = await res.json() as any;

    expect(res.status).toBe(201);
    expect(body.user).toBeDefined();
    expect(body.user.email).toBe(testEmail);
    expect(body.user.name).toBe(testName);
    expect(body.user.rank).toBe('Bronze');
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
    expect(body.expires_in).toBe(900);

    accessToken = body.access_token;
    refreshTokenStr = body.refresh_token;
  });

  it('POST /api/v1/auth/register — rejects duplicate email', async () => {
    const res = await post('/api/v1/auth/register', {
      email: testEmail,
      password: testPassword,
      name: testName,
    });
    expect(res.status).toBe(409);
  });

  it('POST /api/v1/auth/register — rejects short password', async () => {
    const res = await post('/api/v1/auth/register', {
      email: 'another@example.com',
      password: 'short',
      name: 'User',
    });
    expect(res.status).toBe(422);
  });

  it('POST /api/v1/auth/login — succeeds with correct credentials', async () => {
    const res = await post('/api/v1/auth/login', {
      email: testEmail,
      password: testPassword,
    });
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.user).toBeDefined();
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();

    accessToken = body.access_token;
    refreshTokenStr = body.refresh_token;
  });

  it('POST /api/v1/auth/login — rejects wrong password', async () => {
    const res = await post('/api/v1/auth/login', {
      email: testEmail,
      password: 'wrongpassword',
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/login — rejects unknown email', async () => {
    const res = await post('/api/v1/auth/login', {
      email: 'nobody@example.com',
      password: testPassword,
    });
    expect(res.status).toBe(401);
  });

  it('GET /api/v1/auth/me — returns user with valid token', async () => {
    const res = await get('/api/v1/auth/me', accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.email).toBe(testEmail);
    expect(body.name).toBe(testName);
  });

  it('GET /api/v1/auth/me — rejects without token', async () => {
    const res = await get('/api/v1/auth/me');
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/refresh — returns new tokens', async () => {
    const res = await post('/api/v1/auth/refresh', {
      refresh_token: refreshTokenStr,
    });
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.access_token).toBeDefined();
    expect(body.refresh_token).toBeDefined();
    // Token should be rotated (different from old)
    expect(body.refresh_token).not.toBe(refreshTokenStr);

    accessToken = body.access_token;
    refreshTokenStr = body.refresh_token;
  });

  it('POST /api/v1/auth/refresh — rejects already-used refresh token', async () => {
    // The old refreshTokenStr was already rotated, should be invalid now
    const res = await post('/api/v1/auth/refresh', {
      refresh_token: 'invalid-token-string',
    });
    expect(res.status).toBe(401);
  });

  it('POST /api/v1/auth/logout — succeeds', async () => {
    const res = await post('/api/v1/auth/logout', {
      refresh_token: refreshTokenStr,
    }, accessToken);
    const body = await res.json() as any;

    expect(res.status).toBe(200);
    expect(body.message).toBeDefined();
  });
});
