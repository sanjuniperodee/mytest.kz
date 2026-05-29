import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import {
  ENT_CONFIG,
  type EntScope,
  earnEntQuestionPoints,
  getEntProfileIntrinsicMaxPoints,
} from '@bilimland/shared';

export interface SectionScore {
  subjectId: string;
  subjectName: unknown;
  subjectSlug: string;
  correctCount: number;
  totalCount: number;
  /** Доля верных в секции по весам ЕНТ (0–100), если maxPoints > 0 */
  score: number;
  /** Сумма набранных / максимальных весовых баллов по секции (ЕНТ) */
  rawPoints?: number;
  maxPoints?: number;
}

export type ReviewAnswerStatus =
  | 'correct'
  | 'partial'
  | 'incorrect'
  | 'unanswered';

export interface AnswerScore {
  answerId: string;
  questionId: string;
  earnedPoints: number;
  maxPoints: number;
  errorCount: number;
  reviewStatus: ReviewAnswerStatus;
}

interface ScoreResult {
  correctCount: number;
  rawScore: number;
  maxScore: number;
  score: number; // percentage
  sections: SectionScore[];
  answerScores: AnswerScore[];
}

type QuestionPlacement = {
  subjectId: string;
  isMandatory: boolean;
  /** 1-based индекс вопроса внутри секции предмета */
  indexInSubject: number;
  /** С какого индекса (1-based) в секции — 2 балла; null → 31 */
  profileHeavyFrom: number | null;
};

/** ЕНТ профиль: до порога — 1 балл, с порога — 2 (по умолчанию порог 31). */
function entProfileMaxPoints(indexInSubject: number, profileHeavyFrom: number | null): number {
  const from = profileHeavyFrom ?? 31;
  return indexInSubject < from ? 1 : 2;
}

/** ЕНТ full (строгий): профиль 1-30 = 1 балл, 31-40 = 2 балла. */
function entStrictFullMaxPoints(p: QuestionPlacement): number {
  if (p.isMandatory) return 1;
  return p.indexInSubject <= ENT_CONFIG.profileTier1Count
    ? ENT_CONFIG.profileTier1Points
    : ENT_CONFIG.profileTier2Points;
}

function getEntScope(metadata: unknown): EntScope | undefined {
  if (!metadata || typeof metadata !== 'object') return undefined;
  const scope = (metadata as { entScope?: unknown }).entScope;
  if (
    scope === 'mandatory' ||
    scope === 'profile' ||
    scope === 'full' ||
    scope === 'creative'
  ) {
    return scope;
  }
  return undefined;
}

function buildQuestionPlacementFromMetadata(metadata: unknown): Map<string, QuestionPlacement> | null {
  if (!metadata || typeof metadata !== 'object') return null;
  const m = metadata as {
    questionOrder?: string[];
    sections?: Array<{
      subjectId: string;
      questionCount?: number;
      isMandatory?: boolean;
      sortOrder?: number;
      profileHeavyFrom?: number | null;
    }>;
  };
  const order = Array.isArray(m.questionOrder) ? m.questionOrder : [];
  const rawSections = Array.isArray(m.sections) ? m.sections : [];
  if (order.length === 0 || rawSections.length === 0) return null;

  const sections = [...rawSections].sort(
    (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0),
  );
  const map = new Map<string, QuestionPlacement>();
  let ptr = 0;
  for (const sec of sections) {
    const n = Math.max(0, Math.floor(Number(sec.questionCount) || 0));
    const isMandatory = sec.isMandatory !== false;
    const heavy =
      sec.profileHeavyFrom === undefined || sec.profileHeavyFrom === null
        ? null
        : Math.max(1, Math.floor(Number(sec.profileHeavyFrom) || 31));
    for (let i = 0; i < n; i++) {
      const qid = order[ptr++];
      if (!qid) return map.size > 0 ? map : null;
      map.set(qid, {
        subjectId: sec.subjectId,
        isMandatory,
        indexInSubject: i + 1,
        profileHeavyFrom: heavy,
      });
    }
  }
  return map;
}

function entMaxPointsForPlacement(
  p: QuestionPlacement,
  questionScoreWeight: number | null | undefined,
): number {
  if (questionScoreWeight != null) {
    const w = Math.round(Number(questionScoreWeight));
    if (Number.isFinite(w)) return Math.max(1, Math.min(5, w));
  }
  if (p.isMandatory) return 1;
  return entProfileMaxPoints(p.indexInSubject, p.profileHeavyFrom);
}

function getReviewAnswerStatus(
  selectedIds: readonly string[],
  earnedPoints: number,
  maxPoints: number,
): ReviewAnswerStatus {
  if (selectedIds.length === 0) return 'unanswered';
  if (maxPoints > 0 && earnedPoints >= maxPoints) return 'correct';
  if (earnedPoints > 0) return 'partial';
  return 'incorrect';
}

@Injectable()
export class TestScorerService {
  constructor(private prisma: PrismaService) {}

  private async persistAnswerCorrectness(
    correctAnswerIds: string[],
    incorrectAnswerIds: string[],
  ): Promise<void> {
    const answerDelegate = this.prisma.testAnswer as typeof this.prisma.testAnswer & {
      updateMany?: typeof this.prisma.testAnswer.updateMany;
    };

    if (typeof answerDelegate.updateMany === 'function') {
      await Promise.all([
        correctAnswerIds.length > 0
          ? answerDelegate.updateMany({
              where: { id: { in: correctAnswerIds } },
              data: { isCorrect: true },
            })
          : Promise.resolve(),
        incorrectAnswerIds.length > 0
          ? answerDelegate.updateMany({
              where: { id: { in: incorrectAnswerIds } },
              data: { isCorrect: false },
            })
          : Promise.resolve(),
      ]);
      return;
    }

    await Promise.all([
      ...correctAnswerIds.map((id) =>
        this.prisma.testAnswer.update({
          where: { id },
          data: { isCorrect: true },
        }),
      ),
      ...incorrectAnswerIds.map((id) =>
        this.prisma.testAnswer.update({
          where: { id },
          data: { isCorrect: false },
        }),
      ),
    ]);
  }

  async calculateScore(sessionId: string): Promise<ScoreResult> {
    const session = await this.prisma.testSession.findUnique({
      where: { id: sessionId },
      include: {
        examType: true,
        answers: {
          include: {
            question: {
              include: {
                answerOptions: true,
                subject: { select: { id: true, name: true, slug: true, isMandatory: true } },
              },
            },
          },
        },
      },
    });

    if (!session) throw new Error('Session not found');

    const examSlug = (session.examType as { slug?: string }).slug ?? '';
    const entScope = getEntScope(session.metadata);
    const placement = buildQuestionPlacementFromMetadata(session.metadata);

    let correctCount = 0;
    const totalQuestions = session.answers.length;

    const sectionAgg = new Map<
      string,
      {
        subjectId: string;
        subjectName: unknown;
        subjectSlug: string;
        correctCount: number;
        totalCount: number;
        rawPoints: number;
        maxPoints: number;
      }
    >();

    let weightedRaw = 0;
    let weightedMax = 0;
    const answerScores: AnswerScore[] = [];
    const correctAnswerIds: string[] = [];
    const incorrectAnswerIds: string[] = [];
    const entWeightedActive =
      examSlug === 'ent' &&
      placement !== null &&
      placement.size > 0 &&
      placement.size === session.answers.length &&
      session.answers.every((a) => placement.has(a.questionId));
    const strictEntFullActive =
      entWeightedActive &&
      examSlug === 'ent' &&
      entScope === 'full';

    for (const answer of session.answers) {
      const correctOptionIds = answer.question.answerOptions
        .filter((o) => o.isCorrect)
        .map((o) => o.id);

      const selectedIds = answer.selectedIds;

      const subject = (answer.question as { subject?: { id: string; name: unknown; slug: string; isMandatory: boolean } }).subject;
      const subjectId = subject?.id || answer.question.subjectId;
      const pos = entWeightedActive ? placement!.get(answer.questionId) : undefined;
      const qSw = (answer.question as { scoreWeight?: number | null }).scoreWeight;
      const wMax =
        entWeightedActive && pos
          ? strictEntFullActive
            ? pos.isMandatory
              ? entStrictFullMaxPoints(pos)
              : Math.min(
                  entStrictFullMaxPoints(pos),
                  getEntProfileIntrinsicMaxPoints(answer.question.answerOptions),
                )
            : entMaxPointsForPlacement(pos, qSw)
          : 1;

      const { earned: wEarned, errors } = earnEntQuestionPoints(
        wMax,
        correctOptionIds,
        selectedIds,
      );

      const isPerfectlyCorrect = selectedIds.length > 0 && errors === 0;
      const reviewStatus = getReviewAnswerStatus(selectedIds, wEarned, wMax);

      if (isPerfectlyCorrect) correctCount++;
      if (isPerfectlyCorrect) correctAnswerIds.push(answer.id);
      else incorrectAnswerIds.push(answer.id);

      weightedRaw += wEarned;
      weightedMax += wMax;
      answerScores.push({
        answerId: answer.id,
        questionId: answer.questionId,
        earnedPoints: wEarned,
        maxPoints: wMax,
        errorCount: errors,
        reviewStatus,
      });

      if (!sectionAgg.has(subjectId)) {
        sectionAgg.set(subjectId, {
          subjectId,
          subjectName: subject?.name,
          subjectSlug: subject?.slug || '',
          correctCount: 0,
          totalCount: 0,
          rawPoints: 0,
          maxPoints: 0,
        });
      }
      const sec = sectionAgg.get(subjectId)!;
      sec.totalCount++;
      if (isPerfectlyCorrect) sec.correctCount++;
      sec.rawPoints += wEarned;
      sec.maxPoints += wMax;
    }

    await this.persistAnswerCorrectness(correctAnswerIds, incorrectAnswerIds);

    if (entWeightedActive && weightedMax > 0) {
      const score = Math.round((weightedRaw / weightedMax) * 100 * 100) / 100;
      const sections: SectionScore[] = Array.from(sectionAgg.values()).map((s) => ({
        subjectId: s.subjectId,
        subjectName: s.subjectName,
        subjectSlug: s.subjectSlug,
        correctCount: s.correctCount,
        totalCount: s.totalCount,
        rawPoints: s.rawPoints,
        maxPoints: s.maxPoints,
        score:
          s.maxPoints > 0
            ? Math.round((s.rawPoints / s.maxPoints) * 100 * 100) / 100
            : 0,
      }));
      return {
        correctCount,
        rawScore: weightedRaw,
        maxScore: weightedMax,
        score,
        sections,
        answerScores,
      };
    }

    // Fallback: по одному баллу за вопрос (NUET, старые сессии ЕНТ без metadata)
    const rawScore = correctCount;
    const maxScore = totalQuestions;
    const score = maxScore > 0 ? Math.round((rawScore / maxScore) * 100 * 100) / 100 : 0;
    const sections: SectionScore[] = Array.from(sectionAgg.values()).map((s) => ({
      subjectId: s.subjectId,
      subjectName: s.subjectName,
      subjectSlug: s.subjectSlug,
      correctCount: s.correctCount,
      totalCount: s.totalCount,
      score:
        s.totalCount > 0
          ? Math.round((s.correctCount / s.totalCount) * 100 * 100) / 100
          : 0,
    }));

    return {
      correctCount,
      rawScore,
      maxScore,
      score,
      sections,
      answerScores,
    };
  }
}
