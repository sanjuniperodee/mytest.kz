import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { StatisticsFilter } from '../domain/statistics';

@Injectable()
export class StatisticsRepository {
  constructor(private readonly prisma: PrismaService) {}

  sessions(userId: string, filter: StatisticsFilter, now: Date) {
    const since =
      filter.period === 'all'
        ? undefined
        : new Date(now.getTime() - Number(filter.period) * 86400000);
    return this.prisma.testSession.findMany({
      where: {
        userId,
        status: { in: ['completed', 'timed_out'] },
        ...(filter.examTypeId ? { examTypeId: filter.examTypeId } : {}),
        finishedAt: { not: null, ...(since ? { gte: since } : {}), lte: now },
      },
      select: {
        id: true,
        examTypeId: true,
        examType: { select: { id: true, slug: true, name: true } },
        status: true,
        finishedAt: true,
        rawScore: true,
        maxScore: true,
        score: true,
        totalQuestions: true,
        durationSecs: true,
        language: true,
        metadata: true,
      },
    });
  }

  exams(userId: string) {
    return this.prisma.examType.findMany({
      where: {
        testSessions: {
          some: { userId, status: { in: ['completed', 'timed_out'] } },
        },
      },
      select: { id: true, slug: true, name: true },
      orderBy: { slug: 'asc' },
    });
  }

  async subjects(userId: string, sessionIds: string[]) {
    if (!sessionIds.length) return [];
    // Aggregate in Postgres; never download answer text/options or rescore old questions.
    const rows = await this.prisma.$queryRaw<
      Array<{
        subjectId: string;
        subjectName: unknown;
        examTypeId: string;
        total: bigint;
        correct: bigint;
      }>
    >(Prisma.sql`
      SELECT q.subject_id AS "subjectId", s.name AS "subjectName", s.exam_type_id AS "examTypeId",
        COUNT(*) AS total, COUNT(*) FILTER (WHERE a.is_correct = true) AS correct
      FROM test_answers a
      JOIN test_sessions ts ON ts.id = a.session_id
      JOIN questions q ON q.id = a.question_id
      JOIN subjects s ON s.id = q.subject_id
      WHERE ts.user_id = ${userId}::uuid AND ts.id IN (${Prisma.join(sessionIds.map((id) => Prisma.sql`${id}::uuid`))})
        AND a.is_correct IS NOT NULL
      GROUP BY q.subject_id, s.name, s.exam_type_id
    `);
    return rows
      .map((row) => ({
        ...row,
        total: Number(row.total),
        correct: Number(row.correct),
        accuracy:
          Math.round((Number(row.correct) / Number(row.total)) * 1000) / 10,
      }))
      .sort(
        (a, b) =>
          a.accuracy - b.accuracy ||
          b.total - a.total ||
          a.subjectId.localeCompare(b.subjectId),
      );
  }
}
