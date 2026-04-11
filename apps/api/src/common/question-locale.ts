import { Prisma } from '@prisma/client';

/** Язык текста вопроса в `metadata.contentLocale` — только kk или ru. */
export type QuestionContentLocale = 'kk' | 'ru';

export const QUESTION_METADATA_LOCALE_KEY = 'contentLocale' as const;

export function parseQuestionContentLocale(
  raw: string | undefined | null,
  fallback: QuestionContentLocale,
): QuestionContentLocale {
  if (raw === 'kk' || raw === 'ru') return raw;
  return fallback;
}

/**
 * Язык сессии теста → какой контент вопроса допустим.
 * `en` использует тот же пул, что и `ru`.
 */
export function testLanguageToContentLocale(lang: string | undefined | null): 'kk' | 'ru' | null {
  if (!lang || typeof lang !== 'string') return null;
  const l = lang.toLowerCase();
  if (l === 'kk') return 'kk';
  if (l === 'ru' || l === 'en') return 'ru';
  return null;
}

/**
 * Вопрос подходит для языка сессии.
 * `metadata === null` — старые строки: показываем при любом языке (до бэкфилла).
 */
export function questionWhereForTestLanguage(
  language: string | undefined | null,
): Prisma.QuestionWhereInput {
  const contentLang = testLanguageToContentLocale(language);
  if (!contentLang) {
    return {
      OR: [
        { metadata: { equals: Prisma.DbNull } },
        { metadata: { path: [QUESTION_METADATA_LOCALE_KEY], equals: 'kk' } },
        { metadata: { path: [QUESTION_METADATA_LOCALE_KEY], equals: 'ru' } },
      ],
    };
  }
  return {
    OR: [
      { metadata: { equals: Prisma.DbNull } },
      { metadata: { path: [QUESTION_METADATA_LOCALE_KEY], equals: contentLang } },
    ],
  };
}
