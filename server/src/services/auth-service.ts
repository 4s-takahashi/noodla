import { eq, desc } from 'drizzle-orm';
import { db } from '../db/index.js';
import {
  users, devices, refreshTokens, rankLedger, notifications, pointsLedger,
  type NewUser, type NewDevice,
} from '../db/schema.js';
import bcrypt from 'bcrypt';
import { v4 as uuidv4 } from 'uuid';
import {
  signAccessToken, signRefreshToken, verifyRefreshToken,
  hashToken, ACCESS_TOKEN_EXPIRES_IN,
} from '../lib/jwt.js';

export interface AuthTokens {
  access_token: string;
  refresh_token: string;
  expires_in: number;
}

export async function registerUser(
  email: string,
  password: string,
  name: string,
): Promise<{ user: typeof users.$inferSelect; tokens: AuthTokens }> {
  const existing = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  if (existing) {
    throw Object.assign(new Error('このメールアドレスは既に使用されています'), { status: 409, code: 'EMAIL_TAKEN' });
  }

  const passwordHash = await bcrypt.hash(password, 12);
  const userId = uuidv4();
  const now = new Date().toISOString();

  const newUser: NewUser = {
    id: userId,
    email: email.toLowerCase(),
    password_hash: passwordHash,
    name,
    rank: 'Bronze',
    is_supporter: false,
    created_at: now,
    updated_at: now,
  };
  db.insert(users).values(newUser).run();

  // Initial rank ledger entry
  db.insert(rankLedger).values({
    id: uuidv4(),
    user_id: userId,
    rank: 'Bronze',
    score: 0,
    next_rank_score: 1000,
    updated_at: now,
  }).run();

  // Welcome notification
  db.insert(notifications).values({
    id: uuidv4(),
    user_id: userId,
    type: 'system',
    title: 'Noodlaへようこそ！',
    body: 'アカウントが作成されました。ネットワークに参加してポイントを獲得しましょう！',
    is_read: false,
    created_at: now,
  }).run();

  const user = db.select().from(users).where(eq(users.id, userId)).get()!;
  const tokens = await issueTokens(userId, email.toLowerCase());

  return { user, tokens };
}

export async function loginUser(
  email: string,
  password: string,
  deviceInfo?: {
    installation_id: string;
    device_name: string;
    os: 'ios' | 'android';
    os_version: string;
    app_version: string;
    os_device_id?: string;
  },
): Promise<{ user: typeof users.$inferSelect; tokens: AuthTokens; pointsBalance: number }> {
  const user = db.select().from(users).where(eq(users.email, email.toLowerCase())).get();
  if (!user) {
    throw Object.assign(new Error('メールアドレスまたはパスワードが正しくありません'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) {
    throw Object.assign(new Error('メールアドレスまたはパスワードが正しくありません'), { status: 401, code: 'INVALID_CREDENTIALS' });
  }

  const now = new Date().toISOString();
  db.update(users).set({ last_login_at: now, updated_at: now }).where(eq(users.id, user.id)).run();

  if (deviceInfo) {
    await upsertDevice(user.id, deviceInfo);
  }

  const latest = db
    .select({ balance_after: pointsLedger.balance_after })
    .from(pointsLedger)
    .where(eq(pointsLedger.user_id, user.id))
    .orderBy(desc(pointsLedger.created_at))
    .limit(1)
    .get();

  const tokens = await issueTokens(user.id, user.email);

  return { user, tokens, pointsBalance: latest?.balance_after ?? 0 };
}

export async function refreshUserToken(
  refreshTokenStr: string,
): Promise<{ tokens: AuthTokens }> {
  let payload;
  try {
    payload = await verifyRefreshToken(refreshTokenStr);
  } catch {
    throw Object.assign(new Error('リフレッシュトークンが無効です'), { status: 401, code: 'INVALID_REFRESH_TOKEN' });
  }

  const tokenHash = hashToken(refreshTokenStr);
  const storedToken = db
    .select()
    .from(refreshTokens)
    .where(eq(refreshTokens.token_hash, tokenHash))
    .get();

  if (!storedToken || storedToken.revoked_at || new Date(storedToken.expires_at) < new Date()) {
    throw Object.assign(new Error('リフレッシュトークンが無効または期限切れです'), { status: 401, code: 'INVALID_REFRESH_TOKEN' });
  }

  // Revoke old token (rotation)
  db.update(refreshTokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(eq(refreshTokens.id, storedToken.id))
    .run();

  const user = db.select().from(users).where(eq(users.id, payload.sub)).get();
  if (!user) {
    throw Object.assign(new Error('ユーザーが見つかりません'), { status: 401, code: 'USER_NOT_FOUND' });
  }

  const tokens = await issueTokens(payload.sub, user.email, storedToken.device_id ?? undefined);

  return { tokens };
}

export function revokeToken(refreshTokenStr: string): void {
  const tokenHash = hashToken(refreshTokenStr);
  db.update(refreshTokens)
    .set({ revoked_at: new Date().toISOString() })
    .where(eq(refreshTokens.token_hash, tokenHash))
    .run();
}

// ── Internal helpers ──────────────────────────────────────────────────────────

async function issueTokens(userId: string, email: string, deviceId?: string): Promise<AuthTokens> {
  const accessToken = await signAccessToken({ sub: userId, email });
  const { token: refreshTokenStr, jti } = await signRefreshToken(userId);
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  db.insert(refreshTokens).values({
    id: jti,
    user_id: userId,
    token_hash: hashToken(refreshTokenStr),
    device_id: deviceId ?? null,
    expires_at: expiresAt,
    created_at: new Date().toISOString(),
  }).run();

  return {
    access_token: accessToken,
    refresh_token: refreshTokenStr,
    expires_in: ACCESS_TOKEN_EXPIRES_IN,
  };
}

async function upsertDevice(
  userId: string,
  deviceInfo: {
    installation_id: string;
    device_name: string;
    os: 'ios' | 'android';
    os_version: string;
    app_version: string;
    os_device_id?: string;
  },
): Promise<typeof devices.$inferSelect> {
  const existing = db
    .select()
    .from(devices)
    .where(eq(devices.installation_id, deviceInfo.installation_id))
    .get();

  const now = new Date().toISOString();

  if (existing) {
    db.update(devices)
      .set({
        device_name: deviceInfo.device_name,
        os_version: deviceInfo.os_version,
        app_version: deviceInfo.app_version,
        os_device_id: deviceInfo.os_device_id ?? existing.os_device_id,
        last_seen_at: now,
        is_active: true,
      })
      .where(eq(devices.id, existing.id))
      .run();
    return db.select().from(devices).where(eq(devices.id, existing.id)).get()!;
  }

  const deviceId = uuidv4();
  const newDevice: NewDevice = {
    id: deviceId,
    user_id: userId,
    installation_id: deviceInfo.installation_id,
    device_name: deviceInfo.device_name,
    os: deviceInfo.os,
    os_version: deviceInfo.os_version,
    app_version: deviceInfo.app_version,
    os_device_id: deviceInfo.os_device_id,
    is_active: true,
    last_seen_at: now,
    created_at: now,
  };
  db.insert(devices).values(newDevice).run();
  return db.select().from(devices).where(eq(devices.id, deviceId)).get()!;
}
