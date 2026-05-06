import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntitlementStatus, EntitlementTier } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccessService } from '../../subscriptions/access.service';

@Injectable()
export class AdminUserService {
  constructor(
    private prisma: PrismaService,
    private accessService: AccessService,
  ) {}

  async getUsers(search?: string, page = 1, limit = 20) {
    const digits = search?.replace(/\D/g, '') ?? '';
    const where = search
      ? {
          OR: [
            { telegramUsername: { contains: search, mode: 'insensitive' as const } },
            { email: { contains: search, mode: 'insensitive' as const } },
            ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
            { firstName: { contains: search, mode: 'insensitive' as const } },
            { lastName: { contains: search, mode: 'insensitive' as const } },
          ],
        }
      : {};

    let [items, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        include: {
          subscriptions: {
            where: { isActive: true },
            orderBy: { expiresAt: 'desc' },
          },
          entitlements: {
            where: {
              status: EntitlementStatus.active,
              windowStartsAt: { lte: new Date() },
              OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: new Date() } }],
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          },
        },
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    await Promise.all(items.map((u) => this.accessService.ensureSignupEntitlementsForUser(u.id)));

    if (items.length > 0) {
      const refreshed = await this.prisma.user.findMany({
        where: { id: { in: items.map((u) => u.id) } },
        include: {
          subscriptions: {
            where: { isActive: true },
            orderBy: { expiresAt: 'desc' },
          },
          entitlements: {
            where: {
              status: EntitlementStatus.active,
              windowStartsAt: { lte: new Date() },
              OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: new Date() } }],
            },
            orderBy: { updatedAt: 'desc' },
            take: 20,
          },
        },
      });
      const byId = new Map(refreshed.map((u) => [u.id, u]));
      items = items.map((u) => byId.get(u.id) ?? u);
    }

    return {
      items: items.map((u) => ({
        ...u,
        telegramId: u.telegramId ? Number(u.telegramId) : null,
        hasActiveSubscription: u.entitlements.some((e) => e.tier === EntitlementTier.paid),
      })),
      total,
      page,
      limit,
    };
  }

  async updateUser(id: string, data: { isAdmin?: boolean }) {
    return this.prisma.user.update({ where: { id }, data });
  }

  async deleteUser(adminId: string, id: string) {
    if (adminId === id) {
      throw new BadRequestException('Cannot delete your own admin account');
    }

    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        firstName: true,
        lastName: true,
        telegramUsername: true,
        email: true,
        phone: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    const deleted = await this.prisma.$transaction(async (tx) => {
      const sessionIds = (
        await tx.testSession.findMany({
          where: { userId: id },
          select: { id: true },
        })
      ).map((s) => s.id);

      if (sessionIds.length > 0) {
        await tx.funnelStep.updateMany({
          where: { sessionId: { in: sessionIds } },
          data: { sessionId: null },
        });
        await tx.attemptUsageLedger.updateMany({
          where: { sessionId: { in: sessionIds } },
          data: { sessionId: null },
        });
        await tx.testAnswer.deleteMany({
          where: { sessionId: { in: sessionIds } },
        });
        await tx.testSession.deleteMany({ where: { id: { in: sessionIds } } });
      }

      await tx.visitEvent.updateMany({
        where: { userId: id },
        data: { userId: null },
      });
      await tx.subscription.updateMany({
        where: { grantedBy: id },
        data: { grantedBy: null },
      });
      await tx.userExamEntitlement.updateMany({
        where: { createdBy: id },
        data: { createdBy: null },
      });
      await tx.subscriptionPlanTemplate.updateMany({
        where: { createdBy: id },
        data: { createdBy: null },
      });

      const [
        paymentOrders,
        dailyUsage,
        usageLedger,
        entitlements,
        subscriptions,
      ] = await Promise.all([
        tx.paymentOrder.deleteMany({ where: { userId: id } }),
        tx.userExamDailyUsage.deleteMany({ where: { userId: id } }),
        tx.attemptUsageLedger.deleteMany({ where: { userId: id } }),
        tx.userExamEntitlement.deleteMany({ where: { userId: id } }),
        tx.subscription.deleteMany({ where: { userId: id } }),
      ]);

      await tx.user.delete({ where: { id } });

      return {
        paymentOrders: paymentOrders.count,
        dailyUsage: dailyUsage.count,
        usageLedger: usageLedger.count,
        entitlements: entitlements.count,
        subscriptions: subscriptions.count,
        testSessions: sessionIds.length,
      };
    });

    const displayName =
      [user.firstName, user.lastName].filter(Boolean).join(' ').trim() ||
      user.telegramUsername ||
      user.email ||
      user.phone ||
      user.id;

    return { deleted: true, id, displayName, deletedRelations: deleted };
  }

  async getUserDetail(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
        },
        entitlements: {
          include: {
            examType: { select: { id: true, slug: true, name: true } },
            planTemplate: { select: { id: true, code: true, name: true } },
            subscription: { select: { id: true, planType: true, isActive: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!user) throw new NotFoundException('User not found');

    await this.accessService.ensureSignupEntitlementsForUser(id);

    const userWithEntitlements = await this.prisma.user.findUnique({
      where: { id },
      include: {
        subscriptions: {
          orderBy: { createdAt: 'desc' },
        },
        entitlements: {
          include: {
            examType: { select: { id: true, slug: true, name: true } },
            planTemplate: { select: { id: true, code: true, name: true } },
            subscription: { select: { id: true, planType: true, isActive: true } },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!userWithEntitlements) throw new NotFoundException('User not found');

    const sessions = await this.prisma.testSession.findMany({
      where: { userId: id },
      include: {
        examType: { select: { id: true, slug: true, name: true } },
      },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });

    const funnels = await this.prisma.funnelStep.findMany({
      where: { sessionId: { in: sessions.map((s) => s.id) } },
      orderBy: { timestamp: 'desc' },
    });

    return {
      user: {
        ...userWithEntitlements,
        telegramId: userWithEntitlements.telegramId ? Number(userWithEntitlements.telegramId) : null,
        hasActiveSubscription: userWithEntitlements.entitlements.some((e) => {
          const now = new Date();
          return (
            e.tier === EntitlementTier.paid &&
            e.status === EntitlementStatus.active &&
            e.windowStartsAt <= now &&
            (e.windowEndsAt == null || e.windowEndsAt > now)
          );
        }),
      },
      sessions: sessions.map((s) => ({
        id: s.id,
        examTypeSlug: s.examType.slug,
        examTypeName: s.examType.name,
        status: s.status,
        startedAt: s.startedAt,
        finishedAt: s.finishedAt,
        durationSecs: s.durationSecs,
        score: s.score != null ? Number(s.score) : null,
        correctCount: s.correctCount,
        totalQuestions: s.totalQuestions,
      })),
      funnelSteps: funnels.map((f) => ({
        id: f.id,
        step: f.step,
        createdAt: f.timestamp,
      })),
    };
  }
}
