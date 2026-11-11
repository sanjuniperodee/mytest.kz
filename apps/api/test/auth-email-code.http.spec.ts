const mockSendMail = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));

import { Controller, Get, INestApplication, UseGuards } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { AuthGuard, PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { createHash, randomUUID } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import request from 'supertest';
import { CurrentUser } from '../src/common/decorators/current-user.decorator';
import { PrismaService } from '../src/database/prisma.service';
import { REDIS_CLIENT } from '../src/database/redis.module';
import { AuthController } from '../src/modules/auth/auth.controller';
import { AuthService } from '../src/modules/auth/auth.service';
import { EmailCodeService } from '../src/modules/auth/email-code.service';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { TelegramAuthService } from '../src/modules/auth/telegram-auth.service';
import { MailerService } from '../src/modules/notifications/channels/mailer.service';
import { NotificationPreferencesService } from '../src/modules/notifications/notification-preferences.service';
import { AccessService } from '../src/modules/subscriptions/access.service';
import { TelegramBotService } from '../src/modules/telegram/telegram-bot.service';
import { Row, fakeDatabase, fakeRedis, passwordHash, userRow } from './support/auth-fakes';

/**
 * The second proof of email ownership: a one-time code mailed to the address.
 *
 * Same threat as the Google take-back (auth-email-google-takeover.http.spec.ts): a stranger
 * registered someone's address first, with a password of their own, and the real owner comes back
 * with no Google account to prove it. These tests drive the HTTP endpoints against an in-memory
 * database, an in-memory Redis with a clock the tests control, and the real mailer with SMTP
 * mocked.
 */

const ACCESS_SECRET = 'auth-email-code-spec-access-secret';
const REFRESH_SECRET = 'auth-email-code-spec-refresh-secret';
const DAY_MS = 86_400_000;
const MINUTE_MS = 60_000;
const HOUR_MS = 3_600_000;
const INVALID_CODE = 'Неверный или истёкший код';

const BASE_CONFIG: Record<string, string> = {
  JWT_SECRET: ACCESS_SECRET,
  JWT_REFRESH_SECRET: REFRESH_SECRET,
  GOOGLE_CLIENT_ID: 'spec-client.apps.googleusercontent.com',
  AUTH_EMAIL_CODE_ENABLED: '1',
  SMTP_HOST: 'smtp.example.test',
  MAIL_FROM: 'mytest <noreply@my-test.kz>',
  MAIL_DAILY_CAP: '90',
  MAIL_AUTH_DAILY_CAP: '20',
};

@Controller('probe')
class ProbeController {
  /** Any logged-in route: answers only while the caller's session is alive. */
  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  me(@CurrentUser('id') userId: string) {
    return { userId };
  }
}

/** The mail goes out after the response; let it finish. */
const settle = () => new Promise((resolve) => setImmediate(resolve));

describe('sign-in with a code mailed to the address', () => {
  let app: INestApplication;
  let jwt: JwtService;
  let mailer: MailerService;
  let db: ReturnType<typeof fakeDatabase>;
  let redis: ReturnType<typeof fakeRedis>;
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

  async function startApp(overrides: Record<string, string> = {}) {
    db = fakeDatabase();
    redis = fakeRedis();
    googleAccounts.clear();
    mockSendMail.mockReset();
    mockSendMail.mockResolvedValue({ messageId: '<sent@test>' });
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({
          isGlobal: true,
          ignoreEnvFile: true,
          load: [() => ({ ...BASE_CONFIG, ...overrides })],
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
        EmailCodeService,
        MailerService,
        JwtStrategy,
        { provide: PrismaService, useValue: db.prisma },
        { provide: TelegramAuthService, useValue: {} },
        { provide: TelegramBotService, useValue: {} },
        { provide: AccessService, useValue: { ensureFreeEntitlementsForUser: async () => undefined } },
        { provide: REDIS_CLIENT, useValue: redis },
      ],
    }).compile();
    app = module.createNestApplication();
    await app.init();
    jwt = module.get(JwtService);
    mailer = module.get(MailerService);
  }

  beforeEach(async () => {
    await startApp();
  });

  afterEach(async () => {
    await app.close();
  });

  const http = () => request(app.getHttpServer());
  const requestCode = (email: string) => http().post('/auth/email/request-code').send({ email });
  const verifyCode = (email: string, code: string) =>
    http().post('/auth/email/verify-code').send({ email, code });
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

  const storedUser = (id: string) => db.users.find((user) => user.id === id)!;
  const sentMails = () => mockSendMail.mock.calls.map(([message]) => message);

  /** Asks for a code for `email` and reads it out of the mail that was sent. */
  async function codeMailedTo(email: string) {
    const before = sentMails().length;
    await requestCode(email).expect(201);
    await settle();
    const mails = sentMails();
    expect(mails).toHaveLength(before + 1);
    const code = /\b(\d{6})\b/.exec(mails[mails.length - 1].text)?.[1];
    expect(code).toBeDefined();
    return code as string;
  }

  const wrongCodeFor = (code: string) => (code === '000000' ? '111111' : '000000');

  describe('a stranger registered the owner’s address first', () => {
    const EMAIL = 'owner@mail.example.kz';
    const PASSWORD = 'stranger-password';
    let account: Row;
    let stranger: ReturnType<typeof seedSession>;

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
      stranger = seedSession(account.id);
      db.pushSubscriptions.push({ id: randomUUID(), userId: account.id, endpoint: 'https://push.example/stranger' });
    });

    it('signs the real owner in and gives the account to them', async () => {
      await whoAmI(stranger.accessToken).expect(200);
      const code = await codeMailedTo(EMAIL);

      const owner = await verifyCode(EMAIL, code).expect(201);

      expect(owner.body.user.id).toBe(account.id);
      expect(owner.body.user.email).toBe(EMAIL);
      expect(storedUser(account.id)).toMatchObject({
        email: EMAIL,
        emailVerified: true,
        passwordHash: null,
        googleId: null,
        telegramId: null,
        telegramUsername: null,
        telegramLinkedAt: null,
        phone: null,
        isChannelMember: true,
      });
      expect(db.users).toHaveLength(1);
      expect(db.pushSubscriptions).toHaveLength(0);
      expect(redis.deleted).toContain(`parent-report:link:${account.id}`);
      expect([owner.headers['set-cookie']].flat().join(';')).toContain('mytest_refresh_token=');

      const me = await whoAmI(owner.body.accessToken).expect(200);
      expect(me.body.userId).toBe(account.id);
      const renewed = await refresh(owner.body.refreshToken).expect(201);
      await whoAmI(renewed.body.accessToken).expect(200);
    });

    it('cuts off the stranger’s session and password', async () => {
      const code = await codeMailedTo(EMAIL);
      await verifyCode(EMAIL, code).expect(201);

      await whoAmI(stranger.accessToken).expect(401);
      await refresh(stranger.refreshToken).expect(401);
      await loginWithPassword(EMAIL, PASSWORD).expect(401);
    });

    it('does not bring the password back: the code is the login', async () => {
      const code = await codeMailedTo(EMAIL);
      await verifyCode(EMAIL, code).expect(201);

      const refused = await loginWithPassword(EMAIL, PASSWORD).expect(401);

      expect(refused.body.message).toBe('Неверный email или пароль');
      expect(storedUser(account.id).passwordHash).toBeNull();
    });

    it('points a password login at the two ways in that work', async () => {
      const refused = await loginWithPassword(EMAIL, PASSWORD).expect(401);

      expect(refused.body.message).toContain('Вход по паролю');
      expect(refused.body.message).toContain('Google');
      expect(refused.body.message).toContain('по коду из письма');
    });

    it('does not sign the owner out again on later code sign-ins', async () => {
      const first = await verifyCode(EMAIL, await codeMailedTo(EMAIL)).expect(201);
      redis.advance(2 * MINUTE_MS);
      redis.deleted.length = 0;

      const second = await verifyCode(EMAIL, await codeMailedTo(EMAIL)).expect(201);

      expect(second.body.user.id).toBe(account.id);
      await whoAmI(first.body.accessToken).expect(200);
      await whoAmI(second.body.accessToken).expect(200);
      expect(redis.deleted).not.toContain(`parent-report:link:${account.id}`);
    });

    it('keeps results and profile: the account is the same row', async () => {
      const results = [{ id: randomUUID(), userId: account.id, rawScore: 96 }];
      const before = JSON.parse(JSON.stringify(results));

      const owner = await verifyCode(EMAIL, await codeMailedTo(EMAIL)).expect(201);

      expect(owner.body.user).toMatchObject({ id: account.id, firstName: 'Stranger' });
      expect(results).toEqual(before);
    });

    it('matches the address whatever its letter case and spaces', async () => {
      await requestCode('  Owner@Mail.Example.KZ ').expect(201);
      await settle();
      const code = /\b(\d{6})\b/.exec(sentMails()[0].text)![1];

      const owner = await verifyCode('OWNER@mail.example.kz', code).expect(201);

      expect(owner.body.user.id).toBe(account.id);
    });
  });

  describe('what the mail says and who receives it', () => {
    it('sends one plain message to the address, without unsubscribe headers or the code in the subject', async () => {
      seedUser({ email: 'a@mail.example.kz', passwordHash: passwordHash('pw-123456') });

      const code = await codeMailedTo('a@mail.example.kz');

      const [message] = sentMails();
      expect(message).toMatchObject({ to: 'a@mail.example.kz', from: 'mytest <noreply@my-test.kz>' });
      expect(message.subject).toBe('Код для входа в my-test.kz');
      expect(message.subject).not.toContain(code);
      expect(message.html).toContain(code);
      expect(message.text).toContain('10 минут');
      expect(message.headers).toEqual({});
    });

    it('writes in Kazakh to an account that prefers it', async () => {
      seedUser({ email: 'kk@mail.example.kz', passwordHash: passwordHash('pw-123456'), preferredLanguage: 'kk' });

      await codeMailedTo('kk@mail.example.kz');

      expect(sentMails()[0].subject).toBe('my-test.kz сайтына кіру коды');
    });

    it('keeps the code itself out of Redis', async () => {
      seedUser({ email: 'a@mail.example.kz', passwordHash: passwordHash('pw-123456') });

      const code = await codeMailedTo('a@mail.example.kz');

      const stored = [...redis.snapshot().entries()];
      expect(stored.length).toBeGreaterThan(0);
      for (const [key, value] of stored) {
        expect(key).not.toContain('a@mail.example.kz');
        expect(`${key} ${value}`).not.toContain(code);
      }
    });

    it('does not mail an account that already signs in with Google', async () => {
      seedUser({ email: 'g@mail.example.kz', emailVerified: true, googleId: 'google-owner' });

      await requestCode('g@mail.example.kz').expect(201);
      await settle();

      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  describe('no way to learn which addresses have accounts', () => {
    beforeEach(() => {
      seedUser({ email: 'known@mail.example.kz', passwordHash: passwordHash('pw-123456') });
      seedUser({ email: 'google@mail.example.kz', emailVerified: true, googleId: 'google-owner' });
    });

    it('answers a request for an unknown address exactly like one for a known address', async () => {
      const known = await requestCode('known@mail.example.kz').expect(201);
      const unknown = await requestCode('nobody@mail.example.kz').expect(201);
      const withGoogle = await requestCode('google@mail.example.kz').expect(201);
      await settle();

      expect(known.body).toEqual({ ok: true });
      expect(unknown.body).toEqual(known.body);
      expect(withGoogle.body).toEqual(known.body);
      expect(sentMails()).toHaveLength(1);
      expect(sentMails()[0].to).toBe('known@mail.example.kz');
    });

    it('refuses a second request the same way for known and unknown addresses', async () => {
      const outcomes: Array<{ status: number; message: string }> = [];
      for (const email of ['known@mail.example.kz', 'nobody@mail.example.kz']) {
        await requestCode(email).expect(201);
        const again = await requestCode(email);
        outcomes.push({ status: again.status, message: again.body.message });
      }

      expect(outcomes[0]).toEqual({ status: 429, message: 'Код уже отправлен. Попробуйте чуть позже' });
      expect(outcomes[1]).toEqual(outcomes[0]);
    });

    it('answers a wrong code for an unknown address exactly like one for a known address', async () => {
      const code = await codeMailedTo('known@mail.example.kz');

      const wrong = await verifyCode('known@mail.example.kz', wrongCodeFor(code)).expect(401);
      const unknown = await verifyCode('nobody@mail.example.kz', wrongCodeFor(code)).expect(401);
      const withGoogle = await verifyCode('google@mail.example.kz', wrongCodeFor(code)).expect(401);

      expect(wrong.body).toEqual(unknown.body);
      expect(wrong.body).toEqual(withGoogle.body);
      expect(wrong.body.message).toBe(INVALID_CODE);
    });

    it('asks for a well-formed address and says so for anything else', async () => {
      await requestCode('not-an-address').expect(400);
      await requestCode('').expect(400);
      await http().post('/auth/email/request-code').send({}).expect(400);
      await http().post('/auth/email/request-code').send({ email: { $ne: null } }).expect(400);
      expect(redis.snapshot().size).toBe(0);
    });
  });

  describe('a code that must not work', () => {
    const EMAIL = 'owner@mail.example.kz';
    let account: Row;
    let session: ReturnType<typeof seedSession>;

    beforeEach(() => {
      account = seedUser({ email: EMAIL, passwordHash: passwordHash('stranger-pw'), emailVerified: false });
      session = seedSession(account.id);
    });

    const nothingChanged = async () => {
      expect(storedUser(account.id).passwordHash).not.toBeNull();
      await whoAmI(session.accessToken).expect(200);
    };

    it('is used up by its first use', async () => {
      const code = await codeMailedTo(EMAIL);
      await verifyCode(EMAIL, code).expect(201);

      const again = await verifyCode(EMAIL, code).expect(401);

      expect(again.body.message).toBe(INVALID_CODE);
    });

    it('expires after ten minutes', async () => {
      const code = await codeMailedTo(EMAIL);
      redis.advance(10 * MINUTE_MS + 1000);

      await verifyCode(EMAIL, code).expect(401);
      await nothingChanged();
    });

    it('still works just before it expires', async () => {
      const code = await codeMailedTo(EMAIL);
      redis.advance(10 * MINUTE_MS - 1000);

      await verifyCode(EMAIL, code).expect(201);
    });

    it('is not the one that was asked for: a wrong code is refused', async () => {
      const code = await codeMailedTo(EMAIL);

      await verifyCode(EMAIL, wrongCodeFor(code)).expect(401);
      await nothingChanged();
    });

    it('does not open another address, even with the right digits', async () => {
      seedUser({ email: 'other@mail.example.kz', passwordHash: passwordHash('pw-123456') });
      const code = await codeMailedTo(EMAIL);

      await verifyCode('other@mail.example.kz', code).expect(401);
      await nothingChanged();
    });

    it('is replaced by the next one', async () => {
      const first = await codeMailedTo(EMAIL);
      redis.advance(2 * MINUTE_MS);
      const second = await codeMailedTo(EMAIL);
      expect(second).not.toBe(first);

      await verifyCode(EMAIL, first).expect(401);
      await verifyCode(EMAIL, second).expect(201);
    });

    it('dies with the fifth wrong try, and the right code is then refused too', async () => {
      const code = await codeMailedTo(EMAIL);
      const wrong = wrongCodeFor(code);

      for (let attempt = 0; attempt < 5; attempt++) {
        await verifyCode(EMAIL, wrong).expect(401);
      }
      const late = await verifyCode(EMAIL, code).expect(401);

      expect(late.body.message).toBe(INVALID_CODE);
      await nothingChanged();
    });

    it('survives four wrong tries', async () => {
      const code = await codeMailedTo(EMAIL);
      for (let attempt = 0; attempt < 4; attempt++) {
        await verifyCode(EMAIL, wrongCodeFor(code)).expect(401);
      }

      await verifyCode(EMAIL, code).expect(201);
    });

    it('does not give a new code more guesses than five', async () => {
      const first = await codeMailedTo(EMAIL);
      for (let attempt = 0; attempt < 3; attempt++) {
        await verifyCode(EMAIL, wrongCodeFor(first)).expect(401);
      }
      redis.advance(2 * MINUTE_MS);
      const second = await codeMailedTo(EMAIL);
      for (let attempt = 0; attempt < 5; attempt++) {
        await verifyCode(EMAIL, wrongCodeFor(second)).expect(401);
      }

      await verifyCode(EMAIL, second).expect(401);
    });

    it('is refused when it is not six digits', async () => {
      await codeMailedTo(EMAIL);

      for (const bad of ['12345', '1234567', 'abcdef', '12 456', '']) {
        await verifyCode(EMAIL, bad).expect(401);
      }
      await http().post('/auth/email/verify-code').send({ email: EMAIL }).expect(401);
      await http().post('/auth/email/verify-code').send({ email: EMAIL, code: { $ne: 0 } }).expect(401);
    });

    it('is refused once the account has signed in with Google in the meantime', async () => {
      const code = await codeMailedTo(EMAIL);
      googleAccountFor('owner-credential', EMAIL, 'google-owner');
      await loginWithGoogle('owner-credential').expect(201);

      await verifyCode(EMAIL, code).expect(401);

      expect(storedUser(account.id)).toMatchObject({ googleId: 'google-owner', passwordHash: null });
    });

    it('is refused when the account no longer has that address', async () => {
      const code = await codeMailedTo(EMAIL);
      storedUser(account.id).email = 'moved@mail.example.kz';

      await verifyCode(EMAIL, code).expect(401);
    });

    it('is refused for an account that was deleted', async () => {
      const code = await codeMailedTo(EMAIL);
      db.users.splice(0, db.users.length);

      await verifyCode(EMAIL, code).expect(401);
    });

    function googleAccountFor(credential: string, email: string, sub: string) {
      googleAccounts.set(credential, {
        sub,
        email,
        email_verified: true,
        given_name: 'Google',
        family_name: 'Name',
      });
    }
  });

  describe('an account that needs no take-back', () => {
    it('signs in without touching other sessions, the Telegram link or push', async () => {
      const account = seedUser({
        email: 'plain@mail.example.kz',
        emailVerified: true,
        telegramId: BigInt(555000222),
        telegramUsername: 'plain',
        telegramLinkedAt: new Date(),
        phone: '+77010000002',
      });
      const otherDevice = seedSession(account.id);
      db.pushSubscriptions.push({ id: randomUUID(), userId: account.id, endpoint: 'https://push.example/own' });

      const response = await verifyCode('plain@mail.example.kz', await codeMailedTo('plain@mail.example.kz')).expect(201);

      expect(response.body.user.id).toBe(account.id);
      await whoAmI(otherDevice.accessToken).expect(200);
      expect(storedUser(account.id)).toMatchObject({ telegramId: BigInt(555000222), phone: '+77010000002' });
      expect(db.pushSubscriptions).toHaveLength(1);
      expect(redis.deleted).not.toContain(`parent-report:link:${account.id}`);
    });
  });

  describe('limits', () => {
    const EMAIL = 'owner@mail.example.kz';

    beforeEach(() => {
      seedUser({ email: EMAIL, passwordHash: passwordHash('pw-123456') });
    });

    it('allows one request a minute per address', async () => {
      await requestCode(EMAIL).expect(201);
      const early = await requestCode(EMAIL).expect(429);
      expect(early.body.message).toBe('Код уже отправлен. Попробуйте чуть позже');

      redis.advance(61_000);
      await requestCode(EMAIL).expect(201);
    });

    it('allows three requests an hour per address', async () => {
      for (let request = 0; request < 3; request++) {
        await requestCode(EMAIL).expect(201);
        redis.advance(61_000);
      }

      const fourth = await requestCode(EMAIL).expect(429);
      expect(fourth.body.message).toBe('Слишком много запросов кода. Попробуйте позже');
      await settle();
      expect(sentMails()).toHaveLength(3);

      redis.advance(HOUR_MS);
      await requestCode(EMAIL).expect(201);
    });

    it('allows six requests a day per address', async () => {
      for (let hour = 0; hour < 2; hour++) {
        for (let request = 0; request < 3; request++) {
          await requestCode(EMAIL).expect(201);
          redis.advance(61_000);
        }
        redis.advance(HOUR_MS);
      }

      await requestCode(EMAIL).expect(429);

      redis.advance(DAY_MS);
      await requestCode(EMAIL).expect(201);
    });

    it('counts addresses separately', async () => {
      seedUser({ email: 'second@mail.example.kz', passwordHash: passwordHash('pw-123456') });
      await requestCode(EMAIL).expect(201);

      await requestCode('second@mail.example.kz').expect(201);
    });

    it('allows twenty requests an hour from one IP, whatever the addresses', async () => {
      for (let request = 0; request < 20; request++) {
        await requestCode(`person${request}@mail.example.kz`).expect(201);
      }

      const refused = await requestCode('person20@mail.example.kz').expect(429);
      expect(refused.body.message).toBe('Слишком много запросов кода. Попробуйте позже');

      redis.advance(HOUR_MS + 1000);
      await requestCode('person21@mail.example.kz').expect(201);
    });
  });

  describe('the mail budget', () => {
    beforeEach(async () => {
      await app.close();
      await startApp({ MAIL_DAILY_CAP: '30', MAIL_AUTH_DAILY_CAP: '2' });
      for (const name of ['a', 'b', 'c']) {
        seedUser({ email: `${name}@mail.example.kz`, passwordHash: passwordHash('pw-123456') });
      }
    });

    it('stops sign-in mail at its own cap and then refuses every address the same way', async () => {
      await requestCode('a@mail.example.kz').expect(201);
      await requestCode('b@mail.example.kz').expect(201);
      await settle();
      expect(sentMails()).toHaveLength(2);

      const known = await requestCode('c@mail.example.kz').expect(503);
      const unknown = await requestCode('nobody@mail.example.kz').expect(503);
      await settle();

      expect(unknown.body).toEqual(known.body);
      expect(known.body.code).toBe('EMAIL_CODE_UNAVAILABLE');
      expect(sentMails()).toHaveLength(2);
    });

    it('keeps the sign-in reserve out of the campaigns’ share, and the two together under the total', async () => {
      expect(mailer.getDailyCap()).toBe(30);
      expect(mailer.getAuthDailyCap()).toBe(2);
      expect(mailer.getCampaignDailyCap()).toBe(28);

      await requestCode('a@mail.example.kz').expect(201);
      await requestCode('b@mail.example.kz').expect(201);
      await settle();
      await expect(mailer.hasAuthCapacity()).resolves.toBe(false);
      // Campaigns are unaffected by what sign-in used.
      await expect(mailer.hasCapacity()).resolves.toBe(true);
      const message = { to: 'x@mail.example.kz', subject: 's', html: '<p>h</p>', text: 't' };
      for (let sent = 0; sent < 28; sent++) {
        await expect(mailer.send(message)).resolves.toMatchObject({ status: 'sent' });
      }
      await expect(mailer.send(message)).resolves.toEqual({ status: 'skipped', reason: 'daily_cap' });
      await expect(mailer.sentToday()).resolves.toBe(28);
      await expect(mailer.sentToday(new Date(), 'auth')).resolves.toBe(2);
    });

    it('does not let campaigns use up what sign-in needs', async () => {
      const message = { to: 'x@mail.example.kz', subject: 's', html: '<p>h</p>', text: 't' };
      for (let sent = 0; sent < 28; sent++) await mailer.send(message);
      await expect(mailer.hasCapacity()).resolves.toBe(false);

      await requestCode('a@mail.example.kz').expect(201);
      await settle();

      expect(sentMails().filter((mail) => mail.to === 'a@mail.example.kz')).toHaveLength(1);
    });

    it('does not spend any of it on addresses without an account', async () => {
      for (let request = 0; request < 5; request++) {
        await requestCode(`nobody${request}@mail.example.kz`).expect(201);
      }
      await settle();

      await expect(mailer.sentToday(new Date(), 'auth')).resolves.toBe(0);
    });
  });

  describe('when the mail cannot be sent', () => {
    beforeEach(() => {
      seedUser({ email: 'owner@mail.example.kz', passwordHash: passwordHash('pw-123456') });
    });

    it('refuses every address the same way while SMTP is not set up', async () => {
      await app.close();
      await startApp({ SMTP_HOST: '' });
      seedUser({ email: 'owner@mail.example.kz', passwordHash: passwordHash('pw-123456') });

      const known = await requestCode('owner@mail.example.kz').expect(503);
      const unknown = await requestCode('nobody@mail.example.kz').expect(503);

      expect(unknown.body).toEqual(known.body);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    it('still answers ok when the mail server fails after the budget check', async () => {
      mockSendMail.mockRejectedValue(new Error('smtp down'));

      const response = await requestCode('owner@mail.example.kz').expect(201);
      await settle();

      expect(response.body).toEqual({ ok: true });
    });
  });

  describe('switched off', () => {
    it('is off unless AUTH_EMAIL_CODE_ENABLED is set, and sends nothing', async () => {
      await app.close();
      await startApp({ AUTH_EMAIL_CODE_ENABLED: '' });
      const account = seedUser({ email: 'owner@mail.example.kz', passwordHash: passwordHash('pw-123456') });

      const request = await requestCode('owner@mail.example.kz').expect(503);
      await verifyCode('owner@mail.example.kz', '123456').expect(503);

      expect(request.body.code).toBe('EMAIL_CODE_UNAVAILABLE');
      expect(mockSendMail).not.toHaveBeenCalled();
      expect(redis.snapshot().size).toBe(0);
      expect(storedUser(account.id).passwordHash).not.toBeNull();
      expect(mailer.getAuthDailyCap()).toBe(0);
      expect(mailer.getCampaignDailyCap()).toBe(90);
    });

    it('tells the login page whether to show the door at all', async () => {
      await http().get('/auth/email/status').expect(200, { enabled: true });

      await app.close();
      await startApp({ AUTH_EMAIL_CODE_ENABLED: '' });

      await http().get('/auth/email/status').expect(200, { enabled: false });
    });

    it('does not mention the code in the password refusal', async () => {
      await app.close();
      await startApp({ AUTH_EMAIL_CODE_ENABLED: '' });
      seedUser({ email: 'owner@mail.example.kz', passwordHash: passwordHash('pw'), googleId: 'g', emailVerified: true });

      const refused = await loginWithPassword('owner@mail.example.kz', 'pw').expect(401);

      expect(refused.body.message).toContain('Войдите через Google');
      expect(refused.body.message).not.toContain('по коду');
    });
  });
});

describe('connecting Telegram while the account is still unproven', () => {
  function preferencesFor(config: Record<string, string>) {
    const prisma = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          telegramId: null,
          email: 'victim@example.com',
          emailVerified: false,
          passwordHash: 'x:y',
        }),
      },
    };
    const configService = { get: (key: string) => config[key] };
    const telegramBot = { canSendLifecycleNotifications: () => true, getBotUsername: () => 'spec_bot' };
    return new NotificationPreferencesService(prisma as any, configService as any, telegramBot as any);
  }

  it('names both ways in once the mailed code is on, and keeps the same error code', async () => {
    const attempt = preferencesFor({ AUTH_EMAIL_CODE_ENABLED: '1' }).createTelegramLink('7f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b');
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'GOOGLE_SIGN_IN_REQUIRED', message: expect.stringContaining('по коду из письма') },
    });
  });

  it('names only Google while it is off', async () => {
    const attempt = preferencesFor({}).createTelegramLink('7f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b');
    await expect(attempt).rejects.toMatchObject({
      response: { code: 'GOOGLE_SIGN_IN_REQUIRED', message: 'Войдите через Google, чтобы подключить Telegram' },
    });
  });
});
