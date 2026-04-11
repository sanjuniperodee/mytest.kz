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
