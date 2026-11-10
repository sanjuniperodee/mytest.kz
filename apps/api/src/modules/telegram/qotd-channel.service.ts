import { Injectable, Logger, OnModuleDestroy, OnModuleInit, Inject, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';
import { TelegramBotService } from './telegram-bot.service';

type Qotd = {
  key: string;
  date: string;
  subject: { ru: string };
  topic: { name: string; href: string };
  stemHtml: string;
  optionsHtml: string[];
  correct: number;
  explanationHtml: string;
  /** `openstax` — вопрос адаптирован по учебникам OpenStax (CC BY 4.0). */
  source?: 'openstax' | null;
};

/**
 * Строка об источнике для поста в канал (Telegram HTML) или '' — если указывать нечего.
 * CC BY 4.0 требует называть источник везде, где показан вопрос; текст тот же, что на сайте.
 */
export function qotdSourceHtml(source: Qotd['source'], siteUrl: string): string {
  if (source !== 'openstax') return '';
  return `Источник: <a href="${siteUrl}/istochniki#openstax">адаптировано по учебникам OpenStax, CC BY 4.0</a>`;
}

/** HTML вопроса → обычный текст для Telegram. Вопросы с формулами (KaTeX) пропускаем. */
export function qotdPlainText(html: string): string | null {
  if (/class="katex|<math|<svg/i.test(html)) return null;
  return html
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|li)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

/** Сегодняшняя дата и час по Алматы. */
function almatyNow(): { date: string; hour: number } {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Almaty',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    hour12: false,
  }).formatToParts(new Date());
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  return { date: `${get('year')}-${get('month')}-${get('day')}`, hour: Number(get('hour')) % 24 };
}

/**
 * Каждое утро публикует «Вопрос дня» в Telegram-канал викториной + ссылкой на открытый
 * тест по теме. Включается только `QOTD_CHANNEL_ENABLED=true` (публикация от имени
 * проекта). Один пост в день: отметка в Redis.
 */
@Injectable()
export class QotdChannelService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(QotdChannelService.name);
  private timer: NodeJS.Timeout | null = null;
  private readonly enabled: boolean;
  private readonly hour: number;
  private readonly siteUrl: string;

  constructor(
    private readonly telegram: TelegramBotService,
    config: ConfigService,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {
    this.enabled = String(config.get('QOTD_CHANNEL_ENABLED') ?? '').toLowerCase() === 'true';
    this.hour = Number(config.get('QOTD_CHANNEL_HOUR_ALMATY') ?? 9);
    this.siteUrl = (config.get<string>('PUBLIC_SITE_URL') || 'https://my-test.kz').replace(/\/+$/, '');
  }

  onModuleInit() {
    if (!this.enabled) {
      this.logger.log('Question-of-the-day channel posts disabled (QOTD_CHANNEL_ENABLED)');
      return;
    }
    this.timer = setInterval(() => void this.tick().catch((e) => this.logger.warn(String(e))), 10 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async tick(): Promise<'posted' | 'skipped'> {
    const { date, hour } = almatyNow();
    if (hour < this.hour || !this.redis) return 'skipped';
    const lock = await this.redis.set(`qotd-channel:${date}`, '1', 'EX', 60 * 60 * 30, 'NX');
    if (lock !== 'OK') return 'skipped';
    try {
      const res = await fetch(`${this.siteUrl}/api/qotd?date=${date}`, { signal: AbortSignal.timeout(15000) });
      if (!res.ok) throw new Error(`qotd ${res.status}`);
      const q = (await res.json()) as Qotd;
      const question = qotdPlainText(q.stemHtml);
      const options = q.optionsHtml.map(qotdPlainText);
      const explanation = qotdPlainText(q.explanationHtml) ?? undefined;
      const source = qotdSourceHtml(q.source, this.siteUrl);
      if (!question || options.some((o) => !o) || question.length > 300 || options.some((o) => (o as string).length > 100)) {
        this.logger.log(`QOTD ${date} has formulas or is too long for a Telegram quiz — posting a link only`);
        await this.telegram.notifyChannelText(
          `🧠 <b>Вопрос дня · ${this.escape(q.subject.ru)}</b>\n\nРеши на сайте и проверь себя: ${this.siteUrl}${q.topic.href}` +
            (source ? `\n\n${source}` : ''),
        );
        return 'posted';
      }
      const posted = await this.telegram.postQuizToChannel({
        // Без числа вопросов: в теме их от 5 до 10.
        intro:
          `🧠 <b>Вопрос дня · ${this.escape(q.subject.ru)}</b>\nТема: ${this.escape(q.topic.name)}. Ещё вопросы по теме с разбором — бесплатно: ${this.siteUrl}${q.topic.href}` +
          (source ? `\n${source}` : ''),
        question,
        options: options as string[],
        correctIndex: q.correct,
        explanation: explanation && explanation.length <= 200 ? explanation : undefined,
      });
      return posted ? 'posted' : 'skipped';
    } catch (error) {
      await this.redis.del(`qotd-channel:${date}`);
      throw error;
    }
  }

  private escape(v: string) {
    return this.telegram.escapeForTelegram(v);
  }
}
