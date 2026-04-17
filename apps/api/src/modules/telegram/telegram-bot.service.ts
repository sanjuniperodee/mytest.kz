import {
  Injectable,
  Logger,
  OnModuleInit,
  BadRequestException,
  Inject,
  forwardRef,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Context, Telegraf, Markup } from 'telegraf';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { PrismaService } from '../../database/prisma.service';
import { normalizeKzPhone } from '@bilimland/shared';
import { AuthService } from '../auth/auth.service';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot: Telegraf | null = null;
  private channelId: string;
  /** HTTPS origin of the Mini App (Bot API WebAppInfo.url), same as public site. */
  private readonly webAppUrl: string;
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly botToken: string;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {
    this.botToken = (config.get<string>('TELEGRAM_BOT_TOKEN', '') || '').trim();
    this.channelId = config.get<string>('TELEGRAM_CHANNEL_ID', '');
    const raw =
      config.get<string>('TELEGRAM_WEB_APP_URL') || 'https://my-test.kz/login';
    this.webAppUrl = raw.replace(/\/+$/, '');
  }

  /** Inline «Открыть» — для сообщений с кодом (сайт). */
  private openAppInlineKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Открыть MyTest', this.webAppUrl)],
    ]);
  }

  /**
   * Одна reply-клавиатура: WebApp + контакт (в одном сообщении с /start, без второго «шума»).
   * Без oneTime — пользователь может сначала открыть приложение, потом отправить номер.
   */
  private mainReplyKeyboard() {
    return Markup.keyboard([
      [Markup.button.webApp('🚀 Открыть MyTest', this.webAppUrl)],
      [Markup.button.contactRequest('📱 Номер для входа на сайте')],
    ]).resize();
  }

  /** /start и то же самое по смыслу (Telegram команда — только со слэшем). */
  private async sendStartWelcome(ctx: Context) {
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
        '👋 <b>MyTest</b>\n\n' +
          '• <b>Мини-приложение</b> — первая кнопка.\n' +
          '• <b>Вход с сайта</b> — вторая кнопка: поделитесь номером казахстанского оператора. ' +
          'Код для входа придёт <i>в этот же чат</i> одним сообщением.',
        {
          parse_mode: 'HTML',
          ...this.mainReplyKeyboard(),
        },
      );
    } catch (error) {
      this.logger.error(`Error handling /start for ${tgUser.id}: ${error}`);
      await ctx.reply('Произошла ошибка. Попробуйте ещё раз.');
    }
  }

  async onModuleInit() {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN пуст — бот не запускается.');
      return;
    }

    this.bot = new Telegraf(this.botToken);

    this.bot.start(async (ctx) => {
      await this.sendStartWelcome(ctx);
    });

    /**
     * Сообщения вида «буду /start», «hi /start» — без entity bot_command, поэтому `bot.start` не срабатывает.
     * Реагируем, если `/start` есть в конце после пробела (кроме случаев с длинным «хвостом» после /start).
     */
    this.bot.on('text', async (ctx, next) => {
      const raw = ctx.message?.text?.trim() ?? '';
      if (!raw || raw.startsWith('//')) return next();
      const startTail = /^(.+)\s\/start(@[A-Za-z0-9_]*)?(?:\s+(\S.*))?$/i.exec(raw);
      if (!startTail) return next();
      const payload = startTail[3]?.trim();
      if (payload && payload.length > 64) return next();
      await this.sendStartWelcome(ctx);
    });

    this.bot.on('message', async (ctx, next) => {
      if (!ctx.message || !ctx.from) return next();

      const from = ctx.from;
      let normalized: string | null = null;

      if ('contact' in ctx.message) {
        const contact = ctx.message.contact;
        if (contact.user_id !== undefined && contact.user_id !== from.id) {
          await ctx.reply('Отправьте именно <b>свой</b> контакт через кнопку.', {
            parse_mode: 'HTML',
          });
          return;
        }
        normalized = normalizeKzPhone(contact.phone_number);
        if (!normalized) {
          await ctx.reply('Не удалось распознать номер. Нужен номер оператора KZ.');
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
          await this.authService.requestWebCode(normalized, { fromTelegramBot: true });
        } catch (sendErr) {
          this.logger.error(`requestWebCode after phone save failed: ${sendErr}`);
          await ctx.reply(
            'Номер сохранён, но код не отправился. Нажмите «Отправить код» на сайте или /start.',
            Markup.removeKeyboard(),
          );
          return;
        }
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
        this.bot?.stop(signal);
      } catch {
        /* telegraf throws if bot was not running */
      }
    };
    process.once('SIGINT', () => safeStop('SIGINT'));
    process.once('SIGTERM', () => safeStop('SIGTERM'));
  }

  async checkChannelMembership(telegramUserId: number): Promise<boolean> {
    if (!this.bot) return false;
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
   * Код входа в Telegram. HTML — без конфликтов с символами в коде.
   * includePhoneLinkedAck — префикс при привязке номера из бота (одно сообщение вместо двух).
   */
  async sendAuthCodeToTelegram(
    telegramId: bigint,
    code: string,
    options?: { includePhoneLinkedAck?: boolean },
  ): Promise<void> {
    if (!this.bot) {
      this.logger.warn('sendAuthCodeToTelegram: бот не запущен');
      throw new BadRequestException('Telegram-бот недоступен.');
    }
    const ack = options?.includePhoneLinkedAck
      ? '✅ <b>Номер сохранён.</b> На сайте введите тот же номер и код ниже.\n\n'
      : '';
    const body =
      ack +
      `<b>🔐 Код для входа в MyTest:</b> <code>${code}</code>\n\n` +
      `Код действителен 5 минут.`;
    try {
      await this.bot.telegram.sendMessage(Number(telegramId), body, {
        parse_mode: 'HTML',
        ...this.openAppInlineKeyboard(),
      });
    } catch (error) {
      this.logger.error(`Failed to send auth code to telegramId ${telegramId}: ${error}`);
      throw new BadRequestException(
        'Не удалось отправить код. Откройте бота @bilimhan_bot по ссылке с сайта и укажите номер.',
      );
    }
  }
}
