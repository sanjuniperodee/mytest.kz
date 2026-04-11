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
  const tag = getQuestionContentLocale(record.metadata);
  if (tag === 'kk') {
    return (
      pickContentLang(record.content, 'kk') ||
      pickContentLang(record.content, 'ru') ||
      getLocalizedText(record.content)
    );
  }
  if (tag === 'ru') {
    return (
      pickContentLang(record.content, 'ru') ||
      pickContentLang(record.content, 'kk') ||
      getLocalizedText(record.content)
    );
  }
  const kk = pickContentLang(record.content, 'kk');
  const ru = pickContentLang(record.content, 'ru');
  if (prefer === 'kk') return kk || ru || getLocalizedText(record.content);
  return ru || kk || getLocalizedText(record.content);
}

export function localeFilterParam(
  v: '' | 'kk' | 'ru' | 'unset',
): Record<string, string> | undefined {
  if (!v) return undefined;
  return { contentLocale: v };
}
