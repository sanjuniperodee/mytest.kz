import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Ссылка «оплатить за ученика»: непрозрачный токен = format(1) + userId(16) + expiresAt(4,
 * unix-секунды) + HMAC-SHA256(…)[0..16], всё в base64url (50 символов). Ключ HMAC выводится
 * из серверного секрета с собственной меткой назначения — токен отчёта для родителей
 * (тот же размер) здесь не пройдёт, и наоборот.
 *
 * Токен даёт ровно одно право: создать платёж Kaspi в пользу этого аккаунта и следить за
 * его статусом. Состояния на сервере нет — ссылка просто перестаёт работать после expiresAt.
 */

const FORMAT = 1;
const PURPOSE = 'mytest:parent-pay:v1';
const BODY_BYTES = 1 + 16 + 4;
const MAC_BYTES = 16;
const TOKEN_RE = /^[A-Za-z0-9_-]{50}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PARENT_PAY_TOKEN_LENGTH = 50;

export interface ParentPayTokenPayload {
  userId: string;
  /** Момент, после которого ссылка не работает. */
  expiresAt: Date;
}

function purposeKey(secret: string): Buffer {
  if (!secret || !secret.trim()) throw new Error('Parent pay secret is missing');
  return createHmac('sha256', secret).update(PURPOSE).digest();
}

function mac(secret: string, body: Buffer): Buffer {
  return createHmac('sha256', purposeKey(secret)).update(body).digest().subarray(0, MAC_BYTES);
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function signParentPayToken(payload: ParentPayTokenPayload, secret: string): string {
  if (!UUID_RE.test(payload.userId)) throw new Error('Invalid user id');
  const expiresSec = Math.floor(payload.expiresAt.getTime() / 1000);
  if (!Number.isInteger(expiresSec) || expiresSec < 1 || expiresSec > 0xffffffff) {
    throw new Error('Invalid expiry');
  }
  const body = Buffer.alloc(BODY_BYTES);
  body.writeUInt8(FORMAT, 0);
  Buffer.from(payload.userId.replace(/-/g, ''), 'hex').copy(body, 1);
  body.writeUInt32BE(expiresSec, 17);
  return Buffer.concat([body, mac(secret, body)]).toString('base64url');
}

/** null — токен испорчен, подделан, другого формата или истёк (без подробностей наружу). */
export function verifyParentPayToken(
  token: unknown,
  secret: string,
  now: Date = new Date(),
): ParentPayTokenPayload | null {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const raw = Buffer.from(token, 'base64url');
  if (raw.length !== BODY_BYTES + MAC_BYTES) return null;
  // base64url допускает несколько написаний одних байтов — принимаем только каноническое.
  if (raw.toString('base64url') !== token) return null;
  const body = raw.subarray(0, BODY_BYTES);
  const given = raw.subarray(BODY_BYTES);
  if (!timingSafeEqual(given, mac(secret, body))) return null;
  if (body.readUInt8(0) !== FORMAT) return null;
  const expiresSec = body.readUInt32BE(17);
  if (expiresSec * 1000 <= now.getTime()) return null;
  return { userId: bytesToUuid(body.subarray(1, 17)), expiresAt: new Date(expiresSec * 1000) };
}
