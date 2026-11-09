import { Injectable, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import {
  TELEGRAM_LINK_PREFIX,
  createTelegramLinkToken,
  createUnsubscribeToken,
  notificationTokenSecret,
  verifyUnsubscribeToken,
} from './notification-tokens';
import { DEFAULT_SITE_URL, absoluteUrl, notificationLanguage } from './notification-templates';

/** Opt-in / opt-out links: Telegram connect deep link and the email unsubscribe link. */
@Injectable()
export class NotificationPreferencesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly telegramBot: TelegramBotService,
  ) {}

  siteUrl() {
    return ((this.config.get<string>('PUBLIC_SITE_URL') || '').trim() || DEFAULT_SITE_URL).replace(/\/+$/, '');
  }

  async createTelegramLink(userId: string, now = new Date()) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { telegramId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.telegramId != null) return { linked: true, url: null, expiresAt: null };

    const secret = notificationTokenSecret(this.config);
    if (!secret || !this.telegramBot.canSendLifecycleNotifications()) {
      throw new ServiceUnavailableException({
        code: 'TELEGRAM_UNAVAILABLE',
        message: 'Telegram is not available right now',
      });
    }
    const { token, expiresAt } = createTelegramLinkToken(userId, secret, now);
    const bot = this.telegramBot.getBotUsername();
    return {
      linked: false,
      url: `https://t.me/${bot}?start=${TELEGRAM_LINK_PREFIX}${token}`,
      expiresAt: expiresAt.toISOString(),
    };
  }

  /** Absolute one-click unsubscribe URL for a user (served through the site's /api/v1 proxy). */
  unsubscribeUrl(userId: string) {
    const secret = notificationTokenSecret(this.config);
    if (!secret) return null;
    const token = createUnsubscribeToken(userId, secret);
    return absoluteUrl(this.siteUrl(), `/api/v1/notifications/unsubscribe?t=${encodeURIComponent(token)}`);
  }

  async unsubscribeEmail(token: string | undefined, now = new Date()) {
    const secret = notificationTokenSecret(this.config);
    const verified = secret && token ? verifyUnsubscribeToken(token, secret) : null;
    if (!verified) return { ok: false, language: 'ru' as const };
    const user = await this.prisma.user.findUnique({
      where: { id: verified.userId },
      select: { id: true, preferredLanguage: true },
    });
    if (!user) return { ok: false, language: 'ru' as const };
    await this.prisma.user.updateMany({
      where: { id: user.id, emailOptOutAt: null },
      data: { emailOptOutAt: now },
    });
    return { ok: true, language: notificationLanguage(user.preferredLanguage) };
  }
}
