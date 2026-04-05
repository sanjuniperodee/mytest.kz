import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { TelegramBotService } from '../../modules/telegram/telegram-bot.service';

@Injectable()
export class ChannelMemberGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private telegramBot: TelegramBotService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user?.id) {
      throw new ForbiddenException('Channel subscription required');
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
      throw new ForbiddenException('Channel subscription required');
    }

    // If DB already has true, trust it and update request user.
    if (dbUser.isChannelMember) {
      request.user.isChannelMember = true;
      return true;
    }

    // Re-check with Telegram if cached status is stale or currently false.
    const fiveMinAgo = new Date(Date.now() - 5 * 60 * 1000);
    const shouldRecheck = !dbUser.channelCheckedAt || dbUser.channelCheckedAt < fiveMinAgo;

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

      if (isChannelMember) {
        request.user.isChannelMember = true;
        return true;
      }
    }

    // Final deny when still not a member after refresh.
    if (!request.user?.isChannelMember) {
      throw new ForbiddenException('Channel subscription required');
    }

    return true;
  }
}
