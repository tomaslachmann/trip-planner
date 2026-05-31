import { createHmac, timingSafeEqual } from 'node:crypto';
import type { FastifyRequest } from 'fastify';
import { env } from '../../config/env.js';
import { httpError } from '../../utils/http.js';

const issuer = 'trip-planner-api';
const expiresInSeconds = 60 * 60 * 24 * 30;

export type AuthJwtPayload = {
  sub: string;
  email: string;
  iss: string;
  exp: number;
};

function base64UrlJson(value: unknown) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function sign(input: string) {
  return createHmac('sha256', env.JWT_SECRET).update(input).digest('base64url');
}

export function createAccessToken(user: { id: string; email: string }) {
  const header = base64UrlJson({ alg: 'HS256', typ: 'JWT' });
  const payload = base64UrlJson({
    sub: user.id,
    email: user.email,
    iss: issuer,
    exp: Math.floor(Date.now() / 1000) + expiresInSeconds,
  });
  const body = `${header}.${payload}`;
  return `${body}.${sign(body)}`;
}

export function verifyAccessToken(token: string): AuthJwtPayload | null {
  const [header, payload, signature] = token.split('.');
  if (!header || !payload || !signature) return null;
  const body = `${header}.${payload}`;
  const expected = sign(body);
  const providedBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) return null;

  try {
    const parsed = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as AuthJwtPayload;
    if (!parsed.sub || !parsed.email || parsed.iss !== issuer || parsed.exp < Math.floor(Date.now() / 1000)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function getBearerToken(request: FastifyRequest) {
  const header = request.headers.authorization;
  const value = Array.isArray(header) ? header[0] : header;
  if (!value?.startsWith('Bearer ')) return null;
  return value.slice('Bearer '.length).trim();
}

export function requireJwt(request: FastifyRequest) {
  const payload = verifyAccessToken(getBearerToken(request) ?? '');
  if (!payload) throw httpError(401, 'Missing or invalid access token');
  return payload;
}
