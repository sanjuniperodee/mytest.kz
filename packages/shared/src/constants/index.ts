import type { ExamSlug } from '../types/index';

export const EXAM_SLUGS: ExamSlug[] = ['ent', 'nuet', 'nis', 'ktl', 'physmath'];

export const LANGUAGES = ['kk', 'ru', 'en'] as const;

export const DEFAULT_LANGUAGE = 'ru';

// ENT: 20+10+10 обязательных + 40+40 профиль = 120 вопросов; макс. балл 140 (профиль: 1–30 по 1 б., 31–40 по 2 б.)
export const ENT_CONFIG = {
  durationMins: 240,
  mandatorySubjects: ['history_kz', 'reading_literacy', 'math_literacy'],
  mandatoryQuestionCounts: { history_kz: 20, reading_literacy: 10, math_literacy: 10 },
  profileQuestionsPerSubject: 40,
  profileTier1Count: 30,
  profileTier1Points: 1,
  profileTier2Points: 2,
  /** Индексы 31–35: 8 вариантов, до 3 верных (макс. выбор 3). */
  profileTier2ACount: 5,
  profileTier2AOptionCount: 8,
  profileTier2ACorrectCount: 3,
  /** Индексы 36–40: 6 вариантов, до 3 верных (макс. выбор 3). */
  profileTier2BCount: 5,
  profileTier2BOptionCount: 6,
  profileTier2BCorrectCount: 3,
  /** Профиль 1–30: типично 4 варианта и 1 верный (отбор из банка). */
  profileTier1OptionCount: 4,
  profileTier1CorrectCount: 1,
  maxMandatoryPoints: 40,
  maxProfilePointsPerSubject: 50,
  totalQuestions: 120,
  maxTotalPoints: 140,
} as const;

export const ENT_AVAILABLE_PROFILE_SUBJECT_SLUGS = [
  'math',
  'physics',
  'informatics',
  'geography',
  'biology',
] as const;

export const ENT_PROFILE_SUBJECT_PAIRS = [
  ['math', 'physics'],
  ['math', 'geography'],
  ['math', 'informatics'],
] as const;

export type EntProfileSubjectPair = (typeof ENT_PROFILE_SUBJECT_PAIRS)[number];

export const ENT_LOCALE_LIMITED_PROFILE_SUBJECT_PAIRS = [
  { pair: ['biology', 'geography'], languages: ['kk'] },
] as const;

export function getEntProfileSubjectPairKey(slugs: readonly string[]): string {
  return [...slugs].sort().join(':');
}

export const ENT_PROFILE_SUBJECT_PAIR_KEYS = ENT_PROFILE_SUBJECT_PAIRS.map((pair) =>
  getEntProfileSubjectPairKey(pair),
);

export const ENT_LOCALE_LIMITED_PROFILE_SUBJECT_PAIR_KEYS =
  ENT_LOCALE_LIMITED_PROFILE_SUBJECT_PAIRS.map((entry) => ({
    key: getEntProfileSubjectPairKey(entry.pair),
    languages: entry.languages,
  }));

export function isEntProfileSubjectPairAllowed(
  slugs: readonly string[],
  language?: string | null,
): boolean {
  if (slugs.length !== 2) return false;
  const key = getEntProfileSubjectPairKey(slugs);
  if (ENT_PROFILE_SUBJECT_PAIR_KEYS.some((allowedKey) => allowedKey === key)) {
    return true;
  }
  const normalizedLanguage = language?.trim().toLowerCase();
  return ENT_LOCALE_LIMITED_PROFILE_SUBJECT_PAIR_KEYS.some(
    (entry) =>
      entry.key === key &&
      entry.languages.some((allowedLanguage) => allowedLanguage === normalizedLanguage),
  );
}

// NUET config
export const NUET_CONFIG = {
  durationMins: 240,
  sections: ['math', 'critical_thinking', 'academic_aptitude'],
};

// Auth
export const AUTH_CODE_TTL_SECONDS = 300; // 5 minutes
export const AUTH_CODE_LENGTH = 6;
export const JWT_ACCESS_TTL = '15m';
export const JWT_REFRESH_TTL = '7d';

// Channel check cache
export const CHANNEL_CHECK_CACHE_HOURS = 24;
