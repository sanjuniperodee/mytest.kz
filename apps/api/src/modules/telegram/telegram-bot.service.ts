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

/** `users.id` для личного уведомления админа о заявке с лендинга; пустой `LEAD_NOTIFY_USER_ID` отключает поиск в БД. */
const DEFAULT_LEAD_NOTIFY_USER_ID = '22f36334-d7ac-435f-a834-a6bdb4349217';

@Injectable()
export class TelegramBotService implements OnModuleInit {
  private bot: Telegraf | null = null;
  private channelId: string;
  private readonly leadAdminChatId: string;
  private readonly leadAdminUsername: string;
  /** If non-empty: load `users.telegram_id` by this UUID and DM the lead there. */
  private readonly leadNotifyUserId: string;
  /** HTTPS origin of the Mini App (Bot API WebAppInfo.url), same as public site. */
  private readonly webAppUrl: string;
  private readonly logger = new Logger(TelegramBotService.name);
  private readonly botToken: string;
  private isUpdateLoopRunning = false;
  private launchInProgress = false;
  private launchRetryTimer: NodeJS.Timeout | null = null;
  private launchRetryAttempt = 0;

  constructor(
    private config: ConfigService,
    private prisma: PrismaService,
    @Inject(forwardRef(() => AuthService))
    private authService: AuthService,
  ) {
    this.botToken = (config.get<string>('TELEGRAM_BOT_TOKEN', '') || '').trim();
    this.channelId = config.get<string>('TELEGRAM_CHANNEL_ID', '');
    this.leadAdminChatId = (config.get<string>('TELEGRAM_ADMIN_CHAT_ID') || '').trim();
    this.leadAdminUsername =
      (config.get<string>('TELEGRAM_ADMIN_USERNAME') || '@sanjuniperodee').trim();
    const leadNotifyFromEnv = config.get<string>('LEAD_NOTIFY_USER_ID');
    this.leadNotifyUserId =
      leadNotifyFromEnv !== undefined && leadNotifyFromEnv !== null
        ? leadNotifyFromEnv.trim()
        : DEFAULT_LEAD_NOTIFY_USER_ID;
    const raw =
      config.get<string>('TELEGRAM_WEB_APP_URL') || 'https://www.my-test.kz/login';
    this.webAppUrl = raw.replace(/\/+$/, '');
  }

  /** Chat id (numeric) or @username for lead notifications. */
  private async resolveLeadNotificationTarget(): Promise<string | number> {
    if (this.leadNotifyUserId) {
      const user = await this.prisma.user.findUnique({
        where: { id: this.leadNotifyUserId },
        select: { telegramId: true },
      });
      if (user) {
        return Number(user.telegramId);
      }
      this.logger.warn(
        `LEAD_NOTIFY_USER_ID=${this.leadNotifyUserId}: пользователь не найден, используем TELEGRAM_ADMIN_*`,
      );
    }
    const fallback = this.leadAdminChatId || this.leadAdminUsername;
    if (!fallback) {
      throw new BadRequestException(
        'Не настроен получатель заявок: задайте LEAD_NOTIFY_USER_ID (users.id) или TELEGRAM_ADMIN_CHAT_ID / TELEGRAM_ADMIN_USERNAME.',
      );
    }
    return fallback;
  }

  private escapeHtml(input: string): string {
    return input
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  /** Inline «Открыть» — для сообщений с кодом (сайт). */
  private openAppInlineKeyboard() {
    return Markup.inlineKeyboard([
      [Markup.button.webApp('🚀 Открыть MyTest', this.webAppUrl)],
    ]);
  }

  /**
   * Reply-клавиатура для пользователей с уже привязанным номером:
   * WebApp + возможность обновить номер.
   */
  private mainReplyKeyboard() {
    return Markup.keyboard([
      [Markup.button.webApp('🚀 Открыть MyTest', this.webAppUrl)],
      [Markup.button.contactRequest('📱 Обновить номер телефона')],
    ]).resize();
  }

  /**
   * Reply-клавиатура для первичного онбординга:
   * до номера не показываем кнопку WebApp, чтобы не ронять пользователя в непонятный login-loop.
   */
  private contactOnlyKeyboard() {
    return Markup.keyboard([
      [Markup.button.contactRequest('📱 Поделиться номером')],
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

      const user = await this.prisma.user.findUnique({
        where: { telegramId: BigInt(tgUser.id) },
        select: { phone: true },
      });

      if (user?.phone) {
        await ctx.reply(
          '✅ <b>Номер уже привязан.</b>\n\n' +
            'Нажмите <b>«Открыть MyTest»</b> — вход в мини-приложение выполнится автоматически.\n' +
            'Если хотите поменять номер для входа на сайте, используйте кнопку ниже.',
          {
            parse_mode: 'HTML',
            ...this.mainReplyKeyboard(),
          },
        );
        return;
      }

      await ctx.reply(
        '👋 <b>Добро пожаловать в MyTest</b>\n\n' +
          'Чтобы включить вход и открыть приложение:\n' +
          '1) Нажмите <b>«Поделиться номером»</b>\n' +
          '2) Отправьте <b>свой</b> номер KZ через кнопку\n' +
          '3) После этого появится кнопка <b>«Открыть MyTest»</b>, и вход будет работать сразу',
        {
          parse_mode: 'HTML',
          ...this.contactOnlyKeyboard(),
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
    this.bot.catch((err, ctx) => {
      this.logger.error(
        `Unhandled Telegram update error (updateId=${ctx.update?.update_id ?? 'n/a'}): ${err}`,
      );
    });

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
        await this.prisma.user.upsert({
          where: { telegramId: BigInt(from.id) },
          update: {
            telegramUsername: from.username || null,
            firstName: from.first_name,
            lastName: from.last_name || null,
            phone: normalized,
          },
          create: {
            telegramId: BigInt(from.id),
            telegramUsername: from.username || null,
            firstName: from.first_name,
            lastName: from.last_name || null,
            preferredLanguage: from.language_code === 'kk' ? 'kk' : 'ru',
            phone: normalized,
          },
        });
        await ctx.reply(
          '✅ <b>Номер сохранён.</b>\n\n' +
            'Теперь нажмите <b>«Открыть MyTest»</b> — вход в мини-приложение выполнится автоматически.',
          {
            parse_mode: 'HTML',
            ...this.mainReplyKeyboard(),
          },
        );
        try {
          await this.authService.requestWebCode(normalized, { fromTelegramBot: true });
        } catch (sendErr) {
          this.logger.error(`requestWebCode after phone save failed: ${sendErr}`);
          await ctx.reply(
            'Номер сохранён, но код не отправился. Используйте вход через мини-приложение или попробуйте ещё раз /start.',
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

    // Never block Nest bootstrap on Telegram network operations.
    // If Telegram is slow/unreachable, API should still start and serve HTTP.
    void this.launchBotUpdateLoop();

    const safeStop = (signal: NodeJS.Signals) => {
      try {
        this.bot?.stop(signal);
      } catch {
        /* telegraf throws if bot was not running */
      }
      if (this.launchRetryTimer) {
        clearTimeout(this.launchRetryTimer);
        this.launchRetryTimer = null;
      }
      this.isUpdateLoopRunning = false;
      this.launchInProgress = false;
    };
    process.once('SIGINT', () => safeStop('SIGINT'));
    process.once('SIGTERM', () => safeStop('SIGTERM'));
  }

  private async withTimeout<T>(
    p: Promise<T>,
    ms: number,
    label: string,
  ): Promise<T> {
    let timer: NodeJS.Timeout | null = null;
    try {
      return (await Promise.race([
        p,
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(`Timeout after ${ms}ms during ${label}`)),
            ms,
          );
        }),
      ])) as T;
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async launchBotUpdateLoop() {
    if (!this.bot) return;
    if (this.isUpdateLoopRunning || this.launchInProgress) return;
    this.launchInProgress = true;
    const startedAt = Date.now();
    const pendingWarn = setTimeout(() => {
      if (!this.isUpdateLoopRunning) {
        this.logger.warn(
          'Telegram launch still pending (>15s). API remains healthy, but bot update loop is waiting on Telegram network/API.',
        );
      }
    }, 15000);
    try {
      this.logger.log('Telegram launch: checking bot token via getMe...');
      try {
        const me = await this.withTimeout(
          this.bot.telegram.getMe(),
          10000,
          'telegram.getMe',
        );
        this.bot.botInfo = me;
        this.logger.log(
          `Telegram launch: authenticated as @${me.username ?? me.id}`,
        );
      } catch (err) {
        this.logger.warn(`Telegram launch: getMe check failed: ${err}`);
      }

      this.logger.log('Telegram launch: deleting webhook (if any)...');
      try {
        await this.withTimeout(
          this.bot.telegram.deleteWebhook({ drop_pending_updates: false }),
          10000,
          'telegram.deleteWebhook',
        );
        this.logger.log('Telegram launch: webhook cleared');
      } catch (err) {
        this.logger.warn(
          `Telegram launch: deleteWebhook failed (continuing): ${err}`,
        );
      }

      this.logger.log('Telegram launch: starting update loop...');
      // Telegraf v4 long polling launch promise does not resolve while polling is active.
      // Use onLaunch callback to mark successful startup and avoid awaiting forever.
      const launchPromise = this.bot.launch(
        { dropPendingUpdates: false },
        () => {
          this.isUpdateLoopRunning = true;
          this.launchInProgress = false;
          this.launchRetryAttempt = 0;
          clearTimeout(pendingWarn);
          this.logger.log(
            `Telegram bot update loop is running (startup ${Date.now() - startedAt}ms)`,
          );
        },
      );

      void launchPromise.catch((err) => {
        const msg = String(err);
        this.isUpdateLoopRunning = false;
        this.launchInProgress = false;
        clearTimeout(pendingWarn);
        this.logger.error(`Failed to launch Telegram bot update loop: ${msg}`);
        if (
          msg.includes('409') ||
          msg.includes('Conflict') ||
          msg.includes('getUpdates') ||
          msg.includes('webhook')
        ) {
          this.logger.error(
            'Telegram updates conflict detected. Usually this means webhook is still active or another bot instance is polling updates.',
          );
        }
        this.scheduleLaunchRetry();
      });
      return;
    } catch (err) {
      const msg = String(err);
      this.isUpdateLoopRunning = false;
      this.launchInProgress = false;
      clearTimeout(pendingWarn);
      this.logger.error(`Failed to launch Telegram bot update loop: ${msg}`);
      if (
        msg.includes('409') ||
        msg.includes('Conflict') ||
        msg.includes('getUpdates') ||
        msg.includes('webhook')
      ) {
        this.logger.error(
          'Telegram updates conflict detected. Usually this means webhook is still active or another bot instance is polling updates.',
        );
      }
      this.scheduleLaunchRetry();
    }
  }

  private scheduleLaunchRetry() {
    if (this.launchRetryTimer) return;
    this.launchRetryAttempt += 1;
    const delayMs = Math.min(30000, 5000 * this.launchRetryAttempt);
    this.logger.warn(`Retrying Telegram launch in ${delayMs}ms`);
    this.launchRetryTimer = setTimeout(() => {
      this.launchRetryTimer = null;
      void this.launchBotUpdateLoop();
    }, delayMs);
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
    if (!this.isUpdateLoopRunning) {
      this.logger.warn(
        'sendAuthCodeToTelegram: update loop is not running; bot can send messages but may not receive /start or replies',
      );
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

  async sendLeadNotificationToAdmin(payload: {
    name: string;
    phone: string;
    message?: string | null;
    source?: string;
    ip?: string;
    userAgent?: string;
  }): Promise<void> {
    if (!this.bot) {
      this.logger.warn('sendLeadNotificationToAdmin: бот не запущен');
      throw new BadRequestException('Telegram-бот недоступен.');
    }
    const target = await this.resolveLeadNotificationTarget();
    const body = [
      '📩 <b>Новая заявка с лендинга</b>',
      '',
      `<b>Имя:</b> ${this.escapeHtml(payload.name)}`,
      `<b>Телефон:</b> <code>${this.escapeHtml(payload.phone)}</code>`,
      payload.message
        ? `<b>Сообщение:</b> ${this.escapeHtml(payload.message)}`
        : '<b>Сообщение:</b> —',
      payload.source ? `<b>Источник:</b> ${this.escapeHtml(payload.source)}` : null,
      payload.ip ? `<b>IP:</b> <code>${this.escapeHtml(payload.ip)}</code>` : null,
      payload.userAgent
        ? `<b>User-Agent:</b> ${this.escapeHtml(payload.userAgent)}`
        : null,
    ]
      .filter(Boolean)
      .join('\n');

    try {
      await this.bot.telegram.sendMessage(target, body, {
        parse_mode: 'HTML',
      });
    } catch (error) {
      this.logger.error(
        `Failed to send lead notification to ${target}: ${error}`,
      );
      throw new BadRequestException(
        'Не удалось отправить заявку в Telegram. Проверьте, что админ открыл бота.',
      );
    }
  }
}
