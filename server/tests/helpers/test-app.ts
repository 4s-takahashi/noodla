import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { createTestDb } from './test-db.js';
import { setDb } from '../../src/db/index.js';
import auth from '../../src/routes/auth.js';
import devicesRouter from '../../src/routes/devices.js';
import node from '../../src/routes/node.js';
import points from '../../src/routes/points.js';
import rank from '../../src/routes/rank.js';
import notificationsRouter from '../../src/routes/notifications.js';
import usersRouter from '../../src/routes/users.js';

// テスト用インメモリDBをセットアップしてDIで差し替える
// この処理はモジュール評価時に一度だけ実行される
const { db: testDb, sqlite: testSqlite } = createTestDb();
setDb(testDb, testSqlite);

export function createTestApp() {
  const app = new Hono();

  app.use('*', cors());

  app.get('/health', (c) => c.json({ status: 'ok' }));

  app.route('/api/v1/auth', auth);
  app.route('/api/v1/devices', devicesRouter);
  app.route('/api/v1/node', node);
  app.route('/api/v1/points', points);
  app.route('/api/v1/rank', rank);
  app.route('/api/v1/notifications', notificationsRouter);
  app.route('/api/v1/users', usersRouter);

  return app;
}

export async function fetchApp(
  app: ReturnType<typeof createTestApp>,
  path: string,
  options: RequestInit = {},
): Promise<Response> {
  const req = new Request(`http://localhost${path}`, options);
  return app.fetch(req);
}
