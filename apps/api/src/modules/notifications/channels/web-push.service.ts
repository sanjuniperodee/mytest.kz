import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as webpush from 'web-push';
import { PrismaService } from '../../../database/prisma.service';

export interface PushPayload {
  title: string;
  body: string;
  url: string;
  tag?: string;
}

export interface PushSubscriptionInput {
  endpoint: string;
  keys: { p256dh: string; auth: string };
}

export interface PushSendResult {
  sent: number;
  failed: number;
  removed: number;
  /** Subscription that accepted the message first (stored on the delivery row). */
  firstSuccessId: string | null;
  lastError: string | null;
}

/** Hosts of the browser push services. Anything else is refused: the API would POST to it. */
const PUSH_SERVICE_HOST_SUFFIXES = [
  'fcm.googleapis.com',
  'android.googleapis.com',
  'push.services.mozilla.com',
  'notify.windows.com',
  'push.apple.com',
];

const MAX_SUBSCRIPTIONS_PER_USER = 10;
const SEND_FANOUT_LIMIT = 5;

export function isAllowedPushEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint);
  } catch {
    return false;
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
  const host = url.hostname.toLowerCase();
  return PUSH_SERVICE_HOST_SUFFIXES.some(
    (suffix) => host === suffix || host.endsWith(`.${suffix}`),
  );
}

/**
 * VAPID Web Push. Disabled (no-op) until VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT are set.
 * Subscriptions that the push service reports as gone (404/410) are deleted.
 */
@Injectable()
export class WebPushService {
  private readonly logger = new Logger(WebPushService.name);
  private readonly publicKey: string | null;
  private readonly configured: boolean;

  constructor(
    private readonly prisma: PrismaService,
    config: ConfigService,
  ) {
    const publicKey = (config.get<string>('VAPID_PUBLIC_KEY') ?? '').trim();
    const privateKey = (config.get<string>('VAPID_PRIVATE_KEY') ?? '').trim();
    const subject = (config.get<string>('VAPID_SUBJECT') ?? '').trim();
    let configured = false;
    if (publicKey && privateKey && subject) {
      try {
        webpush.setVapidDetails(subject, publicKey, privateKey);
        configured = true;
      } catch (error) {
        this.logger.error(`Invalid VAPID configuration, web push disabled: ${String(error)}`);
      }
    } else {
      this.logger.log('VAPID keys are not set — web push notifications are disabled.');
    }
    this.configured = configured;
    this.publicKey = configured ? publicKey : null;
  }

  isConfigured() {
    return this.configured;
  }

  getPublicKey() {
    return this.publicKey;
  }

  async subscribe(userId: string, input: PushSubscriptionInput, userAgent?: string | null) {
    if (!isAllowedPushEndpoint(input.endpoint)) {
      throw new BadRequestException({
        code: 'PUSH_ENDPOINT_NOT_ALLOWED',
        message: 'Unsupported push service',
      });
    }
    const agent = userAgent ? userAgent.slice(0, 512) : null;
    // One browser = one endpoint: whoever is signed in now owns it.
    const row = await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: {
        userId,
        endpoint: input.endpoint,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: agent,
      },
      update: {
        userId,
        p256dh: input.keys.p256dh,
        auth: input.keys.auth,
        userAgent: agent,
        failureCount: 0,
      },
      select: { id: true },
    });
    await this.trimUserSubscriptions(userId);
    return { ok: true, id: row.id };
  }

  async unsubscribe(userId: string, endpoint: string) {
    const result = await this.prisma.pushSubscription.deleteMany({
      where: { userId, endpoint },
    });
    return { ok: true, removed: result.count };
  }

  async countForUser(userId: string) {
    return this.prisma.pushSubscription.count({ where: { userId } });
  }

  async sendToUser(userId: string, payload: PushPayload): Promise<PushSendResult> {
    const result: PushSendResult = {
      sent: 0,
      failed: 0,
      removed: 0,
      firstSuccessId: null,
      lastError: null,
    };
    if (!this.configured) return result;

    const subscriptions = await this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      take: SEND_FANOUT_LIMIT,
    });
    const body = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url,
      tag: payload.tag,
      icon: '/icon-192x192.png',
      badge: '/icon-192x192.png',
    });

    for (const subscription of subscriptions) {
      try {
        await webpush.sendNotification(
          {
            endpoint: subscription.endpoint,
            keys: { p256dh: subscription.p256dh, auth: subscription.auth },
          },
          body,
          { TTL: 24 * 3600, urgency: 'normal', timeout: 10_000 },
        );
        result.sent += 1;
        result.firstSuccessId ??= subscription.id;
        await this.prisma.pushSubscription.update({
          where: { id: subscription.id },
          data: { lastSuccessAt: new Date(), failureCount: 0 },
        });
      } catch (error) {
        const statusCode = (error as { statusCode?: number })?.statusCode;
        result.lastError = `${statusCode ?? 'ERR'}: ${error instanceof Error ? error.message : String(error)}`;
        if (statusCode === 404 || statusCode === 410) {
          // The browser unsubscribed or the subscription expired — it will never work again.
          await this.prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
          result.removed += 1;
        } else {
          result.failed += 1;
          await this.prisma.pushSubscription.updateMany({
            where: { id: subscription.id },
            data: { lastFailureAt: new Date(), failureCount: { increment: 1 } },
          });
        }
      }
    }
    return result;
  }

  /** Keeps the newest subscriptions of a user (stale browsers pile up otherwise). */
  private async trimUserSubscriptions(userId: string) {
    const stale = await this.prisma.pushSubscription.findMany({
      where: { userId },
      orderBy: { updatedAt: 'desc' },
      skip: MAX_SUBSCRIPTIONS_PER_USER,
      select: { id: true },
    });
    if (stale.length > 0) {
      await this.prisma.pushSubscription.deleteMany({
        where: { id: { in: stale.map((row) => row.id) } },
      });
    }
  }
}
