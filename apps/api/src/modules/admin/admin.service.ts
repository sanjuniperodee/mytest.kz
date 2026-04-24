import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import {
  EntitlementSourceType,
  EntitlementStatus,
  EntitlementTier,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../subscriptions/access.service';

@Injectable()
export class AdminService {
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
          subscriptions: {
            where: { isActive: true },
            orderBy: { expiresAt: 'desc' },
          },
          entitlements: {
            where: {
              status: EntitlementStatus.active,
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

    return {
      items: items.map((u) => ({
        ...u,
        telegramId: Number(u.telegramId),
        hasActiveSubscription: u.entitlements.some(
          (e) => e.tier === EntitlementTier.paid,
        ),
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
    }).then(async (created) => {
      await this.accessService.syncSubscriptionEntitlements(created.id);
      return created;
    });
  }

  async revokeSubscription(subscriptionId: string) {
    const revoked = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });
    await this.accessService.syncSubscriptionEntitlements(subscriptionId);
    return revoked;
  }

  async listPlanTemplates() {
    return this.prisma.subscriptionPlanTemplate.findMany({
      include: {
        examRules: {
          include: { examType: { select: { id: true, slug: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPlanTemplate(
    adminId: string,
    data: {
      code: string;
      name: string;
      description?: string | null;
      isPremium?: boolean;
      durationDays?: number | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezoneMode?: string;
      metadata?: unknown;
      rules?: Array<{
        examTypeId: string;
        totalAttemptsLimit?: number | null;
        dailyAttemptsLimit?: number | null;
        isUnlimited?: boolean;
        sortOrder?: number;
      }>;
    },
  ) {
    return this.prisma.subscriptionPlanTemplate.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        isPremium: data.isPremium ?? false,
        durationDays: data.durationDays ?? null,
        totalAttemptsLimit: data.totalAttemptsLimit ?? null,
        dailyAttemptsLimit: data.dailyAttemptsLimit ?? null,
        timezoneMode: data.timezoneMode ?? 'user',
        metadata: (data.metadata as object | undefined) ?? undefined,
        createdBy: adminId,
        examRules: data.rules?.length
          ? {
              create: data.rules.map((rule) => ({
                examTypeId: rule.examTypeId,
                totalAttemptsLimit: rule.totalAttemptsLimit ?? null,
                dailyAttemptsLimit: rule.dailyAttemptsLimit ?? null,
                isUnlimited: rule.isUnlimited ?? false,
                sortOrder: rule.sortOrder ?? 0,
              })),
            }
          : undefined,
      },
      include: { examRules: true },
    });
  }

  async updatePlanTemplate(
    id: string,
    data: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      isPremium?: boolean;
      durationDays?: number | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezoneMode?: string;
      metadata?: unknown;
      replaceRules?: Array<{
        examTypeId: string;
        totalAttemptsLimit?: number | null;
        dailyAttemptsLimit?: number | null;
        isUnlimited?: boolean;
        sortOrder?: number;
      }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      if (data.replaceRules) {
        await tx.subscriptionPlanTemplateExamRule.deleteMany({
          where: { planTemplateId: id },
        });
      }
      return tx.subscriptionPlanTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.isPremium !== undefined ? { isPremium: data.isPremium } : {}),
          ...(data.durationDays !== undefined ? { durationDays: data.durationDays } : {}),
          ...(data.totalAttemptsLimit !== undefined
            ? { totalAttemptsLimit: data.totalAttemptsLimit }
            : {}),
          ...(data.dailyAttemptsLimit !== undefined
            ? { dailyAttemptsLimit: data.dailyAttemptsLimit }
            : {}),
          ...(data.timezoneMode !== undefined ? { timezoneMode: data.timezoneMode } : {}),
          ...(data.metadata !== undefined ? { metadata: data.metadata as object } : {}),
          ...(data.replaceRules
            ? {
                examRules: {
                  create: data.replaceRules.map((rule) => ({
                    examTypeId: rule.examTypeId,
                    totalAttemptsLimit: rule.totalAttemptsLimit ?? null,
                    dailyAttemptsLimit: rule.dailyAttemptsLimit ?? null,
                    isUnlimited: rule.isUnlimited ?? false,
                    sortOrder: rule.sortOrder ?? 0,
                  })),
                },
              }
            : {}),
        },
        include: { examRules: true },
      });
    });
  }

  /**
   * Создаёт entitlements v2 по всем examRules шаблона (источник plan_template).
   * Шаблон сам по себе доступ не открывает — только после применения к пользователю.
   */
  async applyPlanTemplateToUser(
    adminId: string,
    data: {
      userId: string;
      planTemplateId: string;
      windowStartsAt: string;
      windowEndsAt?: string | null;
      paymentNote?: string | null;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, timezone: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const tpl = await this.prisma.subscriptionPlanTemplate.findFirst({
      where: { id: data.planTemplateId, isActive: true },
      include: {
        examRules: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!tpl) {
      throw new NotFoundException('PLAN_TEMPLATE_NOT_FOUND');
    }
    if (tpl.examRules.length === 0) {
      throw new BadRequestException(
        'PLAN_TEMPLATE_HAS_NO_EXAM_RULES: add at least one exam rule to the template, or use legacy subscription',
      );
    }

    const start = new Date(data.windowStartsAt);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('INVALID_WINDOW_START');
    }

    let end: Date | null = null;
    if (data.windowEndsAt != null && String(data.windowEndsAt).trim() !== '') {
      end = new Date(data.windowEndsAt);
      if (Number.isNaN(end.getTime())) {
        throw new BadRequestException('INVALID_WINDOW_END');
      }
    } else if (tpl.durationDays != null) {
      end = new Date(start.getTime() + tpl.durationDays * 86400000);
    }

    const tz = user.timezone || 'Asia/Almaty';

    return this.prisma.$transaction(async (tx) => {
      const entitlements: { id: string; examTypeId: string }[] = [];
      for (const rule of tpl.examRules) {
        const totalLimit = rule.isUnlimited
          ? null
          : (rule.totalAttemptsLimit ?? tpl.totalAttemptsLimit);
        const dailyLimit = rule.dailyAttemptsLimit ?? tpl.dailyAttemptsLimit;
        const row = await tx.userExamEntitlement.create({
          data: {
            userId: data.userId,
            examTypeId: rule.examTypeId,
            tier: tpl.isPremium ? EntitlementTier.paid : EntitlementTier.trial,
            status: EntitlementStatus.active,
            sourceType: EntitlementSourceType.plan_template,
            sourceRef: `plan_template:${tpl.id}:exam:${rule.examTypeId}:${Date.now()}`,
            planTemplateId: tpl.id,
            subscriptionId: null,
            totalAttemptsLimit: totalLimit,
            dailyAttemptsLimit: dailyLimit,
            usedAttemptsTotal: 0,
            timezone: tz,
            windowStartsAt: start,
            windowEndsAt: end,
            createdBy: adminId,
            metadata: {
              ...(data.paymentNote != null && String(data.paymentNote).trim() !== ''
                ? { paymentNote: String(data.paymentNote).trim() }
                : {}),
              planTemplateCode: tpl.code,
            },
          },
        });
        entitlements.push({ id: row.id, examTypeId: rule.examTypeId });
      }
      return {
        template: { id: tpl.id, code: tpl.code, name: tpl.name },
        entitlements,
      };
    });
  }

  async listUserEntitlements(userId: string) {
    return this.prisma.userExamEntitlement.findMany({
      where: { userId },
      include: {
        examType: { select: { id: true, slug: true, name: true } },
        subscription: { select: { id: true, planType: true, isActive: true } },
        planTemplate: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async grantEntitlement(
    adminId: string,
    data: {
      userId: string;
      examTypeId: string;
      tier: EntitlementTier;
      status?: EntitlementStatus;
      sourceType?: EntitlementSourceType;
      sourceRef?: string;
      planTemplateId?: string | null;
      subscriptionId?: string | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      usedAttemptsTotal?: number;
      timezone?: string;
      windowStartsAt: string;
      windowEndsAt?: string | null;
      metadata?: unknown;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, timezone: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const exam = await this.prisma.examType.findUnique({
      where: { id: data.examTypeId },
      select: { id: true },
    });
    if (!exam) throw new NotFoundException('Exam type not found');

    return this.prisma.userExamEntitlement.create({
      data: {
        userId: data.userId,
        examTypeId: data.examTypeId,
        tier: data.tier,
        status: data.status ?? EntitlementStatus.active,
        sourceType: data.sourceType ?? EntitlementSourceType.admin_override,
        sourceRef:
          data.sourceRef ??
          `manual:${data.userId}:${data.examTypeId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        planTemplateId: data.planTemplateId ?? null,
        subscriptionId: data.subscriptionId ?? null,
        totalAttemptsLimit: data.totalAttemptsLimit ?? null,
        dailyAttemptsLimit: data.dailyAttemptsLimit ?? null,
        usedAttemptsTotal: Math.max(0, data.usedAttemptsTotal ?? 0),
        timezone: data.timezone || user.timezone || 'Asia/Almaty',
        windowStartsAt: new Date(data.windowStartsAt),
        windowEndsAt: data.windowEndsAt ? new Date(data.windowEndsAt) : null,
        createdBy: adminId,
        metadata: (data.metadata as object | undefined) ?? undefined,
      },
    });
  }

  async updateEntitlement(
    entitlementId: string,
    data: {
      status?: EntitlementStatus;
      tier?: EntitlementTier;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezone?: string;
      windowStartsAt?: string;
      windowEndsAt?: string | null;
      nextAllowedAt?: string | null;
      metadata?: unknown;
    },
  ) {
    return this.prisma.userExamEntitlement.update({
      where: { id: entitlementId },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.tier !== undefined ? { tier: data.tier } : {}),
        ...(data.totalAttemptsLimit !== undefined
          ? { totalAttemptsLimit: data.totalAttemptsLimit }
          : {}),
        ...(data.dailyAttemptsLimit !== undefined
          ? { dailyAttemptsLimit: data.dailyAttemptsLimit }
          : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.windowStartsAt !== undefined
          ? { windowStartsAt: new Date(data.windowStartsAt) }
          : {}),
        ...(data.windowEndsAt !== undefined
          ? { windowEndsAt: data.windowEndsAt ? new Date(data.windowEndsAt) : null }
          : {}),
        ...(data.nextAllowedAt !== undefined
          ? { nextAllowedAt: data.nextAllowedAt ? new Date(data.nextAllowedAt) : null }
          : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata as object } : {}),
      },
    });
  }

  async adjustEntitlementAttempts(
    adminId: string,
    entitlementId: string,
    data: { delta: number; reasonCode?: string },
  ) {
    if (!Number.isFinite(data.delta) || data.delta === 0) {
      throw new BadRequestException('INVALID_DELTA');
    }
    return this.prisma.$transaction(async (tx) => {
      const entitlement = await tx.userExamEntitlement.findUnique({
        where: { id: entitlementId },
      });
      if (!entitlement) throw new NotFoundException('ENTITLEMENT_NOT_FOUND');
      const usedAttemptsTotal = Math.max(0, entitlement.usedAttemptsTotal + data.delta);
      const exhausted =
        entitlement.totalAttemptsLimit != null &&
        usedAttemptsTotal >= entitlement.totalAttemptsLimit;
      const status = exhausted ? EntitlementStatus.exhausted : EntitlementStatus.active;
      const updated = await tx.userExamEntitlement.update({
        where: { id: entitlement.id },
        data: {
          usedAttemptsTotal,
          status,
          exhaustedAt: exhausted ? new Date() : null,
        },
      });
      await tx.attemptUsageLedger.create({
        data: {
          userId: entitlement.userId,
          examTypeId: entitlement.examTypeId,
          entitlementId: entitlement.id,
          action: 'manual_adjust',
          reasonCode: data.reasonCode ?? 'ADMIN_MANUAL_ADJUST',
          attemptsDelta: data.delta,
          metadata: { byAdminId: adminId, inputDelta: data.delta },
        },
      });
      return updated;
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
