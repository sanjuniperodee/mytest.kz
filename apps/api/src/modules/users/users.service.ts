import { BadRequestException, Injectable } from '@nestjs/common';
import {
  EntitlementSourceType,
  EntitlementStatus,
  EntitlementTier,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { BILLING_PLANS, ENT_TRIAL_LIMIT } from '../billing/billing.config';
import { ENT_CONFIG } from '@bilimland/shared';
import { AccessService } from '../subscriptions/access.service';

@Injectable()
export class UsersService {
  constructor(
    private prisma: PrismaService,
    private telegramBot: TelegramBotService,
    private accessService: AccessService,
  ) {}

  async getProfile(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) return null;

    // Re-check channel membership:
    // - Always re-check if currently false (user might have just subscribed)
    // - If true, cache for 5 min to avoid spamming Telegram API
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    let isChannelMember = user.telegramId ? user.isChannelMember : true;

    const shouldRecheck =
      !!user.telegramId &&
      (!isChannelMember || !user.channelCheckedAt || user.channelCheckedAt < fiveMinAgo);
    if (shouldRecheck) {
      isChannelMember = await this.telegramBot.checkChannelMembership(
        Number(user.telegramId),
      );
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isChannelMember, channelCheckedAt: new Date() },
      });
    }

    await this.accessService.ensureSignupEntitlementsForUser(userId);

    const accessByExam = await this.accessService.getUserAccessByExam(userId);
    const entAccess = accessByExam.find((x) => x.examSlug === 'ent');
    const activePaidAccess = accessByExam.some((x) => x.hasPaidTier && x.hasAccess);

    const signupEntitlement = await this.prisma.userExamEntitlement.findFirst({
      where: {
        userId,
        sourceType: EntitlementSourceType.plan_template,
        sourceRef: { startsWith: `signup:${userId}:exam:` },
        examType: { slug: 'ent' },
      },
      select: { totalAttemptsLimit: true, usedAttemptsTotal: true },
      orderBy: { createdAt: 'desc' },
    });
    const freeLimit = signupEntitlement?.totalAttemptsLimit ?? ENT_TRIAL_LIMIT;
    const freeUsed = Math.max(
      0,
      signupEntitlement?.usedAttemptsTotal ?? user.entTrialUsed,
    );
    const freeRemaining = Math.max(0, freeLimit - freeUsed);
    const totalRemainingFromAccess =
      entAccess?.total.remaining != null ? Math.max(0, entAccess.total.remaining) : 0;
    const paidTrialRemaining = Math.max(0, totalRemainingFromAccess - freeRemaining);
    const paidTrialLimit = paidTrialRemaining;
    const paidTrialUsed = 0;
    const totalLimit = freeLimit + paidTrialLimit;
    const totalUsed = freeUsed + paidTrialUsed;
    const totalRemaining = freeRemaining + paidTrialRemaining;
    const currentTariff = await this.getCurrentTariff(userId, {
      freeLimit,
      freeUsed,
      freeRemaining,
    });
    const hasActivePaidSubscription =
      activePaidAccess ||
      (currentTariff?.sourceType === 'subscription' &&
        currentTariff.isActive === true &&
        currentTariff.isPaid === true);

    return {
      id: user.id,
      telegramId: user.telegramId ? Number(user.telegramId) : null,
      telegramUsername: user.telegramUsername,
      email: user.email,
      phone: user.phone,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: user.avatarUrl,
      preferredLanguage: user.preferredLanguage,
      timezone: user.timezone,
      isAdmin: user.isAdmin,
      isChannelMember,
      hasActiveSubscription: hasActivePaidSubscription,
      currentTariff,
      accessByExam,
      trialStatus: {
        ent: {
          limit: totalLimit,
          used: totalUsed,
          remaining: totalRemaining,
          exhausted: totalRemaining <= 0,
          freeLimit,
          freeUsed,
          freeRemaining,
          paidTrialLimit,
          paidTrialUsed,
          paidTrialRemaining,
          totalLimit,
          totalUsed,
          totalRemaining,
        },
      },
    };
  }

  private async getCurrentTariff(
    userId: string,
    free: { freeLimit: number; freeUsed: number; freeRemaining: number },
  ) {
    const now = new Date();
    const subscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        planType: true,
        startsAt: true,
        expiresAt: true,
        examType: { select: { id: true, slug: true, name: true } },
      },
    });
    const sortedSubscriptions = [...subscriptions].sort((a, b) => {
      const rank = (planType: string) =>
        planType === 'free' ? 0 : planType === 'trial' ? 1 : 2;
      const aPaid = rank(a.planType);
      const bPaid = rank(b.planType);
      if (aPaid !== bPaid) return bPaid - aPaid;
      return b.expiresAt.getTime() - a.expiresAt.getTime();
    });

    let exhaustedSubscriptionTariff: Record<string, unknown> | null = null;
    for (const activeSubscription of sortedSubscriptions) {
      const plan = BILLING_PLANS.find((p) => p.id === activeSubscription.planType);
      const isPaid = activeSubscription.planType !== 'free';
      const totalLimit = this.subscriptionTotalAttemptsLimit(activeSubscription.planType);
      let usedAttemptsTotal = 0;
      if (totalLimit != null) {
        const agg = await this.prisma.userExamEntitlement.aggregate({
          where: {
            userId,
            subscriptionId: activeSubscription.id,
            sourceType: EntitlementSourceType.subscription,
            status: { in: [EntitlementStatus.active, EntitlementStatus.exhausted] },
          },
          _sum: { usedAttemptsTotal: true },
        });
        usedAttemptsTotal = Math.max(0, agg._sum.usedAttemptsTotal ?? 0);
      }
      const exhausted = totalLimit != null && usedAttemptsTotal >= totalLimit;
      const isActive = !exhausted;
      const tariff = {
        code: activeSubscription.planType,
        name: plan?.name ?? this.fallbackTariffName(activeSubscription.planType),
        description: plan?.description ?? null,
        tier: isPaid ? 'paid' : 'free',
        sourceType: 'subscription',
        subscriptionId: activeSubscription.id,
        startsAt: activeSubscription.startsAt.toISOString(),
        expiresAt: activeSubscription.expiresAt.toISOString(),
        isActive,
        isPaid,
        examSlug: activeSubscription.examType?.slug ?? null,
        totalAttemptsLimit: totalLimit,
        dailyAttemptsLimit: this.subscriptionDailyAttemptsLimit(activeSubscription.planType),
        usedAttemptsTotal,
        remainingAttempts:
          totalLimit == null
            ? null
            : Math.max(0, totalLimit - usedAttemptsTotal),
      };
      if (isActive) return tariff;
      exhaustedSubscriptionTariff ??= tariff;
    }

    const entitlements = await this.prisma.userExamEntitlement.findMany({
      where: {
        userId,
        status: EntitlementStatus.active,
        windowStartsAt: { lte: now },
        OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
      },
      select: {
        id: true,
        tier: true,
        sourceType: true,
        sourceRef: true,
        totalAttemptsLimit: true,
        dailyAttemptsLimit: true,
        usedAttemptsTotal: true,
        windowStartsAt: true,
        windowEndsAt: true,
        planTemplate: {
          select: { id: true, code: true, name: true, description: true },
        },
        examType: { select: { id: true, slug: true, name: true } },
      },
    });
    const activeEntitlement = [...entitlements].sort((a, b) => {
      const rank = (tier: EntitlementTier) =>
        tier === EntitlementTier.paid
          ? 4
          : tier === EntitlementTier.admin
            ? 3
            : tier === EntitlementTier.trial
              ? 2
              : 1;
      const rankDiff = rank(b.tier) - rank(a.tier);
      if (rankDiff !== 0) return rankDiff;
      const aEnds = a.windowEndsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bEnds = b.windowEndsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aEnds - bEnds;
    })[0];

    if (activeEntitlement && activeEntitlement.tier !== EntitlementTier.free) {
      const limit = activeEntitlement.totalAttemptsLimit;
      const used = activeEntitlement.usedAttemptsTotal;
      const hasAttemptsLeft = limit == null || used < limit;
      return {
        code:
          activeEntitlement.planTemplate?.code ??
          activeEntitlement.sourceType,
        name:
          activeEntitlement.planTemplate?.name ??
          this.fallbackTariffName(activeEntitlement.tier),
        description: activeEntitlement.planTemplate?.description ?? null,
        tier: activeEntitlement.tier,
        sourceType: activeEntitlement.sourceType,
        entitlementId: activeEntitlement.id,
        planTemplateId: activeEntitlement.planTemplate?.id ?? null,
        startsAt: activeEntitlement.windowStartsAt.toISOString(),
        expiresAt: activeEntitlement.windowEndsAt?.toISOString() ?? null,
        isActive: hasAttemptsLeft,
        isPaid:
          activeEntitlement.tier === EntitlementTier.paid ||
          activeEntitlement.tier === EntitlementTier.admin,
        examSlug: activeEntitlement.examType.slug,
        totalAttemptsLimit: activeEntitlement.totalAttemptsLimit,
        dailyAttemptsLimit: activeEntitlement.dailyAttemptsLimit,
        usedAttemptsTotal: activeEntitlement.usedAttemptsTotal,
        remainingAttempts:
          activeEntitlement.totalAttemptsLimit == null
            ? null
            : Math.max(
                0,
                activeEntitlement.totalAttemptsLimit -
                  activeEntitlement.usedAttemptsTotal,
              ),
      };
    }

    if (exhaustedSubscriptionTariff) return exhaustedSubscriptionTariff;

    return {
      code: 'free_ent_trial',
      name: 'Стартовый доступ',
      description: 'Пробные попытки для ЕНТ',
      tier: 'free',
      sourceType: 'signup',
      startsAt: null,
      expiresAt: null,
      isActive: free.freeRemaining > 0,
      isPaid: false,
      examSlug: 'ent',
      totalAttemptsLimit: free.freeLimit,
      dailyAttemptsLimit: null,
      usedAttemptsTotal: free.freeUsed,
      remainingAttempts: free.freeRemaining,
    };
  }

  private fallbackTariffName(code: string) {
    if (code === 'trial') return '1 пробный ЕНТ';
    if (code === 'week') return '3 пробных ЕНТ';
    if (code === 'month') return 'Месяц без лимита';
    if (code === 'annual') return '5 пробных ЕНТ';
    if (code === 'paid') return 'Premium';
    if (code === 'admin') return 'Админ-доступ';
    return code;
  }

  private subscriptionTotalAttemptsLimit(planType: string): number | null {
    if (planType === 'trial') return 1;
    if (planType === 'week') return 3;
    if (planType === 'annual') return 5;
    return null;
  }

  private subscriptionDailyAttemptsLimit(planType: string): number | null {
    if (planType === 'trial') return 1;
    return null;
  }

  async updateProfile(
    userId: string,
    data: { preferredLanguage?: string; timezone?: string; avatarUrl?: string | null },
  ) {
    const updateData: {
      preferredLanguage?: string;
      avatarUrl?: string | null;
    } = {};

    if (data.preferredLanguage) {
      updateData.preferredLanguage = data.preferredLanguage;
    }
    if ('avatarUrl' in data) {
      updateData.avatarUrl = this.normalizeAvatarUrl(data.avatarUrl);
    }
    if (Object.keys(updateData).length > 0) {
      await this.prisma.user.update({
        where: { id: userId },
        data: updateData,
      });
    }
    if (data.timezone) {
      await this.accessService.updateUserTimezone(userId, data.timezone);
    }
    return this.getProfile(userId);
  }

  private normalizeAvatarUrl(value: string | null | undefined): string | null {
    if (value == null) return null;
    const trimmed = value.trim();
    if (!trimmed) return null;
    if (trimmed.length > 200_000) {
      throw new BadRequestException('Avatar image is too large');
    }
    const isDataImage = /^data:image\/(png|jpe?g|webp);base64,[a-z0-9+/=]+$/i.test(trimmed);
    const isRemoteImage = /^https:\/\/[^\s]+$/i.test(trimmed);
    const isUploadedAvatar = /^\/uploads\/avatars\/[a-f0-9-]+\.(jpe?g|png|webp)$/i.test(trimmed);
    if (!isDataImage && !isRemoteImage && !isUploadedAvatar) {
      throw new BadRequestException('Unsupported avatar image');
    }
    return trimmed;
  }

  async getStats(userId: string) {
    const finishedStatuses = ['completed', 'timed_out'] as const;

    const [finishedSessions, inProgressSessions] = await Promise.all([
      this.prisma.testSession.findMany({
        where: { userId, status: { in: [...finishedStatuses] } },
        include: {
          examType: { select: { id: true, slug: true, name: true } },
        },
      }),
      this.prisma.testSession.findMany({
        where: { userId, status: 'in_progress' },
        include: {
          examType: { select: { id: true, slug: true, name: true } },
        },
      }),
    ]);

    const isEntSessionEligibleForStats = (session: {
      examType: { slug: string } | null;
      totalQuestions: number;
      maxScore: number | null;
      status: string;
    }) => {
      if (session.examType?.slug !== 'ent') return true;
      if (session.totalQuestions !== ENT_CONFIG.totalQuestions) return false;
      if (session.status === 'in_progress') return true;
      return (
        session.maxScore != null &&
        Number.isFinite(Number(session.maxScore)) &&
        Math.round(Number(session.maxScore)) === ENT_CONFIG.maxTotalPoints
      );
    };

    const analyticsFinishedSessions = finishedSessions.filter(isEntSessionEligibleForStats);
    const analyticsInProgressSessions = inProgressSessions.filter(isEntSessionEligibleForStats);

    type BestSessionPoints = { score: number; raw: number; max: number };

    type ExamAgg = {
      examTypeId: string;
      examSlug: string;
      examName: unknown;
      scores: number[];
      durations: number[];
      correctPct: number[];
      finishedAts: Date[];
      completedCount: number;
      timedOutCount: number;
      /** Лучшая попытка по проценту (при равенстве % — больший сырой балл). */
      bestByPoints: BestSessionPoints | null;
    };

    const byExam = new Map<string, ExamAgg>();
    const finishedByExam = new Map<string, typeof finishedSessions>();

    const ensureAgg = (session: {
      examTypeId: string;
      examType: { slug: string; name: unknown } | null;
    }): ExamAgg => {
      const id = session.examTypeId;
      if (!byExam.has(id)) {
        byExam.set(id, {
          examTypeId: id,
          examSlug: session.examType?.slug ?? '',
          examName: session.examType?.name ?? null,
          scores: [],
          durations: [],
          correctPct: [],
          finishedAts: [],
          completedCount: 0,
          timedOutCount: 0,
          bestByPoints: null,
        });
      }
      return byExam.get(id)!;
    };

    for (const s of analyticsFinishedSessions) {
      const agg = ensureAgg(s);
      if (s.examType) {
        agg.examSlug = s.examType.slug;
        agg.examName = s.examType.name;
      }
      const sc = Number(s.score);
      if (Number.isFinite(sc)) {
        agg.scores.push(sc);
        const maxRaw =
          s.maxScore != null && Number(s.maxScore) > 0
            ? Math.round(Number(s.maxScore))
            : s.totalQuestions > 0
              ? s.totalQuestions
              : null;
        const rawVal =
          s.rawScore != null
            ? Number(s.rawScore)
            : s.correctCount != null
              ? s.correctCount
              : null;
        if (maxRaw != null && maxRaw > 0 && rawVal != null && Number.isFinite(rawVal)) {
          const raw = Math.round(rawVal);
          const candidate = { score: sc, raw, max: maxRaw };
          const prev = agg.bestByPoints;
          if (
            !prev ||
            candidate.score > prev.score ||
            (candidate.score === prev.score && candidate.raw > prev.raw)
          ) {
            agg.bestByPoints = candidate;
          }
        }
      }
      if (s.durationSecs != null && s.durationSecs > 0) {
        agg.durations.push(s.durationSecs);
      }
      if (s.correctCount != null && s.totalQuestions > 0) {
        agg.correctPct.push((s.correctCount / s.totalQuestions) * 100);
      }
      if (s.finishedAt) {
        agg.finishedAts.push(s.finishedAt);
      }
      if (s.status === 'completed') agg.completedCount++;
      if (s.status === 'timed_out') agg.timedOutCount++;
      const list = finishedByExam.get(s.examTypeId) ?? [];
      list.push(s);
      finishedByExam.set(s.examTypeId, list);
    }

    const inProgressByExam = new Map<string, number>();
    for (const s of analyticsInProgressSessions) {
      const agg = ensureAgg(s);
      if (s.examType) {
        if (!agg.examSlug) agg.examSlug = s.examType.slug;
        if (agg.examName == null) agg.examName = s.examType.name;
      }
      inProgressByExam.set(s.examTypeId, (inProgressByExam.get(s.examTypeId) ?? 0) + 1);
    }

    const withScore = analyticsFinishedSessions.filter((s) =>
      Number.isFinite(Number(s.score)),
    );
    const totalTests = withScore.length;
    const averageScore =
      totalTests > 0
        ? withScore.reduce((sum, s) => sum + Number(s.score), 0) / totalTests
        : 0;

    const byExamType = Array.from(byExam.values())
      .map((agg) => {
        const n = agg.scores.length;
        const avg = n > 0 ? agg.scores.reduce((a, b) => a + b, 0) / n : 0;
        const list = finishedByExam.get(agg.examTypeId) ?? [];
        const scoredChrono = list
          .filter((x) => Number.isFinite(Number(x.score)) && x.finishedAt)
          .sort((a, b) => a.finishedAt!.getTime() - b.finishedAt!.getTime());
        const recentScores = scoredChrono.slice(-10).map((x) => Math.round(Number(x.score)));

        return {
          examTypeId: agg.examTypeId,
          examSlug: agg.examSlug,
          examType: {
            id: agg.examTypeId,
            slug: agg.examSlug,
            name: agg.examName,
          },
          testsCount: n,
          totalSessionsCount: n + (inProgressByExam.get(agg.examTypeId) ?? 0),
          completedCount: agg.completedCount,
          timedOutCount: agg.timedOutCount,
          averageScore: n > 0 ? Math.round(avg * 100) / 100 : null,
          bestScore: n > 0 ? Math.round(Math.max(...agg.scores) * 100) / 100 : null,
          bestRawScore: agg.bestByPoints?.raw ?? null,
          bestMaxScore: agg.bestByPoints?.max ?? null,
          worstScore: n > 0 ? Math.round(Math.min(...agg.scores) * 100) / 100 : null,
          averageCorrectPercent:
            agg.correctPct.length > 0
              ? Math.round(
                  (agg.correctPct.reduce((a, b) => a + b, 0) / agg.correctPct.length) * 100,
                ) / 100
              : null,
          averageDurationSecs:
            agg.durations.length > 0
              ? Math.round(agg.durations.reduce((a, b) => a + b, 0) / agg.durations.length)
              : null,
          lastFinishedAt:
            agg.finishedAts.length > 0
              ? new Date(Math.max(...agg.finishedAts.map((d) => d.getTime()))).toISOString()
              : null,
          firstFinishedAt:
            agg.finishedAts.length > 0
              ? new Date(Math.min(...agg.finishedAts.map((d) => d.getTime()))).toISOString()
              : null,
          inProgressCount: inProgressByExam.get(agg.examTypeId) ?? 0,
          recentScores,
        };
      })
      .filter((row) => row.testsCount > 0 || row.inProgressCount > 0)
      .sort(
        (a, b) =>
          b.testsCount + b.inProgressCount - (a.testsCount + a.inProgressCount),
      );

    return {
      totalTests,
      completedTests: totalTests,
      inProgressSessionsCount: analyticsInProgressSessions.length,
      averageScore: Math.round(averageScore * 100) / 100,
      byExamType,
    };
  }

  async getEntHistory(
    userId: string,
    paging?: { page: number; limit: number },
  ): Promise<
    | { sessions: ReturnType<typeof this.mapEntHistoryRow>[] }
    | {
        sessions: ReturnType<typeof this.mapEntHistoryRow>[]
        chartSessions: ReturnType<typeof this.mapEntHistoryRow>[]
        total: number
        page: number
        limit: number
      }
  > {
    const ent = await this.prisma.examType.findUnique({
      where: { slug: 'ent' },
      select: { id: true },
    });
    if (!ent) {
      return paging
        ? { sessions: [], chartSessions: [], total: 0, page: paging.page, limit: paging.limit }
        : { sessions: [] };
    }

    const where = {
      userId,
      examTypeId: ent.id,
      status: { in: ['completed', 'timed_out'] },
      score: { not: null },
    };

    const select = {
      id: true,
      rawScore: true,
      maxScore: true,
      score: true,
      correctCount: true,
      totalQuestions: true,
      language: true,
      finishedAt: true,
      metadata: true,
    } as const;

    if (!paging) {
      const sessions = await this.prisma.testSession.findMany({
        where,
        select,
        orderBy: { finishedAt: 'asc' },
      });
      return {
        sessions: sessions.map((s) => this.mapEntHistoryRow(s)),
      };
    }

    const { page, limit } = paging;
    const skip = (page - 1) * limit;

    const [total, pageRows, chartRows] = await Promise.all([
      this.prisma.testSession.count({ where }),
      this.prisma.testSession.findMany({
        where,
        select,
        orderBy: { finishedAt: 'desc' },
        skip,
        take: limit,
      }),
      this.prisma.testSession.findMany({
        where,
        select,
        orderBy: { finishedAt: 'desc' },
        take: 120,
      }),
    ]);

    const chartSessionsAsc = [...chartRows].reverse().map((s) => this.mapEntHistoryRow(s));

    return {
      sessions: pageRows.map((s) => this.mapEntHistoryRow(s)),
      chartSessions: chartSessionsAsc,
      total,
      page,
      limit,
    };
  }

  async deleteAccount(userId: string) {
    await this.prisma.$transaction(async (tx) => {
      // Delete funnel steps for user's visit events
      const visitIds = (
        await tx.visitEvent.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map((v) => v.id);
      if (visitIds.length > 0) {
        await tx.funnelStep.deleteMany({ where: { visitId: { in: visitIds } } });
        await tx.visitEvent.deleteMany({ where: { userId } });
      }

      // Daily usage
      await tx.userExamDailyUsage.deleteMany({ where: { userId } });
      // Usage ledger
      await tx.attemptUsageLedger.deleteMany({ where: { userId } });
      // Delete test answers for user's sessions
      const sessionIds = (
        await tx.testSession.findMany({
          where: { userId },
          select: { id: true },
        })
      ).map((s) => s.id);
      if (sessionIds.length > 0) {
        await tx.testAnswer.deleteMany({ where: { sessionId: { in: sessionIds } } });
        // Nullify ledger references to these sessions
        await tx.attemptUsageLedger.updateMany({
          where: { sessionId: { in: sessionIds } },
          data: { sessionId: null },
        });
      }
      // Test sessions
      await tx.testSession.deleteMany({ where: { userId } });
      // Entitlements granted by this user
      await tx.userExamEntitlement.updateMany({
        where: { createdBy: userId },
        data: { createdBy: null },
      });
      // Entitlements for this user
      await tx.userExamEntitlement.deleteMany({ where: { userId } });
      // Granted subscriptions
      await tx.subscription.updateMany({
        where: { grantedBy: userId },
        data: { grantedBy: null },
      });
      // Subscriptions
      await tx.subscription.deleteMany({ where: { userId } });
      // Payment orders
      await tx.paymentOrder.deleteMany({ where: { userId } });
      // Plan templates created by user
      await tx.subscriptionPlanTemplate.updateMany({
        where: { createdBy: userId },
        data: { createdBy: null },
      });
      // Notification deliveries
      await tx.notificationDelivery.deleteMany({ where: { userId } });

      // Finally delete the user
      await tx.user.delete({ where: { id: userId } });
    });
  }

  private mapEntHistoryRow(s: {
    id: string;
    rawScore: number | null;
    maxScore: number | null;
    score: unknown;
    correctCount: number | null;
    totalQuestions: number | null;
    language: string | null;
    finishedAt: Date | null;
    metadata: unknown;
  }) {
    return {
      sessionId: s.id,
      date: s.finishedAt?.toISOString() ?? null,
      rawScore: s.rawScore,
      maxScore: s.maxScore,
      score: s.score != null ? Number(s.score) : null,
      correctCount: s.correctCount,
      totalQuestions: s.totalQuestions ?? 0,
      language: s.language,
      metadata: s.metadata as { profileSubjectIds?: string[] } | null,
    };
  }
}
