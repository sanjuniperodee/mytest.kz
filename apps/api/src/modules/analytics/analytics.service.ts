import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private prisma: PrismaService) {}

  async recordVisit(data: {
    visitorId: string;
    source?: string;
    medium?: string;
    campaign?: string;
    referrer?: string;
    landingPath?: string;
    userAgent?: string;
  }) {
    const visit = await this.prisma.visitEvent.create({
      data: {
        visitorId: data.visitorId,
        source: data.source ?? null,
        medium: data.medium ?? null,
        campaign: data.campaign ?? null,
        referrer: data.referrer ?? null,
        landingPath: data.landingPath ?? '/',
      },
    });

    await this.prisma.funnelStep.create({
      data: {
        visitId: visit.id,
        step: 'visit',
      },
    });

    return { visitorId: data.visitorId, recorded: true };
  }

  async attrributeVisit(visitorId: string, userId: string) {
    // Update all unclaimed VisitEvents for this visitorId to link to userId
    await this.prisma.visitEvent.updateMany({
      where: { visitorId, userId: null },
      data: { userId },
    });

    // Find the first visit event for this visitor to add 'registered' step
    const firstVisit = await this.prisma.visitEvent.findFirst({
      where: { visitorId, userId },
      orderBy: { createdAt: 'asc' },
    });

    if (firstVisit) {
      // Check if 'registered' step already exists
      const existingStep = await this.prisma.funnelStep.findFirst({
        where: { visitId: firstVisit.id, step: 'registered' },
      });
      if (!existingStep) {
        await this.prisma.funnelStep.create({
          data: {
            visitId: firstVisit.id,
            step: 'registered',
          },
        });
      }
    }
  }

  async recordFunnelStep(
    userId: string,
    step: 'started_test' | 'completed_test',
    data: {
      sessionId?: string;
      examTypeId?: string;
      score?: number;
      durationSecs?: number;
    },
  ) {
    // Find the most recent visit event for this user
    const lastVisit = await this.prisma.visitEvent.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });

    if (!lastVisit) return;

    // Check if this step already exists for this visit
    const existingStep = await this.prisma.funnelStep.findFirst({
      where: {
        visitId: lastVisit.id,
        step,
        ...(data.sessionId ? { sessionId: data.sessionId } : {}),
      },
    });
    if (existingStep) return;

    await this.prisma.funnelStep.create({
      data: {
        visitId: lastVisit.id,
        step,
        sessionId: data.sessionId ?? null,
        metadata: {
          ...(data.examTypeId ? { examTypeId: data.examTypeId } : {}),
          ...(data.score !== undefined ? { score: data.score } : {}),
          ...(data.durationSecs !== undefined
            ? { durationSecs: data.durationSecs }
            : {}),
        },
      },
    });
  }

  async getFunnelAnalytics(params: {
    from?: string;
    to?: string;
    examTypeId?: string;
  }) {
    const from = params.from
      ? new Date(params.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = params.to ? new Date(params.to) : new Date();

    const baseWhere = {
      createdAt: { gte: from, lte: to },
    };

    // Unique visitors
    const uniqueVisitors = await this.prisma.visitEvent.groupBy({
      by: ['visitorId'],
      where: baseWhere,
    });
    const visits = uniqueVisitors.length;

    // Registered users
    const registeredVisits = await this.prisma.visitEvent.groupBy({
      by: ['visitorId'],
      where: { ...baseWhere, userId: { not: null } },
    });
    const registered = registeredVisits.length;

    // Started test (unique visitors with started_test step)
    const startedWhere = {
      ...baseWhere,
      funnelSteps: { some: { step: 'started_test' } },
    };
    const startedGrouped = await this.prisma.visitEvent.groupBy({
      by: ['visitorId'],
      where: startedWhere,
    });
    const started = startedGrouped.length;

    // Completed test
    const completedWhere = {
      ...baseWhere,
      funnelSteps: { some: { step: 'completed_test' } },
    };
    const completedGrouped = await this.prisma.visitEvent.groupBy({
      by: ['visitorId'],
      where: completedWhere,
    });
    const completed = completedGrouped.length;

    // By date aggregation
    const rawByDate = await this.prisma.$queryRaw<
      Array<{
        date: string;
        visits: bigint;
        registered: bigint;
        started: bigint;
        completed: bigint;
      }>
    >`
      SELECT
        DATE(v.created_at at time zone 'Asia/Almaty') as date,
        COUNT(DISTINCT v.visitor_id) as visits,
        COUNT(DISTINCT CASE WHEN v.user_id IS NOT NULL THEN v.visitor_id END) as registered,
        COUNT(DISTINCT CASE WHEN fs_step.visitor_id IS NOT NULL AND fs_step.step = 'started_test' THEN v.visitor_id END) as started,
        COUNT(DISTINCT CASE WHEN fs_comp.visitor_id IS NOT NULL AND fs_comp.step = 'completed_test' THEN v.visitor_id END) as completed
      FROM visit_events v
      LEFT JOIN funnel_steps fs_step ON fs_step.visit_id = v.id AND fs_step.step = 'started_test'
      LEFT JOIN funnel_steps fs_comp ON fs_comp.visit_id = v.id AND fs_comp.step = 'completed_test'
      WHERE v.created_at >= ${from} AND v.created_at <= ${to}
      GROUP BY DATE(v.created_at at time zone 'Asia/Almaty')
      ORDER BY date ASC
    `;

    const byDate = rawByDate.map((row) => ({
      date: row.date,
      visits: Number(row.visits),
      registered: Number(row.registered),
      started: Number(row.started),
      completed: Number(row.completed),
    }));

    // By exam type
    let byExamType: Array<{
      examTypeId: string;
      examName: unknown;
      started: number;
      completed: number;
      avgScore: number | null;
    }> = [];

    if (params.examTypeId) {
      const examType = await this.prisma.examType.findUnique({
        where: { id: params.examTypeId },
        select: { id: true, name: true },
      });
      if (examType) {
        const startedForExam = await this.prisma.funnelStep.count({
          where: {
            step: 'started_test',
            metadata: { path: ['examTypeId'], equals: params.examTypeId },
            visit: { createdAt: { gte: from, lte: to } },
          },
        });
        const completedForExam = await this.prisma.funnelStep.count({
          where: {
            step: 'completed_test',
            metadata: { path: ['examTypeId'], equals: params.examTypeId },
            visit: { createdAt: { gte: from, lte: to } },
          },
        });
        const scoreAgg = await this.prisma.testSession.aggregate({
          where: {
            examTypeId: params.examTypeId,
            status: 'completed',
            finishedAt: { gte: from, lte: to },
          },
          _avg: { score: true },
        });
        byExamType = [
          {
            examTypeId: params.examTypeId,
            examName: examType.name,
            started: startedForExam,
            completed: completedForExam,
            avgScore:
              scoreAgg._avg.score != null
                ? Number(scoreAgg._avg.score)
                : null,
          },
        ];
      }
    }

    return {
      period: { from: from.toISOString(), to: to.toISOString() },
      totals: { visits, registered, started, completed },
      conversionRates: {
        visitToRegistered:
          visits > 0 ? Math.round((registered / visits) * 10000) / 100 : 0,
        registeredToStarted:
          registered > 0 ? Math.round((started / registered) * 10000) / 100 : 0,
        startedToCompleted:
          started > 0 ? Math.round((completed / started) * 10000) / 100 : 0,
        visitToCompleted:
          visits > 0 ? Math.round((completed / visits) * 10000) / 100 : 0,
      },
      byDate,
      byExamType,
    };
  }

  async getVisitors(params: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    search?: string;
    examTypeId?: string;
    step?: string;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const from = params.from
      ? new Date(params.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = params.to ? new Date(params.to) : new Date();

    const where: any = {
      createdAt: { gte: from, lte: to },
    };

    if (params.step) {
      where.funnelSteps = { some: { step: params.step } };
    }

    if (params.search) {
      where.user = {
        OR: [
          { telegramUsername: { contains: params.search, mode: 'insensitive' } },
          { firstName: { contains: params.search, mode: 'insensitive' } },
          { lastName: { contains: params.search, mode: 'insensitive' } },
        ],
      };
    }

    if (params.examTypeId) {
      where.testSessions = {
        some: {
          examTypeId: params.examTypeId,
          status: 'completed',
        },
      };
    }

    const [items, total] = await Promise.all([
      this.prisma.visitEvent.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              telegramUsername: true,
              firstName: true,
              lastName: true,
            },
          },
          funnelSteps: {
            orderBy: { timestamp: 'asc' },
            select: { step: true, timestamp: true, metadata: true },
          },
          testSessions: {
            where: { status: 'completed' },
            select: {
              id: true,
              examType: { select: { id: true, name: true, slug: true } },
              score: true,
              finishedAt: true,
              durationSecs: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.visitEvent.count({ where }),
    ]);

    return {
      items: items.map((v) => ({
        visitorId: v.visitorId,
        userId: v.userId,
        user: v.user
          ? {
              id: v.user.id,
              telegramId: Number(v.user.telegramId),
              telegramUsername: v.user.telegramUsername,
              firstName: v.user.firstName,
              lastName: v.user.lastName,
            }
          : null,
        firstSeen: v.createdAt.toISOString(),
        lastSeen:
          v.funnelSteps.length > 0
            ? v.funnelSteps[v.funnelSteps.length - 1].timestamp.toISOString()
            : v.createdAt.toISOString(),
        steps: v.funnelSteps.map((fs) => fs.step),
        completedSessions: v.testSessions.map((ts) => ({
          sessionId: ts.id,
          examType: ts.examType,
          score: ts.score ? Number(ts.score) : null,
          finishedAt: ts.finishedAt?.toISOString() ?? null,
          durationSecs: ts.durationSecs,
        })),
      })),
      total,
      page,
      limit,
    };
  }

  async getTestTakers(params: {
    page?: number;
    limit?: number;
    from?: string;
    to?: string;
    examTypeId?: string;
  }) {
    const page = params.page ?? 1;
    const limit = params.limit ?? 50;
    const from = params.from
      ? new Date(params.from)
      : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const to = params.to ? new Date(params.to) : new Date();

    const where: any = {
      status: 'completed',
      finishedAt: { gte: from, lte: to },
    };
    if (params.examTypeId) {
      where.examTypeId = params.examTypeId;
    }

    const [items, total] = await Promise.all([
      this.prisma.testSession.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              telegramUsername: true,
              firstName: true,
              lastName: true,
            },
          },
          examType: { select: { id: true, name: true, slug: true } },
        },
        orderBy: { finishedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.testSession.count({ where }),
    ]);

    // Aggregate per user
    const userMap = new Map<
      string,
      {
        userId: string;
        telegramId: number;
        telegramUsername: string | null;
        firstName: string | null;
        lastName: string | null;
        testsCompleted: number;
        lastTestAt: string | null;
        scores: number[];
        durations: number[];
      }
    >();

    for (const session of items) {
      const u = session.user;
      if (!u) continue;
      const id = u.id;
      const existing = userMap.get(id);
      if (!existing) {
        userMap.set(id, {
          userId: id,
          telegramId: Number(u.telegramId),
          telegramUsername: u.telegramUsername,
          firstName: u.firstName,
          lastName: u.lastName,
          testsCompleted: 1,
          lastTestAt: session.finishedAt?.toISOString() ?? null,
          scores: session.score ? [Number(session.score)] : [],
          durations: session.durationSecs ? [session.durationSecs] : [],
        });
      } else {
        existing.testsCompleted++;
        if (
          session.finishedAt &&
          (!existing.lastTestAt ||
            new Date(session.finishedAt) > new Date(existing.lastTestAt))
        ) {
          existing.lastTestAt = session.finishedAt.toISOString();
        }
        if (session.score)
          existing.scores.push(Number(session.score));
        if (session.durationSecs)
          existing.durations.push(session.durationSecs);
      }
    }

    const aggregated = Array.from(userMap.values()).map((u) => ({
      userId: u.userId,
      telegramId: u.telegramId,
      telegramUsername: u.telegramUsername,
      firstName: u.firstName,
      lastName: u.lastName,
      testsCompleted: u.testsCompleted,
      lastTestAt: u.lastTestAt,
      bestScore:
        u.scores.length > 0 ? Math.max(...u.scores) : null,
      avgScore:
        u.scores.length > 0
          ? Math.round(
              (u.scores.reduce((a, b) => a + b, 0) / u.scores.length) * 100
            ) / 100
          : null,
      avgDurationSecs:
        u.durations.length > 0
          ? Math.round(u.durations.reduce((a, b) => a + b, 0) / u.durations.length)
          : null,
    }));

    return {
      items: aggregated,
      total,
      page,
      limit,
    };
  }

  async exportVisitors(params: {
    from?: string;
    to?: string;
    search?: string;
    examTypeId?: string;
    step?: string;
  }) {
    const data = await this.getVisitors({ ...params, limit: 10000, page: 1 });
    const rows = data.items;
    const header = 'Visitor ID,User ID,Telegram Username,First Name,Last Name,First Seen,Last Seen,Steps,Tests Completed\n';
    const body = rows
      .map(
        (r) =>
          `${r.visitorId},${r.userId ?? ''},${r.user?.telegramUsername ?? ''},${r.user?.firstName ?? ''},${r.user?.lastName ?? ''},${r.firstSeen},${r.lastSeen},"${r.steps.join(' → ')}",${r.completedSessions.length}`,
      )
      .join('\n');
    return header + body;
  }

  async exportTestTakers(params: {
    from?: string;
    to?: string;
    examTypeId?: string;
  }) {
    const data = await this.getTestTakers({ ...params, limit: 10000, page: 1 });
    const rows = data.items;
    const header =
      'Telegram ID,Username,First Name,Last Name,Tests Completed,Last Test,Best Score,Avg Score,Avg Duration (s)\n';
    const body = rows
      .map(
        (r) =>
          `${r.telegramId},${r.telegramUsername ?? ''},${r.firstName ?? ''},${r.lastName ?? ''},${r.testsCompleted},${r.lastTestAt ?? ''},${r.bestScore ?? ''},${r.avgScore ?? ''},${r.avgDurationSecs ?? ''}`,
      )
      .join('\n');
    return header + body;
  }
}
