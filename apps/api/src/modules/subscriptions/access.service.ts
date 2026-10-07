import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  EntitlementSourceType,
  EntitlementStatus,
  EntitlementTier,
  Prisma,
} from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { MonetizationService } from './monetization.service';

export type AccessReasonCode =
  | 'DAILY_LIMIT_REACHED'
  | 'TOTAL_LIMIT_EXHAUSTED'
  | 'NO_ENTITLEMENT';

/** Бесплатная дневная квота ЕНТ на сегодня (по часовому поясу пользователя). */
export interface FreeDailyStatus {
  dailyLimit: number;
  usedToday: number;
  remainingToday: number;
  /** Когда квота обновится — ближайшая полночь по часовому поясу пользователя. */
  nextResetAt: string;
}

export interface AccessExamStatus {
  examTypeId: string;
  examSlug: string;
  hasAccess: boolean;
  reasonCode: AccessReasonCode | null;
  nextAllowedAt: string | null;
  hasPaidTier: boolean;
  /** Платные/выданные попытки (без бесплатной дневной квоты). */
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
  /** null — у экзамена нет бесплатной квоты (не ЕНТ или выключено в админке). */
  free: FreeDailyStatus | null;
}

/** Результат предварительной проверки перед сборкой теста. */
export interface AttemptAccessCheck {
  allowed: boolean;
  /** Какая попытка будет списана: free → детерминированный тест дня, paid → случайный. */
  tier: 'free' | 'paid' | null;
  reasonCode: AccessReasonCode | null;
  nextAllowedAt: string | null;
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

type SubscriptionLike = { planType: string; planSnapshot?: unknown };

type SubscriptionEngineMode = 'LEGACY' | 'DUAL' | 'V2';

const ENT_SLUG = 'ent';
const DEFAULT_TIMEZONE = 'Asia/Almaty';

/**
 * Отказ в попытке. В теле — код (как раньше в `message`, на него завязаны клиенты)
 * и время, когда откроется следующая бесплатная попытка, чтобы клиент показал
 * «подожди до …» без отдельного запроса.
 */
export function accessDeniedError(
  reasonCode: AccessReasonCode,
  nextAllowedAt: Date | string | null = null,
): BadRequestException {
  return new BadRequestException({
    statusCode: 400,
    error: 'Bad Request',
    message: reasonCode,
    code: reasonCode,
    nextAllowedAt:
      nextAllowedAt instanceof Date ? nextAllowedAt.toISOString() : (nextAllowedAt ?? null),
  });
}

/**
 * Доступ к попыткам экзаменов.
 *
 * Источники доступа (UserExamEntitlement):
 *  - `free_daily` — бесплатные N ЕНТ в день всем пользователям (N — в админке,
 *    «Тарифы и доступ»); сбрасывается в полночь по часовому поясу пользователя;
 *  - подписки (купленные тарифы, ручные выдачи) и шаблоны админки.
 *
 * Порядок списания: сначала платные/выданные попытки, бесплатная — когда их нет.
 * Так платный тест всегда случайный и со свежими вопросами, а бесплатный — «тест
 * дня», одинаковый для всех (защита от абуза мультиаккаунтами).
 *
 * Бесплатная квота работает во всех режимах SUBSCRIPTION_ENGINE_MODE: в LEGACY
 * она списывается после проверки подписок, в DUAL/V2 участвует в общем выборе.
 */
@Injectable()
export class AccessService {
  private readonly subscriptionEngineMode: SubscriptionEngineMode;
  private readonly timezoneCooldownDays: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly monetization: MonetizationService,
  ) {
    this.subscriptionEngineMode = this.resolveSubscriptionEngineMode();
    const cooldownRaw = Number(
      this.config.get<string>('USER_TIMEZONE_COOLDOWN_DAYS', '30'),
    );
    this.timezoneCooldownDays =
      Number.isFinite(cooldownRaw) && cooldownRaw > 0 ? Math.floor(cooldownRaw) : 30;
  }

  isV2Enabled() {
    return this.v2Enabled;
  }

  private get v2Enabled(): boolean {
    return this.subscriptionEngineMode !== 'LEGACY';
  }

  private get legacySyncEnabled(): boolean {
    return this.subscriptionEngineMode === 'DUAL';
  }

  /** Заводит/обновляет бесплатную дневную квоту ЕНТ под текущую настройку админки. */
  async ensureFreeEntitlementsForUser(userId: string): Promise<void> {
    await this.monetization.getConfig();
    await this.prisma.$transaction(async (tx) => {
      const exam = await tx.examType.findUnique({
        where: { slug: ENT_SLUG },
        select: { id: true, slug: true },
      });
      if (exam) await this.ensureFreeDailyEntitlementTx(tx, userId, exam, new Date());
    });
  }

  async assertAndConsumeAttempt(
    userId: string,
    examTypeId: string,
    sessionId?: string,
  ): Promise<void> {
    try {
      await this.prisma.$transaction(async (tx) => {
        await this.assertAndConsumeAttemptTx(tx, userId, examTypeId, sessionId);
      });
    } catch (error) {
      await this.recordDeniedAttemptForError(error, userId, examTypeId);
      throw error;
    }
  }

  async assertAndConsumeAttemptTx(
    tx: Prisma.TransactionClient,
    userId: string,
    examTypeId: string,
    sessionId?: string,
  ): Promise<void> {
    await this.monetization.getConfig();
    if (!this.v2Enabled) {
      await this.consumeLegacyAttemptTx(tx, userId, examTypeId, sessionId);
      return;
    }

    const now = new Date();
    const exam = await tx.examType.findUnique({
      where: { id: examTypeId },
      select: { id: true, slug: true },
    });
    if (!exam) throw new BadRequestException('EXAM_NOT_FOUND');

    await this.reconcileEntitlementsTx(tx, userId, exam, now);

    const decision = await this.getAccessDecisionTx(tx, userId, exam.id, now);
    if (!decision.allowed || !decision.candidate) {
      throw accessDeniedError(decision.reasonCode ?? 'NO_ENTITLEMENT', decision.nextAllowedAt);
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
        chosen.nextResetAt ?? this.getNextLocalMidnightUtc(now, chosen.entitlement.timezone),
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
      throw accessDeniedError('TOTAL_LIMIT_EXHAUSTED');
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
  }

  /**
   * Предварительная проверка без списания: можно ли начать попытку и какая будет
   * списана. Нужна, чтобы (1) не собирать тест, если попыток нет, и (2) собрать
   * бесплатный тест детерминированно. Ничего не выбрасывает: при сбое разрешает
   * (`tier: null`) — окончательную проверку всё равно делает списание.
   */
  async checkAttemptAccess(userId: string, examTypeId: string): Promise<AttemptAccessCheck> {
    const fallback: AttemptAccessCheck = {
      allowed: true,
      tier: null,
      reasonCode: null,
      nextAllowedAt: null,
    };
    try {
      await this.monetization.getConfig();
      if (!this.v2Enabled) return await this.checkLegacyAttemptAccess(userId, examTypeId);
      return await this.prisma.$transaction(async (tx) => {
        const now = new Date();
        const exam = await tx.examType.findUnique({
          where: { id: examTypeId },
          select: { id: true, slug: true },
        });
        if (!exam) return fallback;
        await this.reconcileEntitlementsTx(tx, userId, exam, now);
        const decision = await this.getAccessDecisionTx(tx, userId, exam.id, now);
        if (!decision.allowed || !decision.candidate) {
          return {
            allowed: false,
            tier: null,
            reasonCode: decision.reasonCode ?? 'NO_ENTITLEMENT',
            nextAllowedAt: decision.nextAllowedAt?.toISOString() ?? null,
          };
        }
        return {
          allowed: true,
          tier: decision.candidate.entitlement.tier === EntitlementTier.free ? 'free' : 'paid',
          reasonCode: null,
          nextAllowedAt: null,
        };
      });
    } catch {
      return fallback;
    }
  }

  async getUserAccessByExam(userId: string): Promise<AccessExamStatus[]> {
    await this.monetization.getConfig();
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
        await this.reconcileEntitlementsTx(tx, user.id, exam, now);
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

    if (user.timezone === timezone) {
      return { timezone, timezoneChangedAt: user.timezoneChangedAt ?? now };
    }

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
    if (!this.v2Enabled) return;
    await this.monetization.getConfig();
    await this.prisma.$transaction(async (tx) => {
      const sub = await tx.subscription.findUnique({
        where: { id: subscriptionId },
        select: {
          id: true,
          userId: true,
          planType: true,
          planSnapshot: true,
          examTypeId: true,
          startsAt: true,
          expiresAt: true,
          isActive: true,
        },
      });
      if (!sub) return;

      const { attemptsLimit: totalLimit, dailyLimit } = this.subscriptionLimits(sub);
      const examScope =
        sub.examTypeId != null
          ? await tx.examType.findMany({
              where: { id: sub.examTypeId },
              select: { id: true },
            })
          : totalLimit != null
            ? await tx.examType.findMany({
                where: { slug: ENT_SLUG },
                select: { id: true },
              })
            : await tx.examType.findMany({
                where: { isActive: true },
                select: { id: true },
              });
      const tier = this.subscriptionEntitlementTier(sub.planType);
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
            dailyAttemptsLimit: dailyLimit,
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
            dailyAttemptsLimit: dailyLimit,
            windowStartsAt: sub.startsAt,
            windowEndsAt: sub.expiresAt,
          },
        });
      }
    });
  }

  async recordDeniedAttemptForError(
    error: unknown,
    userId: string,
    examTypeId: string,
  ): Promise<void> {
    const reasonCode = this.extractAccessReasonCode(error);
    if (reasonCode) {
      await this.recordDeniedAttempt(userId, examTypeId, reasonCode);
    }
  }

  // ─── Бесплатная дневная квота ────────────────────────────────────────────

  private freeDailySourceRef(userId: string, examTypeId: string) {
    return `free_daily:${userId}:exam:${examTypeId}`;
  }

  /**
   * Держит строку `free_daily` в соответствии с настройкой: создаёт при первом
   * обращении, обновляет лимит, отзывает при выключении бесплатного доступа.
   * Только для ЕНТ. Создание — `ON CONFLICT DO NOTHING`, параллельные запросы
   * не роняют транзакцию.
   */
  private async ensureFreeDailyEntitlementTx(
    tx: Prisma.TransactionClient,
    userId: string,
    exam: { id: string; slug: string },
    now: Date,
  ): Promise<void> {
    if (exam.slug !== ENT_SLUG) return;
    const limit = this.monetization.freeDailyEntAttempts();
    const sourceRef = this.freeDailySourceRef(userId, exam.id);
    const existing = await tx.userExamEntitlement.findUnique({
      where: {
        sourceType_sourceRef: { sourceType: EntitlementSourceType.free_daily, sourceRef },
      },
      select: { id: true, status: true, dailyAttemptsLimit: true },
    });

    if (limit <= 0) {
      if (existing?.status === EntitlementStatus.active) {
        await tx.userExamEntitlement.update({
          where: { id: existing.id },
          data: { status: EntitlementStatus.revoked, revokedAt: now },
        });
      }
      return;
    }

    if (existing) {
      if (existing.status !== EntitlementStatus.active || existing.dailyAttemptsLimit !== limit) {
        await tx.userExamEntitlement.update({
          where: { id: existing.id },
          data: {
            status: EntitlementStatus.active,
            dailyAttemptsLimit: limit,
            revokedAt: null,
            exhaustedAt: null,
          },
        });
      }
      return;
    }

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { timezone: true, createdAt: true },
    });
    if (!user) return;
    await tx.userExamEntitlement.createMany({
      data: [
        {
          userId,
          examTypeId: exam.id,
          tier: EntitlementTier.free,
          status: EntitlementStatus.active,
          sourceType: EntitlementSourceType.free_daily,
          sourceRef,
          totalAttemptsLimit: null,
          dailyAttemptsLimit: limit,
          timezone: user.timezone || DEFAULT_TIMEZONE,
          windowStartsAt: user.createdAt && user.createdAt <= now ? user.createdAt : now,
          windowEndsAt: null,
          metadata: { autoGranted: 'free_daily' },
        },
      ],
      skipDuplicates: true,
    });
  }

  /** Состояние бесплатной квоты на сегодня; null — у экзамена её нет. */
  private async getFreeDailyStatus(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    exam: { id: string; slug: string },
    fallbackTimezone: string,
    now: Date,
  ): Promise<FreeDailyStatus | null> {
    if (exam.slug !== ENT_SLUG) return null;
    const limit = this.monetization.freeDailyEntAttempts();
    if (limit <= 0) return null;
    const entitlement = await db.userExamEntitlement.findUnique({
      where: {
        sourceType_sourceRef: {
          sourceType: EntitlementSourceType.free_daily,
          sourceRef: this.freeDailySourceRef(userId, exam.id),
        },
      },
      select: { id: true, timezone: true },
    });
    const timezone = entitlement?.timezone || fallbackTimezone || DEFAULT_TIMEZONE;
    const usage = entitlement
      ? await db.userExamDailyUsage.findUnique({
          where: {
            entitlementId_localDay: {
              entitlementId: entitlement.id,
              localDay: this.getLocalDayKey(now, timezone),
            },
          },
          select: { attemptsUsed: true },
        })
      : null;
    return this.toFreeDailyStatus(limit, usage?.attemptsUsed ?? 0, timezone, now);
  }

  private toFreeDailyStatus(
    limit: number,
    usedToday: number,
    timezone: string,
    now: Date,
  ): FreeDailyStatus {
    return {
      dailyLimit: limit,
      usedToday,
      remainingToday: Math.max(0, limit - usedToday),
      nextResetAt: this.getNextLocalMidnightUtc(now, timezone).toISOString(),
    };
  }

  /** LEGACY: списывает бесплатную попытку дня. false — на сегодня попытки кончились. */
  private async consumeFreeDailyTx(
    tx: Prisma.TransactionClient,
    userId: string,
    exam: { id: string; slug: string },
    now: Date,
    sessionId?: string,
  ): Promise<boolean> {
    await this.ensureFreeDailyEntitlementTx(tx, userId, exam, now);
    if (this.monetization.freeDailyEntAttempts() <= 0) return false;
    const entitlement = await tx.userExamEntitlement.findUnique({
      where: {
        sourceType_sourceRef: {
          sourceType: EntitlementSourceType.free_daily,
          sourceRef: this.freeDailySourceRef(userId, exam.id),
        },
      },
      select: { id: true, status: true, timezone: true, dailyAttemptsLimit: true },
    });
    if (
      !entitlement ||
      entitlement.status !== EntitlementStatus.active ||
      entitlement.dailyAttemptsLimit == null
    ) {
      return false;
    }
    const localDay = this.getLocalDayKey(now, entitlement.timezone);
    const consumed = await this.tryIncrementDailyUsageTx(
      tx,
      userId,
      exam.id,
      entitlement.id,
      localDay,
      entitlement.timezone,
      entitlement.dailyAttemptsLimit,
    );
    if (!consumed) return false;

    await tx.userExamEntitlement.update({
      where: { id: entitlement.id },
      data: { usedAttemptsTotal: { increment: 1 }, lastAttemptAt: now },
    });
    await tx.attemptUsageLedger.create({
      data: {
        userId,
        examTypeId: exam.id,
        entitlementId: entitlement.id,
        sessionId: sessionId ?? null,
        action: 'attempt_consumed',
        attemptsDelta: 1,
        localDay,
      },
    });
    return true;
  }

  // ─── LEGACY-режим ────────────────────────────────────────────────────────

  private async loadLegacyEntContext(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    now: Date,
  ) {
    const user = await db.user.findUnique({
      where: { id: userId },
      select: { id: true, timezone: true },
    });
    const activeSubscriptions = await db.subscription.findMany({
      where: {
        userId,
        isActive: true,
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      select: {
        id: true,
        planType: true,
        planSnapshot: true,
        startsAt: true,
        expiresAt: true,
      },
    });
    return { user, activeSubscriptions };
  }

  private hasUnlimitedPaid(subs: SubscriptionLike[]): boolean {
    return subs.some(
      (s) =>
        this.subscriptionLimits(s).attemptsLimit == null &&
        this.subscriptionEntitlementTier(s.planType) === EntitlementTier.paid,
    );
  }

  /** Подписка с лимитом попыток, в которой ещё остались попытки (LEGACY считает по сессиям). */
  private async findLegacyLimitedSubWithAttempts(
    db: Prisma.TransactionClient | PrismaService,
    userId: string,
    examTypeId: string,
    subs: Array<SubscriptionLike & { startsAt: Date; expiresAt: Date }>,
    excludeSessionId?: string,
  ) {
    for (const sub of subs) {
      const limit = this.subscriptionLimits(sub).attemptsLimit;
      if (limit == null) continue;
      const used = await db.testSession.count({
        where: {
          userId,
          examTypeId,
          startedAt: { gte: sub.startsAt, lt: sub.expiresAt },
          ...(excludeSessionId ? { NOT: { id: excludeSessionId } } : {}),
        },
      });
      if (used < limit) return sub;
    }
    return null;
  }

  private async checkLegacyAttemptAccess(
    userId: string,
    examTypeId: string,
  ): Promise<AttemptAccessCheck> {
    const exam = await this.prisma.examType.findUnique({
      where: { id: examTypeId },
      select: { id: true, slug: true },
    });
    // Не-ЕНТ экзамены в LEGACY безлимитны → как платная (случайная) попытка.
    if (!exam || exam.slug !== ENT_SLUG) {
      return { allowed: true, tier: 'paid', reasonCode: null, nextAllowedAt: null };
    }
    const now = new Date();
    const { user, activeSubscriptions } = await this.loadLegacyEntContext(this.prisma, userId, now);
    if (!user) return { allowed: false, tier: null, reasonCode: 'NO_ENTITLEMENT', nextAllowedAt: null };

    if (this.hasUnlimitedPaid(activeSubscriptions)) {
      return { allowed: true, tier: 'paid', reasonCode: null, nextAllowedAt: null };
    }
    const limitedSub = await this.findLegacyLimitedSubWithAttempts(
      this.prisma,
      userId,
      examTypeId,
      activeSubscriptions,
    );
    if (limitedSub) {
      const tier = this.subscriptionEntitlementTier(limitedSub.planType);
      return {
        allowed: true,
        tier: tier === EntitlementTier.paid ? 'paid' : 'free',
        reasonCode: null,
        nextAllowedAt: null,
      };
    }
    const free = await this.getFreeDailyStatus(this.prisma, userId, exam, user.timezone, now);
    if (free && free.remainingToday > 0) {
      return { allowed: true, tier: 'free', reasonCode: null, nextAllowedAt: null };
    }
    return free
      ? { allowed: false, tier: null, reasonCode: 'DAILY_LIMIT_REACHED', nextAllowedAt: free.nextResetAt }
      : { allowed: false, tier: null, reasonCode: 'NO_ENTITLEMENT', nextAllowedAt: null };
  }

  private async getLegacyAccessByExam(
    userId: string,
    now: Date,
  ): Promise<AccessExamStatus[]> {
    const exams = await this.prisma.examType.findMany({
      where: { isActive: true },
      select: { id: true, slug: true },
    });
    const { user, activeSubscriptions } = await this.loadLegacyEntContext(this.prisma, userId, now);
    if (!user) return [];

    const result: AccessExamStatus[] = [];
    for (const exam of exams) {
      if (exam.slug !== ENT_SLUG) {
        result.push({
          examTypeId: exam.id,
          examSlug: exam.slug,
          hasAccess: true,
          reasonCode: null,
          nextAllowedAt: null,
          hasPaidTier: true,
          total: { used: 0, limit: null, remaining: null, isUnlimited: true },
          daily: { used: 0, limit: null, remaining: null, isUnlimited: true, nextResetAt: null },
          free: null,
        });
        continue;
      }
      const unlimitedPaid = this.hasUnlimitedPaid(activeSubscriptions);
      const hasPaidSubscription = activeSubscriptions.some(
        (s) => this.subscriptionEntitlementTier(s.planType) === EntitlementTier.paid,
      );
      const limitedPaidSubs = activeSubscriptions.filter(
        (s) =>
          this.subscriptionLimits(s).attemptsLimit != null &&
          this.subscriptionEntitlementTier(s.planType) === EntitlementTier.paid,
      );
      let paidRemaining = 0;
      let paidLimit = 0;
      for (const sub of limitedPaidSubs) {
        const limit = this.subscriptionLimits(sub).attemptsLimit ?? 0;
        const taken = await this.prisma.testSession.count({
          where: {
            userId,
            examTypeId: exam.id,
            startedAt: { gte: sub.startsAt, lt: sub.expiresAt },
          },
        });
        paidLimit += limit;
        paidRemaining += Math.max(0, limit - Math.min(limit, taken));
      }
      const free = await this.getFreeDailyStatus(this.prisma, userId, exam, user.timezone, now);
      const paidAvailable = unlimitedPaid || paidRemaining > 0;
      const hasAccess = paidAvailable || (free?.remainingToday ?? 0) > 0;
      const reasonCode: AccessReasonCode | null = hasAccess
        ? null
        : free
          ? 'DAILY_LIMIT_REACHED'
          : limitedPaidSubs.length > 0
            ? 'TOTAL_LIMIT_EXHAUSTED'
            : 'NO_ENTITLEMENT';
      const nextResetAt = reasonCode === 'DAILY_LIMIT_REACHED' ? free!.nextResetAt : null;
      result.push({
        examTypeId: exam.id,
        examSlug: exam.slug,
        hasAccess,
        reasonCode,
        nextAllowedAt: nextResetAt,
        hasPaidTier: hasPaidSubscription,
        total: {
          used: unlimitedPaid ? 0 : paidLimit - paidRemaining,
          limit: unlimitedPaid ? null : paidLimit,
          remaining: unlimitedPaid ? null : paidRemaining,
          isUnlimited: unlimitedPaid,
        },
        daily:
          paidAvailable || !free
            ? { used: 0, limit: null, remaining: null, isUnlimited: true, nextResetAt: null }
            : {
                used: free.usedToday,
                limit: free.dailyLimit,
                remaining: free.remainingToday,
                isUnlimited: false,
                nextResetAt,
              },
        free,
      });
    }
    return result;
  }

  private async consumeLegacyAttemptTx(
    tx: Prisma.TransactionClient,
    userId: string,
    examTypeId: string,
    sessionId?: string,
  ) {
    const exam = await tx.examType.findUnique({
      where: { id: examTypeId },
      select: { id: true, slug: true },
    });
    if (!exam) throw new BadRequestException('EXAM_NOT_FOUND');
    if (exam.slug !== ENT_SLUG) return;

    const now = new Date();
    const { user, activeSubscriptions } = await this.loadLegacyEntContext(tx, userId, now);
    if (!user) throw new BadRequestException('USER_NOT_FOUND');

    // Платные попытки — первыми (LEGACY считает их по сессиям в окне подписки).
    if (this.hasUnlimitedPaid(activeSubscriptions)) return;
    const limitedSub = await this.findLegacyLimitedSubWithAttempts(
      tx,
      userId,
      examTypeId,
      activeSubscriptions,
      sessionId,
    );
    if (limitedSub) return;

    if (await this.consumeFreeDailyTx(tx, userId, exam, now, sessionId)) return;

    const free = await this.getFreeDailyStatus(tx, userId, exam, user.timezone, now);
    if (free) throw accessDeniedError('DAILY_LIMIT_REACHED', free.nextResetAt);
    throw accessDeniedError('NO_ENTITLEMENT');
  }

  // ─── Общие помощники ─────────────────────────────────────────────────────

  private parseBool(value: string | undefined, fallback: boolean): boolean {
    if (value == null) return fallback;
    const normalized = value.trim().toLowerCase();
    if (['1', 'true', 'yes', 'on'].includes(normalized)) return true;
    if (['0', 'false', 'no', 'off'].includes(normalized)) return false;
    return fallback;
  }

  private resolveSubscriptionEngineMode(): SubscriptionEngineMode {
    const explicitMode = this.config.get<string>('SUBSCRIPTION_ENGINE_MODE')?.trim().toUpperCase();
    if (explicitMode) {
      if (explicitMode === 'LEGACY' || explicitMode === 'DUAL' || explicitMode === 'V2') {
        return explicitMode;
      }
      throw new Error(
        `Invalid SUBSCRIPTION_ENGINE_MODE="${explicitMode}". Use LEGACY, DUAL, or V2.`,
      );
    }

    const v2 = this.parseBool(this.config.get<string>('SUBSCRIPTION_ENGINE_V2'), false);
    if (!v2) return 'LEGACY';

    const dualRead = this.parseBool(
      this.config.get<string>('SUBSCRIPTION_ENGINE_V2_DUAL_READ'),
      true,
    );
    const dualWrite = this.parseBool(
      this.config.get<string>('SUBSCRIPTION_ENGINE_V2_DUAL_WRITE'),
      true,
    );
    return dualRead || dualWrite ? 'DUAL' : 'V2';
  }

  private extractAccessReasonCode(error: unknown): AccessReasonCode | null {
    if (!(error instanceof BadRequestException)) return null;
    const response = error.getResponse();
    const message =
      typeof response === 'string'
        ? response
        : response &&
            typeof response === 'object' &&
            'message' in response &&
            typeof (response as { message?: unknown }).message === 'string'
          ? (response as { message: string }).message
          : error.message;
    if (
      message === 'DAILY_LIMIT_REACHED' ||
      message === 'TOTAL_LIMIT_EXHAUSTED' ||
      message === 'NO_ENTITLEMENT'
    ) {
      return message;
    }
    if (message === 'TRIAL_LIMIT_EXCEEDED') return 'TOTAL_LIMIT_EXHAUSTED';
    return null;
  }

  private async recordDeniedAttempt(
    userId: string,
    examTypeId: string,
    reasonCode: AccessReasonCode,
  ): Promise<void> {
    try {
      await this.prisma.attemptUsageLedger.create({
        data: {
          userId,
          examTypeId,
          action:
            reasonCode === 'DAILY_LIMIT_REACHED'
              ? 'daily_blocked'
              : reasonCode === 'TOTAL_LIMIT_EXHAUSTED'
                ? 'total_blocked'
                : 'denied_no_entitlement',
          reasonCode,
        },
      });
    } catch {
      // Denial logging must not turn a correct access denial into a 500.
    }
  }

  private subscriptionEntitlementTier(planType: string): EntitlementTier {
    return planType === 'free' ? EntitlementTier.free : EntitlementTier.paid;
  }

  /**
   * Лимиты подписки: из снапшота покупки или текущего каталога. Неизвестный код
   * (старые ручные выдачи) — без лимитов, как и раньше.
   */
  private subscriptionLimits(sub: SubscriptionLike): {
    attemptsLimit: number | null;
    dailyLimit: number | null;
  } {
    const terms = this.monetization.planTerms(sub);
    return {
      attemptsLimit: terms?.attemptsLimit ?? null,
      dailyLimit: terms?.dailyLimit ?? null,
    };
  }

  /** Подготовка строк доступа перед решением: бесплатная квота, legacy-синхронизация, истёкшие окна. */
  private async reconcileEntitlementsTx(
    tx: Prisma.TransactionClient,
    userId: string,
    exam: { id: string; slug: string },
    now: Date,
  ) {
    await this.ensureFreeDailyEntitlementTx(tx, userId, exam, now);
    await this.maybeSyncLegacyEntitlements(tx, userId, exam, now);
    await this.expireEndedEntitlements(tx, userId, exam.id, now);
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
    if (!this.legacySyncEnabled || exam.slug !== ENT_SLUG) return;

    const user = await tx.user.findUnique({
      where: { id: userId },
      select: { id: true, timezone: true },
    });
    if (!user) return;

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
        planSnapshot: true,
        startsAt: true,
        expiresAt: true,
      },
    });

    for (const sub of activeSubscriptions) {
      const isTrial = sub.planType === 'starter';
      const sourceType = isTrial
        ? EntitlementSourceType.legacy_trial_subscription
        : EntitlementSourceType.legacy_paid_subscription;
      const sourceRef = `subscription:${sub.id}:exam:${exam.id}`;
      const canonical = await tx.userExamEntitlement.findUnique({
        where: {
          sourceType_sourceRef: {
            sourceType: EntitlementSourceType.subscription,
            sourceRef,
          },
        },
        select: { id: true },
      });
      if (canonical) {
        await tx.userExamEntitlement.updateMany({
          where: {
            sourceType,
            sourceRef,
            status: { in: [EntitlementStatus.active, EntitlementStatus.exhausted] },
          },
          data: {
            status: EntitlementStatus.revoked,
            revokedAt: now,
            metadata: {
              supersededBySourceType: EntitlementSourceType.subscription,
              supersededByEntitlementId: canonical.id,
            },
          },
        });
        continue;
      }
      const tier = this.subscriptionEntitlementTier(sub.planType);
      const { attemptsLimit: totalLimit, dailyLimit } = this.subscriptionLimits(sub);
      const countedUsed = totalLimit != null
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
            sourceRef,
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
            sourceRef,
          },
        },
        update: {
          userId,
          examTypeId: exam.id,
          subscriptionId: sub.id,
          tier,
          status,
          totalAttemptsLimit: totalLimit,
          dailyAttemptsLimit: dailyLimit,
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
          sourceRef,
          totalAttemptsLimit: totalLimit,
          dailyAttemptsLimit: dailyLimit,
          usedAttemptsTotal: used,
          windowStartsAt: sub.startsAt,
          windowEndsAt: sub.expiresAt,
          timezone: user.timezone || DEFAULT_TIMEZONE,
          exhaustedAt: status === EntitlementStatus.exhausted ? now : null,
        },
      });
    }
  }

  /** Дневной лимит строки доступа: свой, а для подписок без него — из условий тарифа. */
  private entitlementDailyLimit(ent: {
    dailyAttemptsLimit: number | null;
    subscription: SubscriptionLike | null;
  }): number | null {
    return (
      ent.dailyAttemptsLimit ??
      (ent.subscription ? this.subscriptionLimits(ent.subscription).dailyLimit : null)
    );
  }

  private async loadDailyUsage(
    tx: Prisma.TransactionClient,
    lookups: Array<{ entitlementId: string; localDay: string }>,
  ): Promise<Map<string, number>> {
    const usage = new Map<string, number>();
    if (lookups.length === 0) return usage;
    const rows = await tx.userExamDailyUsage.findMany({
      where: {
        entitlementId: { in: [...new Set(lookups.map((item) => item.entitlementId))] },
        localDay: { in: [...new Set(lookups.map((item) => item.localDay))] },
      },
      select: { entitlementId: true, localDay: true, attemptsUsed: true },
    });
    for (const row of rows) {
      usage.set(`${row.entitlementId}:${row.localDay}`, row.attemptsUsed);
    }
    return usage;
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
        sourceType: true,
        totalAttemptsLimit: true,
        usedAttemptsTotal: true,
        dailyAttemptsLimit: true,
        timezone: true,
        subscription: { select: { planType: true, planSnapshot: true } },
      },
    });

    const dailyUsageByEntitlementDay = await this.loadDailyUsage(
      tx,
      entitlements
        .filter((ent) => this.entitlementDailyLimit(ent) != null)
        .map((ent) => ({ entitlementId: ent.id, localDay: this.getLocalDayKey(now, ent.timezone) })),
    );

    let usedTotal = 0;
    let totalLimit = 0;
    let totalUnlimited = false;
    let usedDaily = 0;
    let dailyLimit = 0;
    let dailyUnlimited = false;
    let hasPaidTier = false;
    let anyAllowed = false;
    let nearestReset: Date | null = null;
    let anyTotalExhausted = false;
    let anyDailyBlocked = false;
    let free: FreeDailyStatus | null = null;

    for (const ent of entitlements) {
      if (ent.tier === EntitlementTier.paid) hasPaidTier = true;
      const isFreeDaily = ent.sourceType === EntitlementSourceType.free_daily;
      const remTotal =
        ent.totalAttemptsLimit == null
          ? null
          : Math.max(0, ent.totalAttemptsLimit - ent.usedAttemptsTotal);
      if (remTotal === 0) anyTotalExhausted = true;
      // Бесплатная квота отображается отдельно (`free`), в «всего попыток» её не смешиваем.
      if (!isFreeDaily) {
        if (ent.totalAttemptsLimit == null) {
          totalUnlimited = true;
        } else {
          totalLimit += ent.totalAttemptsLimit;
          usedTotal += ent.usedAttemptsTotal;
        }
      }

      const entDailyLimit = this.entitlementDailyLimit(ent);
      if (entDailyLimit == null) {
        dailyUnlimited = true;
        if (remTotal == null || remTotal > 0) anyAllowed = true;
        continue;
      }

      const localDay = this.getLocalDayKey(now, ent.timezone);
      const dailyUsed = dailyUsageByEntitlementDay.get(`${ent.id}:${localDay}`) ?? 0;
      const remDaily = Math.max(0, entDailyLimit - dailyUsed);
      usedDaily += dailyUsed;
      dailyLimit += entDailyLimit;
      if (isFreeDaily) free = this.toFreeDailyStatus(entDailyLimit, dailyUsed, ent.timezone, now);
      if (remDaily === 0) {
        anyDailyBlocked = true;
        const next = this.getNextLocalMidnightUtc(now, ent.timezone);
        if (!nearestReset || next < nearestReset) nearestReset = next;
      }
      if ((remTotal == null || remTotal > 0) && remDaily > 0) {
        anyAllowed = true;
      }
    }

    const reasonCode: AccessReasonCode | null = anyAllowed
      ? null
      : anyDailyBlocked
        ? 'DAILY_LIMIT_REACHED'
        : anyTotalExhausted
          ? 'TOTAL_LIMIT_EXHAUSTED'
          : 'NO_ENTITLEMENT';
    const resetIso =
      reasonCode === 'DAILY_LIMIT_REACHED' && nearestReset ? nearestReset.toISOString() : null;

    return {
      examTypeId,
      examSlug,
      hasAccess: anyAllowed,
      reasonCode,
      nextAllowedAt: resetIso,
      hasPaidTier,
      total: {
        used: usedTotal,
        limit: totalUnlimited ? null : totalLimit,
        remaining: totalUnlimited ? null : Math.max(0, totalLimit - usedTotal),
        isUnlimited: totalUnlimited,
      },
      daily: {
        used: usedDaily,
        limit: dailyUnlimited ? null : dailyLimit,
        remaining: dailyUnlimited ? null : Math.max(0, dailyLimit - usedDaily),
        isUnlimited: dailyUnlimited,
        nextResetAt: resetIso,
      },
      free,
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
        subscription: { select: { planType: true, planSnapshot: true } },
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

    // Порядок списания: платные/выданные → бесплатные; внутри — сначала с лимитом
    // попыток, затем с ближайшим окончанием окна.
    const sorted = [...entitlements].sort((a, b) => {
      const aFree = a.tier === EntitlementTier.free ? 1 : 0;
      const bFree = b.tier === EntitlementTier.free ? 1 : 0;
      if (aFree !== bFree) return aFree - bFree;
      const aUnlimited = a.totalAttemptsLimit == null ? 1 : 0;
      const bUnlimited = b.totalAttemptsLimit == null ? 1 : 0;
      if (aUnlimited !== bUnlimited) return aUnlimited - bUnlimited;
      const aEnds = a.windowEndsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      const bEnds = b.windowEndsAt?.getTime() ?? Number.MAX_SAFE_INTEGER;
      return aEnds - bEnds;
    });

    const dailyUsageByEntitlementDay = await this.loadDailyUsage(
      tx,
      sorted
        .filter((ent) => this.entitlementDailyLimit(ent) != null)
        .map((ent) => ({ entitlementId: ent.id, localDay: this.getLocalDayKey(now, ent.timezone) })),
    );

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
      const dailyAttemptsLimit = this.entitlementDailyLimit(ent);
      if (dailyAttemptsLimit != null) {
        const used = dailyUsageByEntitlementDay.get(`${ent.id}:${localDay}`) ?? 0;
        remToday = Math.max(0, dailyAttemptsLimit - used);
        nextResetAt = this.getNextLocalMidnightUtc(now, ent.timezone);
        if (remToday <= 0) {
          hasDailyBlocked = true;
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
            dailyAttemptsLimit,
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

  /**
   * Атомарно занимает одну попытку дня. Строку дня создаём `ON CONFLICT DO NOTHING`
   * (без ошибки уникальности, которая оборвала бы транзакцию Postgres), затем
   * условный UPDATE: при гонке второй запрос не пройдёт `attemptsUsed < limit`.
   */
  private async tryIncrementDailyUsageTx(
    tx: Prisma.TransactionClient,
    userId: string,
    examTypeId: string,
    entitlementId: string,
    localDay: string,
    timezone: string,
    limit: number,
  ): Promise<boolean> {
    await tx.userExamDailyUsage.createMany({
      data: [{ userId, examTypeId, entitlementId, localDay, timezone, attemptsUsed: 0 }],
      skipDuplicates: true,
    });
    const updated = await tx.userExamDailyUsage.updateMany({
      where: { entitlementId, localDay, attemptsUsed: { lt: limit } },
      data: { attemptsUsed: { increment: 1 } },
    });
    return updated.count > 0;
  }

  private async incrementDailyUsageTx(
    tx: Prisma.TransactionClient,
    userId: string,
    examTypeId: string,
    entitlementId: string,
    localDay: string,
    timezone: string,
    limit: number,
    nextResetAt: Date,
  ) {
    const ok = await this.tryIncrementDailyUsageTx(
      tx,
      userId,
      examTypeId,
      entitlementId,
      localDay,
      timezone,
      limit,
    );
    if (!ok) throw accessDeniedError('DAILY_LIMIT_REACHED', nextResetAt);
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
