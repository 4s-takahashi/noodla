import { SignJWT, jwtVerify } from 'jose';
import { v4 as uuidv4 } from 'uuid';
import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET ?? 'noodla-dev-secret-change-in-production';
const secret = new TextEncoder().encode(JWT_SECRET);

export const ACCESS_TOKEN_EXPIRES_IN = 900; // 15 minutes in seconds
export const REFRESH_TOKEN_EXPIRES_IN = 30 * 24 * 60 * 60; // 30 days in seconds

export interface AccessTokenPayload {
  sub: string;      // user_id
  email: string;
}

export interface RefreshTokenPayload {
  sub: string;      // user_id
  jti: string;      // unique token id
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ email: payload.email })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.sub)
    .setIssuedAt()
    .setExpirationTime(`${ACCESS_TOKEN_EXPIRES_IN}s`)
    .sign(secret);
}

export async function signRefreshToken(userId: string): Promise<{ token: string; jti: string }> {
  const jti = uuidv4();
  const token = await new SignJWT({ jti })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${REFRESH_TOKEN_EXPIRES_IN}s`)
    .sign(secret);
  return { token, jti };
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    email: payload['email'] as string,
  };
}

export async function verifyRefreshToken(token: string): Promise<RefreshTokenPayload> {
  const { payload } = await jwtVerify(token, secret);
  return {
    sub: payload.sub as string,
    jti: payload['jti'] as string,
  };
}

export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}
