import { Controller, ForbiddenException, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthGuard, PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { createHash, randomBytes, randomUUID, scryptSync } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import request from 'supertest';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { hasUnprovenEmailAccess } from '../src/common/email-ownership';
import { PrismaService } from '../src/database/prisma.service';
import { REDIS_CLIENT } from '../src/database/redis.module';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { EmailCodeService } from '../src/modules/auth/email-code.service';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { TelegramAuthService } from '../src/modules/auth/telegram-auth.service';
import { NotificationPreferencesService } from '../src/modules/notifications/notification-preferences.service';
import { AccessService } from '../src/modules/subscriptions/access.service';
import { TelegramBotService } from '../src/modules/telegram/telegram-bot.service';

/**
 * The email + Google account-merge takeover.
 *
 * Email signup (open 12 May – 17 June 2026) never verified the address, so a stranger could register
 * victim@example.com with their own password and wait for the victim to arrive through Google.
 * These tests walk through that attack over HTTP and check that nothing the stranger set up
 * survives the owner's Google sign-in, while people who signed up by email in good faith still
 * reach their own account and results.
 */

const ACCESS_SECRET = 'auth-takeover-spec-access-secret';
const REFRESH_SECRET = 'auth-takeover-spec-refresh-secret';
const GOOGLE_CLIENT_ID = 'spec-client.apps.googleusercontent.com';
const DAY_MS = 86_400_000;

type Row = Record<string, any>;

/** Same format the removed signup wrote: `<salt hex>:<scrypt key hex>`. */
function passwordHash(password: string) {
  const salt = randomBytes(16).toString('hex');
  const key = scryptSync(password, salt, 64, { N: 16384, r: 8, p: 1 });
  return `${salt}:${key.toString('hex')}`;
}

function matches(row: Row, where: Row) {
  return Object.entries(where).every(([field, expected]) => {
    const value = row[field] ?? null;
    if (expected && typeof expected === 'object' && 'gt' in expected) return value > expected.gt;
    return value === expected;
  });
}

/**
 * In-memory stand-in for the tables auth works with. It has no test sessions, subscriptions or
 * any other model on purpose: if auth ever reached for the user's data, the call would throw.
 */
function fakeDatabase() {
  const users: Row[] = [];
  const sessions: Row[] = [];
  const pushSubscriptions: Row[] = [];

  const findUser = async ({ where }: { where: Row }) => {
    const row = users.find((user) => matches(user, where));
    return row ? { ...row } : null;
  };

  const prisma = {
    user: {
      findUnique: findUser,
      findFirst: findUser,
      create: async ({ data }: { data: Row }) => {
        const row = userRow(data);
        users.push(row);
        return { ...row };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = users.find((user) => matches(user, where));
        if (!row) throw new Error('user to update not found');
        Object.assign(row, data);
        return { ...row };
      },
    },
    authSession: {
      create: async ({ data }: { data: Row }) => {
        const row = { revokedAt: null, lastUsedAt: null, ...data };
        sessions.push(row);
        return { ...row };
      },
      update: async ({ where, data }: { where: Row; data: Row }) => {
        const row = sessions.find((session) => matches(session, where));
        if (!row) throw new Error('session to update not found');
        Object.assign(row, data);
        return { ...row };
      },
      updateMany: async ({ where, data }: { where: Row; data: Row }) => {
        const hit = sessions.filter((session) => matches(session, where));
        hit.forEach((session) => Object.assign(session, data));
        return { count: hit.length };
      },
      findUnique: async ({ where, include }: { where: Row; include?: { user?: boolean } }) => {
        const row = sessions.find((session) => matches(session, where));
        if (!row) return null;
        return include?.user
          ? { ...row, user: { ...users.find((user) => user.id === row.userId) } }
          : { ...row };
      },
      findFirst: async ({ where }: { where: Row }) => {
        const row = sessions.find((session) => matches(session, where));
        return row ? { id: row.id } : null;
      },
    },
    pushSubscription: {
      deleteMany: async ({ where }: { where: Row }) => {
        const kept = pushSubscriptions.filter((subscription) => !matches(subscription, where));
        const count = pushSubscriptions.length - kept.length;
        pushSubscriptions.splice(0, pushSubscriptions.length, ...kept);
        return { count };
      },
    },
    $transaction: async (operations: Promise<unknown>[]) => Promise.all(operations),
  };

  return { prisma, users, sessions, pushSubscriptions };
}

function userRow(data: Row): Row {
  return {
    id: randomUUID(),
    telegramId: null,
    telegramUsername: null,
    telegramLinkedAt: null,
    googleId: null,
    email: null,
    emailVerified: false,
    passwordHash: null,
    phone: null,
    firstName: null,
    lastName: null,
    avatarUrl: null,
    preferredLanguage: 'ru',
    isAdmin: false,
    isChannelMember: true,
    ...data,
  };
}

@Controller('probe')
class ProbeController {
  /** Any logged-in route: answers only while the caller's session is alive. */
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return { userId };
  }
}

describe('email + Google account takeover', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let db: ReturnType<typeof fakeDatabase>;
  const redis = { del: jest.fn(async (..._keys: string[]) => 1) };
  /** What Google would say about each credential the tests send. */
  const googleAccounts = new Map<string, Row>();

  beforeAll(() => {
    jest
      .spyOn(OAuth2Client.prototype, 'verifyIdToken')
      .mockImplementation(async (options: { idToken: string }) => {
        const payload = googleAccounts.get(options.idToken);
        if (!payload) throw new Error('unknown credential');
        return { getPayload: () => payload } as any;
      });
  });

  afterAll(() => {
    jest.restoreAllMocks();
  });

  beforeEach(async () => {
    db = fakeDatabase();
    redis.del.mockClear();
    googleAccounts.clear();
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [
            () => ({
              JWT_SECRET: ACCESS_SECRET,
              JWT_REFRESH_SECRET: REFRESH_SECRET,
              GOOGLE_CLIENT_ID,
            }),
          ],
        }),
        PassportModule,
        JwtModule.registerAsync({
          inject: [ConfigService],
          useFactory: (config: ConfigService) => ({
            secret: config.get<string>('JWT_SECRET'),
            signOptions: { expiresIn: '15m' },
          }),
        }),
      ],
      controllers: [AuthController, ProbeController],
      providers: [
        AuthService,
        JwtStrategy,
        { provide: PrismaService, useValue: db.prisma },
        // The mailed-code flow has its own spec (auth-email-code.http.spec.ts); Google sign-in never calls it.
        { provide: EmailCodeService, useValue: {} },
        { provide: TelegramAuthService, useValue: {} },
        { provide: TelegramBotService, useValue: {} },
        { provide: AccessService, useValue: { ensureFreeEntitlementsForUser: async () => undefined } },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    jwt = module.get(JwtService);
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const loginWithPassword = (email: string, password: string) =>
    http().post('/auth/login').send({ email, password });
  const loginWithGoogle = (credential: string) => http().post('/auth/google').send({ credential });
  const refresh = (refreshToken: string) => http().post('/auth/refresh').send({ refreshToken });
  const whoAmI = (accessToken: string) =>
    http().get('/probe/me').set('Authorization', `Bearer ${accessToken}`);

  function seedUser(data: Row) {
    const row = userRow(data);
    db.users.push(row);
    return row;
  }

  /** A session opened earlier (for example by a password login while that still worked). */
  function seedSession(userId: string) {
    const sid = randomUUID();
    const payload = {
      sub: userId,
      sid,
      telegramId: null,
      preferredLanguage: 'ru',
      isAdmin: false,
      isChannelMember: true,
    };
    const accessToken = jwt.sign({ ...payload, jti: randomUUID() });
    const refreshToken = jwt.sign(
      { ...payload, jti: randomUUID() },
      { secret: REFRESH_SECRET, expiresIn: '60d' },
    );
    db.sessions.push({
      id: sid,
      userId,
      familyId: sid,
      refreshTokenHash: createHash('sha256').update(refreshToken).digest('hex'),
      expiresAt: new Date(Date.now() + 60 * DAY_MS),
      revokedAt: null,
      lastUsedAt: null,
    });
    return { sid, accessToken, refreshToken };
  }

  function googleAccount(credential: string, email: string, sub = `google-${randomUUID()}`) {
    googleAccounts.set(credential, {
      sub,
      email,
      email_verified: true,
      given_name: 'Google',
      family_name: 'Name',
      picture: 'https://example.com/avatar.png',
    });
    return sub;
  }

  const storedUser = (id: string) => db.users.find((user) => user.id === id)!;

  it('keeps email signup closed, so nobody can claim a new address', async () => {
    const response = await http()
      .post('/auth/register')
      .send({ email: 'victim@example.com', password: 'attacker-password' })
      .expect(400);
    expect(response.body.message).toContain('Регистрация по email временно недоступна');
    expect(db.users).toHaveLength(0);
  });

  describe('a stranger registered the victim’s email before the victim arrived', () => {
    const EMAIL = 'victim@example.com';
    const PASSWORD = 'attacker-password';
    let account: Row;
    let attacker: ReturnType<typeof seedSession>;

    beforeEach(() => {
      account = seedUser({
        email: EMAIL,
        passwordHash: passwordHash(PASSWORD),
        emailVerified: false,
        firstName: 'Stranger',
        // Planted through the stranger's still-open session: a Telegram link with a phone
        // (both are ways to sign in), a browser push subscription and a parent-report link.
        telegramId: BigInt(777000111),
        telegramUsername: 'stranger',
        telegramLinkedAt: new Date(),
        phone: '+77010000001',
      });
      attacker = seedSession(account.id);
      db.pushSubscriptions.push({ id: randomUUID(), userId: account.id, endpoint: 'https://push.example/stranger' });
      googleAccount('victim-credential', EMAIL, 'google-victim');
    });

    it('does not let the stranger in with the password, before or after', async () => {
      await loginWithPassword(EMAIL, PASSWORD).expect(401);
      await loginWithGoogle('victim-credential').expect(201);
      await loginWithPassword(EMAIL, PASSWORD).expect(401);
      expect(storedUser(account.id).passwordHash).toBeNull();
    });

    it('gives the account to the victim and cuts off the stranger’s session', async () => {
      // The stranger's session works until the owner shows up.
      await whoAmI(attacker.accessToken).expect(200);

      const victim = await loginWithGoogle('victim-credential').expect(201);

      expect(victim.body.user.id).toBe(account.id);
      expect(storedUser(account.id)).toMatchObject({
        googleId: 'google-victim',
        email: EMAIL,
        emailVerified: true,
        passwordHash: null,
      });
      expect(db.users).toHaveLength(1);

      await whoAmI(attacker.accessToken).expect(401);
      await refresh(attacker.refreshToken).expect(401);

      const me = await whoAmI(victim.body.accessToken).expect(200);
      expect(me.body.userId).toBe(account.id);
      const renewed = await refresh(victim.body.refreshToken).expect(201);
      await whoAmI(renewed.body.accessToken).expect(200);
    });

    it('removes what the stranger attached to the account', async () => {
      const victim = await loginWithGoogle('victim-credential').expect(201);

      expect(storedUser(account.id)).toMatchObject({
        telegramId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
        phone: null,
        isChannelMember: true,
      });
      expect(victim.body.user.telegramId).toBeNull();
      expect(db.pushSubscriptions).toHaveLength(0);
      expect(redis.del).toHaveBeenCalledWith(`parent-report:link:${account.id}`);
    });

    it('does not sign the owner out again on later Google sign-ins', async () => {
      const first = await loginWithGoogle('victim-credential').expect(201);
      redis.del.mockClear();

      await loginWithGoogle('victim-credential').expect(201);

      await whoAmI(first.body.accessToken).expect(200);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('answers a wrong password exactly like an unknown email', async () => {
      const wrongPassword = await loginWithPassword(EMAIL, 'not-the-password').expect(401);
      const unknownEmail = await loginWithPassword('nobody@example.com', PASSWORD).expect(401);
      expect(wrongPassword.body).toEqual(unknownEmail.body);
    });
  });

  describe('an account merged with Google while the password was still kept (before 17 June)', () => {
    const EMAIL = 'merged@example.com';
    const PASSWORD = 'password-from-before-the-merge';
    let account: Row;
    let oldSession: ReturnType<typeof seedSession>;

    beforeEach(() => {
      account = seedUser({
        email: EMAIL,
        passwordHash: passwordHash(PASSWORD),
        emailVerified: true,
        googleId: 'google-owner',
        firstName: 'Owner',
      });
      oldSession = seedSession(account.id);
      googleAccount('owner-credential', EMAIL, 'google-owner');
    });

    it('no longer accepts the old password', async () => {
      const response = await loginWithPassword(EMAIL, PASSWORD).expect(401);
      expect(response.body.message).toContain('Войдите через Google');
      expect(db.sessions).toHaveLength(1);
    });

    it('drops the password and every earlier session on the owner’s next Google sign-in', async () => {
      await whoAmI(oldSession.accessToken).expect(200);

      const owner = await loginWithGoogle('owner-credential').expect(201);

      expect(owner.body.user.id).toBe(account.id);
      expect(storedUser(account.id).passwordHash).toBeNull();
      await whoAmI(oldSession.accessToken).expect(401);
      await refresh(oldSession.refreshToken).expect(401);
      await whoAmI(owner.body.accessToken).expect(200);
    });
  });

  describe('someone who signed up by email themselves and never verified it', () => {
    const EMAIL = 'aruzhan@example.com';

    it('gets into the same account with Google and keeps name and results', async () => {
      const account = seedUser({
        email: EMAIL,
        passwordHash: passwordHash('her-own-password'),
        emailVerified: false,
        firstName: 'Аружан',
        lastName: 'Сейтова',
      });
      // Results hang off the user id; auth has no access to them at all (see fakeDatabase).
      const results = [
        { id: randomUUID(), userId: account.id, rawScore: 96, maxScore: 140 },
        { id: randomUUID(), userId: account.id, rawScore: 104, maxScore: 140 },
      ];
      const before = JSON.parse(JSON.stringify(results));
      googleAccount('aruzhan-credential', EMAIL, 'google-aruzhan');

      const response = await loginWithGoogle('aruzhan-credential').expect(201);

      expect(response.body.user).toMatchObject({
        id: account.id,
        email: EMAIL,
        firstName: 'Аружан',
        lastName: 'Сейтова',
      });
      expect(db.users).toHaveLength(1);
      expect(results).toEqual(before);
      expect(results.every((result) => result.userId === response.body.user.id)).toBe(true);
      await whoAmI(response.body.accessToken).expect(200);
    });

    it('matches the email whatever its letter case', async () => {
      const account = seedUser({ email: EMAIL, passwordHash: passwordHash('pw-123456'), emailVerified: false });
      googleAccount('mixed-case-credential', 'Aruzhan@Example.com');

      const response = await loginWithGoogle('mixed-case-credential').expect(201);

      expect(response.body.user.id).toBe(account.id);
    });
  });

  describe('accounts that were never at risk', () => {
    it('leaves an ordinary Google account’s sessions and Telegram link alone', async () => {
      const account = seedUser({
        email: 'regular@example.com',
        emailVerified: true,
        googleId: 'google-regular',
        telegramId: BigInt(555000222),
        telegramUsername: 'regular',
        telegramLinkedAt: new Date(),
        phone: '+77010000002',
      });
      const otherDevice = seedSession(account.id);
      db.pushSubscriptions.push({ id: randomUUID(), userId: account.id, endpoint: 'https://push.example/own' });
      googleAccount('regular-credential', 'regular@example.com', 'google-regular');

      const response = await loginWithGoogle('regular-credential').expect(201);

      expect(response.body.user.id).toBe(account.id);
      await whoAmI(otherDevice.accessToken).expect(200);
      expect(storedUser(account.id)).toMatchObject({
        telegramId: BigInt(555000222),
        telegramUsername: 'regular',
        phone: '+77010000002',
      });
      expect(db.pushSubscriptions).toHaveLength(1);
      expect(redis.del).not.toHaveBeenCalled();
    });

    it('creates a fresh account for a new Google user', async () => {
      googleAccount('new-credential', 'new@example.com', 'google-new');

      const response = await loginWithGoogle('new-credential').expect(201);

      expect(db.users).toHaveLength(1);
      expect(db.users[0]).toMatchObject({
        id: response.body.user.id,
        googleId: 'google-new',
        email: 'new@example.com',
        emailVerified: true,
        passwordHash: null,
      });
    });

    it('refuses an email that belongs to a different Google account', async () => {
      const account = seedUser({
        email: 'taken@example.com',
        emailVerified: true,
        googleId: 'google-first-owner',
      });
      const session = seedSession(account.id);
      googleAccount('other-credential', 'taken@example.com', 'google-someone-else');

      await loginWithGoogle('other-credential').expect(400);

      expect(storedUser(account.id).googleId).toBe('google-first-owner');
      await whoAmI(session.accessToken).expect(200);
    });

    it('rejects a Google account whose email Google has not verified', async () => {
      seedUser({ email: 'victim@example.com', passwordHash: passwordHash('pw-123456'), emailVerified: false });
      googleAccounts.set('unverified-credential', {
        sub: 'google-unverified',
        email: 'victim@example.com',
        email_verified: false,
      });

      await loginWithGoogle('unverified-credential').expect(401);

      expect(db.users[0]).toMatchObject({ googleId: null, emailVerified: false });
    });
  });
});

describe('unproven email access', () => {
  it('means a password, or an email nobody has verified', () => {
    expect(hasUnprovenEmailAccess({ email: 'a@example.com', emailVerified: false, passwordHash: 'x:y' })).toBe(true);
    expect(hasUnprovenEmailAccess({ email: 'a@example.com', emailVerified: true, passwordHash: 'x:y' })).toBe(true);
    expect(hasUnprovenEmailAccess({ email: 'a@example.com', emailVerified: false, passwordHash: null })).toBe(true);
    expect(hasUnprovenEmailAccess({ email: 'a@example.com', emailVerified: true, passwordHash: null })).toBe(false);
    // Telegram-only accounts have no email at all.
    expect(hasUnprovenEmailAccess({ email: null, emailVerified: false, passwordHash: null })).toBe(false);
  });

  describe('connecting Telegram', () => {
    const USER_ID = '7f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b';

    function preferencesFor(user: Row) {
      const prisma = { user: { findUnique: jest.fn().mockResolvedValue(user) } };
      const config = { get: (key: string) => (key === 'JWT_SECRET' ? ACCESS_SECRET : undefined) };
      const telegramBot = {
        canSendLifecycleNotifications: () => true,
        getBotUsername: () => 'spec_bot',
      };
      return new NotificationPreferencesService(prisma as any, config as any, telegramBot as any);
    }

    it('is refused until the owner has signed in with Google', async () => {
      const unproven = [
        { telegramId: null, email: 'victim@example.com', emailVerified: false, passwordHash: 'x:y' },
        { telegramId: null, email: 'victim@example.com', emailVerified: true, passwordHash: 'x:y' },
      ];
      for (const user of unproven) {
        const attempt = preferencesFor(user).createTelegramLink(USER_ID);
        await expect(attempt).rejects.toBeInstanceOf(ForbiddenException);
        await expect(attempt).rejects.toMatchObject({ response: { code: 'GOOGLE_SIGN_IN_REQUIRED' } });
      }
    });

    it('works for a Google-verified account', async () => {
      const link = await preferencesFor({
        telegramId: null,
        email: 'owner@example.com',
        emailVerified: true,
        passwordHash: null,
      }).createTelegramLink(USER_ID);

      expect(link.linked).toBe(false);
      expect(link.url).toMatch(/^https:\/\/t\.me\/spec_bot\?start=link_/);
    });
  });
});
