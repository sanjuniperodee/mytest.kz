import { Prisma } from '@prisma/client';
import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

const ALLOWED_FUNNEL_EVENTS = new Set([
  'visit',
  'registered',
  'started_test',
  'completed_test',
  'review_opened',
  'explain_click',
  'premium_gate',
  'billing_opened',
  'plan_selected',
  'checkout_created',
  'payment_opened',
  'payment_paid',
  'payment_failed',
  'payment_cancelled',
]);

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
    const visitorId = data.visitorId.slice(0, 64);
    const landingPath = (data.landingPath || '/').slice(0, 255);
    const recentDuplicate = await this.prisma.visitEvent.findFirst({
      where: {
        visitorId,
        landingPath,
        createdAt: { gte: new Date(Date.now() - 10_000) },
      },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });

    if (recentDuplicate) {
      return { visitorId, recorded: false, duplicate: true };
    }

    const visit = await this.prisma.visitEvent.create({
      data: {
        visitorId,
        source: data.source?.slice(0, 32) ?? null,
        medium: data.medium?.slice(0, 32) ?? null,
        campaign: data.campaign?.slice(0, 64) ?? null,
        referrer: data.referrer?.slice(0, 500) ?? null,
        landingPath,
      },
    });

    await this.prisma.funnelStep.create({
      data: {
        visitId: visit.id,
        step: 'visit',
      },
    });

    return { visitorId, recorded: true };
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

  async recordEvent(data: {
    userId: string;
    visitorId?: string;
    step: string;
    sessionId?: string;
    metadata?: Record<string, unknown>;
    landingPath?: string;
  }) {
    const step = data.step.trim().slice(0, 32);
    if (!ALLOWED_FUNNEL_EVENTS.has(step)) {
      return { recorded: false, reason: 'UNKNOWN_STEP' };
    }

    const visit = await this.ensureVisitForUser({
      userId: data.userId,
      visitorId: data.visitorId,
      landingPath: data.landingPath,
    });
    if (!visit) return { recorded: false, reason: 'NO_VISIT' };

    const recentDuplicate = await this.prisma.funnelStep.findFirst({
      where: {
        visitId: visit.id,
        step,
        ...(data.sessionId ? { sessionId: data.sessionId } : {}),
        timestamp: { gte: new Date(Date.now() - 30_000) },
      },
      select: { id: true },
    });
    if (recentDuplicate) {
      return { recorded: false, duplicate: true };
    }

    await this.prisma.funnelStep.create({
      data: {
        visitId: visit.id,
        step,
        sessionId: data.sessionId ?? null,
        metadata: {
          ...(data.metadata ?? {}),
          ...(data.landingPath ? { path: data.landingPath } : {}),
        },
      },
    });

    return { recorded: true };
  }

  private async ensureVisitForUser(data: {
    userId: string;
    visitorId?: string;
    landingPath?: string;
  }) {
    if (data.visitorId) {
      await this.prisma.visitEvent.updateMany({
        where: { visitorId: data.visitorId.slice(0, 64), userId: null },
        data: { userId: data.userId },
      });
    }

    const existing = await this.prisma.visitEvent.findFirst({
      where: { userId: data.userId },
      orderBy: { createdAt: 'desc' },
      select: { id: true },
    });
    if (existing) return existing;

    const visitorId = (data.visitorId || `user:${data.userId}`).slice(0, 64);
    return this.prisma.visitEvent.create({
      data: {
        visitorId,
        userId: data.userId,
        landingPath: (data.landingPath || '/app').slice(0, 255),
      },
      select: { id: true },
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

    const billingOpened = await this.countVisitorsByStep('billing_opened', from, to);
    const checkoutCreated = await this.countVisitorsByStep('checkout_created', from, to);
    const paymentPaid = await this.countVisitorsByStep('payment_paid', from, to);

    // By date aggregation
    const rawByDate = await this.prisma.$queryRaw<
      Array<{
        date: string | Date;
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
        COUNT(DISTINCT CASE WHEN fs_step.id IS NOT NULL THEN v.visitor_id END) as started,
        COUNT(DISTINCT CASE WHEN fs_comp.id IS NOT NULL THEN v.visitor_id END) as completed
      FROM visit_events v
      LEFT JOIN funnel_steps fs_step ON fs_step.visit_id = v.id AND fs_step.step = 'started_test'
      LEFT JOIN funnel_steps fs_comp ON fs_comp.visit_id = v.id AND fs_comp.step = 'completed_test'
      WHERE v.created_at >= ${from} AND v.created_at <= ${to}
      GROUP BY DATE(v.created_at at time zone 'Asia/Almaty')
      ORDER BY date ASC
    `;

    const byDate = rawByDate.map((row) => ({
      date:
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date),
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
      totals: { visits, registered, started, completed, billingOpened, checkoutCreated, paymentPaid },
      conversionRates: {
        visitToRegistered:
          visits > 0 ? Math.round((registered / visits) * 10000) / 100 : 0,
        registeredToStarted:
          registered > 0 ? Math.round((started / registered) * 10000) / 100 : 0,
        startedToCompleted:
          started > 0 ? Math.round((completed / started) * 10000) / 100 : 0,
        visitToCompleted:
          visits > 0 ? Math.round((completed / visits) * 10000) / 100 : 0,
        completedToBilling:
          completed > 0 ? Math.round((billingOpened / completed) * 10000) / 100 : 0,
        billingToCheckout:
          billingOpened > 0 ? Math.round((checkoutCreated / billingOpened) * 10000) / 100 : 0,
        checkoutToPaid:
          checkoutCreated > 0 ? Math.round((paymentPaid / checkoutCreated) * 10000) / 100 : 0,
      },
      byDate,
      byExamType,
    };
  }

  private async countVisitorsByStep(step: string, from: Date, to: Date) {
    const grouped = await this.prisma.visitEvent.groupBy({
      by: ['visitorId'],
      where: {
        createdAt: { gte: from, lte: to },
        funnelSteps: { some: { step } },
      },
    });
    return grouped.length;
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
              telegramId: v.user.telegramId ? Number(v.user.telegramId) : null,
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

    const examFilter = params.examTypeId
      ? Prisma.sql`AND ts.exam_type_id = ${params.examTypeId}::uuid`
      : Prisma.empty;

    const [items, totalRows] = await Promise.all([
      this.prisma.$queryRaw<
        Array<{
          userId: string;
          telegramId: bigint | number | null;
          telegramUsername: string | null;
          firstName: string | null;
          lastName: string | null;
          testsCompleted: number | bigint;
          lastTestAt: Date | null;
          bestScore: number | null;
          avgScore: number | null;
          avgDurationSecs: number | null;
        }>
      >(
        Prisma.sql`
          SELECT
            u.id AS "userId",
            u.telegram_id AS "telegramId",
            u.telegram_username AS "telegramUsername",
            u.first_name AS "firstName",
            u.last_name AS "lastName",
            COUNT(ts.id)::int AS "testsCompleted",
            MAX(ts.finished_at) AS "lastTestAt",
            MAX(ts.score)::double precision AS "bestScore",
            AVG(ts.score)::double precision AS "avgScore",
            AVG(ts.duration_secs)::double precision AS "avgDurationSecs"
          FROM test_sessions ts
          JOIN users u ON u.id = ts.user_id
          WHERE ts.status = 'completed'
            AND ts.finished_at >= ${from}
            AND ts.finished_at <= ${to}
            ${examFilter}
          GROUP BY u.id, u.telegram_id, u.telegram_username, u.first_name, u.last_name
          ORDER BY MAX(ts.finished_at) DESC
          OFFSET ${(page - 1) * limit}
          LIMIT ${limit}
        `,
      ),
      this.prisma.$queryRaw<Array<{ total: number | bigint }>>(
        Prisma.sql`
          SELECT COUNT(*)::int AS total
          FROM (
            SELECT ts.user_id
            FROM test_sessions ts
            WHERE ts.status = 'completed'
              AND ts.finished_at >= ${from}
              AND ts.finished_at <= ${to}
              ${examFilter}
              AND ts.user_id IS NOT NULL
            GROUP BY ts.user_id
          ) grouped_users
        `,
      ),
    ]);

    const aggregated = items.map((row) => ({
      userId: row.userId,
      telegramId:
        row.telegramId == null ? null : Number(row.telegramId),
      telegramUsername: row.telegramUsername,
      firstName: row.firstName,
      lastName: row.lastName,
      testsCompleted: Number(row.testsCompleted),
      lastTestAt: row.lastTestAt?.toISOString() ?? null,
      bestScore: row.bestScore != null ? Number(row.bestScore) : null,
      avgScore: row.avgScore != null ? Math.round(Number(row.avgScore) * 100) / 100 : null,
      avgDurationSecs:
        row.avgDurationSecs != null ? Math.round(Number(row.avgDurationSecs)) : null,
    }));

    return {
      items: aggregated,
      total: totalRows[0]?.total ? Number(totalRows[0].total) : 0,
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
