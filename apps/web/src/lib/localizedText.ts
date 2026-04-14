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
    if (
      typeof direct === 'object' &&
      direct !== null &&
      typeof (direct as { text?: string }).text === 'string'
    ) {
      const t = (direct as { text: string }).text;
      if (t.trim()) return t;
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

type ContentSlot = { text?: string; topicLine?: string };

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
    return { text, topicLine };
  }
  return null;
}

/** Legacy: первая строка в одном поле — подпись, остальное — условие (как в старых сидах). */
function splitFirstLineBody(full: string): { topicLine: string; text: string } {
  const s = String(full || '').replace(/\r\n/g, '\n').trim();
  const i = s.indexOf('\n');
  if (i === -1) return { topicLine: '', text: s };
  const first = s.slice(0, i).trim();
  const rest = s.slice(i + 1).trim();
  if (!rest) return { topicLine: '', text: s };
  return { topicLine: first, text: rest };
}

export type QuestionContentDisplayParts = {
  /** Подпись блока / «текст вопроса» из API (`topicLine`), без условия. */
  topicLine: string | null;
  /** Условие (`text`), уже без дублирования с topicLine. */
  stem: string;
};

/**
 * Разбор контента вопроса для UI: явные `topicLine` + `text` в JSON,
 * иначе fallback по локали и при необходимости — первая строка внутри одного поля.
 */
export function getQuestionContentDisplayParts(
  value: unknown,
  language: string | undefined,
): QuestionContentDisplayParts {
  const lang = normalizeLang(language);
  const order: AppLang[] =
    lang === 'kk' ? ['kk', 'ru', 'en'] : lang === 'en' ? ['en', 'ru', 'kk'] : ['ru', 'kk', 'en'];

  for (const l of order) {
    const slot = pickContentSlot(value, l);
    if (!slot) continue;
    const topic = (slot.topicLine || '').trim();
    const text = (slot.text || '').trim();
    if (!topic && !text) continue;

    if (topic && text) return { topicLine: topic, stem: text };
    if (text && !topic) {
      const split = splitFirstLineBody(text);
      if (split.topicLine && split.text) return { topicLine: split.topicLine, stem: split.text };
      return { topicLine: null, stem: text };
    }
    if (topic && !text) return { topicLine: null, stem: topic };
  }

  const flat = localizedText(value, language).trim();
  if (!flat) return { topicLine: null, stem: '' };
  const split = splitFirstLineBody(flat);
  if (split.topicLine && split.text) return { topicLine: split.topicLine, stem: split.text };
  return { topicLine: null, stem: flat };
}

/**
 * Одна строка (например для превью / SEO). Для экрана теста предпочтительнее
 * {@link getQuestionContentDisplayParts}.
 */
export function flattenQuestionContentForDisplay(value: unknown, language: string | undefined): string {
  const { topicLine, stem } = getQuestionContentDisplayParts(value, language);
  if (topicLine && stem) return `${topicLine}\n${stem}`;
  return stem || topicLine || '';
}
