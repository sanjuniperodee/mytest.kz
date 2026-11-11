import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomInt, timingSafeEqual } from 'crypto';
import Redis from 'ioredis';
import { isEmailCodeLoginEnabled } from '../../common/config/email-code-login';
import { getRequiredConfig } from '../../common/config/required-config';
import { PrismaService } from '../../database/prisma.service';
import { REDIS_CLIENT } from '../../database/redis.module';
import { MailerService } from '../notifications/channels/mailer.service';
import {
  LOGIN_CODE_MINUTES,
  loginCodeLanguage,
  renderLoginCodeEmail,
} from './email-code.mail';

const CODE_LENGTH = 6;
const CODE_TTL_SECONDS = LOGIN_CODE_MINUTES * 60;
/** Wrong tries a single code survives. A new code starts again, bounded by the per-address limits. */
const MAX_TRIES_PER_CODE = 5;
const RESEND_SECONDS = 60;
const MAX_REQUESTS_PER_ADDRESS_HOUR = 3;
const MAX_REQUESTS_PER_ADDRESS_DAY = 6;
/**
 * Per IP, on top of the controller's per-minute throttle. Loose on purpose: the API may see one
 * address for many website visitors (Next proxy), and the per-address limits do the real work.
 */
const MAX_REQUESTS_PER_IP_HOUR = 20;

const HOUR_SECONDS = 60 * 60;
const DAY_SECONDS = 24 * HOUR_SECONDS;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const INVALID_CODE_MESSAGE = 'Неверный или истёкший код';

export function normalizeLoginEmail(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const email = raw.trim().toLowerCase();
  return email.length <= 254 && EMAIL_RE.test(email) ? email : null;
}

type CodeRecord = { userId: string; mac: string };

/**
 * One-time code mailed to an address: the second proof of email ownership next to Google sign-in
 * (see `hasUnprovenEmailAccess`). This service only issues and checks codes; what a correct code
 * does to the account is `AuthService.verifyEmailCode`.
 *
 * Nothing here may tell a stranger whether an address has an account: `request` answers and limits
 * every well-formed address alike, and every failure of `consume` is the same 401.
 */
@Injectable()
export class EmailCodeService {
  private readonly logger = new Logger(EmailCodeService.name);

  constructor(
    private readonly config: ConfigService,
    private readonly prisma: PrismaService,
    private readonly mailer: MailerService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  isEnabled() {
    return isEmailCodeLoginEnabled(this.config);
  }

  async request(rawEmail: unknown, ip?: string) {
    this.assertEnabled();
    const email = normalizeLoginEmail(rawEmail);
    if (!email) throw new BadRequestException('Введите корректный email');

    // Limits and the mail budget come before the account lookup, so a refusal means the same for an
    // address with an account and for one without.
    await this.takeIpSlot(ip);
    await this.takeAddressSlots(email);
    if (!(await this.mailer.hasAuthCapacity())) throw this.unavailable();

    // Only accounts without Google: a Google id is a stronger tie than a mailbox, and it keeps the
    // site from mailing codes to every ordinary user whose address someone types in.
    const user = await this.prisma.user.findFirst({
      where: { email, googleId: null },
      select: { id: true, preferredLanguage: true },
    });
    if (user) {
      const code = Array.from({ length: CODE_LENGTH }, () => randomInt(0, 10)).join('');
      const record: CodeRecord = { userId: user.id, mac: this.mac(email, code) };
      await this.redis.set(this.codeKey(email), JSON.stringify(record), 'EX', CODE_TTL_SECONDS);
      await this.redis.del(this.triesKey(email));
      // Not awaited: the answer must not take longer for an address that has an account.
      void this.sendCode(email, code, loginCodeLanguage(user.preferredLanguage));
    }
    return { ok: true };
  }

  /**
   * Checks the code and uses it up. Returns whose code it was; the caller still has to check that
   * the account is unchanged and eligible. Every failure is the same 401.
   */
  async consume(rawEmail: unknown, rawCode: unknown) {
    this.assertEnabled();
    const email = normalizeLoginEmail(rawEmail);
    const code = typeof rawCode === 'string' ? rawCode.trim() : '';
    if (!email || !/^\d{6}$/.test(code)) throw this.invalidCode();

    const stored = await this.redis.get(this.codeKey(email));
    const record = stored ? this.parseRecord(stored) : null;
    if (!record) throw this.invalidCode();

    // Take the try before comparing, so parallel guesses cannot get past the limit.
    const tries = await this.redis.incr(this.triesKey(email));
    if (tries === 1) await this.redis.expire(this.triesKey(email), CODE_TTL_SECONDS);
    if (tries > MAX_TRIES_PER_CODE) {
      await this.redis.del(this.codeKey(email));
      throw this.invalidCode();
    }

    const expected = Buffer.from(record.mac, 'hex');
    const actual = Buffer.from(this.mac(email, code), 'hex');
    if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
      if (tries >= MAX_TRIES_PER_CODE) await this.redis.del(this.codeKey(email));
      throw this.invalidCode();
    }

    // Single use: only the request that actually removes the code goes on.
    if ((await this.redis.del(this.codeKey(email))) !== 1) throw this.invalidCode();
    await this.redis.del(this.triesKey(email));
    return { userId: record.userId, email };
  }

  private async sendCode(email: string, code: string, language: 'ru' | 'kk') {
    try {
      const message = renderLoginCodeEmail(code, language);
      const result = await this.mailer.send({ to: email, ...message }, new Date(), 'auth');
      if (result.status === 'skipped') {
        this.logger.warn(`Sign-in code not sent: ${result.reason}`);
      }
    } catch (error) {
      this.logger.warn(
        `Sign-in code not sent: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private async takeIpSlot(ip?: string) {
    if (!ip) return;
    const count = await this.bump(`auth:email-code:ip:${sha256(ip)}`, HOUR_SECONDS);
    if (count > MAX_REQUESTS_PER_IP_HOUR) throw this.tooMany();
  }

  private async takeAddressSlots(email: string) {
    const id = sha256(email);
    const first = await this.redis.set(
      `auth:email-code:last:${id}`,
      '1',
      'EX',
      RESEND_SECONDS,
      'NX',
    );
    if (first !== 'OK') {
      throw new HttpException('Код уже отправлен. Попробуйте чуть позже', HttpStatus.TOO_MANY_REQUESTS);
    }
    if ((await this.bump(`auth:email-code:hour:${id}`, HOUR_SECONDS)) > MAX_REQUESTS_PER_ADDRESS_HOUR) {
      throw this.tooMany();
    }
    if ((await this.bump(`auth:email-code:day:${id}`, DAY_SECONDS)) > MAX_REQUESTS_PER_ADDRESS_DAY) {
      throw this.tooMany();
    }
  }

  private async bump(key: string, ttlSeconds: number) {
    const count = await this.redis.incr(key);
    if (count === 1) await this.redis.expire(key, ttlSeconds);
    return count;
  }

  private assertEnabled() {
    if (!this.isEnabled()) throw this.unavailable();
  }

  private unavailable() {
    return new ServiceUnavailableException({
      code: 'EMAIL_CODE_UNAVAILABLE',
      message: 'Вход по коду из письма сейчас недоступен. Войдите через Google или по телефону.',
    });
  }

  private tooMany() {
    return new HttpException('Слишком много запросов кода. Попробуйте позже', HttpStatus.TOO_MANY_REQUESTS);
  }

  private invalidCode() {
    return new UnauthorizedException(INVALID_CODE_MESSAGE);
  }

  private parseRecord(raw: string): CodeRecord | null {
    try {
      const value = JSON.parse(raw) as Partial<CodeRecord>;
      return typeof value.userId === 'string' && typeof value.mac === 'string'
        ? { userId: value.userId, mac: value.mac }
        : null;
    } catch {
      return null;
    }
  }

  /** Redis holds only this, never the code itself. Its own key, derived from the JWT secret. */
  private mac(email: string, code: string) {
    const key = createHmac('sha256', getRequiredConfig(this.config, 'JWT_SECRET'))
      .update('mytest:auth:email-code:v1')
      .digest();
    return createHmac('sha256', key).update(`${email}\n${code}`).digest('hex');
  }

  private codeKey(email: string) {
    return `auth:email-code:code:${sha256(email)}`;
  }

  private triesKey(email: string) {
    return `auth:email-code:tries:${sha256(email)}`;
  }
}

function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}
