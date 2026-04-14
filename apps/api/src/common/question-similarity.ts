/** Нормализация для сравнения текстов вопросов (админка, без pg_trgm). */
export function normalizeQuestionText(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[`"'«»„“”]/g, '');
}

function diceBigrams(a: string, b: string): number {
  if (a.length < 2 && b.length < 2) return a === b ? 1 : 0;
  if (a.length < 2) return b.includes(a) ? 0.5 : 0;
  if (b.length < 2) return a.includes(b) ? 0.5 : 0;
  const map = new Map<string, number>();
  for (let i = 0; i < a.length - 1; i++) {
    const bg = a.slice(i, i + 2);
    map.set(bg, (map.get(bg) || 0) + 1);
  }
  let inter = 0;
  for (let i = 0; i < b.length - 1; i++) {
    const bg = b.slice(i, i + 2);
    const c = map.get(bg) || 0;
    if (c > 0) {
      map.set(bg, c - 1);
      inter++;
    }
  }
  return (2 * inter) / (a.length + b.length - 2);
}

function tokenJaccard(a: string, b: string): number {
  const ta = new Set(
    a
      .split(/[\s,.;:!?…]+/u)
      .map((w) => w.trim())
      .filter((w) => w.length > 0),
  );
  const tb = new Set(
    b
      .split(/[\s,.;:!?…]+/u)
      .map((w) => w.trim())
      .filter((w) => w.length > 0),
  );
  if (ta.size === 0 && tb.size === 0) return 1;
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const w of ta) if (tb.has(w)) inter++;
  const union = ta.size + tb.size - inter;
  return union === 0 ? 0 : inter / union;
}

/** Оценка 0..1: на длинных текстах «0.9» редко; для UI пороги 0.45 / 0.72 / 0.85. */
export function questionTextSimilarity(a: string, b: string): number {
  const na = normalizeQuestionText(a);
  const nb = normalizeQuestionText(b);
  if (!na && !nb) return 1;
  if (!na || !nb) return 0;
  if (na === nb) return 1;
  return Math.max(diceBigrams(na, nb), tokenJaccard(na, nb));
}

export type QuestionContentSlot = {
  text?: string;
  /** Материал для чтения (Оқу сауаттылығы, длинный контекст в тарихе и т.п.). */
  passage?: string;
  topicLine?: string;
  hint?: string;
};

export function extractSlot(content: unknown, locale: 'ru' | 'kk' | 'en'): QuestionContentSlot | null {
  if (!content || typeof content !== 'object') return null;
  const root = content as Record<string, unknown>;
  const raw = root[locale];
  if (raw == null) return null;
  if (typeof raw === 'string') return { text: raw };
  if (typeof raw === 'object' && raw !== null) {
    const o = raw as Record<string, unknown>;
    const text = typeof o.text === 'string' ? o.text : '';
    const passage = typeof o.passage === 'string' ? o.passage : '';
    const topicLine = typeof o.topicLine === 'string' ? o.topicLine : '';
    const hint = typeof o.hint === 'string' ? o.hint : '';
    return { text, passage, topicLine, hint };
  }
  return null;
}

/** Текст для поиска дубликатов: материал + подпись блока + условие. */
export function combineTopicAndStem(slot: QuestionContentSlot | null): string {
  if (!slot) return '';
  const p = (slot.passage || '').trim();
  const t = (slot.topicLine || '').trim();
  const b = (slot.text || '').trim();
  const parts = [p, t, b].filter((x) => x.length > 0);
  return parts.join('\n');
}

export function previewFromSlot(slot: QuestionContentSlot | null, maxLen = 140): string {
  const s = combineTopicAndStem(slot);
  if (s.length <= maxLen) return s;
  return `${s.slice(0, maxLen)}…`;
}
