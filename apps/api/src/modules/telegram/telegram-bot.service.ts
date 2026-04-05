import { Injectable, Logger, OnModuleInit, BadRequestException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf } from 'telegraf';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot: Telegraf;
  private channelId: string;
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
  ) {
    const token = config.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.bot = new Telegraf(token);
    this.channelId = config.get<string>('TELEGRAM_CHANNEL_ID', '');
  }

  async onModuleInit() {
    // Handle /start — save the user's chatId so we can send them codes later
    this.bot.start(async (ctx) => {
      const tgUser = ctx.from;
      if (!tgUser) return;

      try {
        // Upsert user: create if doesn't exist, update username/name if it does
        await this.prisma.user.upsert({
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

        await ctx.reply(
          '👋 Добро пожаловать в BilimLand!\n\n' +
          'Теперь вы можете войти на сайт через свой Telegram username.\n\n' +
          '1️⃣ Зайдите на сайт\n' +
          '2️⃣ Введите ваш @username\n' +
          '3️⃣ Получите код подтверждения сюда\n\n' +
          '📚 Удачи в подготовке!',
        );
      } catch (error) {
        this.logger.error(`Error handling /start for ${tgUser.id}: ${error}`);
        await ctx.reply('Произошла ошибка. Попробуйте ещё раз.');
      }
    });

    // Launch bot in polling mode (non-blocking)
    this.bot.launch().catch((err) => {
      this.logger.error(`Failed to launch Telegram bot: ${err}`);
    });

    this.logger.log('Telegram bot started');

    const safeStop = (signal: NodeJS.Signals) => {
      try {
        this.bot.stop(signal);
      } catch {
        /* telegraf throws if bot was not running */
      }
    };
    process.once('SIGINT', () => safeStop('SIGINT'));
    process.once('SIGTERM', () => safeStop('SIGTERM'));
  }

  async checkChannelMembership(telegramUserId: number): Promise<boolean> {
    try {
      const member = await this.bot.telegram.getChatMember(
        this.channelId,
        telegramUserId,
      );
      return ['member', 'administrator', 'creator'].includes(member.status);
    } catch (error) {
      this.logger.warn(
        `Failed to check channel membership for ${telegramUserId}: ${error}`,
      );
      return false;
    }
  }

  /**
   * Send auth code to user by their Telegram username.
   * User must have pressed /start in the bot first (so we have their chatId).
   */
  async sendAuthCode(username: string, code: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: {
        telegramUsername: { equals: username, mode: 'insensitive' },
      },
    });

    if (!user) {
      throw new BadRequestException(
        'Пользователь не найден. Сначала напишите /start боту @bilimhan_bot в Telegram.',
      );
    }

    try {
      await this.bot.telegram.sendMessage(
        Number(user.telegramId),
        `🔐 Ваш код для входа в BilimLand: *${code}*\n\nКод действителен 5 минут.`,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      this.logger.error(`Failed to send auth code to @${username}: ${error}`);
      throw new BadRequestException(
        'Не удалось отправить код. Убедитесь что вы написали /start боту @bilimhan_bot.',
      );
    }
  }

  /**
   * Resolve a Telegram username to a user record.
   * Creates the user if they pressed /start (exist in DB).
   */
  async findUserByUsername(username: string) {
    return this.prisma.user.findFirst({
      where: {
        telegramUsername: { equals: username, mode: 'insensitive' },
      },
    });
  }
}
