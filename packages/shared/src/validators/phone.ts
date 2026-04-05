/**
 * Normalize mobile to 11 digits starting with 7 (KZ/RU +7).
 * Accepts Telegram contact format, spaces, leading +8, etc.
 */
export function normalizeKzPhone(raw: string): string | null {
  let d = raw.replace(/\D/g, '');
  if (d.length === 11 && d.startsWith('7')) return d;
  if (d.length === 11 && d.startsWith('8')) return `7${d.slice(1)}`;
  if (d.length === 10) return `7${d}`;
  return null;
}

/** Display mask for UI, e.g. +7 7** *** 12 34 */
export function maskPhoneDigits(normalized: string): string {
  if (normalized.length !== 11) return `+${normalized}`;
  return `+${normalized[0]} ${normalized.slice(1, 4)} ** *** ${normalized.slice(9, 11)}`;
}
