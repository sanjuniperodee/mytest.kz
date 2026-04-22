// i18n content type for trilingual support
export interface LocalizedString {
  kk: string;
  ru: string;
  en: string;
}

export type Language = 'kk' | 'ru' | 'en';

// Exam types
export interface ExamTypeDto {
  id: string;
  slug: string;
  name: LocalizedString;
  description: LocalizedString | null;
  isActive: boolean;
}

export type ExamSlug = 'ent' | 'nuet' | 'nis' | 'ktl' | 'physmath';

// Subject
export interface SubjectDto {
  id: string;
  examTypeId: string;
  slug: string;
  name: LocalizedString;
  isMandatory: boolean;
}

// Question types
export type QuestionType = 'single_choice' | 'multiple_choice' | 'matching' | 'ordering';

export interface QuestionContentLang {
  text: string;
  hint?: string;
}

export interface QuestionDto {
  id: string;
  topicId: string;
  subjectId: string;
  examTypeId: string;
  difficulty: number;
  type: QuestionType;
  content: Record<Language, QuestionContentLang>;
  imageUrls?: string[];
  answerOptions: AnswerOptionDto[];
}

export interface AnswerOptionDto {
  id: string;
  content: LocalizedString;
  sortOrder: number;
  // isCorrect is NOT sent to client during test, only during review
}

// Test session
export type TestSessionStatus = 'in_progress' | 'completed' | 'abandoned' | 'timed_out';

export interface TestSessionDto {
  id: string;
  examTypeId: string;
  status: TestSessionStatus;
  language: Language;
  startedAt: string;
  finishedAt: string | null;
  timeRemaining: number | null;
  totalQuestions: number;
  correctCount: number | null;
  score: number | null;
  rawScore: number | null;
  maxScore: number | null;
}

export interface TestAnswerDto {
  questionId: string;
  selectedIds: string[];
  isCorrect?: boolean;
}

// User
export interface UserDto {
  id: string;
  telegramId: number;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredLanguage: Language;
  timezone?: string;
  isChannelMember: boolean;
  hasActiveSubscription: boolean;
  trialStatus?: TrialStatusDto;
  accessByExam?: AccessByExamItemDto[];
}

export interface TrialStatusItemDto {
  limit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
}

export interface TrialStatusDto {
  ent: TrialStatusItemDto;
}

export interface AccessByExamLimitDto {
  used: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
}

export interface AccessByExamItemDto {
  examTypeId: string;
  examSlug: string;
  hasAccess: boolean;
  reasonCode: 'DAILY_LIMIT_REACHED' | 'TOTAL_LIMIT_EXHAUSTED' | 'NO_ENTITLEMENT' | null;
  nextAllowedAt: string | null;
  hasPaidTier: boolean;
  total: AccessByExamLimitDto;
  daily: AccessByExamLimitDto & { nextResetAt: string | null };
}

// Subscription
export interface SubscriptionDto {
  id: string;
  planType: string;
  examTypeId: string | null;
  startsAt: string;
  expiresAt: string;
  isActive: boolean;
}

// Auth
export interface AuthResponseDto {
  accessToken: string;
  refreshToken: string;
  user: UserDto;
}

// Stats
export interface UserExamStatsDto {
  examTypeId: string;
  examSlug: string;
  examType: {
    id: string;
    slug: string;
    name: unknown;
  };
  testsCount: number;
  averageScore: number | null;
  bestScore: number | null;
  bestRawScore: number | null;
  bestMaxScore: number | null;
  worstScore: number | null;
  averageCorrectPercent: number | null;
  averageDurationSecs: number | null;
  lastFinishedAt: string | null;
  firstFinishedAt: string | null;
  inProgressCount: number;
  recentScores: number[];
}

export interface UserStatsDto {
  totalTests: number;
  completedTests: number;
  inProgressSessionsCount: number;
  averageScore: number;
  byExamType: UserExamStatsDto[];
}

export interface BillingPlanDto {
  id: string;
  name: string;
  description: string;
  priceKzt: number;
  durationDays: number;
  highlight?: string;
  features: string[];
}

export interface BillingCheckoutRequestDto {
  planId: string;
}

export interface BillingCheckoutResponseDto {
  orderId: string;
  checkoutUrl: string;
}
