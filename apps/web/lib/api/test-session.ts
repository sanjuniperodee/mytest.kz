import { localize, type Locale, type LocalizedText } from "./i18n"
import type {
  AnswerOption,
  SessionMetadataSection,
  SessionSectionScore,
  TestAnswer,
  TestSession,
} from "./types"

export interface QuestionDisplayParts {
  passage: string | null
  topicLine: string | null
  stem: string
}

export interface FlatSessionQuestion {
  id: string
  answerId: string
  content: unknown
  subjectName: LocalizedText
  subjectSlug?: string
  imageUrls: string[]
  answerOptions: AnswerOption[]
  selectedIds: string[]
  isCorrect: boolean | null
  explanation: unknown
  hasExplanation: boolean
  multiSelect: boolean
  sectionId: string
  sectionTitle: string
  sectionIndex: number
  display: QuestionDisplayParts
}

export interface ReviewSectionModel {
  id: string
  title: string
  subjectName: LocalizedText
  subjectSlug?: string
  correctCount: number
  totalCount: number
  score?: number
  questions: FlatSessionQuestion[]
}

type ContentSlot = {
  text?: string
  topicLine?: string
  passage?: string
}

const FALLBACK_LOCALES: Locale[] = ["ru", "kk", "en"]

function localeOrder(locale: Locale): Locale[] {
  return [locale, ...FALLBACK_LOCALES.filter((item) => item !== locale)]
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null
}

function pickSlot(value: unknown, locale: Locale): ContentSlot | null {
  if (typeof value === "string") return { text: value }
  const root = asRecord(value)
  if (!root) return null
  const raw = root[locale]
  if (typeof raw === "string") return { text: raw }
  const slot = asRecord(raw)
  if (slot) {
    return {
      text: typeof slot.text === "string" ? slot.text : "",
      topicLine: typeof slot.topicLine === "string" ? slot.topicLine : "",
      passage: typeof slot.passage === "string" ? slot.passage : "",
    }
  }
  return null
}

export function getQuestionDisplayParts(
  content: unknown,
  locale: Locale,
): QuestionDisplayParts {
  for (const loc of localeOrder(locale)) {
    const slot = pickSlot(content, loc)
    if (!slot) continue
    const passage = (slot.passage || "").trim()
    const topicLine = (slot.topicLine || "").trim()
    const stem = (slot.text || "").trim()
    if (passage || topicLine || stem) {
      return {
        passage: passage || null,
        topicLine: topicLine || null,
        stem,
      }
    }
  }

  const root = asRecord(content)
  if (root) {
    const passage = typeof root.passage === "string" ? root.passage.trim() : ""
    const topicLine = typeof root.topicLine === "string" ? root.topicLine.trim() : ""
    const stem = typeof root.text === "string" ? root.text.trim() : ""
    if (passage || topicLine || stem) {
      return {
        passage: passage || null,
        topicLine: topicLine || null,
        stem,
      }
    }
  }

  return {
    passage: null,
    topicLine: null,
    stem: localize(content as LocalizedText, locale),
  }
}

function imageUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string" && item.trim() !== "")
}

function orderedAnswers(session: TestSession): TestAnswer[] {
  const answers = [...(session.answers || [])]
  const order = session.metadata?.questionOrder
  if (!order?.length) return answers
  const rank = new Map(order.map((id, idx) => [id, idx]))
  return answers.sort((a, b) => {
    const ai = rank.get(a.questionId) ?? Number.MAX_SAFE_INTEGER
    const bi = rank.get(b.questionId) ?? Number.MAX_SAFE_INTEGER
    if (ai !== bi) return ai - bi
    return a.id.localeCompare(b.id)
  })
}

function sortedMetadataSections(session: TestSession): SessionMetadataSection[] {
  return [...(session.metadata?.sections || [])].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  )
}

function sectionForIndex(
  sections: SessionMetadataSection[],
  index: number,
): { section: SessionMetadataSection | null; sectionIndex: number } {
  let start = 0
  for (let i = 0; i < sections.length; i += 1) {
    const count = Math.max(0, sections[i]?.questionCount ?? 0)
    if (index >= start && index < start + count) {
      return { section: sections[i] ?? null, sectionIndex: i }
    }
    start += count
  }
  return { section: null, sectionIndex: sections.length }
}

function isMultiSelect(type: string | undefined, answerOptions: AnswerOption[]) {
  if (type && !["single_choice", "single", "radio"].includes(type)) return true
  const correctCount = answerOptions.filter((option) => option.isCorrect).length
  return correctCount > 1
}

export function flattenSessionQuestions(
  session: TestSession,
  locale: Locale,
): FlatSessionQuestion[] {
  const sections = sortedMetadataSections(session)
  return orderedAnswers(session).map((answer, index) => {
    const { section, sectionIndex } = sectionForIndex(sections, index)
    const question = answer.question
    const subject = question.subject
    const subjectName = section?.subjectName ?? subject?.name ?? ""
    const sectionTitle =
      localize(section?.subjectName ?? subject?.name, locale) ||
      section?.subjectSlug ||
      subject?.slug ||
      ""
    const options = [...(question.answerOptions || [])].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
    )

    return {
      id: question.id,
      answerId: answer.id,
      content: question.content,
      subjectName,
      subjectSlug: section?.subjectSlug ?? subject?.slug,
      imageUrls: imageUrls(question.imageUrls),
      answerOptions: options,
      selectedIds: answer.selectedIds || [],
      isCorrect: answer.isCorrect,
      explanation: question.explanation,
      hasExplanation: question.explanation != null,
      multiSelect: isMultiSelect(question.type, options),
      sectionId: section?.subjectId ?? subject?.id ?? `section-${sectionIndex}`,
      sectionTitle,
      sectionIndex,
      display: getQuestionDisplayParts(question.content, locale),
    }
  })
}

function scoreForSection(
  scores: SessionSectionScore[] | undefined,
  section: SessionMetadataSection | null,
) {
  if (!section) return undefined
  return scores?.find((score) => score.subjectId === section.subjectId)
}

export function buildReviewSections(
  session: TestSession,
  locale: Locale,
): ReviewSectionModel[] {
  const questions = flattenSessionQuestions(session, locale)
  const sections = sortedMetadataSections(session)
  const scores = session.sectionScores || session.sectionsScores || []

  if (sections.length === 0) {
    return [
      {
        id: "all",
        title: "Вопросы",
        subjectName: "Вопросы",
        correctCount: questions.filter((q) => q.isCorrect === true).length,
        totalCount: questions.length,
        questions,
      },
    ]
  }

  return sections.map((section, index) => {
    const sectionQuestions = questions.filter((q) => q.sectionIndex === index)
    const sectionScore = scoreForSection(scores, section)
    const correctCount =
      sectionScore?.correctCount ?? sectionQuestions.filter((q) => q.isCorrect === true).length
    const totalCount = sectionScore?.totalCount ?? sectionQuestions.length
    const title =
      localize(section.subjectName, locale) || section.subjectSlug || `Раздел ${index + 1}`

    return {
      id: section.subjectId || `section-${index}`,
      title,
      subjectName: section.subjectName,
      subjectSlug: section.subjectSlug,
      correctCount,
      totalCount,
      score: sectionScore?.score,
      questions: sectionQuestions,
    }
  })
}
