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
    if (typeof v === 'object' && v !== null) {
      const slot = v as { text?: string; passage?: string };
      if (typeof slot.text === 'string' && slot.text.trim()) return slot.text;
      if (typeof slot.passage === 'string' && slot.passage.trim()) return slot.passage;
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
    const p = (slot.passage || '').trim();
    const t = (slot.topicLine || '').trim();
    const b = (slot.text || '').trim();
    const head = p || t;
    if (head && b) return `${head.slice(0, 80)}${head.length > 80 ? '…' : ''} — ${b.slice(0, 100)}${b.length > 100 ? '…' : ''}`;
    return b || head || pickContentLang(record.content, lang);
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
  /** Материал для чтения (Оқу сауаттылығы, контекст в тарихе). */
  passage?: string;
  /** Короткая подпись блока / раздел ЕНТ. */
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
      passage: typeof s.passage === 'string' ? s.passage : '',
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
  passage_ru: string;
  passage_kk: string;
  passage_en: string;
  topic_ru: string;
  stem_ru: string;
  topic_kk: string;
  stem_kk: string;
  topic_en: string;
  stem_en: string;
} {
  const out = {
    passage_ru: '',
    passage_kk: '',
    passage_en: '',
    topic_ru: '',
    stem_ru: '',
    topic_kk: '',
    stem_kk: '',
    topic_en: '',
    stem_en: '',
  };
  if (!content) return out;
  for (const lang of ['ru', 'kk', 'en'] as const) {
    const slot = pickSlot(content, lang);
    if (!slot) continue;
    const passagePart = (slot.passage || '').trim();
    const topicPart = (slot.topicLine || '').trim();
    const textPart = (slot.text || '').trim();
    if (!passagePart && !topicPart && !textPart) continue;
    if (lang === 'ru') {
      out.passage_ru = passagePart;
      out.topic_ru = topicPart;
      out.stem_ru = textPart;
    } else if (lang === 'kk') {
      out.passage_kk = passagePart;
      out.topic_kk = topicPart;
      out.stem_kk = textPart;
    } else {
      out.passage_en = passagePart;
      out.topic_en = topicPart;
      out.stem_en = textPart;
    }
  }

  const legacy = getLocalizedText(content).trim();
  if (!legacy) return out;
  const isKk = contentLocale === 'kk';
  if (isKk) {
    if (!out.stem_kk && !out.topic_kk && !out.passage_kk) {
      out.stem_kk = legacy;
    }
  } else {
    if (!out.stem_ru && !out.topic_ru && !out.passage_ru) {
      out.stem_ru = legacy;
    }
  }
  return out;
}

/** Сборка JSON content для POST/PATCH. */
export function buildQuestionContentJson(values: {
  passage_ru: string;
  passage_kk: string;
  passage_en: string;
  topic_ru: string;
  stem_ru: string;
  topic_kk: string;
  stem_kk: string;
  topic_en: string;
  stem_en: string;
}): Record<string, AdminContentSlot> {
  const slot = (passage: string, topic: string, stem: string): AdminContentSlot => {
    const p = (passage || '').trim();
    const t = (topic || '').trim();
    const s = (stem || '').trim();
    const o: AdminContentSlot = {};
    if (p) o.passage = p;
    if (t) o.topicLine = t;
    if (s) o.text = s;
    if (!p && !t && !s) return { text: '' };
    return o;
  };
  return {
    ru: slot(values.passage_ru, values.topic_ru, values.stem_ru),
    kk: slot(values.passage_kk, values.topic_kk, values.stem_kk),
    en: slot(values.passage_en, values.topic_en, values.stem_en),
  };
}

/** Текст для запроса похожих: материал + подпись + условие. */
export function buildSimilarityNeedle(
  values: {
    passage_ru: string;
    passage_kk: string;
    topic_ru: string;
    stem_ru: string;
    topic_kk: string;
    stem_kk: string;
  },
  prefer: 'ru' | 'kk',
): string {
  const passage = prefer === 'kk' ? values.passage_kk : values.passage_ru;
  const topic = prefer === 'kk' ? values.topic_kk : values.topic_ru;
  const stem = prefer === 'kk' ? values.stem_kk : values.stem_ru;
  const parts = [passage, topic, stem].map((x) => (x || '').trim()).filter(Boolean);
  return parts.join('\n');
}
