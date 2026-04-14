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
  maxMandatoryPoints: 40,
  maxProfilePointsPerSubject: 50,
  totalQuestions: 120,
  maxTotalPoints: 140,
};

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
