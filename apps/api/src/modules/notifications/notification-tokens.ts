import { createHmac, timingSafeEqual } from 'crypto';
import type { ConfigService } from '@nestjs/config';

/**
 * Compact signed tokens for notification links (no DB state):
 * - Telegram connect: `/start link_<token>` — Telegram allows 64 chars of [A-Za-z0-9_-] in a start payload.
 * - Email unsubscribe: `?t=<token>` — never expires (unsubscribe links must keep working).
 *
 * Layout (base64url): user id (16 bytes) [+ expiry, 4 bytes] + truncated HMAC-SHA256.
 * Every purpose uses its own key derived from the base secret.
 */

export const TELEGRAM_LINK_PREFIX = 'link_';
export const TELEGRAM_LINK_TTL_SECONDS = 30 * 60;

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;

type Purpose = 'telegram-link' | 'email-unsubscribe';

/** Secret for notification links: dedicated env first, JWT secret as fallback. */
export function notificationTokenSecret(config: Pick<ConfigService, 'get'>): string | null {
  const raw =
    config.get<string>('NOTIFICATIONS_TOKEN_SECRET') || config.get<string>('JWT_SECRET') || '';
  const secret = raw.trim();
  return secret.length >= 16 ? secret : null;
}

function purposeKey(secret: string, purpose: Purpose) {
  return createHmac('sha256', secret).update(`mytest:notifications:${purpose}:v1`).digest();
}

function sign(secret: string, purpose: Purpose, body: Buffer, length: number) {
  return createHmac('sha256', purposeKey(secret, purpose)).update(body).digest().subarray(0, length);
}

function uuidToBytes(id: string) {
  if (!UUID_RE.test(id)) throw new Error('Invalid user id');
  return Buffer.from(id.replace(/-/g, ''), 'hex');
}

function bytesToUuid(bytes: Buffer) {
  const h = bytes.toString('hex');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
}

function decode(token: string): Buffer | null {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const raw = Buffer.from(token, 'base64url');
  return raw.length === 32 ? raw : null;
}

function sameBytes(a: Buffer, b: Buffer) {
  return a.length === b.length && timingSafeEqual(a, b);
}

export function createTelegramLinkToken(
  userId: string,
  secret: string,
  now = new Date(),
  ttlSeconds = TELEGRAM_LINK_TTL_SECONDS,
) {
  const expiresAtSec = Math.floor(now.getTime() / 1000) + ttlSeconds;
  const expiry = Buffer.alloc(4);
  expiry.writeUInt32BE(expiresAtSec);
  const body = Buffer.concat([uuidToBytes(userId), expiry]);
  return {
    token: Buffer.concat([body, sign(secret, 'telegram-link', body, 12)]).toString('base64url'),
    expiresAt: new Date(expiresAtSec * 1000),
  };
}

export function verifyTelegramLinkToken(token: string, secret: string, now = new Date()) {
  const raw = decode(token);
  if (!raw) return null;
  const body = raw.subarray(0, 20);
  if (!sameBytes(raw.subarray(20), sign(secret, 'telegram-link', body, 12))) return null;
  const expiresAt = new Date(body.readUInt32BE(16) * 1000);
  if (expiresAt.getTime() < now.getTime()) return null;
  return { userId: bytesToUuid(body.subarray(0, 16)), expiresAt };
}

export function createUnsubscribeToken(userId: string, secret: string) {
  const body = uuidToBytes(userId);
  return Buffer.concat([body, sign(secret, 'email-unsubscribe', body, 16)]).toString('base64url');
}

export function verifyUnsubscribeToken(token: string, secret: string) {
  const raw = decode(token);
  if (!raw) return null;
  const body = raw.subarray(0, 16);
  if (!sameBytes(raw.subarray(16), sign(secret, 'email-unsubscribe', body, 16))) return null;
  return { userId: bytesToUuid(body) };
}
