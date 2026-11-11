import { Inject, Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import * as nodemailer from 'nodemailer';
import { isEmailCodeLoginEnabled } from '../../../common/config/email-code-login';
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

/**
 * Whose budget a message is spent from. Sign-in codes must still go out on a day the lifecycle
 * campaigns have used up everything they are allowed, so they count against their own cap.
 */
export type MailPurpose = 'campaign' | 'auth';

type Transport = { sendMail(message: Record<string, unknown>): Promise<{ messageId?: string }> };

const DEFAULT_DAILY_CAP = 400;
const DEFAULT_AUTH_DAILY_CAP = 20;

/**
 * SMTP sender for lifecycle emails and sign-in codes. Disabled (no-op, logs once) until SMTP_HOST
 * is set. `MAIL_DAILY_CAP` (Asia/Almaty calendar day, counted in Redis) is the total for the
 * provider's limit; while sign-in by mailed code is on, `MAIL_AUTH_DAILY_CAP` of it is reserved for
 * those codes and campaigns get the rest, so the two together never pass the total.
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

  /** Total per day, campaigns and sign-in codes together (the provider's limit). */
  getDailyCap() {
    const raw = Number(this.config.get<string>('MAIL_DAILY_CAP'));
    return Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : DEFAULT_DAILY_CAP;
  }

  /** The part of the total kept for sign-in codes; 0 while that feature is off. */
  getAuthDailyCap() {
    if (!isEmailCodeLoginEnabled(this.config)) return 0;
    const raw = Number(this.config.get<string>('MAIL_AUTH_DAILY_CAP'));
    const wanted = Number.isFinite(raw) && raw >= 0 ? Math.floor(raw) : DEFAULT_AUTH_DAILY_CAP;
    return Math.min(wanted, this.getDailyCap());
  }

  /** What lifecycle campaigns may send per day: the total minus the sign-in reserve. */
  getCampaignDailyCap() {
    return this.getDailyCap() - this.getAuthDailyCap();
  }

  async sentToday(now = new Date(), purpose: MailPurpose = 'campaign') {
    const raw = await this.redis.get(this.counterKey(now, purpose));
    return Number(raw) || 0;
  }

  async hasCapacity(now = new Date()) {
    if (!this.isConfigured()) return false;
    return (await this.sentToday(now)) < this.getCampaignDailyCap();
  }

  /** True when SMTP is set up and today's sign-in code budget is not used up. */
  async hasAuthCapacity(now = new Date()) {
    if (!this.isConfigured()) return false;
    return (await this.sentToday(now, 'auth')) < this.getAuthDailyCap();
  }

  async send(
    message: MailMessage,
    now = new Date(),
    purpose: MailPurpose = 'campaign',
  ): Promise<MailSendResult> {
    if (!this.isConfigured()) {
      this.logDisabledOnce();
      return { status: 'skipped', reason: 'not_configured' };
    }
    if (!(await this.reserveSlot(now, purpose))) {
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

  /** Atomically takes one slot of today's cap for this purpose; false when the cap is reached. */
  private async reserveSlot(now: Date, purpose: MailPurpose) {
    const cap = purpose === 'auth' ? this.getAuthDailyCap() : this.getCampaignDailyCap();
    const key = this.counterKey(now, purpose);
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, 2 * 24 * 3600);
    if (count > cap) {
      await this.redis.decr(key);
      return false;
    }
    return true;
  }

  private counterKey(now: Date, purpose: MailPurpose) {
    const day = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(now);
    return purpose === 'auth' ? `notifications:mail:auth:${day}` : `notifications:mail:sent:${day}`;
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
