/** Метка языка контента вопроса (metadata.contentLocale в API). */
export type ContentLocaleTag = 'kk' | 'ru' | null;

export function getQuestionContentLocale(metadata: unknown): ContentLocaleTag {
  if (!metadata || typeof metadata !== 'object') return null;
  const v = (metadata as Record<string, unknown>).contentLocale;
  if (v === 'kk' || v === 'ru') return v;
  return null;
}

export function pickContentLang(value: unknown, lang: 'kk' | 'ru' | 'en'): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    const v = o[lang];
    if (typeof v === 'string' && v.trim()) return v;
    if (typeof v === 'object' && v !== null && typeof (v as { text?: string }).text === 'string') {
      const t = (v as { text: string }).text;
      if (t.trim()) return t;
    }
  }
  return '';
}

export function getLocalizedText(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value;
  for (const lang of ['ru', 'kk', 'en'] as const) {
    const s = pickContentLang(value, lang);
    if (s) return s;
  }
  if (typeof value === 'object' && value !== null) {
    const o = value as Record<string, unknown>;
    if (typeof o.text === 'string' && o.text.trim()) return o.text;
  }
  return '';
}

/** Превью текста вопроса с учётом метки языка и предпочтения колонки. */
export function getQuestionPreviewText(
  record: { content: unknown; metadata?: unknown },
  prefer: 'kk' | 'ru',
): string {
  const previewSlot = (lang: 'kk' | 'ru'): string => {
    const slot = pickSlot(record.content, lang);
    if (!slot) return pickContentLang(record.content, lang);
    const t = (slot.topicLine || '').trim();
    const b = (slot.text || '').trim();
    if (t && b) return `${t} — ${b}`;
    return b || t || pickContentLang(record.content, lang);
  };

  const tag = getQuestionContentLocale(record.metadata);
  if (tag === 'kk') {
    return previewSlot('kk') || previewSlot('ru') || getLocalizedText(record.content);
  }
  if (tag === 'ru') {
    return previewSlot('ru') || previewSlot('kk') || getLocalizedText(record.content);
  }
  if (prefer === 'kk') {
    return previewSlot('kk') || previewSlot('ru') || getLocalizedText(record.content);
  }
  return previewSlot('ru') || previewSlot('kk') || getLocalizedText(record.content);
}

/** Фильтр языка контента в админке (совпадает с query API). */
export type AdminLocaleFilter = '' | 'kk' | 'ru' | 'unset';

export function localeFilterParam(
  v: AdminLocaleFilter,
): Record<string, string> | undefined {
  if (!v) return undefined;
  return { contentLocale: v };
}

export const LOCALE_TAB_KEYS = {
  all: 'all',
  kk: 'kk',
  ru: 'ru',
  unset: 'unset',
} as const;

export function localeFilterToTabKey(f: AdminLocaleFilter): string {
  if (f === 'kk') return LOCALE_TAB_KEYS.kk;
  if (f === 'ru') return LOCALE_TAB_KEYS.ru;
  if (f === 'unset') return LOCALE_TAB_KEYS.unset;
  return LOCALE_TAB_KEYS.all;
}

export function tabKeyToLocaleFilter(key: string): AdminLocaleFilter {
  if (key === LOCALE_TAB_KEYS.kk) return 'kk';
  if (key === LOCALE_TAB_KEYS.ru) return 'ru';
  if (key === LOCALE_TAB_KEYS.unset) return 'unset';
  return '';
}

/** Одна локаль в content JSON вопроса. */
export type AdminContentSlot = {
  topicLine?: string;
  text?: string;
  hint?: string;
};

function pickSlot(content: unknown, lang: 'kk' | 'ru' | 'en'): AdminContentSlot | null {
  if (!content || typeof content !== 'object') return null;
  const o = content as Record<string, unknown>;
  const raw = o[lang];
  if (raw == null) return null;
  if (typeof raw === 'string') return { text: raw };
  if (typeof raw === 'object' && raw !== null) {
    const s = raw as Record<string, unknown>;
    return {
      topicLine: typeof s.topicLine === 'string' ? s.topicLine : '',
      text: typeof s.text === 'string' ? s.text : '',
      hint: typeof s.hint === 'string' ? s.hint : '',
    };
  }
  return null;
}

/** Первая строка vs остальное (legacy без topicLine). */
export function splitFirstLineBody(full: string): { topicLine: string; text: string } {
  const s = String(full || '').replace(/\r\n/g, '\n').trim();
  const i = s.indexOf('\n');
  if (i === -1) return { topicLine: '', text: s };
  const first = s.slice(0, i).trim();
  const rest = s.slice(i + 1).trim();
  if (!rest) return { topicLine: '', text: s };
  return { topicLine: first, text: rest };
}

/** Заполнение формы из записи API. */
export function parseQuestionFormSlots(
  content: unknown,
  contentLocale?: ContentLocaleTag | null,
): {
  topic_ru: string;
  stem_ru: string;
  topic_kk: string;
  stem_kk: string;
  topic_en: string;
  stem_en: string;
} {
  const out = { topic_ru: '', stem_ru: '', topic_kk: '', stem_kk: '', topic_en: '', stem_en: '' };
  if (!content) return out;
  for (const lang of ['ru', 'kk', 'en'] as const) {
    const slot = pickSlot(content, lang);
    if (!slot) continue;
    const topicPart = (slot.topicLine || '').trim();
    const textPart = (slot.text || '').trim();
    if (!topicPart && !textPart) continue;
    const hasExplicitTopic = !!topicPart;
    if (hasExplicitTopic) {
      if (lang === 'ru') {
        out.topic_ru = topicPart;
        out.stem_ru = textPart;
      } else if (lang === 'kk') {
        out.topic_kk = topicPart;
        out.stem_kk = textPart;
      } else {
        out.topic_en = topicPart;
        out.stem_en = textPart;
      }
    } else {
      const combined = textPart;
      const { topicLine, text } = splitFirstLineBody(combined);
      if (lang === 'ru') {
        out.topic_ru = topicLine;
        out.stem_ru = text;
      } else if (lang === 'kk') {
        out.topic_kk = topicLine;
        out.stem_kk = text;
      } else {
        out.topic_en = topicLine;
        out.stem_en = text;
      }
    }
  }

  const legacy = getLocalizedText(content).trim();
  if (!legacy) return out;
  const { topicLine, text } = splitFirstLineBody(legacy);
  const isKk = contentLocale === 'kk';
  if (isKk) {
    if (!out.stem_kk && !out.topic_kk) {
      out.topic_kk = topicLine;
      out.stem_kk = text;
    }
  } else {
    if (!out.stem_ru && !out.topic_ru) {
      out.topic_ru = topicLine;
      out.stem_ru = text;
    }
  }
  return out;
}

/** Сборка JSON content для POST/PATCH. */
export function buildQuestionContentJson(values: {
  topic_ru: string;
  stem_ru: string;
  topic_kk: string;
  stem_kk: string;
  topic_en: string;
  stem_en: string;
}): Record<string, AdminContentSlot> {
  const slot = (topic: string, stem: string): AdminContentSlot => {
    const t = (topic || '').trim();
    const s = (stem || '').trim();
    if (t && s) return { topicLine: t, text: s };
    if (s) return { text: s };
    if (t) return { text: t };
    return { text: '' };
  };
  return {
    ru: slot(values.topic_ru, values.stem_ru),
    kk: slot(values.topic_kk, values.stem_kk),
    en: slot(values.topic_en, values.stem_en),
  };
}

/** Текст для запроса похожих (заголовок + условие, приоритет RU). */
export function buildSimilarityNeedle(values: {
  topic_ru: string;
  stem_ru: string;
  topic_kk: string;
  stem_kk: string;
}, prefer: 'ru' | 'kk'): string {
  const topic = prefer === 'kk' ? values.topic_kk : values.topic_ru;
  const stem = prefer === 'kk' ? values.stem_kk : values.stem_ru;
  const t = (topic || '').trim();
  const s = (stem || '').trim();
  if (t && s) return `${t}\n${s}`;
  return s || t;
}
