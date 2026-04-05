import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Telegraf, Markup } from 'telegraf';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';
import { normalizeKzPhone } from '@bilimland/shared';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot: Telegraf;
  private channelId: string;
  private readonly logger = new Logger(TelegramBotService.name);

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {
    const token = config.get<string>('TELEGRAM_BOT_TOKEN', '');
    this.bot = new Telegraf(token);
    this.channelId = config.get<string>('TELEGRAM_CHANNEL_ID', '');
  }

  async onModuleInit() {
    const contactKb = Markup.keyboard([
      [Markup.button.contactRequest('📱 Поделиться номером')],
    ])
      .resize()
      .oneTime();

    this.bot.start(async (ctx) => {
      const tgUser = ctx.from;
      if (!tgUser) return;

      try {
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
          '👋 Добро пожаловать в MyTest!\n\n' +
            'Укажите номер телефона в боте — сразу после сохранения мы отправим код сюда. Затем на сайте введите тот же номер и код.',
          contactKb,
        );
      } catch (error) {
        this.logger.error(`Error handling /start for ${tgUser.id}: ${error}`);
        await ctx.reply('Произошла ошибка. Попробуйте ещё раз.');
      }
    });

    this.bot.on('message', async (ctx, next) => {
      if (!ctx.message || !ctx.from) return next();

      const from = ctx.from;
      let normalized: string | null = null;

      if ('contact' in ctx.message) {
        const contact = ctx.message.contact;
        if (contact.user_id !== undefined && contact.user_id !== from.id) {
          await ctx.reply('Используйте кнопку и отправьте свой номер телефона.');
          return;
        }
        normalized = normalizeKzPhone(contact.phone_number);
        if (!normalized) {
          await ctx.reply('Не удалось распознать номер. Попробуйте ещё раз.');
          return;
        }
      } else if ('text' in ctx.message) {
        const text = ctx.message.text.trim();
        if (text.startsWith('/')) return next();
        normalized = normalizeKzPhone(text);
        if (!normalized) return next();
      } else {
        return next();
      }

      try {
        await this.prisma.user.update({
          where: { telegramId: BigInt(from.id) },
          data: { phone: normalized },
        });
        try {
          await this.authService.requestWebCode(normalized);
        } catch (sendErr) {
          this.logger.error(`requestWebCode after phone save failed: ${sendErr}`);
          await ctx.reply(
            '✅ Номер сохранён. Код не удалось отправить — нажмите «Отправить код» на сайте.',
            { reply_markup: { remove_keyboard: true } },
          );
          return;
        }
        await ctx.reply(
          '✅ Номер сохранён. Код для входа отправлен в этот чат. На сайте введите тот же номер и код.',
          { reply_markup: { remove_keyboard: true } },
        );
      } catch (e) {
        if (e instanceof PrismaClientKnownRequestError && e.code === 'P2002') {
          await ctx.reply(
            'Этот номер уже привязан к другому аккаунту. Если это ошибка, напишите в поддержку.',
          );
          return;
        }
        this.logger.error(`Failed to save phone for ${from.id}: ${e}`);
        await ctx.reply('Не удалось сохранить номер. Попробуйте позже.');
      }
    });

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

  /** Send login code to an existing Telegram chat. */
  async sendAuthCodeToTelegram(telegramId: bigint, code: string): Promise<void> {
    try {
      await this.bot.telegram.sendMessage(
        Number(telegramId),
        `🔐 Код для входа в MyTest: *${code}*\n\nКод действителен 5 минут.`,
        { parse_mode: 'Markdown' },
      );
    } catch (error) {
      this.logger.error(`Failed to send auth code to telegramId ${telegramId}: ${error}`);
      throw new BadRequestException(
        'Не удалось отправить код. Откройте бота @bilimhan_bot по ссылке с сайта и укажите номер.',
      );
    }
  }
}
