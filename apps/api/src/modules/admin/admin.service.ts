import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AdminService {
  constructor(private prisma: PrismaService) {}

  async getUsers(search?: string, page = 1, limit = 20) {
    const digits = search?.replace(/\D/g, '') ?? '';
    const where = search
      ? {
          OR: [
            { telegramUsername: { contains: search, mode: 'insensitive' as const } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    const [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          subscriptions: { where: { isActive: true }, take: 1 },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      items: items.map((u) => ({
        ...u,
        telegramId: Number(u.telegramId),
        hasActiveSubscription: u.subscriptions.length > 0,
      })),
      total,
      page,
      limit,
    };
  }

  async updateUser(id: string, data: { isAdmin?: boolean }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async grantSubscription(
    adminId: string,
    data: {
      userId: string;
      planType: string;
      examTypeId?: string;
      startsAt: string;
      expiresAt: string;
      paymentNote?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.subscription.create({
      data: {
        userId: data.userId,
        planType: data.planType,
        examTypeId: data.examTypeId || null,
        grantedBy: adminId,
        startsAt: new Date(data.startsAt),
        expiresAt: new Date(data.expiresAt),
        paymentNote: data.paymentNote || null,
      },
    });
  }

  async revokeSubscription(subscriptionId: string) {
    return this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });
  }

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
      };
    }

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const baseWhere = { examTypeId: ent.id, status: 'completed' as const };

    const [completedSessions, last30Completed, scoreAgg, correctAgg] =
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
    };
  }
}
