import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';

function toNumber(value: unknown): number {
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'number') return value;
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  return 0;
}

function localizedLabel(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value && typeof value === 'object') {
    const obj = value as Record<string, unknown>;
    const ru = obj.ru;
    const kk = obj.kk;
    const en = obj.en;
    if (typeof ru === 'string' && ru.trim()) return ru;
    if (typeof kk === 'string' && kk.trim()) return kk;
    if (typeof en === 'string' && en.trim()) return en;
  }
  return '—';
}

function csvCell(value: unknown): string {
  const raw = value == null ? '' : String(value);
  return /[",\n\r]/.test(raw) ? `"${raw.replace(/"/g, '""')}"` : raw;
}

@Injectable()
export class AdminAnalyticsService {
  constructor(private prisma: PrismaService) {}

  async getAnalyticsOverview() {
    const [totalUsers, totalTests, totalQuestions, activeSubscriptions] =
      await Promise.all([
        this.prisma.user.count(),
        this.prisma.testSession.count({ where: { status: 'completed' } }),
        this.prisma.question.count({ where: { isActive: true } }),
        this.prisma.subscription.count({
          where: { isActive: true, expiresAt: { gt: new Date() } },
        }),
      ]);

    return { totalUsers, totalTests, totalQuestions, activeSubscriptions };
  }

  async getEntTrialAnalytics() {
    const ent = await this.prisma.examType.findUnique({
      where: { slug: 'ent' },
      select: { id: true },
    });
    if (!ent) {
      return {
        entFound: false as const,
        completedSessions: 0,
        last30Completed: 0,
        avgScore: null as number | null,
        avgCorrectPercent: null as number | null,
        byLanguage: [],
        bySubject: [],
      };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const finishedStatuses = ['completed', 'timed_out'] as const;
    const baseWhere = { examTypeId: ent.id, status: { in: [...finishedStatuses] } };

    const [completedSessions, last30Completed, scoreAgg, correctAgg, languageAgg, subjectRows] =
      await Promise.all([
        this.prisma.testSession.count({ where: baseWhere }),
        this.prisma.testSession.count({
          where: {
            ...baseWhere,
            finishedAt: { gte: thirtyDaysAgo },
          },
        }),
        this.prisma.testSession.aggregate({
          where: { ...baseWhere, score: { not: null } },
          _avg: { score: true },
        }),
        this.prisma.testSession.aggregate({
          where: {
            ...baseWhere,
            totalQuestions: { gt: 0 },
            correctCount: { not: null },
          },
          _avg: {
            correctCount: true,
            totalQuestions: true,
          },
        }),
        this.prisma.testSession.groupBy({
          by: ['language'],
          where: baseWhere,
          _count: { _all: true },
          _avg: { score: true, rawScore: true },
          orderBy: { _count: { language: 'desc' } },
        }),
        this.prisma.$queryRaw<
          Array<{
            subjectId: string;
            subjectSlug: string;
            subjectName: unknown;
            sessions: number | bigint;
            answers: number | bigint;
            correctAnswers: number | bigint;
          }>
        >`
          SELECT
            q.subject_id AS "subjectId",
            s.slug AS "subjectSlug",
            s.name AS "subjectName",
            COUNT(DISTINCT ta.session_id)::int AS "sessions",
            COUNT(*)::int AS "answers",
            COUNT(*) FILTER (WHERE ta.is_correct = true)::int AS "correctAnswers"
          FROM test_answers ta
          JOIN test_sessions ts ON ts.id = ta.session_id
          JOIN questions q ON q.id = ta.question_id
          JOIN subjects s ON s.id = q.subject_id
          WHERE ts.exam_type_id = ${ent.id}::uuid
            AND ts.status IN ('completed', 'timed_out')
          GROUP BY q.subject_id, s.slug, s.name
          ORDER BY "answers" DESC
        `,
      ]);

    const avgScore = scoreAgg._avg.score != null ? Number(scoreAgg._avg.score) : null;
    let avgCorrectPercent: number | null = null;
    if (
      correctAgg._avg.correctCount != null &&
      correctAgg._avg.totalQuestions != null &&
      Number(correctAgg._avg.totalQuestions) > 0
    ) {
      avgCorrectPercent =
        (Number(correctAgg._avg.correctCount) / Number(correctAgg._avg.totalQuestions)) * 100;
    }

    return {
      entFound: true as const,
      completedSessions,
      last30Completed,
      avgScore,
      avgCorrectPercent,
      byLanguage: languageAgg.map((row) => ({
        language: row.language || '—',
        sessions: row._count._all,
        avgScore: row._avg.score != null ? Number(row._avg.score) : null,
        avgRawScore: row._avg.rawScore != null ? Number(row._avg.rawScore) : null,
      })),
      bySubject: subjectRows.map((row) => {
        const answers = toNumber(row.answers);
        const correctAnswers = toNumber(row.correctAnswers);
        return {
          subjectId: row.subjectId,
          subjectSlug: row.subjectSlug,
          subjectName: row.subjectName,
          sessions: toNumber(row.sessions),
          answers,
          correctAnswers,
          accuracyPercent:
            answers > 0 ? Math.round((correctAnswers / answers) * 1000) / 10 : null,
        };
      }),
    };
  }

  async exportEntTrialAnalytics() {
    const data = await this.getEntTrialAnalytics();
    const lines: string[] = [
      'Section,Key,Label,Sessions,Answers,Correct Answers,Accuracy %,Avg Score,Avg Raw Score',
    ];

    if (!data.entFound) return `${lines[0]}\n`;

    lines.push(
      [
        'summary',
        'all',
        'All ENT',
        data.completedSessions,
        '',
        '',
        data.avgCorrectPercent ?? '',
        data.avgScore ?? '',
        '',
      ]
        .map(csvCell)
        .join(','),
    );

    for (const row of data.byLanguage) {
      lines.push(
        [
          'language',
          row.language,
          row.language,
          row.sessions,
          '',
          '',
          '',
          row.avgScore ?? '',
          row.avgRawScore ?? '',
        ]
          .map(csvCell)
          .join(','),
      );
    }

    for (const row of data.bySubject) {
      lines.push(
        [
          'subject',
          row.subjectSlug,
          localizedLabel(row.subjectName),
          row.sessions,
          row.answers,
          row.correctAnswers,
          row.accuracyPercent ?? '',
          '',
          '',
        ]
          .map(csvCell)
          .join(','),
      );
    }

    return `${lines.join('\n')}\n`;
  }
}
