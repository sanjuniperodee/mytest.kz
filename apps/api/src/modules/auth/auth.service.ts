import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { REDIS_CLIENT } from '../../database/redis.module';
import {
  AUTH_CODE_TTL_SECONDS,
  AUTH_CODE_LENGTH,
  normalizeKzPhone,
} from '@bilimland/shared';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private telegramAuth: TelegramAuthService,
    @Inject(forwardRef(() => TelegramBotService))
    private telegramBot: TelegramBotService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async authenticateTelegram(initDataRaw: string) {
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

    return this.generateTokens({
      ...user,
      telegramId: Number(user.telegramId),
      isChannelMember,
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

    const code = Array.from({ length: AUTH_CODE_LENGTH }, () =>
      Math.floor(Math.random() * 10),
    ).join('');

    const redisKey = `auth:code:${normalized}`;
    await this.redis.set(redisKey, code, 'EX', AUTH_CODE_TTL_SECONDS);

    await this.telegramBot.sendAuthCodeToTelegram(user.telegramId, code, {
      includePhoneLinkedAck: opts?.fromTelegramBot === true,
    });

    return { message: 'Code sent to your Telegram' };
  }

  async verifyWebCode(rawPhone: string, code: string) {
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

    return this.generateTokens({
      ...user,
      telegramId: Number(user.telegramId),
      isChannelMember,
    });
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      });

      const user = await this.prisma.user.findUnique({
        where: { id: payload.sub },
      });

      if (!user) throw new UnauthorizedException();

      return this.generateTokens({
        ...user,
        telegramId: Number(user.telegramId),
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  private generateTokens(user: {
    id: string;
    telegramId: number;
    preferredLanguage: string;
    isAdmin: boolean;
    isChannelMember: boolean;
    telegramUsername: string | null;
    firstName: string | null;
    lastName: string | null;
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
      secret: this.config.get<string>('JWT_REFRESH_SECRET'),
      expiresIn: this.config.get<string>('JWT_REFRESH_EXPIRES_IN') || '60d',
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
        preferredLanguage: user.preferredLanguage,
        isChannelMember: user.isChannelMember,
        isAdmin: user.isAdmin,
      },
    };
  }
}
