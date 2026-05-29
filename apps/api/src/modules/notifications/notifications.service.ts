import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntitlementStatus, EntitlementTier, Prisma } from '@prisma/client';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import {
  NOTIFICATION_CAMPAIGNS,
  type NotificationCampaignKey,
  getNotificationCampaignDefinition,
} from './notification-campaigns';

const FINISHED_SESSION_STATUSES = ['completed', 'timed_out'] as const;
const GLOBAL_USER_COOLDOWN_HOURS = 24;

type CandidateUser = {
  id: string;
  telegramId: bigint | null;
  preferredLanguage: string;
  timezone: string | null;
};

type NotificationCandidate = {
  campaignKey: NotificationCampaignKey;
  user: CandidateUser;
  dedupeKey: string;
  sessionId?: string | null;
  subscriptionId?: string | null;
  metadata?: Prisma.InputJsonObject;
};

type DeliveryOutcome = 'sent' | 'skipped' | 'failed';

type RunSource = 'scheduler' | 'manual';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private telegramBot: TelegramBotService,
  ) {}

  async ensureDefaultCampaigns() {
    await Promise.all(
      NOTIFICATION_CAMPAIGNS.map((campaign) =>
        this.prisma.notificationCampaign.upsert({
          where: { key: campaign.key },
          create: {
            key: campaign.key,
            title: campaign.title,
            cooldownHours: campaign.cooldownHours,
            metadata: {
              ru: campaign.message.ru,
              kk: campaign.message.kk,
              channelButtons: campaign.channelButtons === true,
            },
          },
          update: {
            title: campaign.title,
            metadata: {
              ru: campaign.message.ru,
              kk: campaign.message.kk,
              channelButtons: campaign.channelButtons === true,
            },
          },
        }),
      ),
    );
  }

  async runAutomation(
    source: RunSource,
    options: { campaignKey?: NotificationCampaignKey } = {},
  ) {
    await this.ensureDefaultCampaigns();
    const batchSize = this.getBatchSize();
    const run = await this.prisma.notificationRun.create({
      data: {
        source,
        status: 'running',
        metadata: options.campaignKey ? { campaignKey: options.campaignKey } : undefined,
      },
    });

    let scanned = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const messagedUserIds = new Set<string>();

    try {
      const now = new Date();
      const campaignRows = await this.prisma.notificationCampaign.findMany({
        where: {
          isActive: true,
          ...(options.campaignKey ? { key: options.campaignKey } : {}),
        },
        orderBy: { createdAt: 'asc' },
      });

      for (const campaign of campaignRows) {
        if (sent + failed >= batchSize) break;
        const definition = getNotificationCampaignDefinition(campaign.key);
        if (!definition) continue;

        const remaining = Math.max(0, batchSize - sent - failed);
        const candidates = await this.getCandidates(
          definition.key,
          now,
          Math.max(remaining * 3, remaining),
          campaign.cooldownHours,
        );
        scanned += candidates.length;

        for (const candidate of candidates) {
          if (sent + failed >= batchSize) break;
          if (messagedUserIds.has(candidate.user.id)) {
            skipped += 1;
            continue;
          }
          const outcome = await this.processCandidate(candidate, now, {
            skipRecentCheck: true,
          });
          if (outcome === 'sent') sent += 1;
          else if (outcome === 'failed') failed += 1;
          else skipped += 1;
          if (outcome === 'sent') messagedUserIds.add(candidate.user.id);
        }
      }

      await this.prisma.notificationRun.update({
        where: { id: run.id },
        data: {
          status: 'completed',
          scanned,
          sent,
          skipped,
          failed,
          finishedAt: new Date(),
        },
      });
      return { runId: run.id, scanned, sent, skipped, failed };
    } catch (error) {
      const message = this.errorMessage(error);
      await this.prisma.notificationRun.update({
        where: { id: run.id },
        data: {
          status: 'failed',
          scanned,
          sent,
          skipped,
          failed,
          finishedAt: new Date(),
          errorMessage: message,
        },
      });
      this.logger.error(`Notification run failed: ${message}`);
      throw error;
    }
  }

  async getOverview() {
    await this.ensureDefaultCampaigns();
    const campaigns = await this.prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'asc' },
    });
    const now = new Date();

    const campaignRows = await Promise.all(
      campaigns.map(async (campaign) => {
        const [sent, failed, lastDelivery, audience] = await Promise.all([
          this.prisma.notificationDelivery.count({
            where: { campaignKey: campaign.key, status: 'sent' },
          }),
          this.prisma.notificationDelivery.count({
            where: { campaignKey: campaign.key, status: 'failed' },
          }),
          this.prisma.notificationDelivery.findFirst({
            where: { campaignKey: campaign.key },
            orderBy: { attemptedAt: 'desc' },
          }),
          this.countAudience(campaign.key, now, campaign.cooldownHours),
        ]);

        return {
          id: campaign.id,
          key: campaign.key,
          title: campaign.title,
          isActive: campaign.isActive,
          cooldownHours: campaign.cooldownHours,
          audience,
          sent,
          failed,
          lastAttemptedAt: lastDelivery?.attemptedAt ?? null,
          updatedAt: campaign.updatedAt,
        };
      }),
    );

    const runs = await this.prisma.notificationRun.findMany({
      orderBy: { startedAt: 'desc' },
      take: 10,
    });

    return {
      campaigns: campaignRows,
      runs,
      settings: {
        enabled: this.isEnabled(),
        pollIntervalMinutes: this.getPollIntervalMinutes(),
        batchSize: this.getBatchSize(),
        quietHours: this.getQuietHoursLabel(),
        globalCooldownHours: GLOBAL_USER_COOLDOWN_HOURS,
      },
    };
  }

  async getLogs(params: {
    page?: number;
    limit?: number;
    campaignKey?: string;
    status?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const where: Prisma.NotificationDeliveryWhereInput = {
      ...(params.campaignKey ? { campaignKey: params.campaignKey } : {}),
      ...(params.status ? { status: params.status } : {}),
    };

    const [items, total] = await Promise.all([
      this.prisma.notificationDelivery.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              telegramId: true,
              telegramUsername: true,
              phone: true,
              firstName: true,
              lastName: true,
              preferredLanguage: true,
            },
          },
        },
        orderBy: { attemptedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.notificationDelivery.count({ where }),
    ]);

    return {
      items: items.map((item) => ({
        ...item,
        targetTelegramId: Number(item.targetTelegramId),
        user: {
          ...item.user,
          telegramId: item.user.telegramId ? Number(item.user.telegramId) : null,
        },
      })),
      total,
      page,
      limit,
    };
  }

  async updateCampaign(
    key: string,
    data: { isActive?: boolean; cooldownHours?: number },
  ) {
    const existing = await this.prisma.notificationCampaign.findUnique({
      where: { key },
    });
    if (!existing) throw new NotFoundException('Campaign not found');

    return this.prisma.notificationCampaign.update({
      where: { key },
      data: {
        ...(typeof data.isActive === 'boolean'
          ? { isActive: data.isActive }
          : {}),
        ...(typeof data.cooldownHours === 'number'
          ? { cooldownHours: Math.max(1, Math.floor(data.cooldownHours)) }
          : {}),
      },
    });
  }

  isEnabled() {
    const raw = this.config.get<string | boolean>('NOTIFICATIONS_ENABLED');
    if (raw === undefined || raw === null || raw === '') return true;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no', 'off'].includes(raw.trim().toLowerCase());
  }

  getPollIntervalMinutes() {
    const raw = Number(this.config.get<string>('NOTIFICATIONS_POLL_INTERVAL_MINUTES'));
    return Number.isFinite(raw) && raw > 0 ? raw : 15;
  }

  private async processCandidate(
    candidate: NotificationCandidate,
    now: Date,
    options: { skipRecentCheck?: boolean } = {},
  ): Promise<DeliveryOutcome> {
    if (!candidate.user.telegramId) return 'skipped';
    if (!options.skipRecentCheck && await this.wasUserMessagedRecently(candidate.user.id, now)) {
      return 'skipped';
    }
    if (this.isQuietHour(candidate.user.timezone, now)) return 'skipped';

    const definition = getNotificationCampaignDefinition(candidate.campaignKey);
    if (!definition) return 'skipped';

    let deliveryId: string;
    try {
      const created = await this.prisma.notificationDelivery.create({
        data: {
          campaignKey: candidate.campaignKey,
          userId: candidate.user.id,
          sessionId: candidate.sessionId ?? null,
          subscriptionId: candidate.subscriptionId ?? null,
          dedupeKey: candidate.dedupeKey,
          status: 'pending',
          targetTelegramId: candidate.user.telegramId,
          metadata: candidate.metadata,
        },
      });
      deliveryId = created.id;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        return 'skipped';
      }
      throw error;
    }

    try {
      const language = candidate.user.preferredLanguage === 'kk' ? 'kk' : 'ru';
      await this.telegramBot.sendLifecycleNotification(
        candidate.user.telegramId,
        definition.message[language],
        {
          language,
          channelButtons: definition.channelButtons === true,
        },
      );
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: { status: 'sent', sentAt: new Date() },
      });
      return 'sent';
    } catch (error) {
      await this.prisma.notificationDelivery.update({
        where: { id: deliveryId },
        data: {
          status: 'failed',
          errorCode: this.errorCode(error),
          errorMessage: this.errorMessage(error).slice(0, 2000),
        },
      });
      return 'failed';
    }
  }

  private async wasUserMessagedRecently(userId: string, now: Date) {
    const since = this.addHours(now, -GLOBAL_USER_COOLDOWN_HOURS);
    const existing = await this.prisma.notificationDelivery.findFirst({
      where: {
        userId,
        status: 'sent',
        sentAt: { gte: since },
      },
      select: { id: true },
    });
    return !!existing;
  }

  private async countAudience(key: string, now: Date, cooldownHours: number) {
    const definition = getNotificationCampaignDefinition(key);
    if (!definition) return 0;
    const candidates = await this.getCandidates(
      definition.key,
      now,
      5000,
      cooldownHours,
    );
    return candidates.length;
  }

  private async getCandidates(
    key: NotificationCampaignKey,
    now: Date,
    limit: number,
    cooldownHours?: number,
  ): Promise<NotificationCandidate[]> {
    let candidates: NotificationCandidate[];
    switch (key) {
      case 'abandoned_test':
        candidates = await this.getAbandonedTestCandidates(now, limit);
        break;
      case 'channel_gate_day1':
        candidates = await this.getChannelGateCandidates(key, now, 24, limit);
        break;
      case 'channel_gate_day3':
        candidates = await this.getChannelGateCandidates(
          key,
          now,
          72,
          limit,
          'channel_gate_day1',
        );
        break;
      case 'no_trial_day1':
        candidates = await this.getNoTrialCandidates(key, now, 24, limit);
        break;
      case 'no_trial_day3':
        candidates = await this.getNoTrialCandidates(
          key,
          now,
          72,
          limit,
          'no_trial_day1',
        );
        break;
      case 'post_trial_no_payment':
        candidates = await this.getPostTrialNoPaymentCandidates(
          'post_trial_no_payment',
          now,
          limit,
          15,
          24,
        );
        break;
      case 'post_trial_day1_no_payment':
        candidates = await this.getPostTrialNoPaymentCandidates(
          'post_trial_day1_no_payment',
          now,
          limit,
          24 * 60,
          72,
        );
        break;
      case 'post_trial_day3_no_payment':
        candidates = await this.getPostTrialNoPaymentCandidates(
          'post_trial_day3_no_payment',
          now,
          limit,
          72 * 60,
          168,
        );
        break;
      case 'paid_weekly_inactive':
        candidates = await this.getPaidWeeklyInactiveCandidates(
          now,
          limit,
          cooldownHours ?? 168,
        );
        break;
      case 'paid_expiring_soon':
        candidates = await this.getPaidExpiringSoonCandidates(now, limit);
        break;
      default:
        candidates = [];
    }

    return this.filterRecentlyMessaged(
      await this.filterExistingDedupe(candidates),
      now,
    );
  }

  private async filterRecentlyMessaged(
    candidates: NotificationCandidate[],
    now: Date,
  ): Promise<NotificationCandidate[]> {
    if (candidates.length === 0) return candidates;
    const userIds = [...new Set(candidates.map((candidate) => candidate.user.id))];
    const since = this.addHours(now, -GLOBAL_USER_COOLDOWN_HOURS);
    const recentRows = await this.prisma.notificationDelivery.findMany({
      where: {
        userId: { in: userIds },
        status: 'sent',
        sentAt: { gte: since },
      },
      select: { userId: true },
    });
    const recentUserIds = new Set(recentRows.map((row) => row.userId));
    return candidates.filter((candidate) => !recentUserIds.has(candidate.user.id));
  }

  private async getAbandonedTestCandidates(
    now: Date,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const sessions = await this.prisma.testSession.findMany({
      where: {
        status: 'in_progress',
        startedAt: { lte: this.addMinutes(now, -30) },
        user: { telegramId: { not: null } },
        notificationDeliveries: {
          none: { campaignKey: 'abandoned_test' },
        },
      },
      select: {
        id: true,
        startedAt: true,
        metadata: true,
        template: { select: { durationMins: true } },
        user: {
          select: {
            id: true,
            telegramId: true,
            preferredLanguage: true,
            timezone: true,
          },
        },
      },
      orderBy: { startedAt: 'asc' },
      take: Math.max(limit * 4, limit),
    });

    return sessions
      .filter((session) => {
        const durationMins =
          session.template?.durationMins ??
          this.getMetadataNumber(session.metadata, 'entSessionDurationMins') ??
          240;
        return session.startedAt.getTime() + (durationMins + 30) * 60_000 <= now.getTime();
      })
      .slice(0, limit)
      .map((session) => ({
        campaignKey: 'abandoned_test',
        user: session.user,
        sessionId: session.id,
        dedupeKey: `abandoned_test:${session.id}`,
        metadata: {
          startedAt: session.startedAt.toISOString(),
          durationMins:
            session.template?.durationMins ??
            this.getMetadataNumber(session.metadata, 'entSessionDurationMins') ??
            240,
        },
      }));
  }

  private async getChannelGateCandidates(
    campaignKey: NotificationCampaignKey,
    now: Date,
    ageHours: number,
    limit: number,
    priorCampaignKey?: NotificationCampaignKey,
  ): Promise<NotificationCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        telegramId: { not: null },
        phone: { not: null },
        isChannelMember: false,
        createdAt: { lte: this.addHours(now, -ageHours) },
        testSessions: {
          none: { status: { in: [...FINISHED_SESSION_STATUSES] } },
        },
        entitlements: {
          none: {
            tier: { in: [EntitlementTier.paid, EntitlementTier.admin] },
            status: EntitlementStatus.active,
            windowStartsAt: { lte: now },
            OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
          },
        },
        subscriptions: {
          none: {
            isActive: true,
            startsAt: { lte: now },
            expiresAt: { gt: now },
            planType: { not: 'free' },
          },
        },
        AND: [
          { notificationDeliveries: { none: { campaignKey } } },
          ...(priorCampaignKey
            ? [
                {
                  notificationDeliveries: {
                    some: { campaignKey: priorCampaignKey, status: 'sent' },
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        telegramId: true,
        preferredLanguage: true,
        timezone: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return users.map((user) => ({
      campaignKey,
      user,
      dedupeKey: `${campaignKey}:${user.id}`,
    }));
  }

  private async getNoTrialCandidates(
    campaignKey: NotificationCampaignKey,
    now: Date,
    ageHours: number,
    limit: number,
    priorCampaignKey?: NotificationCampaignKey,
  ): Promise<NotificationCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        telegramId: { not: null },
        phone: { not: null },
        isChannelMember: true,
        createdAt: { lte: this.addHours(now, -ageHours) },
        testSessions: {
          none: { status: { in: [...FINISHED_SESSION_STATUSES] } },
        },
        AND: [
          { notificationDeliveries: { none: { campaignKey } } },
          ...(priorCampaignKey
            ? [
                {
                  notificationDeliveries: {
                    some: { campaignKey: priorCampaignKey, status: 'sent' },
                  },
                },
              ]
            : []),
        ],
      },
      select: {
        id: true,
        telegramId: true,
        preferredLanguage: true,
        timezone: true,
      },
      orderBy: { createdAt: 'asc' },
      take: limit,
    });

    return users.map((user) => ({
      campaignKey,
      user,
      dedupeKey: `${campaignKey}:${user.id}`,
    }));
  }

  private async getPostTrialNoPaymentCandidates(
    campaignKey: Extract<
      NotificationCampaignKey,
      | 'post_trial_no_payment'
      | 'post_trial_day1_no_payment'
      | 'post_trial_day3_no_payment'
    >,
    now: Date,
    limit: number,
    minAgeMinutes: number,
    maxAgeHours: number,
  ): Promise<NotificationCandidate[]> {
    const sessions = await this.prisma.testSession.findMany({
      where: {
        status: { in: [...FINISHED_SESSION_STATUSES] },
        finishedAt: {
          lte: this.addMinutes(now, -minAgeMinutes),
          gte: this.addHours(now, -maxAgeHours),
        },
        examType: { slug: 'ent' },
        notificationDeliveries: {
          none: { campaignKey },
        },
        user: {
          telegramId: { not: null },
          phone: { not: null },
          isChannelMember: true,
          entitlements: {
            none: {
              tier: { in: [EntitlementTier.paid, EntitlementTier.admin] },
              status: EntitlementStatus.active,
              windowStartsAt: { lte: now },
              OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
            },
          },
          subscriptions: {
            none: {
              isActive: true,
              startsAt: { lte: now },
              expiresAt: { gt: now },
              planType: { not: 'free' },
            },
          },
        },
      },
      select: {
        id: true,
        finishedAt: true,
        rawScore: true,
        maxScore: true,
        score: true,
        user: {
          select: {
            id: true,
            telegramId: true,
            preferredLanguage: true,
            timezone: true,
          },
        },
      },
      orderBy: { finishedAt: 'asc' },
      take: limit,
    });

    return sessions.map((session) => ({
      campaignKey,
      user: session.user,
      sessionId: session.id,
      dedupeKey: `${campaignKey}:${session.id}`,
      metadata: {
        finishedAt: session.finishedAt?.toISOString() ?? null,
        rawScore: session.rawScore ?? null,
        maxScore: session.maxScore ?? null,
        score: session.score != null ? Number(session.score) : null,
      },
    }));
  }

  private async getPaidWeeklyInactiveCandidates(
    now: Date,
    limit: number,
    cooldownHours: number,
  ): Promise<NotificationCandidate[]> {
    const normalizedCooldownHours = Math.max(24, Math.floor(cooldownHours));
    const since = this.addHours(now, -normalizedCooldownHours);
    const users = await this.prisma.user.findMany({
      where: {
        telegramId: { not: null },
        OR: [
          {
            entitlements: {
              some: {
                tier: EntitlementTier.paid,
                status: EntitlementStatus.active,
                windowStartsAt: { lte: now },
                OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
              },
            },
          },
          {
            subscriptions: {
              some: {
                isActive: true,
                expiresAt: { gt: now },
                planType: { not: 'trial' },
              },
            },
          },
        ],
        testSessions: {
          none: {
            status: { in: [...FINISHED_SESSION_STATUSES] },
            finishedAt: { gte: since },
          },
        },
        notificationDeliveries: {
          none: {
            campaignKey: 'paid_weekly_inactive',
            status: 'sent',
            sentAt: { gte: since },
          },
        },
      },
      select: {
        id: true,
        telegramId: true,
        preferredLanguage: true,
        timezone: true,
      },
      orderBy: { updatedAt: 'asc' },
      take: limit,
    });
    const periodKey = this.periodKey(now, normalizedCooldownHours);

    return users.map((user) => ({
      campaignKey: 'paid_weekly_inactive',
      user,
      dedupeKey: `paid_weekly_inactive:${user.id}:${periodKey}`,
    }));
  }

  private async getPaidExpiringSoonCandidates(
    now: Date,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const soon = this.addHours(now, 72);
    const byRef = new Map<string, NotificationCandidate>();

    const entitlements = await this.prisma.userExamEntitlement.findMany({
      where: {
        tier: EntitlementTier.paid,
        status: EntitlementStatus.active,
        windowStartsAt: { lte: now },
        windowEndsAt: { gt: now, lte: soon },
        user: { telegramId: { not: null } },
      },
      select: {
        id: true,
        subscriptionId: true,
        windowEndsAt: true,
        user: {
          select: {
            id: true,
            telegramId: true,
            preferredLanguage: true,
            timezone: true,
          },
        },
      },
      orderBy: { windowEndsAt: 'asc' },
      take: limit * 2,
    });

    for (const entitlement of entitlements) {
      const ref = entitlement.subscriptionId ?? entitlement.id;
      if (byRef.has(ref)) continue;
      byRef.set(ref, {
        campaignKey: 'paid_expiring_soon',
        user: entitlement.user,
        subscriptionId: entitlement.subscriptionId,
        dedupeKey: `paid_expiring_soon:${ref}`,
        metadata: {
          entitlementId: entitlement.id,
          windowEndsAt: entitlement.windowEndsAt?.toISOString() ?? null,
        },
      });
      if (byRef.size >= limit) break;
    }

    if (byRef.size < limit) {
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          isActive: true,
          expiresAt: { gt: now, lte: soon },
          planType: { not: 'trial' },
          user: { telegramId: { not: null } },
        },
        select: {
          id: true,
          expiresAt: true,
          user: {
            select: {
              id: true,
              telegramId: true,
              preferredLanguage: true,
              timezone: true,
            },
          },
        },
        orderBy: { expiresAt: 'asc' },
        take: limit * 2,
      });

      for (const subscription of subscriptions) {
        if (byRef.has(subscription.id)) continue;
        byRef.set(subscription.id, {
          campaignKey: 'paid_expiring_soon',
          user: subscription.user,
          subscriptionId: subscription.id,
          dedupeKey: `paid_expiring_soon:${subscription.id}`,
          metadata: {
            subscriptionId: subscription.id,
            expiresAt: subscription.expiresAt.toISOString(),
          },
        });
        if (byRef.size >= limit) break;
      }
    }

    return [...byRef.values()].slice(0, limit);
  }

  private async filterExistingDedupe(candidates: NotificationCandidate[]) {
    if (candidates.length === 0) return candidates;
    const dedupeKeys = candidates.map((candidate) => candidate.dedupeKey);
    const existing = await this.prisma.notificationDelivery.findMany({
      where: { dedupeKey: { in: dedupeKeys } },
      select: { dedupeKey: true },
    });
    const existingSet = new Set(existing.map((item) => item.dedupeKey));
    return candidates.filter((candidate) => !existingSet.has(candidate.dedupeKey));
  }

  private getBatchSize() {
    const raw = Number(this.config.get<string>('NOTIFICATIONS_BATCH_SIZE'));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 50;
  }

  private isQuietHour(timezone: string | null, now: Date) {
    const { start, end } = this.getQuietHours();
    const hour = this.localHour(now, timezone || 'Asia/Almaty');
    if (start === end) return false;
    if (start < end) return hour >= start && hour < end;
    return hour >= start || hour < end;
  }

  private getQuietHoursLabel() {
    const { start, end } = this.getQuietHours();
    return `${String(start).padStart(2, '0')}-${String(end).padStart(2, '0')}`;
  }

  private getQuietHours() {
    const raw = this.config.get<string>('NOTIFICATIONS_QUIET_HOURS') || '22-09';
    const match = /^(\d{1,2})\s*-\s*(\d{1,2})$/.exec(raw.trim());
    if (!match) return { start: 22, end: 9 };
    const start = Math.min(23, Math.max(0, Number(match[1])));
    const end = Math.min(23, Math.max(0, Number(match[2])));
    return { start, end };
  }

  private localHour(now: Date, timezone: string): number {
    try {
      const parts = new Intl.DateTimeFormat('en-US', {
        timeZone: timezone,
        hour: '2-digit',
        hour12: false,
      }).formatToParts(now);
      const hour = Number(parts.find((part) => part.type === 'hour')?.value ?? '0');
      return hour === 24 ? 0 : hour;
    } catch {
      return this.localHour(now, 'Asia/Almaty');
    }
  }

  private getMetadataNumber(metadata: Prisma.JsonValue, key: string) {
    if (!metadata || typeof metadata !== 'object' || Array.isArray(metadata)) return null;
    const value = (metadata as Record<string, unknown>)[key];
    return typeof value === 'number' && Number.isFinite(value) ? value : null;
  }

  private addMinutes(date: Date, minutes: number) {
    return new Date(date.getTime() + minutes * 60_000);
  }

  private addHours(date: Date, hours: number) {
    return new Date(date.getTime() + hours * 3_600_000);
  }

  private periodKey(date: Date, periodHours: number) {
    const bucket = Math.floor(date.getTime() / (periodHours * 3_600_000));
    return `${periodHours}h:${bucket}`;
  }

  private errorCode(error: unknown) {
    if (error && typeof error === 'object' && 'code' in error) {
      const code = (error as { code?: unknown }).code;
      if (typeof code === 'string') return code.slice(0, 80);
    }
    return error instanceof Error ? error.name.slice(0, 80) : 'UNKNOWN';
  }

  private errorMessage(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }
}
