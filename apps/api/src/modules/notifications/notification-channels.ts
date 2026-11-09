import type { Prisma } from '@prisma/client';
import { NOTIFICATION_CHANNELS, type NotificationChannel } from './notification-campaigns';

export type ChannelFlags = Record<NotificationChannel, boolean>;

/** Fields of a user that decide which channels can reach them. */
export interface ChannelUser {
  telegramId: bigint | null;
  telegramLinkedAt?: Date | null;
  phone?: string | null;
  notificationsMutedAt?: Date | null;
  email?: string | null;
  googleId?: string | null;
  emailVerified?: boolean | null;
  emailOptOutAt?: Date | null;
  _count?: { pushSubscriptions?: number } | null;
}

/**
 * Per-user eligibility:
 * - push: at least one browser subscription;
 * - telegram: a chat id, not muted with /stop, and an account that can actually open the app
 *   (phone shared in the bot, or Telegram linked to a web account);
 * - email: verified Google email that has not unsubscribed.
 */
export function userChannelEligibility(user: ChannelUser): ChannelFlags {
  return {
    push: (user._count?.pushSubscriptions ?? 0) > 0,
    telegram:
      user.telegramId != null &&
      !user.notificationsMutedAt &&
      (Boolean(user.phone) || Boolean(user.telegramLinkedAt)),
    email:
      Boolean(user.email) &&
      Boolean(user.googleId) &&
      user.emailVerified !== false &&
      !user.emailOptOutAt,
  };
}

/** Preferred channels first (push → telegram → email); at most `max` of them. */
export function selectChannels(
  eligible: ChannelFlags,
  configured: ChannelFlags,
  allowed: readonly NotificationChannel[],
  max = 1,
): NotificationChannel[] {
  return NOTIFICATION_CHANNELS.filter(
    (channel) => allowed.includes(channel) && configured[channel] && eligible[channel],
  ).slice(0, Math.max(1, max));
}

/** Prisma filter: users reachable by at least one allowed + configured channel. */
export function reachableUserWhere(
  allowed: readonly NotificationChannel[],
  configured: ChannelFlags,
): Prisma.UserWhereInput {
  const or: Prisma.UserWhereInput[] = [];
  const usable = (channel: NotificationChannel) => allowed.includes(channel) && configured[channel];
  if (usable('push')) or.push({ pushSubscriptions: { some: {} } });
  if (usable('telegram')) {
    or.push({
      telegramId: { not: null },
      notificationsMutedAt: null,
      OR: [{ phone: { not: null } }, { telegramLinkedAt: { not: null } }],
    });
  }
  if (usable('email')) {
    or.push({
      email: { not: null },
      googleId: { not: null },
      emailVerified: true,
      emailOptOutAt: null,
    });
  }
  // Nothing configured: match nobody instead of everybody.
  return or.length > 0 ? { OR: or } : { id: { in: [] } };
}

/** Telegram keeps the historical key, other channels get a suffix — one row per channel. */
export function channelDedupeKey(baseKey: string, channel: NotificationChannel) {
  return channel === 'telegram' ? baseKey : `${baseKey}:${channel}`;
}
