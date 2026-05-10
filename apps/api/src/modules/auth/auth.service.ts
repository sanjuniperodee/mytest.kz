import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import { randomInt } from 'crypto';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { REDIS_CLIENT } from '../../database/redis.module';
import {
  getJwtExpiresIn,
  getRequiredConfig,
} from '../../common/config/required-config';
import {
  AUTH_CODE_TTL_SECONDS,
  AUTH_CODE_LENGTH,
  normalizeKzPhone,
} from '@bilimland/shared';
import { AccessService } from '../subscriptions/access.service';

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private telegramAuth: TelegramAuthService,
    @Inject(forwardRef(() => TelegramBotService))
    private telegramBot: TelegramBotService,
    private accessService: AccessService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async authenticateTelegram(initDataRaw: string, visitorId?: string) {
    const initData = this.telegramAuth.validateInitData(initDataRaw);
    if (!initData) {
      throw new UnauthorizedException('Invalid Telegram init data');
    }

    const { user: tgUser } = initData;

    const user = await this.prisma.user.upsert({
      where: { telegramId: BigInt(tgUser.id) },
      update: {
        telegramUsername: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
      },
      create: {
        telegramId: BigInt(tgUser.id),
        telegramUsername: tgUser.username || null,
        firstName: tgUser.first_name,
        lastName: tgUser.last_name || null,
        preferredLanguage: tgUser.language_code === 'kk' ? 'kk' : 'ru',
      },
    });

    // Check channel membership
    const isChannelMember = await this.telegramBot.checkChannelMembership(tgUser.id);
    if (user.isChannelMember !== isChannelMember) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isChannelMember, channelCheckedAt: new Date() },
      });
    }

    /**
     * Production onboarding rule:
     * Mini App login is allowed only after user shares phone in bot.
     * This removes confusing states where app opens but web/OTP flow is unavailable.
     */
    if (!user.phone) {
      throw new BadRequestException('PHONE_REQUIRED_IN_BOT');
    }

    // Attribution: link visitorId to user
    if (visitorId) {
      await this.attrributeVisit(visitorId, user.id);
    }

    await this.accessService.ensureSignupEntitlementsForUser(user.id);

    return this.generateTokens({
      ...user,
      telegramId: Number(user.telegramId),
      isChannelMember,
    });
  }

  async authenticateGoogle(credential: string, visitorId?: string) {
    const raw = this.config.get<string>('GOOGLE_CLIENT_ID');
    const audiences = raw
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (!audiences.length) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    if (!credential) {
      throw new BadRequestException('Google credential is required');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: audiences.length === 1 ? audiences[0] : audiences,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const email = payload.email.toLowerCase();
    const existingUser = await this.prisma.user.findFirst({
      where: {
        OR: [{ googleId: payload.sub }, { email }],
      },
    });

    const names = this.getGoogleNames(payload);
    const user = existingUser
      ? await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            googleId: payload.sub,
            email,
            emailVerified: true,
            firstName: existingUser.firstName || names.firstName,
            lastName: existingUser.lastName || names.lastName,
            avatarUrl: existingUser.avatarUrl || payload.picture || null,
            isChannelMember: existingUser.telegramId ? existingUser.isChannelMember : true,
          },
        })
      : await this.prisma.user.create({
          data: {
            googleId: payload.sub,
            email,
            emailVerified: true,
            firstName: names.firstName,
            lastName: names.lastName,
            avatarUrl: payload.picture || null,
            preferredLanguage: 'ru',
            isChannelMember: true,
          },
        });

    if (visitorId) {
      await this.attrributeVisit(visitorId, user.id);
    }

    await this.accessService.ensureSignupEntitlementsForUser(user.id);

    return this.generateTokens({
      ...user,
      telegramId: user.telegramId ? Number(user.telegramId) : null,
      isChannelMember: user.telegramId ? user.isChannelMember : true,
    });
  }

  /**
   * Step 1: User enters phone (same as shared in Telegram bot).
   * Redis key + code sent to Telegram chat by telegramId.
   */
  /**
   * @param opts.fromTelegramBot — одно сообщение в Telegram: префикс «номер сохранён» + код (без второго дублирующего текста из бота).
   */
  async requestWebCode(
    rawPhone: string,
    opts?: { fromTelegramBot?: boolean },
  ) {
    const normalized = normalizeKzPhone(rawPhone || '');
    if (!normalized) {
      throw new BadRequestException('Введите корректный номер телефона');
    }

    const user = await this.prisma.user.findFirst({
      where: { phone: normalized },
    });
    if (!user) {
      throw new BadRequestException(
        'Номер не найден. Откройте бота @bilimhan_bot по ссылке с сайта и укажите номер в Telegram.',
      );
    }
    if (!user.telegramId) {
      throw new BadRequestException('Для этого аккаунта вход через Telegram-код недоступен');
    }

    const code = Array.from({ length: AUTH_CODE_LENGTH }, () =>
      randomInt(0, 10),
    ).join('');

    const redisKey = `auth:code:${normalized}`;
    await this.redis.set(redisKey, code, 'EX', AUTH_CODE_TTL_SECONDS);

    await this.telegramBot.sendAuthCodeToTelegram(user.telegramId, code, {
      includePhoneLinkedAck: opts?.fromTelegramBot === true,
    });

    return { message: 'Code sent to your Telegram' };
  }

  async verifyWebCode(rawPhone: string, code: string, visitorId?: string) {
    const normalized = normalizeKzPhone(rawPhone || '');
    if (!normalized) {
      throw new BadRequestException('Введите корректный номер телефона');
    }

    const redisKey = `auth:code:${normalized}`;

    const storedCode = await this.redis.get(redisKey);
    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedException('Неверный или истёкший код');
    }

    await this.redis.del(redisKey);

    const user = await this.prisma.user.findFirst({
      where: { phone: normalized },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Пользователь не найден. Откройте бота @bilimhan_bot по ссылке с сайта и укажите номер в Telegram.',
      );
    }
    if (!user.telegramId) {
      throw new UnauthorizedException('Для этого аккаунта вход через Telegram-код недоступен');
    }

    // Check channel membership
    const isChannelMember = await this.telegramBot.checkChannelMembership(
      Number(user.telegramId),
    );
    if (user.isChannelMember !== isChannelMember) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isChannelMember, channelCheckedAt: new Date() },
      });
    }

    // Attribution: link visitorId to user
    if (visitorId) {
      await this.attrributeVisit(visitorId, user.id);
    }

    return this.generateTokens({
      ...user,
      telegramId: Number(user.telegramId),
      isChannelMember,
    });
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: getRequiredConfig(this.config, 'JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) throw new UnauthorizedException();

      await this.accessService.ensureSignupEntitlementsForUser(user.id);

      return this.generateTokens({
        ...user,
        telegramId: user.telegramId ? Number(user.telegramId) : null,
        isChannelMember: user.telegramId ? user.isChannelMember : true,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(user: {
    id: string;
    telegramId: number | null;
    preferredLanguage: string;
    isAdmin: boolean;
    isChannelMember: boolean;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
    avatarUrl?: string | null;
    email?: string | null;
  }) {
    const payload = {
      sub: user.id,
      telegramId: user.telegramId,
      preferredLanguage: user.preferredLanguage,
      isAdmin: user.isAdmin,
      isChannelMember: user.isChannelMember,
    };

    const accessToken = this.jwt.sign(payload);
    const refreshToken = this.jwt.sign(payload, {
      secret: getRequiredConfig(this.config, 'JWT_REFRESH_SECRET'),
      expiresIn: getJwtExpiresIn(
        this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
        '60d',
      ),
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        telegramUsername: user.telegramUsername,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl ?? null,
        email: user.email ?? null,
        preferredLanguage: user.preferredLanguage,
        isChannelMember: user.isChannelMember,
        isAdmin: user.isAdmin,
      },
    };
  }

  private getGoogleNames(payload: {
    given_name?: string;
    family_name?: string;
    name?: string;
  }) {
    const firstName = payload.given_name?.trim() || null;
    const lastName = payload.family_name?.trim() || null;
    if (firstName || lastName || !payload.name) {
      return { firstName, lastName };
    }

    const [first, ...rest] = payload.name.trim().split(/\s+/);
    return {
      firstName: first || null,
      lastName: rest.join(' ') || null,
    };
  }

  private async attrributeVisit(visitorId: string, userId: string) {
    // Update all unclaimed VisitEvents for this visitorId to link to userId
    await this.prisma.visitEvent.updateMany({
      where: { visitorId, userId: null },
      data: { userId },
    });

    // Find the first visit event for this visitor to add 'registered' step
    const firstVisit = await this.prisma.visitEvent.findFirst({
      where: { visitorId },
      orderBy: { createdAt: 'asc' },
    });

    if (firstVisit) {
      const existingStep = await this.prisma.funnelStep.findFirst({
        where: { visitId: firstVisit.id, step: 'registered' },
      });
      if (!existingStep) {
        await this.prisma.funnelStep.create({
          data: {
            visitId: firstVisit.id,
            step: 'registered',
          },
        });
      }
    }
  }
}
