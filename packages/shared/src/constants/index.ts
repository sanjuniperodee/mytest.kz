import type { ExamSlug } from '../types/index';

export const EXAM_SLUGS: ExamSlug[] = ['ent', 'nuet', 'nis', 'ktl', 'physmath'];

export const LANGUAGES = ['kk', 'ru', 'en'] as const;

export const DEFAULT_LANGUAGE = 'ru';

// ENT scoring: 5 subjects, 40 questions each = 200 questions, 140 points max
// Mandatory subjects get 1 point per question, profile subjects get different weights
export const ENT_CONFIG = {
  durationMins: 240,
  mandatorySubjects: ['math_literacy', 'reading_literacy', 'history_of_kazakhstan'],
  questionsPerSubject: 40,
  totalQuestions: 120, // 3 mandatory + 2 profile = but 40 each
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
