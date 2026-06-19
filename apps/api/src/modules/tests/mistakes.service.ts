import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';

export type MistakeLatestRow = {
  questionId: string;
  isCorrect: boolean;
  examTypeId: string;
  subjectId: string;
  topicId: string;
};

export type MistakeRecoveryRow = {
  questionId: string;
  finishedAt: Date;
  examTypeId: string;
  sessionId: string;
  subjectSlug: string;
  examSlug: string;
  /** Json { kk, ru, en } из exam_types */
  examName: unknown;
  /** Json { kk, ru, en } из subjects */
  subjectName: unknown;
};

/** The student's latest graded answer to a question (for AI explanation/analysis). */
export type LatestAnswerRow = {
  questionId: string;
  selectedIds: string[];
  timeSpentSecs: number | null;
};

/** Deterministic ЕНТ score projection shown on the mistakes page. */
export type EntScoreImpact =
  | { available: false }
  | {
      available: true;
      lastScore: number;
      maxScore: number;
      lastTakenAt: string | null;
      openCount: number;
      recoverable: number;
      potentialScore: number;
      resolvedCount: number;
      baselineTier: string;
      potentialTier: string;
    };

type SubjectTopicMistakeRow = {
  topicId: string;
  topicName: unknown;
  sortOrder: number;
  openCount: number | bigint;
  activeOpenCount: number | bigint;
  lastWrongAt: Date | null;
};

/** Grant-readiness band by total ЕНТ score (out of 140). */
function entTierLabel(total: number): string {
  if (total < 50) return 'ниже порога';
  if (total < 65) return 'база';
  if (total < 75) return 'грант реален';
  if (total < 100) return 'сильный результат';
  return 'топовый результат';
}

@Injectable()
export class MistakesService {
  constructor(private prisma: PrismaService) {}

  /** Latest graded outcome per question (finished sessions only). */
  async getLatestOutcomes(userId: string): Promise<MistakeLatestRow[]> {
    return this.prisma.$queryRaw<MistakeLatestRow[]>`
      SELECT DISTINCT ON (ta.question_id)
        ta.question_id AS "questionId",
        ta.is_correct AS "isCorrect",
        ts.exam_type_id AS "examTypeId",
        q.subject_id AS "subjectId",
        q.topic_id AS "topicId"
      FROM test_answers ta
      INNER JOIN test_sessions ts ON ts.id = ta.session_id
      INNER JOIN questions q ON q.id = ta.question_id
      WHERE ts.user_id = ${userId}::uuid
        AND ts.status IN ('completed', 'timed_out')
        AND ta.is_correct IS NOT NULL
      ORDER BY ta.question_id, ts.finished_at DESC NULLS LAST, ts.id DESC
    `;
  }

  /** Correct answer immediately after a wrong one for the same question (any finished session). */
  async getRecentRecoveries(userId: string, take = 25): Promise<MistakeRecoveryRow[]> {
    return this.prisma.$queryRaw<MistakeRecoveryRow[]>`
      WITH attempts AS (
        SELECT
          ta.question_id AS "questionId",
          ta.is_correct AS "isCorrect",
          ts.finished_at AS "finishedAt",
          ts.exam_type_id AS "examTypeId",
          ts.id AS "sessionId",
          LAG(ta.is_correct) OVER (
            PARTITION BY ta.question_id
            ORDER BY ts.finished_at ASC NULLS LAST, ts.id ASC, ta.id ASC
          ) AS "prevCorrect"
        FROM test_answers ta
        INNER JOIN test_sessions ts ON ts.id = ta.session_id
        WHERE ts.user_id = ${userId}::uuid
          AND ts.status IN ('completed', 'timed_out')
          AND ta.is_correct IS NOT NULL
      )
      SELECT
        a."questionId",
        a."finishedAt",
        a."examTypeId",
        a."sessionId",
        s.slug AS "subjectSlug",
        et.slug AS "examSlug",
        et.name AS "examName",
        s.name AS "subjectName"
      FROM attempts a
      INNER JOIN questions q ON q.id = a."questionId"
      INNER JOIN subjects s ON s.id = q.subject_id
      INNER JOIN exam_types et ON et.id = a."examTypeId"
      WHERE a."isCorrect" = true
        AND a."prevCorrect" = false
      ORDER BY a."finishedAt" DESC
      LIMIT ${take}
    `;
  }

  async getSummary(userId: string) {
    const latest = await this.getLatestOutcomes(userId);
    const open = latest.filter((r) => r.isCorrect === false);
    const byExam = new Map<string, number>();
    const bySubject = new Map<
      string,
      { examTypeId: string; subjectId: string; count: number }
    >();
    for (const r of open) {
      byExam.set(r.examTypeId, (byExam.get(r.examTypeId) ?? 0) + 1);
      const subjectKey = `${r.examTypeId}:${r.subjectId}`;
      const current = bySubject.get(subjectKey);
      if (current) {
        current.count++;
      } else {
        bySubject.set(subjectKey, {
          examTypeId: r.examTypeId,
          subjectId: r.subjectId,
          count: 1,
        });
      }
    }

    const examIds = [...byExam.keys()];
    const subjectIds = [
      ...new Set([...bySubject.values()].map((r) => r.subjectId)),
    ];
    const exams = await this.prisma.examType.findMany({
      where: { id: { in: examIds } },
      select: { id: true, slug: true, name: true },
    });
    const subjects = await this.prisma.subject.findMany({
      where: { id: { in: subjectIds } },
      select: { id: true, slug: true, name: true, examTypeId: true },
    });
    const examMap = new Map(exams.map((e) => [e.id, e]));
    const subjectMap = new Map(subjects.map((s) => [s.id, s]));

    const openByExam = examIds
      .map((id) => ({
        examTypeId: id,
        examSlug: examMap.get(id)?.slug ?? '',
        examName: examMap.get(id)?.name ?? null,
        count: byExam.get(id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const openBySubject = [...bySubject.values()]
      .map((row) => {
        const subject = subjectMap.get(row.subjectId);
        const exam = examMap.get(row.examTypeId);
        return {
          examTypeId: row.examTypeId,
          examSlug: exam?.slug ?? '',
          examName: exam?.name ?? null,
          subjectId: row.subjectId,
          subjectSlug: subject?.slug ?? '',
          subjectName: subject?.name ?? null,
          count: row.count,
        };
      })
      .sort((a, b) => b.count - a.count);

    const rawRecoveries = await this.getRecentRecoveries(userId, 25);
    const recentRecoveries = rawRecoveries.map((r) => ({
      questionId: r.questionId,
      examTypeId: r.examTypeId,
      examSlug: r.examSlug,
      examName: r.examName,
      subjectSlug: r.subjectSlug,
      subjectName: r.subjectName,
      sessionId: r.sessionId,
      recoveredAt: r.finishedAt.toISOString(),
    }));

    const scoreImpact = await this.computeEntScoreImpact(userId, open, rawRecoveries);

    return {
      openTotal: open.length,
      openByExam,
      openBySubject,
      recentRecoveries,
      scoreImpact,
    };
  }

  async getSubjectDetail(userId: string, subjectId: string, examTypeId?: string) {
    const subject = await this.prisma.subject.findFirst({
      where: {
        id: subjectId,
        ...(examTypeId ? { examTypeId } : {}),
      },
      include: {
        examType: { select: { id: true, slug: true, name: true } },
      },
    });
    if (!subject) throw new NotFoundException('SUBJECT_NOT_FOUND');

    const examFilter = examTypeId
      ? Prisma.sql`AND latest."examTypeId" = ${examTypeId}::uuid`
      : Prisma.empty;

    const rows = await this.prisma.$queryRaw<SubjectTopicMistakeRow[]>`
      WITH latest AS (
        SELECT DISTINCT ON (ta.question_id)
          ta.question_id AS "questionId",
          ta.is_correct AS "isCorrect",
          ts.exam_type_id AS "examTypeId",
          q.subject_id AS "subjectId",
          q.topic_id AS "topicId",
          q.is_active AS "isActive",
          ts.finished_at AS "lastWrongAt"
        FROM test_answers ta
        INNER JOIN test_sessions ts ON ts.id = ta.session_id
        INNER JOIN questions q ON q.id = ta.question_id
        WHERE ts.user_id = ${userId}::uuid
          AND ts.status IN ('completed', 'timed_out')
          AND ta.is_correct IS NOT NULL
        ORDER BY ta.question_id, ts.finished_at DESC NULLS LAST, ts.id DESC
      )
      SELECT
        t.id AS "topicId",
        t.name AS "topicName",
        t.sort_order AS "sortOrder",
        COUNT(*)::int AS "openCount",
        SUM(CASE WHEN latest."isActive" THEN 1 ELSE 0 END)::int AS "activeOpenCount",
        MAX(latest."lastWrongAt") AS "lastWrongAt"
      FROM latest
      INNER JOIN topics t ON t.id = latest."topicId"
      WHERE latest."isCorrect" = false
        AND latest."subjectId" = ${subjectId}::uuid
        ${examFilter}
      GROUP BY t.id, t.name, t.sort_order
      ORDER BY "openCount" DESC, t.sort_order ASC, t.id ASC
    `;

    const topics = rows.map((row) => ({
      topicId: row.topicId,
      topicName: row.topicName,
      sortOrder: row.sortOrder,
      openCount: Number(row.openCount) || 0,
      activeOpenCount: Number(row.activeOpenCount) || 0,
      lastWrongAt: row.lastWrongAt ? row.lastWrongAt.toISOString() : null,
    }));
    const openTotal = topics.reduce((sum, topic) => sum + topic.openCount, 0);
    const activeOpenTotal = topics.reduce((sum, topic) => sum + topic.activeOpenCount, 0);

    return {
      examTypeId: subject.examTypeId,
      examSlug: subject.examType.slug,
      examName: subject.examType.name,
      subjectId: subject.id,
      subjectSlug: subject.slug,
      subjectName: subject.name,
      isMandatory: subject.isMandatory,
      openTotal,
      activeOpenTotal,
      topicCount: topics.length,
      topics,
    };
  }

  /**
   * Deterministic ЕНТ score projection: "you scored X on your last full ЕНТ;
   * closing your open mistakes would take you to ~Y". Each open mistake counts as
   * ≈1 recoverable point (conservative — profile questions are worth up to 2),
   * capped at the points actually lost on that exam. Recomputed on every summary
   * load, so it updates as the student closes mistakes / takes new exams.
   */
  private async computeEntScoreImpact(
    userId: string,
    open: MistakeLatestRow[],
    recoveries: MistakeRecoveryRow[],
  ): Promise<EntScoreImpact> {
    const entExam = await this.prisma.examType.findFirst({
      where: { slug: 'ent' },
      select: { id: true },
    });
    if (!entExam) return { available: false };

    // Most recent FULL ЕНТ attempt (maxScore ~140 excludes remediation/single-subject practice).
    const lastEnt = await this.prisma.testSession.findFirst({
      where: {
        userId,
        examTypeId: entExam.id,
        status: { in: ['completed', 'timed_out'] },
        rawScore: { not: null },
        maxScore: { gte: 100 },
      },
      orderBy: { finishedAt: 'desc' },
      select: { rawScore: true, maxScore: true, finishedAt: true },
    });
    if (!lastEnt || lastEnt.rawScore == null || lastEnt.maxScore == null) {
      return { available: false };
    }

    const lastScore = lastEnt.rawScore;
    const maxScore = lastEnt.maxScore;
    const openCount = open.filter((r) => r.examTypeId === entExam.id).length;
    const lostPoints = Math.max(0, maxScore - lastScore);
    const recoverable = Math.min(openCount, lostPoints);
    const potentialScore = Math.min(maxScore, lastScore + recoverable);
    const resolvedCount = recoveries.filter((r) => r.examTypeId === entExam.id).length;

    return {
      available: true,
      lastScore,
      maxScore,
      lastTakenAt: lastEnt.finishedAt ? lastEnt.finishedAt.toISOString() : null,
      openCount,
      recoverable,
      potentialScore,
      resolvedCount,
      baselineTier: entTierLabel(lastScore),
      potentialTier: entTierLabel(potentialScore),
    };
  }

  /**
   * The student's latest graded answer (selected option ids + time spent) for the
   * given questions. Used by the AI coach to explain *why* the student went wrong.
   */
  async getLatestAnswersForQuestions(
    userId: string,
    questionIds: string[],
  ): Promise<LatestAnswerRow[]> {
    if (questionIds.length === 0) return [];
    return this.prisma.$queryRaw<LatestAnswerRow[]>`
      SELECT DISTINCT ON (ta.question_id)
        ta.question_id AS "questionId",
        ta.selected_ids AS "selectedIds",
        ta.time_spent_secs AS "timeSpentSecs"
      FROM test_answers ta
      INNER JOIN test_sessions ts ON ts.id = ta.session_id
      WHERE ts.user_id = ${userId}::uuid
        AND ta.question_id = ANY(${questionIds}::uuid[])
        AND ts.status IN ('completed', 'timed_out')
        AND ta.is_correct IS NOT NULL
      ORDER BY ta.question_id, ts.finished_at DESC NULLS LAST, ts.id DESC
    `;
  }

  getOpenMistakeQuestionIds(
    latest: MistakeLatestRow[],
    examTypeId?: string,
    subjectId?: string,
    topicId?: string,
  ): string[] {
    const open = latest.filter((r) => r.isCorrect === false);
    const filtered = examTypeId
      ? open.filter((r) => r.examTypeId === examTypeId)
      : open;
    const subjectFiltered = subjectId
      ? filtered.filter((r) => r.subjectId === subjectId)
      : filtered;
    const topicFiltered = topicId
      ? subjectFiltered.filter((r) => r.topicId === topicId)
      : subjectFiltered;
    return topicFiltered.map((r) => r.questionId);
  }
}
