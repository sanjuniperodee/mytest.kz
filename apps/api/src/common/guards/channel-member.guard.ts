import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { TelegramBotService } from '../../modules/telegram/telegram-bot.service';

@Injectable()
export class ChannelMemberGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private telegramBot: TelegramBotService,
    private config: ConfigService,
  ) {}

  private telegramChannelForbidden() {
    return new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        code: 'TELEGRAM_CHANNEL_REQUIRED',
        message: 'Channel subscription required',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  private telegramAccountForbidden() {
    return new HttpException(
      {
        statusCode: HttpStatus.FORBIDDEN,
        error: 'Forbidden',
        code: 'TELEGRAM_ACCOUNT_REQUIRED',
        message: 'Telegram channel membership required',
      },
      HttpStatus.FORBIDDEN,
    );
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.isTelegramChannelRequired();
    if (!required) return true;

    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw this.telegramChannelForbidden();
    }

    // Fast path: token already says user is a member.
    if (user.isChannelMember) return true;

    const dbUser = await this.prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        telegramId: true,
        isChannelMember: true,
        channelCheckedAt: true,
      },
    });

    if (!dbUser) {
      throw this.telegramChannelForbidden();
    }

    // User with no Telegram account — only allow if channel is not required
    if (!dbUser.telegramId) {
      if (required) {
        throw this.telegramAccountForbidden();
      }
      return true;
    }

    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const shouldRecheck =
      !dbUser.channelCheckedAt ||
      dbUser.channelCheckedAt < fiveMinAgo ||
      !dbUser.isChannelMember;

    if (shouldRecheck) {
      const isChannelMember = await this.telegramBot.checkChannelMembership(
        Number(dbUser.telegramId),
      );

      await this.prisma.user.update({
        where: { id: dbUser.id },
        data: {
          isChannelMember,
          channelCheckedAt: new Date(),
        },
      });

      request.user.isChannelMember = isChannelMember;

      if (isChannelMember) {
        return true;
      }

      throw this.telegramChannelForbidden();
    }

    // JWT может отставать позади БД после /users/me — доверяем свежему снимку isChannelMember
    if (dbUser.isChannelMember) {
      request.user.isChannelMember = true;
      return true;
    }

    throw this.telegramChannelForbidden();
  }

  private isTelegramChannelRequired(): boolean {
    const raw = this.config.get<string | boolean>('TELEGRAM_CHANNEL_REQUIRED');
    if (raw === undefined || raw === null || raw === '') return true;
    if (typeof raw === 'boolean') return raw;
    return !['false', '0', 'no', 'off'].includes(raw.trim().toLowerCase());
  }
}
