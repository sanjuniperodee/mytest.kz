/** Языки интерфейса приложения (совпадают с i18n + preferredLanguage). */
export type AppLang = 'kk' | 'ru' | 'en';

function normalizeLang(language: string | undefined): AppLang {
  const base = (language || 'ru').split('-')[0].toLowerCase();
  if (base === 'kk') return 'kk';
  if (base === 'en') return 'en';
  return 'ru';
}

function pickLang(value: unknown, lang: AppLang): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    const direct = o[lang];
    if (typeof direct === 'string' && direct.trim()) return direct;
    if (typeof direct === 'object' && direct !== null) {
      const slot = direct as { text?: string; passage?: string };
      if (typeof slot.text === 'string' && slot.text.trim()) return slot.text;
      if (typeof slot.passage === 'string' && slot.passage.trim()) return slot.passage;
    }
  }
  return '';
}

/**
 * Строка из API: plain string или JSON { kk, ru, en }.
 * Порядок: текущий язык UI → остальные → любая непустая строка в объекте.
 */
export function localizedText(value: unknown, language: string | undefined): string {
  const lang = normalizeLang(language);
  const order: AppLang[] =
    lang === 'kk' ? ['kk', 'ru', 'en'] : lang === 'en' ? ['en', 'ru', 'kk'] : ['ru', 'kk', 'en'];
  for (const l of order) {
    const s = pickLang(value, l);
    if (s) return s;
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    for (const v of Object.values(o)) {
      if (typeof v === 'string' && v.trim()) return v;
    }
    if (typeof o.text === 'string' && o.text.trim()) return o.text;
  }
  return '';
}

type ContentSlot = { text?: string; topicLine?: string; passage?: string };

function pickContentSlot(value: unknown, lang: AppLang): ContentSlot | null {
  if (!value || typeof value !== 'object') return null;
  const o = value as Record<string, unknown>;
  const raw = o[lang];
  if (raw == null) return null;
  if (typeof raw === 'string') return { text: raw };
  if (typeof raw === 'object' && raw !== null) {
    const s = raw as Record<string, unknown>;
    const text = typeof s.text === 'string' ? s.text : '';
    const topicLine = typeof s.topicLine === 'string' ? s.topicLine : '';
    const passage = typeof s.passage === 'string' ? s.passage : '';
    return { text, topicLine, passage };
  }
  return null;
}

export type QuestionContentDisplayParts = {
  /** Материал для чтения (Оқу сауаттылығы, тарих) — поле `passage` в JSON. */
  passage: string | null;
  /** Короткая подпись блока / раздел ЕНТ — `topicLine`. */
  topicLine: string | null;
  /** Формулировка вопроса — `text`. */
  stem: string;
};

/**
 * Разбор контента: `passage` + `topicLine` + `text`; legacy — одно поле `text` или строка.
 */
export function getQuestionContentDisplayParts(
  value: unknown,
  language: string | undefined,
): QuestionContentDisplayParts {
  const empty = (): QuestionContentDisplayParts => ({
    passage: null,
    topicLine: null,
    stem: '',
  });
  const lang = normalizeLang(language);
  const order: AppLang[] =
    lang === 'kk' ? ['kk', 'ru', 'en'] : lang === 'en' ? ['en', 'ru', 'kk'] : ['ru', 'kk', 'en'];

  for (const l of order) {
    const slot = pickContentSlot(value, l);
    if (!slot) continue;
    const passage = (slot.passage || '').trim();
    const topic = (slot.topicLine || '').trim();
    const text = (slot.text || '').trim();
    if (!passage && !topic && !text) continue;
    return {
      passage: passage || null,
      topicLine: topic || null,
      stem: text,
    };
  }

  /** Нет слотов kk/ru/en: плоский объект { passage?, topicLine?, text? } (старый/ошибочный JSON). */
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    const hasLocaleSlot = (['kk', 'ru', 'en'] as const).some((k) => {
      const v = o[k];
      if (v == null || v === '') return false;
      if (typeof v === 'string') return v.trim().length > 0;
      return typeof v === 'object';
    });
    if (!hasLocaleSlot) {
      const passage = typeof o.passage === 'string' ? o.passage.trim() : '';
      const topicLine = typeof o.topicLine === 'string' ? o.topicLine.trim() : '';
      const text = typeof o.text === 'string' ? o.text.trim() : '';
      if (passage || topicLine || text) {
        return {
          passage: passage || null,
          topicLine: topicLine || null,
          stem: text,
        };
      }
    }
  }

  const flat = localizedText(value, language).trim();
  if (!flat) return empty();
  /** Одна строка в сиде без слотов — целиком в условие (сплит «первая строка» не topicLine). */
  return { passage: null, topicLine: null, stem: flat };
}

/**
 * Одна строка (например для превью / SEO). Для экрана теста предпочтительнее
 * {@link getQuestionContentDisplayParts}.
 */
export function flattenQuestionContentForDisplay(value: unknown, language: string | undefined): string {
  const { passage, topicLine, stem } = getQuestionContentDisplayParts(value, language);
  const parts = [passage, topicLine, stem].filter((x): x is string => !!x && x.trim().length > 0);
  return parts.join('\n\n');
}
