import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import { REDIS_CLIENT } from '../../../database/redis.module';

export interface MailMessage {
  to: string;
  subject: string;
  html: string;
  text: string;
  /** One-click unsubscribe URL (RFC 8058): adds List-Unsubscribe + List-Unsubscribe-Post. */
  unsubscribeUrl?: string;
}

export type MailSendResult =
  | { status: 'sent'; messageId: string | null }
  | { status: 'skipped'; reason: 'not_configured' | 'daily_cap' };

type Transport = { sendMail(message: Record<string, unknown>): Promise<{ messageId?: string }> };

const DEFAULT_DAILY_CAP = 400;

/**
 * SMTP sender for lifecycle emails. Disabled (no-op, logs once) until SMTP_HOST is set.
 * A daily cap (MAIL_DAILY_CAP, Asia/Almaty calendar day, counted in Redis) keeps us
 * under the Gmail SMTP limit (~500/day).
 */
@Injectable()
export class MailerService implements OnModuleInit {
  private readonly logger = new Logger(MailerService.name);
  private transport: Transport | null = null;
  private loggedDisabled = false;

  constructor(
    private readonly config: ConfigService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  onModuleInit() {
    if (!this.isConfigured()) this.logDisabledOnce();
  }

  isConfigured() {
    return Boolean(this.host());
  }

  getDailyCap() {
    const raw = Number(this.config.get<string>('MAIL_DAILY_CAP'));
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : DEFAULT_DAILY_CAP;
  }

  async sentToday(now = new Date()) {
    const raw = await this.redis.get(this.counterKey(now));
    return Number(raw) || 0;
  }

  async hasCapacity(now = new Date()) {
    if (!this.isConfigured()) return false;
    return (await this.sentToday(now)) < this.getDailyCap();
  }

  async send(message: MailMessage, now = new Date()): Promise<MailSendResult> {
    if (!this.isConfigured()) {
      this.logDisabledOnce();
      return { status: 'skipped', reason: 'not_configured' };
    }
    if (!(await this.reserveSlot(now))) {
      return { status: 'skipped', reason: 'daily_cap' };
    }

    const headers: Record<string, string> = {};
    if (message.unsubscribeUrl) {
      headers['List-Unsubscribe'] = `<${message.unsubscribeUrl}>`;
      headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click';
    }
    const info = await this.getTransport().sendMail({
      from: this.from(),
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      headers,
      disableFileAccess: true,
      disableUrlAccess: true,
    });
    return { status: 'sent', messageId: info?.messageId ?? null };
  }

  /** Atomically takes one slot of today's cap; false when the cap is reached. */
  private async reserveSlot(now: Date) {
    const cap = this.getDailyCap();
    const key = this.counterKey(now);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 2 * 24 * 3600);
    if (count > cap) {
      await this.redis.decr(key);
      return false;
    }
    return true;
  }

  private counterKey(now: Date) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(now);
    return `notifications:mail:sent:${day}`;
  }

  private getTransport(): Transport {
    if (this.transport) return this.transport;
    const port = Number(this.config.get<string>('SMTP_PORT')) || 465;
    const rawSecure = (this.config.get<string>('SMTP_SECURE') ?? '').trim().toLowerCase();
    const secure = rawSecure ? ['1', 'true', 'yes', 'on'].includes(rawSecure) : port === 465;
    const user = (this.config.get<string>('SMTP_USER') ?? '').trim();
    const pass = this.config.get<string>('SMTP_PASS') ?? '';
    this.transport = nodemailer.createTransport({
      host: this.host(),
      port,
      secure,
      auth: user ? { user, pass } : undefined,
      pool: true,
      maxConnections: 2,
      maxMessages: 100,
      connectionTimeout: 15_000,
      greetingTimeout: 10_000,
      socketTimeout: 30_000,
    }) as unknown as Transport;
    return this.transport;
  }

  private from() {
    const configured = (this.config.get<string>('MAIL_FROM') ?? '').trim();
    if (configured) return configured;
    const user = (this.config.get<string>('SMTP_USER') ?? '').trim();
    return user ? `"mytest" <${user}>` : 'mytest <no-reply@my-test.kz>';
  }

  private host() {
    return (this.config.get<string>('SMTP_HOST') ?? '').trim();
  }

  private logDisabledOnce() {
    if (this.loggedDisabled) return;
    this.loggedDisabled = true;
    this.logger.log('SMTP_HOST is not set — email notifications are disabled.');
  }
}
