import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EntitlementSourceType,
  EntitlementStatus,
  EntitlementTier,
  Prisma,
} from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';
import { ENT_TRIAL_LIMIT } from '../billing/billing.config';

export type AccessReasonCode =
  | 'DAILY_LIMIT_REACHED'
  | 'TOTAL_LIMIT_EXHAUSTED'
  | 'NO_ENTITLEMENT';

export interface AccessExamStatus {
  examTypeId: string;
  examSlug: string;
  hasAccess: boolean;
  reasonCode: AccessReasonCode | null;
  nextAllowedAt: string | null;
  hasPaidTier: boolean;
  total: {
    used: number;
    limit: number | null;
    remaining: number | null;
    isUnlimited: boolean;
  };
  daily: {
    used: number;
    limit: number | null;
    remaining: number | null;
    isUnlimited: boolean;
    nextResetAt: string | null;
  };
}

type DecisionCandidate = {
  entitlement: {
    id: string;
    sourceType: EntitlementSourceType;
    totalAttemptsLimit: number | null;
    dailyAttemptsLimit: number | null;
    usedAttemptsTotal: number;
    timezone: string;
    windowEndsAt: Date | null;
    tier: EntitlementTier;
  };
  localDay: string;
  remainingTotal: number | null;
  remainingToday: number | null;
  nextResetAt: Date | null;
};

type AccessDecision = {
  allowed: boolean;
  reasonCode: AccessReasonCode | null;
  nextAllowedAt: Date | null;
  candidate: DecisionCandidate | null;
};

@Injectable()
export class AccessService {
  private readonly v2Enabled: boolean;
  private readonly legacySyncEnabled: boolean;
  private readonly dualWriteLegacyEnabled: boolean;
  private readonly timezoneCooldownDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.v2Enabled = this.parseBool(
      this.config.get<string>('SUBSCRIPTION_ENGINE_V2'),
      false,
    );
    this.legacySyncEnabled = this.parseBool(
      this.config.get<string>('SUBSCRIPTION_ENGINE_V2_DUAL_READ'),
      true,
    );
    this.dualWriteLegacyEnabled = this.parseBool(
      this.config.get<string>('SUBSCRIPTION_ENGINE_V2_DUAL_WRITE'),
      true,
    );
    const cooldownRaw = Number(
      this.config.get<string>('USER_TIMEZONE_COOLDOWN_DAYS', '30'),
    );
    this.timezoneCooldownDays =
      Number.isFinite(cooldownRaw) && cooldownRaw > 0 ? Math.floor(cooldownRaw) : 30;
  }

  isV2Enabled() {
    return this.v2Enabled;
  }

  async assertAndConsumeAttempt(
    userId: string,
    examTypeId: string,
    sessionId?: string,
  ): Promise<void> {
    if (!this.v2Enabled) {
      await this.consumeLegacyAttempt(userId, examTypeId);
      return;
    }

    await this.prisma.$transaction(async (tx) => {
      const now = new Date();
      const exam = await tx.examType.findUnique({
        where: { id: examTypeId },
        select: { id: true, slug: true },
      });
      if (!exam) throw new BadRequestException('EXAM_NOT_FOUND');

      await this.maybeSyncLegacyEntitlements(tx, userId, exam, now);
      await this.expireEndedEntitlements(tx, userId, exam.id, now);

      const decision = await this.getAccessDecisionTx(tx, userId, exam.id, now);
      if (!decision.allowed || !decision.candidate) {
        await tx.attemptUsageLedger.create({
          data: {
            userId,
            examTypeId: exam.id,
            action:
              decision.reasonCode === 'DAILY_LIMIT_REACHED'
                ? 'daily_blocked'
                : decision.reasonCode === 'TOTAL_LIMIT_EXHAUSTED'
                  ? 'total_blocked'
                  : 'denied_no_entitlement',
            reasonCode: decision.reasonCode,
            localDay: decision.candidate?.localDay ?? null,
            metadata: decision.nextAllowedAt
              ? { nextAllowedAt: decision.nextAllowedAt.toISOString() }
              : undefined,
          },
        });
        throw new BadRequestException(
          decision.reasonCode ?? 'NO_ENTITLEMENT',
        );
      }

      const chosen = decision.candidate;
      if (chosen.remainingToday != null) {
        await this.incrementDailyUsageTx(
          tx,
          userId,
          exam.id,
          chosen.entitlement.id,
          chosen.localDay,
          chosen.entitlement.timezone,
          chosen.entitlement.dailyAttemptsLimit!,
        );
      }

      const updateRes = await tx.userExamEntitlement.updateMany({
        where: {
          id: chosen.entitlement.id,
          status: EntitlementStatus.active,
          ...(chosen.entitlement.totalAttemptsLimit != null
            ? {
                usedAttemptsTotal: {
                  lt: chosen.entitlement.totalAttemptsLimit,
                },
              }
            : {}),
        },
        data: {
          usedAttemptsTotal: { increment: 1 },
          lastAttemptAt: now,
        },
      });
      if (updateRes.count === 0) {
        throw new BadRequestException('TOTAL_LIMIT_EXHAUSTED');
      }

      const updated = await tx.userExamEntitlement.findUnique({
        where: { id: chosen.entitlement.id },
        select: {
          id: true,
          totalAttemptsLimit: true,
          usedAttemptsTotal: true,
          status: true,
          sourceType: true,
        },
      });
      if (
        updated &&
        updated.totalAttemptsLimit != null &&
        updated.usedAttemptsTotal >= updated.totalAttemptsLimit &&
        updated.status === EntitlementStatus.active
      ) {
        await tx.userExamEntitlement.update({
          where: { id: updated.id },
          data: { status: EntitlementStatus.exhausted, exhaustedAt: now },
        });
      }

      if (
        this.dualWriteLegacyEnabled &&
        chosen.entitlement.sourceType === EntitlementSourceType.legacy_free_trial
      ) {
        await tx.user.updateMany({
          where: { id: userId, entTrialUsed: { lt: ENT_TRIAL_LIMIT } },
          data: { entTrialUsed: { increment: 1 } },
        });
      }

      await tx.attemptUsageLedger.create({
        data: {
          userId,
          examTypeId: exam.id,
          entitlementId: chosen.entitlement.id,
          sessionId: sessionId ?? null,
          action: 'attempt_consumed',
          attemptsDelta: 1,
          localDay: chosen.localDay,
        },
      });
    });
  }

  async getUserAccessByExam(userId: string): Promise<AccessExamStatus[]> {
    const now = new Date();
    if (!this.v2Enabled) {
      return this.getLegacyAccessByExam(userId, now);
    }

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { id: true },
      });
      if (!user) return [];
      const exams = await tx.examType.findMany({
        where: { isActive: true },
        select: { id: true, slug: true },
      });
      const result: AccessExamStatus[] = [];
      for (const exam of exams) {
        await this.maybeSyncLegacyEntitlements(tx, user.id, exam, now);
        await this.expireEndedEntitlements(tx, user.id, exam.id, now);
        result.push(
          await this.buildExamSummaryTx(tx, user.id, exam.id, exam.slug, now),
        );
      }
      return result;
    });
  }

  async updateUserTimezone(
    userId: string,
    timezone: string,
    opts?: { byAdmin?: boolean },
  ): Promise<{ timezone: string; timezoneChangedAt: Date }> {
    if (!this.isValidTimeZone(timezone)) {
      throw new BadRequestException('INVALID_TIMEZONE');
    }

    const now = new Date();
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { timezone: true, timezoneChangedAt: true },
    });
    if (!user) throw new BadRequestException('USER_NOT_FOUND');

    if (!opts?.byAdmin && user.timezoneChangedAt) {
      const cooldownMs = this.timezoneCooldownDays * 24 * 60 * 60 * 1000;
      const nextAllowed = new Date(user.timezoneChangedAt.getTime() + cooldownMs);
      if (nextAllowed > now) {
        throw new BadRequestException('TIMEZONE_CHANGE_COOLDOWN');
      }
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.user.update({
        where: { id: userId },
        data: { timezone, timezoneChangedAt: now },
      });
      await tx.userExamEntitlement.updateMany({
        where: {
          userId,
          status: EntitlementStatus.active,
        },
        data: {
          timezone,
          timezoneLockedUntil: opts?.byAdmin
            ? null
            : new Date(now.getTime() + this.timezoneCooldownDays * 24 * 60 * 60 * 1000),
        },
      });
      const allExamTypes = await tx.examType.findMany({
        where: { isActive: true },
        select: { id: true },
      });
      if (allExamTypes.length > 0) {
        await tx.attemptUsageLedger.createMany({
          data: allExamTypes.map((exam) => ({
            userId,
            examTypeId: exam.id,
            action: 'timezone_changed',
            reasonCode: 'TIMEZONE_UPDATED',
            metadata: { timezone, byAdmin: !!opts?.byAdmin },
          })),
        });
      }
    });
    return { timezone, timezoneChangedAt: now };
  }

  async syncSubscriptionEntitlements(subscriptionId: string): Promise<void> {
    if (!this.v2Enabled && !this.dualWriteLegacyEnabled) return;
    await this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
          id: true,
          userId: true,
          planType: true,
          examTypeId: true,
          startsAt: true,
          expiresAt: true,
          isActive: true,
        },
      });
      if (!sub) return;

      const examScope =
        sub.examTypeId != null
          ? await tx.examType.findMany({
              where: { id: sub.examTypeId },
              select: { id: true },
            })
          : sub.planType === 'trial'
            ? await tx.examType.findMany({
                where: { slug: 'ent' },
                select: { id: true },
              })
            : await tx.examType.findMany({
                where: { isActive: true },
                select: { id: true },
              });
      const tier =
        sub.planType === 'trial' ? EntitlementTier.trial : EntitlementTier.paid;
      const totalLimit = sub.planType === 'trial' ? 1 : null;
      const status = !sub.isActive
        ? EntitlementStatus.revoked
        : sub.expiresAt <= new Date()
          ? EntitlementStatus.expired
          : EntitlementStatus.active;

      for (const exam of examScope) {
        await tx.userExamEntitlement.upsert({
          where: {
            sourceType_sourceRef: {
              sourceType: EntitlementSourceType.subscription,
              sourceRef: `subscription:${sub.id}:exam:${exam.id}`,
            },
          },
          update: {
            userId: sub.userId,
            examTypeId: exam.id,
            subscriptionId: sub.id,
            tier,
            status,
            totalAttemptsLimit: totalLimit,
            dailyAttemptsLimit: null,
            windowStartsAt: sub.startsAt,
            windowEndsAt: sub.expiresAt,
            revokedAt: status === EntitlementStatus.revoked ? new Date() : null,
            exhaustedAt: null,
          },
          create: {
            userId: sub.userId,
            examTypeId: exam.id,
            subscriptionId: sub.id,
            sourceType: EntitlementSourceType.subscription,
            sourceRef: `subscription:${sub.id}:exam:${exam.id}`,
            tier,
            status,
            totalAttemptsLimit: totalLimit,
            dailyAttemptsLimit: null,
            windowStartsAt: sub.startsAt,
            windowEndsAt: sub.expiresAt,
          },
        });
      }
    });
  }

  private async getLegacyAccessByExam(
    userId: string,
    now: Date,
  ): Promise<AccessExamStatus[]> {
    const exams = await this.prisma.examType.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
    });
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { entTrialUsed: true },
    });
    if (!user) return [];
    const activeSubscriptions = await this.prisma.subscription.findMany({
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
        examTypeId: true,
      },
    });

    const result: AccessExamStatus[] = [];
    for (const exam of exams) {
      if (exam.slug !== 'ent') {
        result.push({
          examTypeId: exam.id,
          examSlug: exam.slug,
          hasAccess: true,
          reasonCode: null,
          nextAllowedAt: null,
          hasPaidTier: true,
          total: { used: 0, limit: null, remaining: null, isUnlimited: true },
          daily: { used: 0, limit: null, remaining: null, isUnlimited: true, nextResetAt: null },
        });
        continue;
      }
      const paid = activeSubscriptions.some((s) => s.planType !== 'trial');
      const trialSubs = activeSubscriptions.filter((s) => s.planType === 'trial');
      let paidTrialRemaining = 0;
      for (const sub of trialSubs) {
        const taken = await this.prisma.testSession.count({
          where: {
            userId,
            examTypeId: exam.id,
            startedAt: { gte: sub.startsAt, lt: sub.expiresAt },
          },
        });
        paidTrialRemaining += Math.max(0, 1 - Math.min(1, taken));
      }
      const freeRemaining = Math.max(0, ENT_TRIAL_LIMIT - user.entTrialUsed);
      const totalRemaining = paid ? null : freeRemaining + paidTrialRemaining;
      result.push({
        examTypeId: exam.id,
        examSlug: exam.slug,
        hasAccess: paid || (totalRemaining ?? 0) > 0,
        reasonCode:
          paid || (totalRemaining ?? 0) > 0 ? null : 'TOTAL_LIMIT_EXHAUSTED',
        nextAllowedAt: null,
        hasPaidTier: paid,
        total: {
          used: paid ? 0 : user.entTrialUsed + (trialSubs.length - paidTrialRemaining),
          limit: paid ? null : ENT_TRIAL_LIMIT + trialSubs.length,
          remaining: totalRemaining,
          isUnlimited: paid,
        },
        daily: {
          used: 0,
          limit: null,
          remaining: null,
          isUnlimited: true,
          nextResetAt: null,
        },
      });
    }
    return result;
  }

  private async consumeLegacyAttempt(userId: string, examTypeId: string) {
    const exam = await this.prisma.examType.findUnique({
      where: { id: examTypeId },
      select: { id: true, slug: true },
    });
    if (!exam) throw new BadRequestException('EXAM_NOT_FOUND');
    if (exam.slug !== 'ent') return;

    const now = new Date();
    const activeSubscriptions = await this.prisma.subscription.findMany({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: { planType: true, startsAt: true, expiresAt: true },
    });

    if (activeSubscriptions.some((s) => s.planType !== 'trial')) return;

    for (const sub of activeSubscriptions.filter((s) => s.planType === 'trial')) {
      const used = await this.prisma.testSession.count({
        where: {
          userId,
          examTypeId,
          startedAt: { gte: sub.startsAt, lt: sub.expiresAt },
        },
      });
      if (used < 1) return;
    }

    const consumed = await this.prisma.user.updateMany({
      where: { id: userId, entTrialUsed: { lt: ENT_TRIAL_LIMIT } },
      data: { entTrialUsed: { increment: 1 } },
    });
    if (consumed.count === 0) throw new BadRequestException('TRIAL_LIMIT_EXCEEDED');
  }

  private parseBool(value: string | undefined, fallback: boolean): boolean {
    if (value == null) return fallback;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private async expireEndedEntitlements(
    tx: Prisma.TransactionClient,
    userId: string,
    examTypeId: string,
    now: Date,
  ) {
    await tx.userExamEntitlement.updateMany({
      where: {
        userId,
        examTypeId,
        status: EntitlementStatus.active,
        windowEndsAt: { not: null, lte: now },
      },
      data: { status: EntitlementStatus.expired },
    });
  }

  private async maybeSyncLegacyEntitlements(
    tx: Prisma.TransactionClient,
    userId: string,
    exam: { id: string; slug: string },
    now: Date,
  ) {
    if (!this.legacySyncEnabled || exam.slug !== 'ent') return;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, entTrialUsed: true, timezone: true },
    });
    if (!user) return;

    const freeUsed = Math.max(0, user.entTrialUsed);
    const freeStatus =
      freeUsed >= ENT_TRIAL_LIMIT
        ? EntitlementStatus.exhausted
        : EntitlementStatus.active;
    await tx.userExamEntitlement.upsert({
      where: {
        sourceType_sourceRef: {
          sourceType: EntitlementSourceType.legacy_free_trial,
          sourceRef: `user:${userId}:ent_free`,
        },
      },
      update: {
        userId,
        examTypeId: exam.id,
        tier: EntitlementTier.free,
        status: freeStatus,
        totalAttemptsLimit: ENT_TRIAL_LIMIT,
        dailyAttemptsLimit: null,
        usedAttemptsTotal: freeUsed,
        timezone: user.timezone || 'Asia/Almaty',
        windowStartsAt: now,
        windowEndsAt: null,
        exhaustedAt: freeStatus === EntitlementStatus.exhausted ? now : null,
      },
      create: {
        userId,
        examTypeId: exam.id,
        tier: EntitlementTier.free,
        status: freeStatus,
        sourceType: EntitlementSourceType.legacy_free_trial,
        sourceRef: `user:${userId}:ent_free`,
        totalAttemptsLimit: ENT_TRIAL_LIMIT,
        dailyAttemptsLimit: null,
        usedAttemptsTotal: freeUsed,
        timezone: user.timezone || 'Asia/Almaty',
        windowStartsAt: now,
      },
    });

    const activeSubscriptions = await tx.subscription.findMany({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
        OR: [{ examTypeId: null }, { examTypeId: exam.id }],
      },
      select: {
        id: true,
        planType: true,
        startsAt: true,
        expiresAt: true,
      },
    });

    for (const sub of activeSubscriptions) {
      const isTrial = sub.planType === 'trial';
      const sourceType = isTrial
        ? EntitlementSourceType.legacy_trial_subscription
        : EntitlementSourceType.legacy_paid_subscription;
      const tier = isTrial ? EntitlementTier.trial : EntitlementTier.paid;
      const totalLimit = isTrial ? 1 : null;
      const countedUsed = isTrial
        ? await tx.testSession.count({
            where: {
              userId,
              examTypeId: exam.id,
              startedAt: { gte: sub.startsAt, lt: sub.expiresAt },
            },
          })
        : 0;
      const existing = await tx.userExamEntitlement.findUnique({
        where: {
          sourceType_sourceRef: {
            sourceType,
            sourceRef: `subscription:${sub.id}:exam:${exam.id}`,
          },
        },
        select: { usedAttemptsTotal: true },
      });
      const used = Math.max(existing?.usedAttemptsTotal ?? 0, countedUsed);
      const status =
        totalLimit != null && used >= totalLimit
          ? EntitlementStatus.exhausted
          : EntitlementStatus.active;

      await tx.userExamEntitlement.upsert({
        where: {
          sourceType_sourceRef: {
            sourceType,
            sourceRef: `subscription:${sub.id}:exam:${exam.id}`,
          },
        },
        update: {
          userId,
          examTypeId: exam.id,
          subscriptionId: sub.id,
          tier,
          status,
          totalAttemptsLimit: totalLimit,
          dailyAttemptsLimit: null,
          usedAttemptsTotal: used,
          windowStartsAt: sub.startsAt,
          windowEndsAt: sub.expiresAt,
          exhaustedAt: status === EntitlementStatus.exhausted ? now : null,
        },
        create: {
          userId,
          examTypeId: exam.id,
          subscriptionId: sub.id,
          tier,
          status,
          sourceType,
          sourceRef: `subscription:${sub.id}:exam:${exam.id}`,
          totalAttemptsLimit: totalLimit,
          dailyAttemptsLimit: null,
          usedAttemptsTotal: used,
          windowStartsAt: sub.startsAt,
          windowEndsAt: sub.expiresAt,
          timezone: user.timezone || 'Asia/Almaty',
          exhaustedAt: status === EntitlementStatus.exhausted ? now : null,
        },
      });
    }
  }

  private async buildExamSummaryTx(
    tx: Prisma.TransactionClient,
    userId: string,
    examTypeId: string,
    examSlug: string,
    now: Date,
  ): Promise<AccessExamStatus> {
    const entitlements = await tx.userExamEntitlement.findMany({
      where: {
        userId,
        examTypeId,
        status: EntitlementStatus.active,
        windowStartsAt: { lte: now },
        OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
      },
      select: {
        id: true,
        tier: true,
        status: true,
        totalAttemptsLimit: true,
        usedAttemptsTotal: true,
        dailyAttemptsLimit: true,
        timezone: true,
      },
    });

    let usedTotal = 0;
    let totalLimit: number | null = 0;
    let totalUnlimited = false;
    let usedDaily = 0;
    let dailyLimit: number | null = 0;
    let dailyUnlimited = false;
    let hasPaidTier = false;
    let anyAllowed = false;
    let nearestReset: Date | null = null;
    let anyTotalExhausted = false;
    let anyDailyBlocked = false;

    for (const ent of entitlements) {
      if (ent.tier === EntitlementTier.paid) hasPaidTier = true;
      const remTotal =
        ent.totalAttemptsLimit == null
          ? null
          : Math.max(0, ent.totalAttemptsLimit - ent.usedAttemptsTotal);
      if (remTotal === 0) anyTotalExhausted = true;
      if (ent.totalAttemptsLimit == null) {
        totalUnlimited = true;
      } else {
        totalLimit = (totalLimit ?? 0) + ent.totalAttemptsLimit;
        usedTotal += ent.usedAttemptsTotal;
      }

      if (ent.dailyAttemptsLimit == null) {
        dailyUnlimited = true;
        if (remTotal == null || remTotal > 0) anyAllowed = true;
        continue;
      }

      const localDay = this.getLocalDayKey(now, ent.timezone);
      const usage = await tx.userExamDailyUsage.findUnique({
        where: {
          entitlementId_localDay: {
            entitlementId: ent.id,
            localDay,
          },
        },
        select: { attemptsUsed: true },
      });
      const dailyUsed = usage?.attemptsUsed ?? 0;
      const remDaily = Math.max(0, ent.dailyAttemptsLimit - dailyUsed);
      usedDaily += dailyUsed;
      dailyLimit = (dailyLimit ?? 0) + ent.dailyAttemptsLimit;
      if (remDaily === 0) {
        anyDailyBlocked = true;
        const next = this.getNextLocalMidnightUtc(now, ent.timezone);
        if (!nearestReset || next < nearestReset) nearestReset = next;
      }
      if ((remTotal == null || remTotal > 0) && remDaily > 0) {
        anyAllowed = true;
      }
    }

    const computedTotalLimit = totalUnlimited ? null : totalLimit;
    const computedTotalRemaining = totalUnlimited
      ? null
      : Math.max(0, (totalLimit ?? 0) - usedTotal);
    const computedDailyLimit = dailyUnlimited ? null : dailyLimit;
    const computedDailyRemaining = dailyUnlimited
      ? null
      : Math.max(0, (dailyLimit ?? 0) - usedDaily);
    const reasonCode: AccessReasonCode | null = anyAllowed
      ? null
      : anyDailyBlocked
        ? 'DAILY_LIMIT_REACHED'
        : anyTotalExhausted
          ? 'TOTAL_LIMIT_EXHAUSTED'
          : 'NO_ENTITLEMENT';

    return {
      examTypeId,
      examSlug,
      hasAccess: anyAllowed,
      reasonCode,
      nextAllowedAt:
        reasonCode === 'DAILY_LIMIT_REACHED' && nearestReset
          ? nearestReset.toISOString()
          : null,
      hasPaidTier,
      total: {
        used: usedTotal,
        limit: computedTotalLimit,
        remaining: computedTotalRemaining,
        isUnlimited: totalUnlimited,
      },
      daily: {
        used: usedDaily,
        limit: computedDailyLimit,
        remaining: computedDailyRemaining,
        isUnlimited: dailyUnlimited,
        nextResetAt:
          reasonCode === 'DAILY_LIMIT_REACHED' && nearestReset
            ? nearestReset.toISOString()
            : null,
      },
    };
  }

  private async getAccessDecisionTx(
    tx: Prisma.TransactionClient,
    userId: string,
    examTypeId: string,
    now: Date,
  ): Promise<AccessDecision> {
    const entitlements = await tx.userExamEntitlement.findMany({
      where: {
        userId,
        examTypeId,
        status: EntitlementStatus.active,
        windowStartsAt: { lte: now },
        OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
      },
      select: {
        id: true,
        sourceType: true,
        totalAttemptsLimit: true,
        usedAttemptsTotal: true,
        dailyAttemptsLimit: true,
        timezone: true,
        tier: true,
        windowEndsAt: true,
        createdAt: true,
      },
      orderBy: [{ createdAt: 'asc' }],
    });

    if (entitlements.length === 0) {
      return {
        allowed: false,
        reasonCode: 'NO_ENTITLEMENT',
        nextAllowedAt: null,
        candidate: null,
      };
    }

    const sorted = [...entitlements].sort((a, b) => {
      const aUnlimited = a.totalAttemptsLimit == null ? 1 : 0;
      const bUnlimited = b.totalAttemptsLimit == null ? 1 : 0;
      if (aUnlimited !== bUnlimited) return aUnlimited - bUnlimited;
      const aEnds = a.windowEndsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bEnds = b.windowEndsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aEnds - bEnds;
    });

    let hasDailyBlocked = false;
    let hasTotalExhausted = false;
    let nearestReset: Date | null = null;
    for (const ent of sorted) {
      const remTotal =
        ent.totalAttemptsLimit == null
          ? null
          : Math.max(0, ent.totalAttemptsLimit - ent.usedAttemptsTotal);
      if (remTotal === 0) {
        hasTotalExhausted = true;
        continue;
      }
      const localDay = this.getLocalDayKey(now, ent.timezone);
      let remToday: number | null = null;
      let nextResetAt: Date | null = null;
      if (ent.dailyAttemptsLimit != null) {
        const usage = await tx.userExamDailyUsage.findUnique({
          where: {
            entitlementId_localDay: { entitlementId: ent.id, localDay },
          },
          select: { attemptsUsed: true },
        });
        const used = usage?.attemptsUsed ?? 0;
        remToday = Math.max(0, ent.dailyAttemptsLimit - used);
        if (remToday <= 0) {
          hasDailyBlocked = true;
          nextResetAt = this.getNextLocalMidnightUtc(now, ent.timezone);
          if (!nearestReset || nextResetAt < nearestReset) nearestReset = nextResetAt;
          continue;
        }
      }
      return {
        allowed: true,
        reasonCode: null,
        nextAllowedAt: null,
        candidate: {
          entitlement: {
            id: ent.id,
            sourceType: ent.sourceType,
            totalAttemptsLimit: ent.totalAttemptsLimit,
            dailyAttemptsLimit: ent.dailyAttemptsLimit,
            usedAttemptsTotal: ent.usedAttemptsTotal,
            timezone: ent.timezone,
            windowEndsAt: ent.windowEndsAt,
            tier: ent.tier,
          },
          localDay,
          remainingTotal: remTotal,
          remainingToday: remToday,
          nextResetAt,
        },
      };
    }

    return {
      allowed: false,
      reasonCode: hasDailyBlocked
        ? 'DAILY_LIMIT_REACHED'
        : hasTotalExhausted
          ? 'TOTAL_LIMIT_EXHAUSTED'
          : 'NO_ENTITLEMENT',
      nextAllowedAt: nearestReset,
      candidate: null,
    };
  }

  private async incrementDailyUsageTx(
    tx: Prisma.TransactionClient,
    userId: string,
    examTypeId: string,
    entitlementId: string,
    localDay: string,
    timezone: string,
    limit: number,
  ) {
    const updated = await tx.userExamDailyUsage.updateMany({
      where: {
        entitlementId,
        localDay,
        attemptsUsed: { lt: limit },
      },
      data: { attemptsUsed: { increment: 1 } },
    });
    if (updated.count > 0) return;

    try {
      await tx.userExamDailyUsage.create({
        data: {
          userId,
          examTypeId,
          entitlementId,
          localDay,
          timezone,
          attemptsUsed: 1,
        },
      });
      return;
    } catch (err) {
      if (!(err instanceof PrismaClientKnownRequestError) || err.code !== 'P2002') {
        throw err;
      }
    }

    const retry = await tx.userExamDailyUsage.updateMany({
      where: {
        entitlementId,
        localDay,
        attemptsUsed: { lt: limit },
      },
      data: { attemptsUsed: { increment: 1 } },
    });
    if (retry.count === 0) {
      throw new BadRequestException('DAILY_LIMIT_REACHED');
    }
  }

  private isValidTimeZone(timezone: string): boolean {
    try {
      // Throws for invalid IANA names
      new Intl.DateTimeFormat('en-US', { timeZone: timezone }).format();
      return true;
    } catch {
      return false;
    }
  }

  private getLocalDayKey(date: Date, timezone: string): string {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
    return `${get('year')}-${get('month')}-${get('day')}`;
  }

  private getNextLocalMidnightUtc(date: Date, timezone: string): Date {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).formatToParts(date);
    const y = Number(parts.find((p) => p.type === 'year')?.value);
    const m = Number(parts.find((p) => p.type === 'month')?.value);
    const d = Number(parts.find((p) => p.type === 'day')?.value);

    const nextDayUtcGuess = new Date(Date.UTC(y, m - 1, d + 1, 0, 0, 0));
    const offset1 = this.getOffsetMs(nextDayUtcGuess, timezone);
    const firstPass = new Date(nextDayUtcGuess.getTime() - offset1);
    const offset2 = this.getOffsetMs(firstPass, timezone);
    if (offset1 === offset2) return firstPass;
    return new Date(nextDayUtcGuess.getTime() - offset2);
  }

  private getOffsetMs(date: Date, timezone: string): number {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      timeZoneName: 'shortOffset',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(date);
    const zone = parts.find((p) => p.type === 'timeZoneName')?.value ?? 'GMT+0';
    const match = zone.match(/GMT([+-]\d{1,2})(?::?(\d{2}))?/i);
    if (!match) return 0;
    const hours = Number(match[1]);
    const mins = Number(match[2] ?? '0');
    const sign = hours < 0 ? -1 : 1;
    return (hours * 60 + sign * mins) * 60 * 1000;
  }
}
