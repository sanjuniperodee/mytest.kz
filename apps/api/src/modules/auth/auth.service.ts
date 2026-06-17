import {
  Injectable,
  UnauthorizedException,
  Inject,
  BadRequestException,
  forwardRef,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';
import {
  createHash,
  randomInt,
  randomBytes,
  randomUUID,
  scrypt,
  timingSafeEqual,
} from 'crypto';
import { promisify } from 'util';
import Redis from 'ioredis';
import { PrismaService } from '../../database/prisma.service';
import { TelegramAuthService } from './telegram-auth.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { REDIS_CLIENT } from '../../database/redis.module';
import {
  getJwtExpiresIn,
  getRequiredConfig,
} from '../../common/config/required-config';
import {
  AUTH_CODE_TTL_SECONDS,
  AUTH_CODE_LENGTH,
  normalizeKzPhone,
} from '@bilimland/shared';
import { AccessService } from '../subscriptions/access.service';


const WEB_AUTH_MAX_VERIFY_ATTEMPTS = 5;
const WEB_AUTH_VERIFY_LOCK_SECONDS = 15 * 60;

type TokenUser = {
  id: string;
  telegramId: number | null;
  preferredLanguage: string;
  isAdmin: boolean;
  isChannelMember: boolean;
  telegramUsername: string | null;
  firstName: string | null;
  lastName: string | null;
  avatarUrl?: string | null;
  email?: string | null;
};

type RefreshJwtPayload = {
  sub: string;
  sid?: string;
  jti?: string;
};

@Injectable()
export class AuthService {
  private googleClient = new OAuth2Client();

  constructor(
    private prisma: PrismaService,
    private jwt: JwtService,
    private config: ConfigService,
    private telegramAuth: TelegramAuthService,
    @Inject(forwardRef(() => TelegramBotService))
    private telegramBot: TelegramBotService,
    private accessService: AccessService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async authenticateTelegram(initDataRaw: string, visitorId?: string) {
    const initData = this.telegramAuth.validateInitData(initDataRaw);
    if (!initData) {
      throw new UnauthorizedException('Invalid Telegram init data');
    }

    const { user: tgUser } = initData;

    const user = await this.prisma.user.upsert({
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

    // Check channel membership
    const isChannelMember = await this.telegramBot.checkChannelMembership(tgUser.id);
    if (user.isChannelMember !== isChannelMember) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isChannelMember, channelCheckedAt: new Date() },
      });
    }

    /**
     * Production onboarding rule:
     * Mini App login is allowed only after user shares phone in bot.
     * This removes confusing states where app opens but web/OTP flow is unavailable.
     */
    if (!user.phone) {
      throw new BadRequestException('PHONE_REQUIRED_IN_BOT');
    }

    // Attribution: link visitorId to user
    if (visitorId) {
      await this.attributeVisit(visitorId, user.id);
    }

    await this.accessService.ensureSignupEntitlementsForUser(user.id);

    return this.generateTokens({
      ...user,
      telegramId: Number(user.telegramId),
      isChannelMember,
    });
  }

  async authenticateGoogle(credential: string, visitorId?: string) {
    const raw = this.config.get<string>('GOOGLE_CLIENT_ID');
    const audiences = raw
      ? raw.split(',').map((s) => s.trim()).filter(Boolean)
      : [];
    if (!audiences.length) {
      throw new BadRequestException('Google sign-in is not configured');
    }
    if (!credential) {
      throw new BadRequestException('Google credential is required');
    }

    let payload;
    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken: credential,
        audience: audiences.length === 1 ? audiences[0] : audiences,
      });
      payload = ticket.getPayload();
    } catch {
      throw new UnauthorizedException('Invalid Google credential');
    }

    if (!payload?.sub || !payload.email || !payload.email_verified) {
      throw new UnauthorizedException('Google email is not verified');
    }

    const email = payload.email.toLowerCase();
    const names = this.getGoogleNames(payload);
    const googleUser = await this.prisma.user.findUnique({
      where: { googleId: payload.sub },
    });
    const emailUser = googleUser
      ? null
      : await this.prisma.user.findUnique({
          where: { email },
        });

    if (emailUser) {
      if (!emailUser.emailVerified || emailUser.passwordHash) {
        throw new BadRequestException(
          'Этот email уже зарегистрирован. Войдите по email и привяжите Google после подтверждения аккаунта.',
        );
      }
      if (emailUser.googleId && emailUser.googleId !== payload.sub) {
        throw new BadRequestException('Этот email уже привязан к другому Google аккаунту');
      }
    }

    const existingUser = googleUser ?? emailUser;
    const user = existingUser
      ? await this.prisma.user.update({
          where: { id: existingUser.id },
          data: {
            googleId: payload.sub,
            email,
            emailVerified: true,
            firstName: existingUser.firstName || names.firstName,
            lastName: existingUser.lastName || names.lastName,
            avatarUrl: existingUser.avatarUrl || payload.picture || null,
            isChannelMember: existingUser.telegramId ? existingUser.isChannelMember : true,
          },
        })
      : await this.prisma.user.create({
          data: {
            googleId: payload.sub,
            email,
            emailVerified: true,
            firstName: names.firstName,
            lastName: names.lastName,
            avatarUrl: payload.picture || null,
            preferredLanguage: 'ru',
            isChannelMember: true,
          },
        });

    if (visitorId) {
      await this.attributeVisit(visitorId, user.id);
    }

    await this.accessService.ensureSignupEntitlementsForUser(user.id);

    return this.generateTokens({
      ...user,
      telegramId: user.telegramId ? Number(user.telegramId) : null,
      isChannelMember: user.telegramId ? user.isChannelMember : true,
    });
  }

  /**
   * Step 1: User enters phone (same as shared in Telegram bot).
   * Redis key + code sent to Telegram chat by telegramId.
   */
  /**
   * @param opts.fromTelegramBot — одно сообщение в Telegram: префикс «номер сохранён» + код (без второго дублирующего текста из бота).
   */
  async requestWebCode(
    rawPhone: string,
    opts?: { fromTelegramBot?: boolean },
  ) {
    const normalized = normalizeKzPhone(rawPhone || '');
    if (!normalized) {
      throw new BadRequestException('Введите корректный номер телефона');
    }

    const user = await this.prisma.user.findFirst({
      where: { phone: normalized },
    });
    if (!user) {
      throw new BadRequestException(
        'Номер не найден. Откройте бота @bilimhan_bot по ссылке с сайта и укажите номер в Telegram.',
      );
    }
    if (!user.telegramId) {
      throw new BadRequestException('Для этого аккаунта вход через Telegram-код недоступен');
    }

    const code = Array.from({ length: AUTH_CODE_LENGTH }, () =>
      randomInt(0, 10),
    ).join('');

    const redisKey = `auth:code:${normalized}`;
    await this.redis.set(redisKey, code, 'EX', AUTH_CODE_TTL_SECONDS);
    // SECURITY: do NOT clear the brute-force counter on resend. The counter
    // is owned by verifyWebCode and must only be cleared on success there,
    // otherwise a resend becomes a free retry budget for an attacker.
    // (See audit: docs/code-review-and-optimization-plan-minimax.md P0-1)

    await this.telegramBot.sendAuthCodeToTelegram(user.telegramId, code, {
      includePhoneLinkedAck: opts?.fromTelegramBot === true,
    });

    return { message: 'Code sent to your Telegram' };
  }

  async verifyWebCode(rawPhone: string, code: string, visitorId?: string) {
    const normalized = normalizeKzPhone(rawPhone || '');
    if (!normalized) {
      throw new BadRequestException('Введите корректный номер телефона');
    }

    const redisKey = `auth:code:${normalized}`;
    await this.assertWebAuthNotLocked(normalized);
    // SECURITY: the fixed demo OTP is a credential bypass. Only honor it
    // outside production from config environment parameters.
    const testPhone = this.config.get<string>('DEV_FIXED_OTP_PHONE');
    const testOtp = this.config.get<string>('DEV_FIXED_OTP_CODE');
    const useFixedOtp =
      process.env.NODE_ENV !== 'production' &&
      testPhone &&
      testOtp &&
      normalized === testPhone &&
      code === testOtp;

    if (!useFixedOtp) {
      const storedCode = await this.redis.get(redisKey);
      if (!storedCode || storedCode !== code) {
        await this.recordWebAuthFailure(normalized);
        throw new UnauthorizedException('Неверный или истёкший код');
      }
    }

    await this.redis.del(redisKey);
    await this.redis.del(this.webAuthAttemptKey(normalized));

    const user = await this.prisma.user.findFirst({
      where: { phone: normalized },
    });

    if (!user) {
      throw new UnauthorizedException(
        'Пользователь не найден. Откройте бота @bilimhan_bot по ссылке с сайта и укажите номер в Telegram.',
      );
    }
    if (!user.telegramId) {
      throw new UnauthorizedException('Для этого аккаунта вход через Telegram-код недоступен');
    }

    // Check channel membership
    const isChannelMember = await this.telegramBot.checkChannelMembership(
      Number(user.telegramId),
    );
    if (user.isChannelMember !== isChannelMember) {
      await this.prisma.user.update({
        where: { id: user.id },
        data: { isChannelMember, channelCheckedAt: new Date() },
      });
    }

    // Attribution: link visitorId to user
    if (visitorId) {
      await this.attributeVisit(visitorId, user.id);
    }

    return this.generateTokens({
      ...user,
      telegramId: Number(user.telegramId),
      isChannelMember,
    });
  }

  async registerEmail(dto: {
    email: string;
    password: string;
    firstName?: string;
    lastName?: string;
  }) {
    const email = dto.email.trim().toLowerCase();
    if (!email || !email.includes('@')) {
      throw new BadRequestException('Введите корректный email');
    }
    if (!dto.password || dto.password.length < 6) {
      throw new BadRequestException('Пароль должен быть не менее 6 символов');
    }

    const existing = await this.prisma.user.findFirst({
      where: { email },
    });
    if (existing) {
      throw new BadRequestException('Пользователь с таким email уже существует');
    }

    const passwordHash = await hashPassword(dto.password);

    const user = await this.prisma.user.create({
      data: {
        email,
        emailVerified: false,
        passwordHash,
        firstName: dto.firstName?.trim() || null,
        lastName: dto.lastName?.trim() || null,
        preferredLanguage: 'ru',
        isChannelMember: true,
      },
    });

    await this.accessService.ensureSignupEntitlementsForUser(user.id);

    return this.generateTokens({
      ...user,
      telegramId: null,
      isChannelMember: true,
    });
  }

  async loginEmail(email: string, password: string) {
    const normalized = email.trim().toLowerCase();
    if (!normalized || !normalized.includes('@')) {
      throw new BadRequestException('Введите корректный email');
    }

    const user = await this.prisma.user.findFirst({
      where: { email: normalized },
    });
    if (!user || !user.passwordHash) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    const valid = await verifyPassword(password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException('Неверный email или пароль');
    }

    await this.accessService.ensureSignupEntitlementsForUser(user.id);

    return this.generateTokens({
      ...user,
      telegramId: user.telegramId ? Number(user.telegramId) : null,
      isChannelMember: user.telegramId ? user.isChannelMember : true,
    });
  }

  async refreshToken(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: getRequiredConfig(this.config, 'JWT_REFRESH_SECRET'),
      }) as RefreshJwtPayload;
      if (!payload.sid) {
        throw new UnauthorizedException();
      }

      const session = await this.prisma.authSession.findUnique({
        where: { id: payload.sid },
        include: { user: true },
      });

      if (!session || session.userId !== payload.sub || session.revokedAt) {
        throw new UnauthorizedException();
      }
      if (session.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException();
      }
      if (session.refreshTokenHash !== this.hashToken(refreshToken)) {
        const gracePeriodMs = 15000;
        if (session.lastUsedAt && Date.now() - session.lastUsedAt.getTime() < gracePeriodMs) {
          throw new UnauthorizedException('Token rotating');
        }
        await this.prisma.authSession.updateMany({
          where: { familyId: session.familyId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        throw new UnauthorizedException();
      }

      await this.accessService.ensureSignupEntitlementsForUser(session.user.id);

      return this.generateTokens({
        ...session.user,
        telegramId: session.user.telegramId ? Number(session.user.telegramId) : null,
        isChannelMember: session.user.telegramId ? session.user.isChannelMember : true,
      }, {
        id: session.id,
        familyId: session.familyId,
      });
    } catch {
      throw new UnauthorizedException('Invalid refresh token');
    }
  }

  async logout(refreshToken: string) {
    try {
      const payload = this.jwt.verify(refreshToken, {
        secret: getRequiredConfig(this.config, 'JWT_REFRESH_SECRET'),
      }) as RefreshJwtPayload;
      if (payload.sid) {
        await this.prisma.authSession.updateMany({
          where: { id: payload.sid, revokedAt: null },
          data: { revokedAt: new Date() },
        });
      }
    } catch {
      // Logout is idempotent from the client perspective.
    }
    return { ok: true };
  }

  async logoutAll(userId: string) {
    await this.prisma.authSession.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    return { ok: true };
  }

  private async generateTokens(
    user: TokenUser,
    existingSession?: { id: string; familyId: string },
  ) {
    const sessionId = existingSession?.id ?? randomUUID();
    const familyId = existingSession?.familyId ?? sessionId;
    const payload = {
      sub: user.id,
      sid: sessionId,
      telegramId: user.telegramId,
      preferredLanguage: user.preferredLanguage,
      isAdmin: user.isAdmin,
      isChannelMember: user.isChannelMember,
    };

    const accessToken = this.jwt.sign({ ...payload, jti: randomUUID() });
    const refreshToken = this.jwt.sign(
      { ...payload, sid: sessionId, jti: randomUUID() },
      {
      secret: getRequiredConfig(this.config, 'JWT_REFRESH_SECRET'),
      expiresIn: getJwtExpiresIn(
        this.config.get<string>('JWT_REFRESH_EXPIRES_IN'),
        '60d',
      ),
      },
    );
    const refreshTokenHash = this.hashToken(refreshToken);
    const expiresAt = this.getJwtExpiryDate(refreshToken);

    if (existingSession) {
      await this.prisma.authSession.update({
        where: { id: sessionId },
        data: {
          refreshTokenHash,
          expiresAt,
          lastUsedAt: new Date(),
        },
      });
    } else {
      await this.prisma.authSession.create({
        data: {
          id: sessionId,
          userId: user.id,
          familyId,
          refreshTokenHash,
          expiresAt,
        },
      });
    }

    return {
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        telegramId: user.telegramId,
        telegramUsername: user.telegramUsername,
        firstName: user.firstName,
        lastName: user.lastName,
        avatarUrl: user.avatarUrl ?? null,
        email: user.email ?? null,
        preferredLanguage: user.preferredLanguage,
        isChannelMember: user.isChannelMember,
        isAdmin: user.isAdmin,
      },
    };
  }

  private hashToken(token: string): string {
    return createHash('sha256').update(token).digest('hex');
  }

  private getJwtExpiryDate(token: string): Date {
    const decoded = this.jwt.decode(token) as { exp?: unknown } | null;
    const exp = typeof decoded?.exp === 'number' ? decoded.exp : null;
    if (!exp) {
      throw new Error('Refresh token expiry is missing');
    }
    return new Date(exp * 1000);
  }

  private getGoogleNames(payload: {
    given_name?: string;
    family_name?: string;
    name?: string;
  }) {
    const firstName = payload.given_name?.trim() || null;
    const lastName = payload.family_name?.trim() || null;
    if (firstName || lastName || !payload.name) {
      return { firstName, lastName };
    }

    const [first, ...rest] = payload.name.trim().split(/\s+/);
    return {
      firstName: first || null,
      lastName: rest.join(' ') || null,
    };
  }

  private webAuthAttemptKey(normalizedPhone: string): string {
    return `auth:code:attempts:${normalizedPhone}`;
  }

  private async assertWebAuthNotLocked(normalizedPhone: string) {
    const attempts = Number(await this.redis.get(this.webAuthAttemptKey(normalizedPhone)));
    if (Number.isFinite(attempts) && attempts >= WEB_AUTH_MAX_VERIFY_ATTEMPTS) {
      throw new UnauthorizedException('Слишком много попыток. Попробуйте позже');
    }
  }

  private async recordWebAuthFailure(normalizedPhone: string) {
    const key = this.webAuthAttemptKey(normalizedPhone);
    const attempts = await this.redis.incr(key);
    if (attempts === 1) {
      await this.redis.expire(key, WEB_AUTH_VERIFY_LOCK_SECONDS);
    }
  }

  private async attributeVisit(visitorId: string, userId: string) {
    // Update all unclaimed VisitEvents for this visitorId to link to userId
    await this.prisma.visitEvent.updateMany({
      where: { visitorId, userId: null },
      data: { userId },
    });

    // Find the first visit event for this visitor to add 'registered' step
    const firstVisit = await this.prisma.visitEvent.findFirst({
      where: { visitorId },
      orderBy: { createdAt: 'asc' },
    });

    if (firstVisit) {
      const existingStep = await this.prisma.funnelStep.findFirst({
        where: { visitId: firstVisit.id, step: 'registered' },
      });
      if (!existingStep) {
        await this.prisma.funnelStep.create({
          data: {
            visitId: firstVisit.id,
            step: 'registered',
          },
        });
      }
    }
  }
}

const SALT_LEN = 32;
const KEY_LEN = 64;
const HASH_SEP = ':';
const scryptAsync = promisify(scrypt);

const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };

async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SALT_LEN).toString('hex');
  const key = (await (scryptAsync as any)(password, salt, KEY_LEN, SCRYPT_OPTIONS)) as Buffer;
  return `${salt}${HASH_SEP}${key.toString('hex')}`;
}

async function verifyPassword(password: string, hash: string): Promise<boolean> {
  const [salt, keyHex] = hash.split(HASH_SEP);
  if (!salt || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  if (expected.length !== KEY_LEN) return false;
  const actual = (await (scryptAsync as any)(password, salt, KEY_LEN, SCRYPT_OPTIONS)) as Buffer;
  if (actual.length !== expected.length) return false;
  return timingSafeEqual(expected, actual);
}
