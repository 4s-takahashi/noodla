import { serve } from '@hono/node-server';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import auth from './routes/auth.js';
import devicesRouter from './routes/devices.js';
import node from './routes/node.js';
import points from './routes/points.js';
import rank from './routes/rank.js';
import notificationsRouter from './routes/notifications.js';
import usersRouter from './routes/users.js';

const app = new Hono();

// ── Global Middleware ─────────────────────────────────────────────────────────

app.use('*', logger());

app.use(
  '*',
  cors({
    origin: ['http://localhost:8081', 'http://localhost:19006', 'exp://localhost:8081'],
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization'],
    credentials: true,
  }),
);

// ── Health check ──────────────────────────────────────────────────────────────

app.get('/health', (c) => c.json({ status: 'ok', version: '1.0.0', timestamp: new Date().toISOString() }));

// ── API Routes ────────────────────────────────────────────────────────────────

app.route('/api/v1/auth', auth);
app.route('/api/v1/devices', devicesRouter);
app.route('/api/v1/node', node);
app.route('/api/v1/points', points);
app.route('/api/v1/rank', rank);
app.route('/api/v1/notifications', notificationsRouter);
app.route('/api/v1/users', usersRouter);

// ── 404 handler ───────────────────────────────────────────────────────────────

app.notFound((c) => c.json({ error: 'Not Found' }, 404));

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal Server Error' }, 500);
});

// ── Start server ──────────────────────────────────────────────────────────────

const PORT = Number(process.env.PORT ?? 3001);

serve({
  fetch: app.fetch,
  port: PORT,
}, (info) => {
  console.log(`🚀 Noodla API server running on http://localhost:${info.port}`);
  console.log(`   Health: http://localhost:${info.port}/health`);
  console.log(`   API:    http://localhost:${info.port}/api/v1`);
});

export default app;
