import { createHash, randomBytes } from 'node:crypto';

import { SignJWT, jwtVerify } from 'jose';

import { env } from '@/env';

export interface AccessTokenPayload {
  userId: string;
  cedula: string;
}

const encoder = new TextEncoder();

function secretKey(): Uint8Array {
  return encoder.encode(env.jwtSecret);
}

export async function signAccessToken(payload: AccessTokenPayload): Promise<string> {
  return new SignJWT({ cedula: payload.cedula })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(payload.userId)
    .setIssuedAt()
    .setExpirationTime(`${env.accessTokenTtl}s`)
    .sign(secretKey());
}

export async function verifyAccessToken(token: string): Promise<AccessTokenPayload> {
  const { payload } = await jwtVerify(token, secretKey(), { algorithms: ['HS256'] });
  if (!payload.sub) {
    throw new Error('Token sin subject');
  }
  return { userId: payload.sub, cedula: String(payload.cedula ?? '') };
}

export function createRefreshToken(): { token: string; tokenHash: string } {
  const token = randomBytes(48).toString('base64url');
  return { token, tokenHash: hashRefreshToken(token) };
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
