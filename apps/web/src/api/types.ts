export interface User {
  id: string;
  telegramId: number;
  telegramUsername: string | null;
  phone?: string | null;
  firstName: string | null;
  lastName: string | null;
  preferredLanguage: 'kk' | 'ru' | 'en';
  timezone?: string;
  isChannelMember: boolean;
  isAdmin: boolean;
  hasActiveSubscription?: boolean;
  trialStatus?: TrialStatus;
  accessByExam?: AccessByExamItem[];
}

export interface TrialStatusItem {
  limit: number;
  used: number;
  remaining: number;
  exhausted: boolean;
  freeLimit?: number;
  freeUsed?: number;
  freeRemaining?: number;
  paidTrialLimit?: number;
  paidTrialUsed?: number;
  paidTrialRemaining?: number;
  totalLimit?: number;
  totalUsed?: number;
  totalRemaining?: number;
}

export interface TrialStatus {
  ent: TrialStatusItem;
}

export interface AccessLimit {
  used: number;
  limit: number | null;
  remaining: number | null;
  isUnlimited: boolean;
}

export interface AccessByExamItem {
  examTypeId: string;
  examSlug: string;
  hasAccess: boolean;
  reasonCode: 'DAILY_LIMIT_REACHED' | 'TOTAL_LIMIT_EXHAUSTED' | 'NO_ENTITLEMENT' | null;
  nextAllowedAt: string | null;
  hasPaidTier: boolean;
  total: AccessLimit;
  daily: AccessLimit & { nextResetAt: string | null };
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: User;
}

export interface ExamType {
  id: string;
  slug: string;
  /** JSON { kk, ru, en } или строка */
  name: unknown;
  description: unknown;
  isActive: boolean;
}

export interface Subject {
  id: string;
  examTypeId: string;
  slug: string;
  name: unknown;
  isMandatory: boolean;
  sortOrder: number;
}

export interface TestTemplate {
  id: string;
  examTypeId: string;
  name: unknown;
  durationMins: number;
  sections: TestTemplateSection[];
}

export interface TestTemplateSection {
  id: string;
  subjectId: string;
  questionCount: number;
  subject: Subject;
}

export interface AnswerOption {
  id: string;
  content: string;
  sortOrder: number;
  isCorrect?: boolean;
}

export interface Question {
  id: string;
  difficulty: number;
  type: string;
  /** JSON: строка или { ru: { passage?, topicLine?, text }, ... } — passage = текст для чтения, topicLine = подпись ЕНТ, text = вопрос */
  content: unknown;
  imageUrls?: string[];
  answerOptions: AnswerOption[];
  subject?: { id: string; name: unknown; slug: string };
}

export interface TestAnswer {
  id: string;
  questionId: string;
  selectedIds: string[];
  isCorrect: boolean | null;
  answeredAt: string | null;
  question: Question;
}

export interface SessionSectionScore {
  subjectId: string;
  subjectName: unknown;
  subjectSlug: string;
  correctCount: number;
  totalCount: number;
  score: number;
  rawPoints?: number;
  maxPoints?: number;
}

export interface SessionSection {
  subjectId: string;
  /** JSON или строка с бэка */
  subjectName: unknown;
  subjectSlug: string;
  isMandatory?: boolean;
  profileHeavyFrom?: number | null;
  questionCount: number;
  sortOrder: number;
}

export interface SessionMetadata {
  kind?: 'remediation';
  entScope?: 'mandatory' | 'profile' | 'full';
  remediationDurationMins?: number;
  sections: SessionSection[];
  profileSubjectIds: string[];
  questionOrder?: string[];
}

export interface MistakesSummary {
  openTotal: number;
  openByExam: {
    examTypeId: string;
    examSlug: string;
    /** JSON i18n из БД */
    examName: unknown | null;
    count: number;
  }[];
  recentRecoveries: {
    questionId: string;
    examTypeId: string;
    examSlug: string;
    examName: unknown;
    subjectSlug: string;
    subjectName: unknown;
    sessionId: string;
    recoveredAt: string;
  }[];
}

export interface TestSession {
  id: string;
  examTypeId: string;
  status: 'in_progress' | 'completed' | 'abandoned' | 'timed_out';
  language: string;
  startedAt: string;
  finishedAt: string | null;
  timeRemaining: number | null;
  totalQuestions: number;
  correctCount: number | null;
  score: number | null;
  rawScore: number | null;
  maxScore: number | null;
  metadata?: SessionMetadata;
  sectionScores?: SessionSectionScore[];
  sectionsScores?: SessionSectionScore[];
  answers: TestAnswer[];
  examType?: ExamType;
}

export interface PaginatedResponse<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface UserExamStats {
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
  /** Сырой балл лучшей попытки (напр. верные ответы для ЕНТ). */
  bestRawScore: number | null;
  /** Максимум баллов при лучшей попытке. */
  bestMaxScore: number | null;
  worstScore: number | null;
  averageCorrectPercent: number | null;
  averageDurationSecs: number | null;
  lastFinishedAt: string | null;
  firstFinishedAt: string | null;
  inProgressCount: number;
  recentScores: number[];
}

export interface UserStats {
  totalTests: number;
  completedTests: number;
  inProgressSessionsCount: number;
  averageScore: number;
  byExamType: UserExamStats[];
}

export interface BillingPlan {
  id: string;
  name: string;
  description: string;
  priceKzt: number;
  originalPriceKzt?: number;
  durationDays: number;
  highlight?: string;
  features: string[];
}

export interface CheckoutResponse {
  orderId: string;
  checkoutUrl: string;
}
