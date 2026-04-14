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

/**
 * Одна строка для условия в UI: при явном topicLine — «тема\\nтело» (как в старых сидах),
 * иначе только text (первая строка темы может быть внутри text).
 */
export function flattenQuestionContentForDisplay(value: unknown, language: string | undefined): string {
  const lang = normalizeLang(language);
  const order: AppLang[] =
    lang === 'kk' ? ['kk', 'ru', 'en'] : lang === 'en' ? ['en', 'ru', 'kk'] : ['ru', 'kk', 'en'];
  for (const l of order) {
    const slot = pickContentSlot(value, l);
    if (!slot) continue;
    const t = (slot.topicLine || '').trim();
    const b = (slot.text || '').trim();
    if (t && b) return `${t}\n${b}`;
    if (b) return b;
    if (t) return t;
  }
  return localizedText(value, language);
}
