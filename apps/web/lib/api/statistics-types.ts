import type { LocalizedText } from "./i18n"

export type StatisticsAttempt = {
  sessionId: string
  examTypeId: string
  examName: LocalizedText
  date: string
  rawScore: number | null
  maxScore: number | null
  percent: number | null
  status: string
  language: string
  durationSecs: number | null
  totalQuestions: number
}
export type StatisticsReport = {
  exams: { id: string; slug: string; name: LocalizedText }[]
  filters: {
    period: "30" | "90" | "all"
    format: "exam" | "practice"
    examTypeId?: string
    page: number
  }
  summary: {
    total: number
    scored: number
    unscored: number
    averagePercent: number | null
    latest: StatisticsAttempt | null
    best: StatisticsAttempt | null
    deltaPercentPoints: number | null
    totalDurationSecs: number | null
    timedOutCount: number
  }
  subjects: {
    subjectId: string
    subjectName: LocalizedText
    examTypeId: string
    total: number
    correct: number
    accuracy: number
  }[]
  chart: StatisticsAttempt[]
  chartLimit: number
  history: StatisticsAttempt[]
  page: number
  pageCount: number
  limit: number
  generatedAt: string
}
