import { Injectable, UnauthorizedException, Inject, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { REDIS_CLIENT } from '../../database/redis.module';
import { AUTH_CODE_TTL_SECONDS, AUTH_CODE_LENGTH } from '@bilimland/shared';

@Injectable()
export class AuthService {
  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private telegramAuth: TelegramAuthService,
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

    return this.generateTokens({
      ...user,
      telegramId: Number(user.telegramId),
      isChannelMember,
    });
  }

  /**
   * Step 1: User enters their Telegram @username on the website.
   * We look them up in DB (they must have /start'd the bot first),
   * generate a 6-digit code, save to Redis, and send via bot.
   */
  async requestWebCode(username: string) {
    const cleanUsername = username.replace('@', '').trim();
    if (!cleanUsername) {
      throw new BadRequestException('Введите username');
    }

    // Generate 6-digit code
    const code = Array.from({ length: AUTH_CODE_LENGTH }, () =>
      Math.floor(Math.random() * 10),
    ).join('');

    // Store in Redis with TTL
    const redisKey = `auth:code:${cleanUsername.toLowerCase()}`;
    await this.redis.set(redisKey, code, 'EX', AUTH_CODE_TTL_SECONDS);

    // Send code via Telegram bot (will throw BadRequestException if user not found)
    await this.telegramBot.sendAuthCode(cleanUsername, code);

    return { message: 'Code sent to your Telegram' };
  }

  /**
   * Step 2: User enters the 6-digit code from Telegram.
   * We verify it, find (or confirm) the user, and issue JWT tokens.
   */
  async verifyWebCode(username: string, code: string) {
    const cleanUsername = username.replace('@', '').trim().toLowerCase();
    const redisKey = `auth:code:${cleanUsername}`;

    const storedCode = await this.redis.get(redisKey);
    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedException('Неверный или истёкший код');
    }

    // Delete the code after successful verification
    await this.redis.del(redisKey);

    // Find user by username — they exist because sendAuthCode checked this
    const user = await this.prisma.user.findFirst({
      where: {
        telegramUsername: { equals: cleanUsername, mode: 'insensitive' },
      },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Пользователь не найден. Напишите /start боту @bilimhan_bot.',
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
      expiresIn: '7d',
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
