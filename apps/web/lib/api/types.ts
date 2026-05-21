// Shared API types for mytest-v2. These mirror the current Nest backend contract.

import type { LocalizedText } from "./i18n"

export type AccessReasonCode =
  | "DAILY_LIMIT_REACHED"
  | "TOTAL_LIMIT_EXHAUSTED"
  | "NO_ENTITLEMENT"
  | null

export interface AccessLimit {
  used: number
  limit: number | null
  remaining: number | null
  isUnlimited: boolean
}

export interface AccessByExamItem {
  examTypeId: string
  examSlug: string
  hasAccess: boolean
  reasonCode: AccessReasonCode
  nextAllowedAt: string | null
  hasPaidTier: boolean
  total: AccessLimit
  daily: AccessLimit & { nextResetAt: string | null }
}

export interface TrialStatusItem {
  limit: number
  used: number
  remaining: number
  exhausted: boolean
  freeLimit?: number
  freeUsed?: number
  freeRemaining?: number
  paidTrialLimit?: number
  paidTrialUsed?: number
  paidTrialRemaining?: number
  totalLimit?: number
  totalUsed?: number
  totalRemaining?: number
}

export interface TrialStatus {
  ent: TrialStatusItem
}

export interface CurrentTariff {
  code: string
  name: LocalizedText
  description?: LocalizedText | null
  tier: "free" | "trial" | "paid" | "admin" | string
  sourceType?: string | null
  subscriptionId?: string | null
  entitlementId?: string | null
  planTemplateId?: string | null
  startsAt?: string | null
  expiresAt?: string | null
  isActive?: boolean
  isPaid?: boolean
  examSlug?: string | null
  totalAttemptsLimit?: number | null
  dailyAttemptsLimit?: number | null
  usedAttemptsTotal?: number | null
  remainingAttempts?: number | null
}

export interface User {
  id: string
  telegramId?: number | null
  telegramUsername?: string | null
  username?: string | null
  email?: string | null
  phone?: string | null
  firstName?: string | null
  lastName?: string | null
  fullName?: LocalizedText
  avatarUrl?: string | null
  preferredLanguage?: "ru" | "kk" | "en" | string | null
  timezone?: string | null
  isChannelMember?: boolean
  isAdmin?: boolean | null
  hasActiveSubscription?: boolean
  currentTariff?: CurrentTariff | null
  accessByExam?: AccessByExamItem[]
  trialStatus?: TrialStatus
  createdAt?: string | null
  [key: string]: unknown
}

export interface AuthResponse {
  accessToken: string
  refreshToken: string
  user: User
}

export interface ExamType {
  id: string
  slug: string
  /** Legacy/generated clients may still pass `code`; canonical backend field is `slug`. */
  code?: string
  name: LocalizedText
  description?: LocalizedText | null
  isActive?: boolean
  createdAt?: string
  iconUrl?: string | null
}

export interface Subject {
  id: string
  examTypeId: string
  slug: string
  code?: string
  name: LocalizedText
  isMandatory: boolean
  sortOrder?: number
  isProfile?: boolean
}

export interface TestTemplateSection {
  id: string
  templateId?: string
  subjectId: string
  questionCount: number
  selectionMode?: string
  sortOrder?: number
  profileHeavyFrom?: number | null
  subject?: Subject
}

export interface TestTemplate {
  id: string
  examTypeId: string
  name: LocalizedText
  durationMins: number
  isActive?: boolean
  sections?: TestTemplateSection[]
  /** UI-only/legacy optional fields. */
  description?: LocalizedText
  totalQuestions?: number
  isPremium?: boolean
}

export interface AnswerOption {
  id: string
  content: LocalizedText
  sortOrder?: number
  isCorrect?: boolean
  /** Legacy UI optional fields. */
  text?: LocalizedText
  imageUrl?: string | null
}

export interface Question {
  id: string
  difficulty?: number
  type?: string
  content: unknown
  explanation?: unknown
  imageUrls?: unknown
  answerOptions: AnswerOption[]
  subjectId?: string
  subject?: { id: string; name: LocalizedText; slug: string }
  /** Legacy UI optional fields. */
  text?: LocalizedText
  imageUrl?: string | null
  subjectName?: LocalizedText
  options?: AnswerOption[]
  selectedIds?: string[]
  multiSelect?: boolean
}

export interface TestAnswer {
  id: string
  questionId: string
  selectedIds: string[]
  isCorrect: boolean | null
  earnedPoints?: number
  maxPoints?: number
  errorCount?: number
  reviewStatus?: "correct" | "partial" | "incorrect" | "unanswered"
  answeredAt?: string | null
  question: Question
}

export interface SessionMetadataSection {
  subjectId: string
  subjectName: LocalizedText
  subjectSlug: string
  isMandatory?: boolean
  questionCount: number
  sortOrder: number
  profileHeavyFrom?: number | null
}

export interface SessionMetadata {
  kind?: "remediation"
  entScope?: "mandatory" | "profile" | "full" | "creative"
  remediationDurationMins?: number
  entSessionDurationMins?: number
  sections?: SessionMetadataSection[]
  profileSubjectIds?: string[]
  questionOrder?: string[]
}

export interface SessionSectionScore {
  subjectId: string
  subjectName: LocalizedText
  subjectSlug: string
  correctCount: number
  totalCount: number
  score: number
  rawPoints?: number
  maxPoints?: number
}

export type QuestionAppealReason =
  | "incorrect_answer"
  | "ambiguous_wording"
  | "outdated_content"
  | "broken_media"
  | "other"

export type QuestionAppealStatus =
  | "pending"
  | "under_review"
  | "resolved"
  | "rejected"

export interface QuestionAppeal {
  id: string
  userId?: string
  sessionId: string
  questionId: string
  examTypeId?: string
  subjectId?: string
  reason: QuestionAppealReason
  message: string
  status: QuestionAppealStatus
  adminNote?: string | null
  reviewedAt?: string | null
  createdAt: string
  updatedAt: string
}

export interface TestSession {
  id: string
  examTypeId: string
  templateId?: string | null
  status: "in_progress" | "completed" | "timed_out" | "abandoned"
  language?: "ru" | "kk" | string
  startedAt?: string
  finishedAt?: string | null
  durationSecs?: number | null
  timeRemaining?: number | null
  totalQuestions?: number
  correctCount?: number | null
  score?: number | null
  rawScore?: number | null
  maxScore?: number | null
  metadata?: SessionMetadata | null
  answers?: TestAnswer[]
  examType?: ExamType
  sectionScores?: SessionSectionScore[]
  sectionsScores?: SessionSectionScore[]
  appeals?: QuestionAppeal[]
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  limit: number
}

export type SessionListItem = TestSession
export type ReviewResponse = TestSession

export interface BillingPlan {
  id: string
  code?: string
  name: LocalizedText
  description?: LocalizedText
  priceKzt?: number | null
  originalPriceKzt?: number | null
  priceCents?: number | null
  price?: number | null
  currency?: string
  durationDays?: number
  isPremium?: boolean
  features?: LocalizedText[]
  oldPrice?: number | null
  highlight?: string | null
  badge?: string | null
}

export interface CheckoutResponse {
  orderId: string
  checkoutUrl?: string
  paymentUrl?: string
}

export interface UserExamStats {
  examTypeId: string
  examSlug: string
  examType: ExamType
  testsCount: number
  totalSessionsCount?: number
  completedCount?: number
  timedOutCount?: number
  averageScore: number | null
  bestScore: number | null
  bestRawScore?: number | null
  bestMaxScore?: number | null
  worstScore?: number | null
  averageCorrectPercent?: number | null
  averageDurationSecs?: number | null
  lastFinishedAt?: string | null
  firstFinishedAt?: string | null
  inProgressCount?: number
  recentScores?: number[]
}

export interface UserStats {
  totalTests: number
  completedTests: number
  inProgressSessionsCount?: number
  averageScore: number
  byExamType?: UserExamStats[]
  /** Legacy optional fields kept for tolerant UI rendering. */
  bestScore?: number
  weeklyStreak?: number
}

export interface MistakesSummary {
  openTotal: number
  openByExam: {
    examTypeId: string
    examSlug: string
    examName: LocalizedText | null
    count: number
  }[]
  openBySubject: {
    examTypeId: string
    examSlug: string
    examName: LocalizedText | null
    subjectId: string
    subjectSlug: string
    subjectName: LocalizedText | null
    count: number
  }[]
  recentRecoveries: {
    questionId: string
    examTypeId: string
    examSlug: string
    examName: LocalizedText
    subjectSlug: string
    subjectName: LocalizedText
    sessionId: string
    recoveredAt: string
  }[]
}

export interface LeaderboardEntry {
  rank?: number | null
  position?: number | null
  userId?: string | null
  user?: {
    id?: string
    fullName?: LocalizedText
    firstName?: LocalizedText
    lastName?: LocalizedText
    name?: LocalizedText
    displayName?: LocalizedText
    username?: string | null
    phone?: string | null
    avatarUrl?: string | null
  } | null
  fullName?: LocalizedText
  firstName?: LocalizedText
  lastName?: LocalizedText
  name?: LocalizedText
  displayName?: LocalizedText
  displayNameText?: string
  username?: string | null
  telegramUsername?: string | null
  phone?: string | null
  avatarUrl?: string | null
  bestScore?: number | null
  score?: number | null
  rawScore?: number | null
  maxScore?: number | null
  bestRawScore?: number | null
  bestMaxScore?: number | null
  totalScore?: number | null
  total?: number | null
  points?: number | null
  value?: number | null
  durationSecs?: number | null
  finishedAt?: string | null
  sessionId?: string | null
  profileSubjects?: string[]
  totalTests?: number | null
  testsCount?: number | null
  attempts?: number | null
  attemptsCount?: number | null
  [key: string]: unknown
}

export interface AdmissionCycle {
  id: string
  slug: string
  sortOrder: number
}

export interface University {
  code: number
  name: string
  shortName: string | null
}

export interface AdmissionProgram {
  id: string
  code: string
  profileVariant?: number
  name: string
  profileSubjects?: string
  profileShortLabel?: string | null
}

export interface CompareResult {
  total: number
  passesEntThresholds: boolean
  cutoff: number | null
  hasCutoff: boolean
  gapToCutoff: number | null
}

export interface ChanceProgram {
  cycleSlug: string
  programId: string
  programCode: string
  programName: string
  profileSubjects: string
  profileVariant?: number
  displayedQuotaType: "GRANT" | "RURAL"
  displayedMinScore: number | null
  universityCount: number
  isPass: boolean
  total: number
  gapToCutoff: number | null
}

export interface ChanceUniversity {
  cycleSlug: string
  universityCode: number
  universityName: string
  universityShortName: string | null
  programId: string
  programCode: string
  programName: string
  profileSubjects: string
  profileVariant?: number
  displayedQuotaType: "GRANT" | "RURAL"
  displayedMinScore: number | null
  isPass: boolean
  total: number
  gapToCutoff: number | null
}
