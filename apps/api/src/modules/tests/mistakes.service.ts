import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

export type MistakeLatestRow = {
  questionId: string;
  isCorrect: boolean;
  examTypeId: string;
};

export type MistakeRecoveryRow = {
  questionId: string;
  finishedAt: Date;
  examTypeId: string;
  sessionId: string;
  subjectSlug: string;
  examSlug: string;
};

@Injectable()
export class MistakesService {
  constructor(private prisma: PrismaService) {}

  /** Latest graded outcome per question (finished sessions only). */
  async getLatestOutcomes(userId: string): Promise<MistakeLatestRow[]> {
    return this.prisma.$queryRaw<MistakeLatestRow[]>`
      SELECT DISTINCT ON (ta.question_id)
        ta.question_id AS "questionId",
        ta.is_correct AS "isCorrect",
        ts.exam_type_id AS "examTypeId"
      FROM test_answers ta
      INNER JOIN test_sessions ts ON ts.id = ta.session_id
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
        et.slug AS "examSlug"
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
    for (const r of open) {
      byExam.set(r.examTypeId, (byExam.get(r.examTypeId) ?? 0) + 1);
    }

    const examIds = [...byExam.keys()];
    const exams = await this.prisma.examType.findMany({
      where: { id: { in: examIds } },
      select: { id: true, slug: true, name: true },
    });
    const examMap = new Map(exams.map((e) => [e.id, e]));

    const openByExam = examIds
      .map((id) => ({
        examTypeId: id,
        examSlug: examMap.get(id)?.slug ?? '',
        count: byExam.get(id) ?? 0,
      }))
      .sort((a, b) => b.count - a.count);

    const rawRecoveries = await this.getRecentRecoveries(userId, 25);
    const recentRecoveries = rawRecoveries.map((r) => ({
      questionId: r.questionId,
      examTypeId: r.examTypeId,
      examSlug: r.examSlug,
      subjectSlug: r.subjectSlug,
      sessionId: r.sessionId,
      recoveredAt: r.finishedAt.toISOString(),
    }));

    return {
      openTotal: open.length,
      openByExam,
      recentRecoveries,
    };
  }

  getOpenMistakeQuestionIds(
    latest: MistakeLatestRow[],
    examTypeId?: string,
  ): string[] {
    const open = latest.filter((r) => r.isCorrect === false);
    const filtered = examTypeId
      ? open.filter((r) => r.examTypeId === examTypeId)
      : open;
    return filtered.map((r) => r.questionId);
  }
}
