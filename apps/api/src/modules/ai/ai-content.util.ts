/**
 * Server-side extraction of localized question/option text from the heterogeneous
 * Prisma JSON shapes. Mirrors apps/web/lib/api/test-session.ts pickSlot logic.
 *
 * Question.content can be:
 *   - a flat string
 *   - a flat locale map { kk, ru, en } of strings
 *   - a slot map { kk: { passage?, topicLine?, text, hint? }, ru: {...}, en: {...} }
 * Option/Subject/Topic/Exam .name|.content are flat locale maps { kk, ru, en }.
 */

type Locale = 'ru' | 'kk' | 'en';
const FALLBACK_LOCALES: Locale[] = ['ru', 'kk', 'en'];

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function localeOrder(locale: Locale): Locale[] {
  return [locale, ...FALLBACK_LOCALES.filter((l) => l !== locale)];
}

/** Resolve a flat { kk, ru, en } string map (or plain string) to one locale. */
export function localizeFlat(value: unknown, locale: Locale, fallback = ''): string {
  if (typeof value === 'string') return value.trim();
  const root = asRecord(value);
  if (!root) return fallback;
  for (const loc of localeOrder(locale)) {
    const v = root[loc];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  return fallback;
}

/** Extract the question stem (text + topicLine prefix when present). */
export function extractQuestionText(content: unknown, locale: Locale): string {
  for (const loc of localeOrder(locale)) {
    const slot = pickSlot(content, loc);
    if (!slot) continue;
    const parts = [slot.topicLine, slot.text].map((s) => (s || '').trim()).filter(Boolean);
    if (parts.length) return parts.join(' — ');
  }
  // Plain string fallback
  if (typeof content === 'string') return content.trim();
  const root = asRecord(content);
  if (root && typeof root.text === 'string') return root.text.trim();
  return '';
}

/** Reading-context passage, if any (capped by caller). */
export function extractPassage(content: unknown, locale: Locale): string {
  for (const loc of localeOrder(locale)) {
    const slot = pickSlot(content, loc);
    if (slot?.passage) return slot.passage.trim();
  }
  return '';
}

type ContentSlot = { text?: string; topicLine?: string; passage?: string };

function pickSlot(value: unknown, locale: Locale): ContentSlot | null {
  if (typeof value === 'string') return { text: value };
  const root = asRecord(value);
  if (!root) return null;
  const raw = root[locale];
  if (typeof raw === 'string') return { text: raw };
  const slot = asRecord(raw);
  if (slot) {
    return {
      text: typeof slot.text === 'string' ? slot.text : '',
      topicLine: typeof slot.topicLine === 'string' ? slot.topicLine : '',
      passage: typeof slot.passage === 'string' ? slot.passage : '',
    };
  }
  return null;
}

export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}…`;
}
