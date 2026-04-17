import { createHash, randomBytes } from 'crypto';

type Scalar = string | number | boolean | null | undefined;

function normalizeValue(value: Scalar): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'boolean') return value ? '1' : '0';
  return String(value);
}

export function freedomPaySign(
  scriptName: string,
  fields: Record<string, Scalar>,
  secretKey: string,
): string {
  const sortedEntries = Object.entries(fields)
    .filter(([key]) => key !== 'pg_sig')
    .sort(([a], [b]) => a.localeCompare(b));
  const payload = [
    scriptName,
    ...sortedEntries.map(([, value]) => normalizeValue(value)),
    secretKey,
  ].join(';');
  return createHash('md5').update(payload).digest('hex');
}

export function freedomPayVerifySignature(
  scriptName: string,
  fields: Record<string, Scalar>,
  secretKey: string,
): boolean {
  const receivedSig = normalizeValue(fields.pg_sig);
  if (!receivedSig) return false;
  const expectedSig = freedomPaySign(scriptName, fields, secretKey);
  return receivedSig === expectedSig;
}

export function freedomPaySalt(length = 16): string {
  return randomBytes(length).toString('hex').slice(0, length);
}
