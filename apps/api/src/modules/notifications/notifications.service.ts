import { Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntitlementStatus, EntitlementTier, Prisma } from '@prisma/client';
import Redis from 'ioredis';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { freeDailyEntAttempts } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../database/redis.module';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { TestScorerService } from '../tests/test-scorer.service';
import { MonetizationService } from '../subscriptions/monetization.service';
import { MailerService } from './channels/mailer.service';
import { WebPushService } from './channels/web-push.service';
import {
  NOTIFICATION_CAMPAIGNS,
  NOTIFICATION_CHANNELS,
  type NotificationCampaignDefinition,
  type NotificationCampaignKey,
  type NotificationChannel,
  campaignOrder,
  getNotificationCampaignDefinition,
} from './notification-campaigns';
import {
  type ChannelFlags,
  type ChannelUser,
  channelDedupeKey,
  reachableUserWhere,
  selectChannels,
  userChannelEligibility,
} from './notification-channels';
import { NotificationPreferencesService } from './notification-preferences.service';
import {
  type NotificationContext,
  type NotificationLanguage,
  type RenderedNotification,
  notificationLanguage,
  renderEmail,
  renderNotification,
  renderTelegramText,
} from './notification-templates';

const FINISHED_SESSION_STATUSES = ['completed', 'timed_out'] as const;
const GLOBAL_USER_COOLDOWN_HOURS = 24;
const ALMATY = 'Asia/Almaty';

/** Everything channel selection and rendering need about a recipient. */
const CANDIDATE_USER_SELECT = {
  id: true,
  telegramId: true,
  telegramLinkedAt: true,
  phone: true,
  notificationsMutedAt: true,
  email: true,
  googleId: true,
  emailVerified: true,
  emailOptOutAt: true,
  preferredLanguage: true,
  timezone: true,
  _count: { select: { pushSubscriptions: true } },
} satisfies Prisma.UserSelect;

/** Telegram-native accounts that have not passed the channel gate get only channel_gate_* messages. */
const NOT_CHANNEL_GATED: Prisma.UserWhereInput = {
  OR: [{ telegramId: null }, { telegramLinkedAt: { not: null } }, { isChannelMember: true }],
};

type CandidateUser = ChannelUser & {
  id: string;
  preferredLanguage: string;
  timezone: string | null;
};

type NotificationCandidate = {
  campaignKey: NotificationCampaignKey;
  user: CandidateUser;
  /** Base key; per-channel rows add a suffix (see channelDedupeKey). */
  dedupeKey: string;
  sessionId?: string | null;
  subscriptionId?: string | null;
  metadata?: Prisma.InputJsonObject;
  context?: NotificationContext;
};

type DeliveryOutcome = 'sent' | 'skipped' | 'failed';
/** `gone`: the channel can never reach this user again (push subscription expired, bot blocked). */
type ChannelOutcome = DeliveryOutcome | 'gone';

type RunSource = 'scheduler' | 'manual';

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private telegramBot: TelegramBotService,
    @Inject(REDIS_CLIENT) private redis: Redis,
    private mailer: MailerService,
    private webPush: WebPushService,
    private preferences: NotificationPreferencesService,
    private scorer: TestScorerService,
    private monetization: MonetizationService,
  ) {}

  async ensureDefaultCampaigns() {
    await Promise.all(
      NOTIFICATION_CAMPAIGNS.map((campaign) => {
        const metadata = {
          ru: campaign.message.ru,
          kk: campaign.message.kk,
          channelButtons: campaign.channelButtons === true,
          channels: [...campaign.channels],
        };
        return this.prisma.notificationCampaign.upsert({
          where: { key: campaign.key },
          create: {
            key: campaign.key,
            title: campaign.title,
            cooldownHours: campaign.cooldownHours,
            // isActive is only seeded here; admins own it afterwards.
            isActive: campaign.defaultActive !== false,
            metadata,
          },
          update: { title: campaign.title, metadata },
        });
      }),
    );
  }

  async runAutomation(
    source: RunSource,
    options: { campaignKey?: NotificationCampaignKey; adminId?: string } = {},
  ) {
    if (!this.isEnabled()) {
      return { source, status: 'disabled', scanned: 0, sent: 0, skipped: 0, failed: 0 };
    }
    const lockToken = `${source}:${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const lockTtlMs = Math.max(10 * 60_000, this.getPollIntervalMinutes() * 60_000 * 2);
    const acquired = await this.redis.set(
      'notifications:automation:lock',
      lockToken,
      'PX',
      lockTtlMs,
      'NX',
    );
    if (acquired !== 'OK') {
      return { source, status: 'locked', scanned: 0, sent: 0, skipped: 0, failed: 0 };
    }
    await this.ensureDefaultCampaigns();
    const batchSize = this.getBatchSize();
    const run = await this.prisma.notificationRun.create({
      data: {
        source,
        status: 'running',
        metadata: options.campaignKey ? { campaignKey: options.campaignKey } : undefined,
      },
    });

    if (source === 'manual' && options.adminId) {
      await this.prisma.adminAudit.create({
        data: {
          actorUserId: options.adminId,
          targetType: 'notification_campaign',
          targetId: options.campaignKey || 'all',
          action: 'trigger_manual_run',
          before: Prisma.DbNull,
          after: {
            runId: run.id,
            campaignKey: options.campaignKey || 'all',
          },
        },
      });
    }

    let scanned = 0;
    let sent = 0;
    let skipped = 0;
    let failed = 0;
    const messagedUserIds = new Set<string>();

    try {
      const now = new Date();
      const allCampaigns = await this.prisma.notificationCampaign.findMany({
        orderBy: { createdAt: 'asc' },
      });
      const activeKeys = new Set(allCampaigns.filter((row) => row.isActive).map((row) => row.key));
      const campaignRows = allCampaigns.filter(
        (row) => row.isActive && (!options.campaignKey || row.key === options.campaignKey),
      );
      // Event-driven campaigns (welcome, result recap, replies) go first.
      campaignRows.sort((a, b) => campaignOrder(a.key) - campaignOrder(b.key));

      for (const campaign of campaignRows) {
        if (sent + failed >= batchSize) break;
        const definition = getNotificationCampaignDefinition(campaign.key);
        if (!definition || this.isSuperseded(definition, activeKeys)) continue;

        const remaining = Math.max(0, batchSize - sent - failed);
        const candidates = await this.getCandidates(
          definition,
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
          const outcome = await this.processCandidate(candidate, definition, now);
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
    } finally {
      await this.releaseAutomationLock(lockToken);
    }
  }

  private isSuperseded(definition: NotificationCampaignDefinition, activeKeys: Set<string>) {
    return Boolean(definition.supersededBy && activeKeys.has(definition.supersededBy));
  }

  private async releaseAutomationLock(token: string) {
    try {
      await this.redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        'notifications:automation:lock',
        token,
      );
    } catch (error) {
      this.logger.warn(`Could not release notification automation lock: ${error}`);
    }
  }

  async getOverview() {
    await this.ensureDefaultCampaigns();
    const campaigns = await this.prisma.notificationCampaign.findMany({
      orderBy: { createdAt: 'asc' },
    });
    campaigns.sort((a, b) => campaignOrder(a.key) - campaignOrder(b.key));
    const now = new Date();
    const activeKeys = new Set(campaigns.filter((row) => row.isActive).map((row) => row.key));

    const grouped = await this.prisma.notificationDelivery.groupBy({
      by: ['campaignKey', 'channel', 'status'],
      _count: { _all: true },
    });
    const emptyByChannel = () =>
      Object.fromEntries(
        NOTIFICATION_CHANNELS.map((channel) => [channel, { sent: 0, failed: 0 }]),
      ) as Record<NotificationChannel, { sent: number; failed: number }>;
    const statsByCampaign = new Map<string, Record<NotificationChannel, { sent: number; failed: number }>>();
    for (const row of grouped) {
      const channel = row.channel as NotificationChannel;
      if (!NOTIFICATION_CHANNELS.includes(channel)) continue;
      if (row.status !== 'sent' && row.status !== 'failed') continue;
      const stats = statsByCampaign.get(row.campaignKey) ?? emptyByChannel();
      stats[channel][row.status] += row._count._all;
      statsByCampaign.set(row.campaignKey, stats);
    }

    const campaignRows = await Promise.all(
      campaigns.map(async (campaign) => {
        const definition = getNotificationCampaignDefinition(campaign.key);
        const superseded = definition ? this.isSuperseded(definition, activeKeys) : false;
        const byChannel = statsByCampaign.get(campaign.key) ?? emptyByChannel();
        const [lastDelivery, audience] = await Promise.all([
          this.prisma.notificationDelivery.findFirst({
            where: { campaignKey: campaign.key },
            orderBy: { attemptedAt: 'desc' },
          }),
          superseded ? Promise.resolve(0) : this.countAudience(campaign.key, now, campaign.cooldownHours),
        ]);

        return {
          id: campaign.id,
          key: campaign.key,
          title: campaign.title,
          isActive: campaign.isActive,
          cooldownHours: campaign.cooldownHours,
          channels: definition ? [...definition.channels] : ['telegram'],
          superseded,
          audience,
          sent: NOTIFICATION_CHANNELS.reduce((sum, channel) => sum + byChannel[channel].sent, 0),
          failed: NOTIFICATION_CHANNELS.reduce((sum, channel) => sum + byChannel[channel].failed, 0),
          byChannel,
          lastAttemptedAt: lastDelivery?.attemptedAt ?? null,
          updatedAt: campaign.updatedAt,
        };
      }),
    );

    const [runs, pushSubscriptions, mailSentToday] = await Promise.all([
      this.prisma.notificationRun.findMany({
        orderBy: { startedAt: 'desc' },
        take: 10,
      }),
      this.prisma.pushSubscription.count(),
      this.mailer.isConfigured() ? this.mailer.sentToday(now) : Promise.resolve(0),
    ]);

    return {
      campaigns: campaignRows,
      runs,
      settings: {
        enabled: this.isEnabled(),
        pollIntervalMinutes: this.getPollIntervalMinutes(),
        batchSize: this.getBatchSize(),
        quietHours: this.getQuietHoursLabel(),
        globalCooldownHours: GLOBAL_USER_COOLDOWN_HOURS,
        channels: {
          telegram: { configured: this.telegramBot.canSendLifecycleNotifications() },
          push: { configured: this.webPush.isConfigured(), subscriptions: pushSubscriptions },
          email: {
            configured: this.mailer.isConfigured(),
            dailyCap: this.mailer.getDailyCap(),
            sentToday: mailSentToday,
          },
        },
      },
    };
  }

  async getLogs(params: {
    page?: number;
    limit?: number;
    campaignKey?: string;
    status?: string;
    channel?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 20));
    const where: Prisma.NotificationDeliveryWhereInput = {
      ...(params.campaignKey ? { campaignKey: params.campaignKey } : {}),
      ...(params.status ? { status: params.status } : {}),
      ...(params.channel ? { channel: params.channel } : {}),
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
              email: true,
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
        targetTelegramId: item.targetTelegramId != null ? Number(item.targetTelegramId) : null,
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
    adminId: string | undefined,
    key: string,
    data: { isActive?: boolean; cooldownHours?: number },
  ) {
    const existing = await this.prisma.notificationCampaign.findUnique({
      where: { key },
    });
    if (!existing) throw new NotFoundException('Campaign not found');

    const updated = await this.prisma.notificationCampaign.update({
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

    if (adminId) {
      await this.prisma.adminAudit.create({
        data: {
          actorUserId: adminId,
          targetType: 'notification_campaign',
          targetId: key,
          action: 'update_campaign',
          before: {
            isActive: existing.isActive,
            cooldownHours: existing.cooldownHours,
          },
          after: {
            isActive: updated.isActive,
            cooldownHours: updated.cooldownHours,
          },
        },
      });
    }

    return updated;
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

  /** Channels that are set up on this server (credentials present, bot running). */
  configuredChannels(): ChannelFlags {
    return {
      push: this.webPush.isConfigured(),
      telegram: this.telegramBot.canSendLifecycleNotifications(),
      email: this.mailer.isConfigured(),
    };
  }

  private reachable(definition: NotificationCampaignDefinition) {
    return reachableUserWhere(definition.channels, this.configuredChannels());
  }

  private async processCandidate(
    candidate: NotificationCandidate,
    definition: NotificationCampaignDefinition,
    now: Date,
  ): Promise<DeliveryOutcome> {
    if (this.isQuietHour(candidate.user.timezone, now)) return 'skipped';

    const channels = selectChannels(
      userChannelEligibility(candidate.user),
      this.configuredChannels(),
      definition.channels,
      NOTIFICATION_CHANNELS.length,
    );
    if (channels.length === 0) return 'skipped';

    const language = notificationLanguage(candidate.user.preferredLanguage);
    const context = await this.resolveContext(candidate, language, now);
    const rendered = renderNotification(definition, language, context, this.preferences.siteUrl());

    let budget = Math.max(1, definition.maxChannels ?? 1);
    let outcome: DeliveryOutcome = 'skipped';
    for (const channel of channels) {
      if (budget <= 0) break;
      const result = await this.deliver(channel, candidate, definition, rendered, language, context, now);
      if (result === 'sent') {
        outcome = 'sent';
        budget -= 1;
      } else if (result === 'failed') {
        // A transient error: retry later on the same channel rather than spamming another one.
        if (outcome !== 'sent') outcome = 'failed';
        budget -= 1;
      } else if (result === 'gone') {
        // This channel is dead for the user — fall through to the next one.
        if (outcome === 'skipped') outcome = 'failed';
      }
    }
    return outcome;
  }

  private async deliver(
    channel: NotificationChannel,
    candidate: NotificationCandidate,
    definition: NotificationCampaignDefinition,
    rendered: RenderedNotification,
    language: NotificationLanguage,
    context: NotificationContext | null,
    now: Date,
  ): Promise<ChannelOutcome> {
    const { user } = candidate;
    if (channel === 'email' && !(await this.mailer.hasCapacity(now))) return 'skipped';
    const unsubscribeUrl = channel === 'email' ? this.preferences.unsubscribeUrl(user.id) : null;
    // Never send an email without a working unsubscribe link.
    if (channel === 'email' && !unsubscribeUrl) return 'skipped';

    const deliveryId = await this.createDelivery(channel, candidate);
    if (!deliveryId) return 'skipped';

    try {
      if (channel === 'telegram') {
        await this.telegramBot.sendLifecycleNotification(
          user.telegramId!,
          renderTelegramText(definition, rendered, language, context),
          {
            language,
            channelButtons: definition.channelButtons === true,
            // Web accounts that linked Telegram log in on the site, not in the Mini App.
            ...(user.phone ? {} : { url: rendered.url, buttonLabel: rendered.ctaLabel }),
          },
        );
        await this.markSent(deliveryId);
        return 'sent';
      }

      if (channel === 'push') {
        const result = await this.webPush.sendToUser(user.id, {
          title: rendered.title,
          body: rendered.body,
          url: rendered.url,
          tag: rendered.tag,
        });
        if (result.sent > 0) {
          await this.markSent(deliveryId, { targetPushId: result.firstSuccessId });
          return 'sent';
        }
        const gone = result.failed === 0;
        await this.markFailed(deliveryId, {
          code: gone ? 'PUSH_GONE' : 'PUSH_FAILED',
          message: result.lastError ?? 'No active push subscriptions',
          retry: !gone,
        });
        return gone ? 'gone' : 'failed';
      }

      const email = renderEmail(rendered, language, unsubscribeUrl!);
      const result = await this.mailer.send(
        {
          to: user.email!,
          subject: email.subject,
          html: email.html,
          text: email.text,
          unsubscribeUrl: unsubscribeUrl!,
        },
        now,
      );
      if (result.status === 'skipped') {
        await this.markFailed(deliveryId, {
          code: result.reason === 'daily_cap' ? 'MAIL_DAILY_CAP' : 'MAIL_NOT_CONFIGURED',
          message: `Email skipped: ${result.reason}`,
          retry: true,
        });
        return 'skipped';
      }
      await this.markSent(deliveryId);
      return 'sent';
    } catch (error) {
      const unreachable =
        channel === 'telegram' && this.telegramBot.isUnreachableChatError(error);
      if (unreachable) {
        // Blocked bot / deleted account: stop using Telegram for this user (/start re-enables it).
        await this.prisma.user.updateMany({
          where: { id: user.id, notificationsMutedAt: null },
          data: { notificationsMutedAt: new Date() },
        });
      }
      await this.markFailed(deliveryId, {
        code: unreachable ? 'TELEGRAM_UNREACHABLE' : this.errorCode(error),
        message: this.errorMessage(error),
        retry: !unreachable,
      });
      return unreachable ? 'gone' : 'failed';
    }
  }

  private async createDelivery(channel: NotificationChannel, candidate: NotificationCandidate) {
    const { user } = candidate;
    const target = {
      channel,
      targetTelegramId: channel === 'telegram' ? user.telegramId : null,
      targetEmail: channel === 'email' ? user.email ?? null : null,
    };
    const dedupeKey = channelDedupeKey(candidate.dedupeKey, channel);
    try {
      const created = await this.prisma.notificationDelivery.upsert({
        where: { dedupeKey },
        create: {
          campaignKey: candidate.campaignKey,
          userId: user.id,
          sessionId: candidate.sessionId ?? null,
          subscriptionId: candidate.subscriptionId ?? null,
          dedupeKey,
          status: 'pending',
          ...target,
          metadata: candidate.metadata,
        },
        update: {
          status: 'pending',
          attemptedAt: new Date(),
          nextAttemptAt: null,
          ...target,
          metadata: candidate.metadata,
        },
      });
      return created.id as string;
    } catch (error) {
      if (error instanceof PrismaClientKnownRequestError && error.code === 'P2002') {
        return null;
      }
      throw error;
    }
  }

  private async markSent(deliveryId: string, extra: { targetPushId?: string | null } = {}) {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'sent',
        sentAt: new Date(),
        errorCode: null,
        errorMessage: null,
        ...(extra.targetPushId ? { targetPushId: extra.targetPushId } : {}),
      },
    });
  }

  private async markFailed(
    deliveryId: string,
    failure: { code: string; message: string; retry: boolean },
  ) {
    await this.prisma.notificationDelivery.update({
      where: { id: deliveryId },
      data: {
        status: 'failed',
        retryCount: { increment: 1 },
        nextAttemptAt: failure.retry ? this.nextRetryAt(new Date()) : null,
        errorCode: failure.code.slice(0, 80),
        errorMessage: failure.message.slice(0, 2000),
      },
    });
  }

  private async resolveContext(
    candidate: NotificationCandidate,
    language: NotificationLanguage,
    now: Date,
  ): Promise<NotificationContext | null> {
    if (candidate.context) return candidate.context;
    if (candidate.campaignKey === 'result_recap' && candidate.sessionId) {
      return this.buildResultRecapContext(candidate, language, now);
    }
    return null;
  }

  /** Score + the three subjects where the most points were lost. */
  private async buildResultRecapContext(
    candidate: NotificationCandidate,
    language: NotificationLanguage,
    now: Date,
  ): Promise<NotificationContext> {
    const sessionId = candidate.sessionId!;
    const fallbackRaw = this.getMetadataNumber(candidate.metadata ?? null, 'rawScore');
    const fallbackMax = this.getMetadataNumber(candidate.metadata ?? null, 'maxScore');
    const showPremium = !(await this.hasPaidAccess(candidate.user.id, now));
    try {
      const score = await this.scorer.calculateScore(sessionId, undefined, { readOnly: true });
      const weakSubjects = score.sections
        .map((section) => ({
          name: this.localizedName(section.subjectName, language),
          lost:
            section.maxPoints != null && section.rawPoints != null
              ? section.maxPoints - section.rawPoints
              : section.totalCount - section.correctCount,
        }))
        .filter((subject) => subject.name && subject.lost > 0)
        .sort((a, b) => b.lost - a.lost)
        .slice(0, 3);
      return {
        kind: 'result_recap',
        sessionId,
        rawScore: score.rawScore,
        maxScore: score.maxScore,
        weakSubjects,
        showPremium,
      };
    } catch (error) {
      this.logger.warn(`Result recap scoring failed for ${sessionId}: ${this.errorMessage(error)}`);
      return {
        kind: 'result_recap',
        sessionId,
        rawScore: fallbackRaw,
        maxScore: fallbackMax,
        weakSubjects: [],
        showPremium,
      };
    }
  }

  private async hasPaidAccess(userId: string, now: Date) {
    const [entitlement, subscription] = await Promise.all([
      this.prisma.userExamEntitlement.findFirst({
        where: { userId, ...this.activePaidEntitlementWhere(now) },
        select: { id: true },
      }),
      this.prisma.subscription.findFirst({
        where: { userId, ...this.activePaidSubscriptionWhere(now) },
        select: { id: true },
      }),
    ]);
    return Boolean(entitlement || subscription);
  }

  private activePaidEntitlementWhere(now: Date): Prisma.UserExamEntitlementWhereInput {
    return {
      tier: { in: [EntitlementTier.paid, EntitlementTier.admin] },
      status: EntitlementStatus.active,
      windowStartsAt: { lte: now },
      OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
    };
  }

  private activePaidSubscriptionWhere(now: Date): Prisma.SubscriptionWhereInput {
    return {
      isActive: true,
      startsAt: { lte: now },
      expiresAt: { gt: now },
      planType: { not: 'free' },
    };
  }

  private noPaidAccessWhere(now: Date): Prisma.UserWhereInput {
    return {
      entitlements: { none: this.activePaidEntitlementWhere(now) },
      subscriptions: { none: this.activePaidSubscriptionWhere(now) },
    };
  }

  private async countAudience(key: string, now: Date, cooldownHours: number) {
    const definition = getNotificationCampaignDefinition(key);
    if (!definition) return 0;
    const candidates = await this.getCandidates(definition, now, 5000, cooldownHours);
    return candidates.length;
  }

  private async getCandidates(
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
    cooldownHours?: number,
  ): Promise<NotificationCandidate[]> {
    let candidates: NotificationCandidate[];
    switch (definition.key) {
      case 'welcome':
        candidates = await this.getWelcomeCandidates(definition, now, limit);
        break;
      case 'result_recap':
        candidates = await this.getResultRecapCandidates(definition, now, limit);
        break;
      case 'community_reply':
        candidates = await this.getCommunityReplyCandidates(definition, now, limit);
        break;
      case 'abandoned_test':
        candidates = await this.getAbandonedTestCandidates(definition, now, limit);
        break;
      case 'free_ent_available':
        candidates = await this.getFreeEntAvailableCandidates(definition, now, limit);
        break;
      case 'channel_gate_day1':
        candidates = await this.getChannelGateCandidates(definition, now, 24, limit);
        break;
      case 'channel_gate_day3':
        candidates = await this.getChannelGateCandidates(definition, now, 72, limit, 'channel_gate_day1');
        break;
      case 'no_trial_day1':
        candidates = await this.getNoTrialCandidates(definition, now, 24, limit);
        break;
      case 'no_trial_day3':
        candidates = await this.getNoTrialCandidates(definition, now, 72, limit, 'no_trial_day1');
        break;
      case 'post_trial_no_payment':
        // Telegram-only; skipped by runAutomation while result_recap is active.
        candidates = await this.getPostTrialNoPaymentCandidates(definition, now, limit, 15, 24);
        break;
      case 'post_trial_day1_no_payment':
        candidates = await this.getPostTrialNoPaymentCandidates(definition, now, limit, 24 * 60, 72);
        break;
      case 'post_trial_day3_no_payment':
        candidates = await this.getPostTrialNoPaymentCandidates(definition, now, limit, 72 * 60, 168);
        break;
      case 'paid_weekly_inactive':
        candidates = await this.getPaidWeeklyInactiveCandidates(definition, now, limit, cooldownHours ?? 168);
        break;
      case 'paid_expiring_soon':
        candidates = await this.getPaidExpiringSoonCandidates(definition, now, limit);
        break;
      default:
        candidates = [];
    }

    let filtered = await this.filterExistingDedupe(candidates);
    if (!definition.bypassGlobalCooldown) {
      filtered = await this.filterRecentlyMessaged(filtered, now);
    }
    return this.filterFrequencyCap(filtered, definition, now);
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

  private async filterFrequencyCap(
    candidates: NotificationCandidate[],
    definition: NotificationCampaignDefinition,
    now: Date,
  ): Promise<NotificationCandidate[]> {
    const cap = definition.frequencyCap;
    if (!cap || candidates.length === 0) return candidates;
    const userIds = [...new Set(candidates.map((candidate) => candidate.user.id))];
    const rows = await this.prisma.notificationDelivery.findMany({
      where: {
        campaignKey: definition.key,
        userId: { in: userIds },
        status: 'sent',
        sentAt: { gte: this.addHours(now, -cap.windowHours) },
      },
      select: { userId: true },
    });
    const counts = new Map<string, number>();
    for (const row of rows) counts.set(row.userId, (counts.get(row.userId) ?? 0) + 1);
    return candidates.filter((candidate) => (counts.get(candidate.user.id) ?? 0) < cap.max);
  }

  private async getWelcomeCandidates(
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const users = await this.prisma.user.findMany({
      where: {
        createdAt: { gte: this.addHours(now, -48), lte: this.addMinutes(now, -5) },
        testSessions: { none: { status: { in: [...FINISHED_SESSION_STATUSES] } } },
        notificationDeliveries: { none: { campaignKey: 'welcome' } },
        AND: [this.reachable(definition), NOT_CHANNEL_GATED],
      },
      select: CANDIDATE_USER_SELECT,
      orderBy: { createdAt: 'asc' },
      take: limit,
    });
    return users.map((user) => ({
      campaignKey: 'welcome',
      user,
      dedupeKey: `welcome:${user.id}`,
    }));
  }

  private async getResultRecapCandidates(
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const sessions = await this.prisma.testSession.findMany({
      where: {
        status: { in: [...FINISHED_SESSION_STATUSES] },
        examType: { slug: 'ent' },
        // Full ENT only (140 points); short practice sessions are not recapped.
        maxScore: { gte: 100 },
        finishedAt: { gte: this.addHours(now, -24), lte: this.addMinutes(now, -15) },
        notificationDeliveries: { none: { campaignKey: 'result_recap' } },
        user: this.reachable(definition),
      },
      select: {
        id: true,
        finishedAt: true,
        rawScore: true,
        maxScore: true,
        user: { select: CANDIDATE_USER_SELECT },
      },
      orderBy: { finishedAt: 'asc' },
      take: limit,
    });
    return sessions.map((session) => ({
      campaignKey: 'result_recap',
      user: session.user,
      sessionId: session.id,
      dedupeKey: `result_recap:${session.id}`,
      metadata: {
        finishedAt: session.finishedAt?.toISOString() ?? null,
        rawScore: session.rawScore ?? null,
        maxScore: session.maxScore ?? null,
      },
    }));
  }

  /** Replies by other people to the user's posts in the last 24 h (blocked users excluded). */
  private async getCommunityReplyCandidates(
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const replies = await this.prisma.socialPost.findMany({
      where: {
        deletedAt: null,
        parentId: { not: null },
        // A short delay: someone chatting right now has probably seen it already.
        createdAt: { gte: this.addHours(now, -24), lte: this.addMinutes(now, -10) },
        parent: { is: { deletedAt: null } },
      },
      select: {
        id: true,
        authorId: true,
        parent: { select: { id: true, authorId: true, body: true } },
      },
      orderBy: { createdAt: 'desc' },
      take: Math.min(2000, Math.max(200, limit * 20)),
    });

    const byRecipient = new Map<string, typeof replies>();
    for (const reply of replies) {
      if (!reply.parent || reply.parent.authorId === reply.authorId) continue;
      const list = byRecipient.get(reply.parent.authorId) ?? [];
      list.push(reply);
      byRecipient.set(reply.parent.authorId, list);
    }
    if (byRecipient.size === 0) return [];

    const recipientIds = [...byRecipient.keys()];
    const [blocks, users] = await Promise.all([
      this.prisma.socialBlock.findMany({
        where: {
          OR: [{ blockerId: { in: recipientIds } }, { blockedId: { in: recipientIds } }],
        },
        select: { blockerId: true, blockedId: true },
      }),
      this.prisma.user.findMany({
        where: {
          id: { in: recipientIds },
          notificationDeliveries: {
            none: {
              campaignKey: 'community_reply',
              status: 'sent',
              sentAt: { gte: this.addHours(now, -24) },
            },
          },
          AND: [this.reachable(definition)],
        },
        select: CANDIDATE_USER_SELECT,
      }),
    ]);
    const hidden = new Set(
      blocks.flatMap((block) => [
        `${block.blockerId}:${block.blockedId}`,
        `${block.blockedId}:${block.blockerId}`,
      ]),
    );

    const candidates: NotificationCandidate[] = [];
    for (const user of users) {
      const visible = (byRecipient.get(user.id) ?? []).filter(
        (reply) => !hidden.has(`${user.id}:${reply.authorId}`),
      );
      const latest = visible[0];
      if (!latest?.parent) continue;
      candidates.push({
        campaignKey: 'community_reply',
        user,
        dedupeKey: `community_reply:${user.id}:${latest.id}`,
        metadata: { postId: latest.parent.id, replyId: latest.id, replies: visible.length },
        context: {
          kind: 'community_reply',
          postId: latest.parent.id,
          replies: visible.length,
          excerpt: latest.parent.body,
        },
      });
      if (candidates.length >= limit) break;
    }
    return candidates;
  }

  private async getAbandonedTestCandidates(
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const sessions = await this.prisma.testSession.findMany({
      where: {
        status: 'in_progress',
        // Older attempts are not worth a reminder (and must not be mass-mailed on a new channel).
        startedAt: { gte: this.addHours(now, -72), lte: this.addMinutes(now, -30) },
        user: this.reachable(definition),
        notificationDeliveries: {
          none: { campaignKey: 'abandoned_test' },
        },
      },
      select: {
        id: true,
        startedAt: true,
        metadata: true,
        template: { select: { durationMins: true } },
        user: { select: CANDIDATE_USER_SELECT },
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
        context: { kind: 'session', sessionId: session.id },
      }));
  }

  /** Took an ENT in the last 14 days, not today, free tier on: «today's free ENT is available». */
  private async getFreeEntAvailableCandidates(
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const config = await this.monetization.getConfig();
    if (freeDailyEntAttempts(config) <= 0) return [];
    const dayStart = this.zonedDayStart(now, ALMATY);
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: ALMATY }).format(now);
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          this.reachable(definition),
          NOT_CHANNEL_GATED,
          this.noPaidAccessWhere(now),
          {
            testSessions: {
              some: { examType: { slug: 'ent' }, startedAt: { gte: this.addHours(now, -14 * 24) } },
            },
          },
          { testSessions: { none: { startedAt: { gte: dayStart } } } },
          {
            notificationDeliveries: {
              none: { campaignKey: 'free_ent_available', attemptedAt: { gte: dayStart } },
            },
          },
        ],
      },
      select: CANDIDATE_USER_SELECT,
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
    return users.map((user) => ({
      campaignKey: 'free_ent_available',
      user,
      dedupeKey: `free_ent_available:${user.id}:${day}`,
    }));
  }

  private async getChannelGateCandidates(
    definition: NotificationCampaignDefinition,
    now: Date,
    ageHours: number,
    limit: number,
    priorCampaignKey?: NotificationCampaignKey,
  ): Promise<NotificationCandidate[]> {
    const campaignKey = definition.key;
    const users = await this.prisma.user.findMany({
      where: {
        telegramId: { not: null },
        // Telegram linked to a web account is never gated.
        telegramLinkedAt: null,
        phone: { not: null },
        isChannelMember: false,
        createdAt: { lte: this.addHours(now, -ageHours) },
        testSessions: {
          none: { status: { in: [...FINISHED_SESSION_STATUSES] } },
        },
        ...this.noPaidAccessWhere(now),
        AND: [
          this.reachable(definition),
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
      select: CANDIDATE_USER_SELECT,
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
    definition: NotificationCampaignDefinition,
    now: Date,
    ageHours: number,
    limit: number,
    priorCampaignKey?: NotificationCampaignKey,
  ): Promise<NotificationCandidate[]> {
    const campaignKey = definition.key;
    const users = await this.prisma.user.findMany({
      where: {
        // Upper bound: new channels must not mass-mail every old account at once.
        createdAt: { lte: this.addHours(now, -ageHours), gte: this.addHours(now, -14 * 24) },
        testSessions: {
          none: { status: { in: [...FINISHED_SESSION_STATUSES] } },
        },
        AND: [
          this.reachable(definition),
          NOT_CHANNEL_GATED,
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
      select: CANDIDATE_USER_SELECT,
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
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
    minAgeMinutes: number,
    maxAgeHours: number,
  ): Promise<NotificationCandidate[]> {
    const campaignKey = definition.key;
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
          AND: [this.reachable(definition), NOT_CHANNEL_GATED, this.noPaidAccessWhere(now)],
        },
      },
      select: {
        id: true,
        finishedAt: true,
        rawScore: true,
        maxScore: true,
        score: true,
        user: { select: CANDIDATE_USER_SELECT },
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
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
    cooldownHours: number,
  ): Promise<NotificationCandidate[]> {
    const normalizedCooldownHours = Math.max(24, Math.floor(cooldownHours));
    const since = this.addHours(now, -normalizedCooldownHours);
    const users = await this.prisma.user.findMany({
      where: {
        AND: [
          this.reachable(definition),
          {
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
                    planType: { not: 'starter' },
                  },
                },
              },
            ],
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
            attemptedAt: { gte: since },
          },
        },
      },
      select: CANDIDATE_USER_SELECT,
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
    definition: NotificationCampaignDefinition,
    now: Date,
    limit: number,
  ): Promise<NotificationCandidate[]> {
    const soon = this.addHours(now, 72);
    const byRef = new Map<string, NotificationCandidate>();
    const reachable = this.reachable(definition);

    const entitlements = await this.prisma.userExamEntitlement.findMany({
      where: {
        tier: EntitlementTier.paid,
        status: EntitlementStatus.active,
        windowStartsAt: { lte: now },
        windowEndsAt: { gt: now, lte: soon },
        user: reachable,
      },
      select: {
        id: true,
        subscriptionId: true,
        windowEndsAt: true,
        user: { select: CANDIDATE_USER_SELECT },
      },
      orderBy: { windowEndsAt: 'asc' },
      take: limit * 20,
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
    }

    if (byRef.size < limit) {
      const subscriptions = await this.prisma.subscription.findMany({
        where: {
          isActive: true,
          expiresAt: { gt: now, lte: soon },
          planType: { not: 'trial' },
          user: reachable,
        },
        select: {
          id: true,
          expiresAt: true,
          user: { select: CANDIDATE_USER_SELECT },
        },
        orderBy: { expiresAt: 'asc' },
        take: limit * 20,
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
      }
    }

    const deduped = await this.filterExistingDedupe([...byRef.values()]);
    return deduped.slice(0, limit);
  }

  /** Drops candidates that already have a live delivery on any channel. */
  private async filterExistingDedupe(candidates: NotificationCandidate[]) {
    if (candidates.length === 0) return candidates;
    const variantToBase = new Map<string, string>();
    for (const candidate of candidates) {
      for (const channel of NOTIFICATION_CHANNELS) {
        variantToBase.set(channelDedupeKey(candidate.dedupeKey, channel), candidate.dedupeKey);
      }
    }
    const now = new Date();
    const existing = await this.prisma.notificationDelivery.findMany({
      where: {
        dedupeKey: { in: [...variantToBase.keys()] },
        OR: [
          { status: { in: ['sent', 'pending', 'suppressed'] } },
          {
            status: 'failed',
            OR: [
              { retryCount: { gte: 3 } },
              { nextAttemptAt: null },
              { nextAttemptAt: { gt: now } },
            ],
          },
        ],
      },
      select: { dedupeKey: true },
    });
    const blocked = new Set(existing.map((item) => variantToBase.get(item.dedupeKey)));
    return candidates.filter((candidate) => !blocked.has(candidate.dedupeKey));
  }

  private nextRetryAt(now: Date) {
    return new Date(now.getTime() + 30 * 60_000);
  }

  private getBatchSize() {
    const raw = Number(this.config.get<string>('NOTIFICATIONS_BATCH_SIZE'));
    return Number.isFinite(raw) && raw > 0 ? Math.floor(raw) : 50;
  }

  private isQuietHour(timezone: string | null, now: Date) {
    const { start, end } = this.getQuietHours();
    const hour = this.localHour(now, timezone || ALMATY);
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
      return this.localHour(now, ALMATY);
    }
  }

  /** Midnight of `now`'s calendar day in `timeZone`, as an absolute instant. */
  private zonedDayStart(now: Date, timeZone: string) {
    const parts = Object.fromEntries(
      new Intl.DateTimeFormat('en-US', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
        .formatToParts(now)
        .map((part) => [part.type, part.value]),
    );
    const year = Number(parts.year);
    const month = Number(parts.month) - 1;
    const day = Number(parts.day);
    const localAsUtc = Date.UTC(year, month, day, Number(parts.hour) % 24, Number(parts.minute), Number(parts.second));
    const offsetMs = localAsUtc - Math.floor(now.getTime() / 1000) * 1000;
    return new Date(Date.UTC(year, month, day) - offsetMs);
  }

  private localizedName(value: unknown, language: NotificationLanguage) {
    if (typeof value === 'string') return value;
    if (!value || typeof value !== 'object') return '';
    const record = value as Record<string, unknown>;
    const pick = (key: string) => (typeof record[key] === 'string' ? (record[key] as string).trim() : '');
    return pick(language) || pick('ru') || pick('kk') || pick('en');
  }

  private getMetadataNumber(metadata: Prisma.JsonValue | Prisma.InputJsonObject | null, key: string) {
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
