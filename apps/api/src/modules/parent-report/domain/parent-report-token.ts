import { createHmac, timingSafeEqual } from 'crypto';

/**
 * Ссылка «отчёт для родителей»: непрозрачный токен = format(1) + userId(16) + version(4)
 * + HMAC-SHA256(…)[0..16], всё в base64url (50 символов). Ключ HMAC выводится из
 * серверного секрета с отдельной меткой назначения, поэтому токен нельзя спутать
 * с JWT или другими подписями на том же секрете. version — случайное число, которое
 * хранится на сервере для пользователя: отзыв ссылки = смена/удаление версии.
 */

const FORMAT = 1;
const PURPOSE = 'mytest:parent-report:v1';
const BODY_BYTES = 1 + 16 + 4;
const MAC_BYTES = 16;
const TOKEN_RE = /^[A-Za-z0-9_-]{50}$/;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const PARENT_REPORT_TOKEN_LENGTH = 50;

export interface ParentReportTokenPayload {
  userId: string;
  version: number;
}

function purposeKey(secret: string): Buffer {
  if (!secret || !secret.trim()) throw new Error('Parent report secret is missing');
  return createHmac('sha256', secret).update(PURPOSE).digest();
}

function mac(secret: string, body: Buffer): Buffer {
  return createHmac('sha256', purposeKey(secret)).update(body).digest().subarray(0, MAC_BYTES);
}

function uuidToBytes(id: string): Buffer {
  return Buffer.from(id.replace(/-/g, ''), 'hex');
}

function bytesToUuid(bytes: Buffer): string {
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function isValidParentReportVersion(version: unknown): version is number {
  return typeof version === 'number' && Number.isInteger(version) && version >= 1 && version <= 0xffffffff;
}

export function signParentReportToken(payload: ParentReportTokenPayload, secret: string): string {
  if (!UUID_RE.test(payload.userId)) throw new Error('Invalid user id');
  if (!isValidParentReportVersion(payload.version)) throw new Error('Invalid version');
  const body = Buffer.alloc(BODY_BYTES);
  body.writeUInt8(FORMAT, 0);
  uuidToBytes(payload.userId).copy(body, 1);
  body.writeUInt32BE(payload.version, 17);
  return Buffer.concat([body, mac(secret, body)]).toString('base64url');
}

/** null — токен испорчен, подделан или другого формата (без подробностей наружу). */
export function verifyParentReportToken(
  token: unknown,
  secret: string,
): ParentReportTokenPayload | null {
  if (typeof token !== 'string' || !TOKEN_RE.test(token)) return null;
  const raw = Buffer.from(token, 'base64url');
  if (raw.length !== BODY_BYTES + MAC_BYTES) return null;
  // base64url допускает несколько написаний одних байтов — принимаем только каноническое.
  if (raw.toString('base64url') !== token) return null;
  const body = raw.subarray(0, BODY_BYTES);
  const given = raw.subarray(BODY_BYTES);
  if (!timingSafeEqual(given, mac(secret, body))) return null;
  if (body.readUInt8(0) !== FORMAT) return null;
  const version = body.readUInt32BE(17);
  if (!isValidParentReportVersion(version)) return null;
  return { userId: bytesToUuid(body.subarray(1, 17)), version };
}
