const mockSendMail = jest.fn();
const mockSendNotification = jest.fn();

jest.mock('nodemailer', () => ({
  createTransport: jest.fn(() => ({ sendMail: mockSendMail })),
}));
jest.mock('web-push', () => ({
  setVapidDetails: jest.fn(),
  sendNotification: (...args: unknown[]) => mockSendNotification(...args),
}));

import { ExecutionContext, INestApplication, Logger, ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { ChannelMemberGuard } from '../src/common/guards/channel-member.guard';
import { isChannelGateExempt } from '../src/common/channel-gate';
import { PrismaService } from '../src/database/prisma.service';
import { MailerService } from '../src/modules/notifications/channels/mailer.service';
import {
  WebPushService,
  isAllowedPushEndpoint,
} from '../src/modules/notifications/channels/web-push.service';
import {
  reachableUserWhere,
  selectChannels,
  userChannelEligibility,
} from '../src/modules/notifications/notification-channels';
import { NotificationPreferencesService } from '../src/modules/notifications/notification-preferences.service';
import {
  TELEGRAM_LINK_PREFIX,
  createTelegramLinkToken,
  createUnsubscribeToken,
  verifyTelegramLinkToken,
  verifyUnsubscribeToken,
} from '../src/modules/notifications/notification-tokens';
import { NotificationsController } from '../src/modules/notifications/notifications.controller';
import { NotificationsService } from '../src/modules/notifications/notifications.service';
import { TelegramBotService } from '../src/modules/telegram/telegram-bot.service';

const SECRET = 'test-secret-for-notification-links';
const USER_ID = '7b0f6a52-3c1d-4e8f-9a2b-1c2d3e4f5a6b';
const FCM_ENDPOINT = 'https://fcm.googleapis.com/fcm/send/abc123:APA91bExample';
const P256DH =
  'BNcRdreALRFXTkOOUHK1EtK2wtaz5Ry4YfYCA_0QTpQtUbVlUls0VJXg7A8u-Ts1XbjhazAkj7I99e8QcYP7DkM';
const AUTH = 'tBHItJI5svbpez7KI4CCXg';

function config(values: Record<string, string | undefined>) {
  return { get: jest.fn((key: string) => values[key]) };
}

function fakeRedis() {
  const store = new Map<string, number>();
  return {
    store,
    get: jest.fn(async (key: string) => (store.has(key) ? String(store.get(key)) : null)),
    incr: jest.fn(async (key: string) => {
      store.set(key, (store.get(key) ?? 0) + 1);
      return store.get(key)!;
    }),
    decr: jest.fn(async (key: string) => {
      store.set(key, (store.get(key) ?? 0) - 1);
      return store.get(key)!;
    }),
    expire: jest.fn(async () => 1),
    set: jest.fn(async () => 'OK'),
    eval: jest.fn(async () => 1),
  };
}

beforeEach(() => {
  mockSendMail.mockReset();
  mockSendNotification.mockReset();
});

describe('MailerService', () => {
  it('is a no-op without SMTP_HOST and logs that only once', async () => {
    const log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
    const redis = fakeRedis();
    const mailer = new MailerService(config({}) as any, redis as any);
    mailer.onModuleInit();
    const message = { to: 'a@gmail.com', subject: 's', html: '<p>h</p>', text: 't' };
    await expect(mailer.send(message)).resolves.toEqual({ status: 'skipped', reason: 'not_configured' });
    await expect(mailer.send(message)).resolves.toEqual({ status: 'skipped', reason: 'not_configured' });
    expect(mailer.isConfigured()).toBe(false);
    await expect(mailer.hasCapacity()).resolves.toBe(false);
    expect(log.mock.calls.filter(([text]) => String(text).includes('SMTP_HOST'))).toHaveLength(1);
    expect(mockSendMail).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
    log.mockRestore();
  });

  it('sends with List-Unsubscribe headers and stops at MAIL_DAILY_CAP', async () => {
    mockSendMail.mockResolvedValue({ messageId: '<m1@test>' });
    const redis = fakeRedis();
    const mailer = new MailerService(
      config({ SMTP_HOST: 'smtp.gmail.com', SMTP_USER: 'mytest@gmail.com', SMTP_PASS: 'x', MAIL_DAILY_CAP: '1' }) as any,
      redis as any,
    );
    const message = {
      to: 'a@gmail.com',
      subject: 's',
      html: '<p>h</p>',
      text: 't',
      unsubscribeUrl: 'https://my-test.kz/api/v1/notifications/unsubscribe?t=abc',
    };
    await expect(mailer.send(message)).resolves.toEqual({ status: 'sent', messageId: '<m1@test>' });
    await expect(mailer.send(message)).resolves.toEqual({ status: 'skipped', reason: 'daily_cap' });
    expect(mockSendMail).toHaveBeenCalledTimes(1);
    expect(mockSendMail.mock.calls[0][0]).toMatchObject({
      from: '"mytest" <mytest@gmail.com>',
      headers: {
        'List-Unsubscribe': '<https://my-test.kz/api/v1/notifications/unsubscribe?t=abc>',
        'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
      },
    });
    await expect(mailer.sentToday()).resolves.toBe(1);
  });
});

describe('notification link tokens', () => {
  it('round-trips the unsubscribe token and rejects tampering or another secret', () => {
    const token = createUnsubscribeToken(USER_ID, SECRET);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(verifyUnsubscribeToken(token, SECRET)).toEqual({ userId: USER_ID });
    const tampered = `${token.slice(0, 10)}${token[10] === 'A' ? 'B' : 'A'}${token.slice(11)}`;
    expect(verifyUnsubscribeToken(tampered, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(token, `${SECRET}-other`)).toBeNull();
    expect(verifyUnsubscribeToken('garbage', SECRET)).toBeNull();
  });

  it('builds a Telegram start payload that fits the 64-char limit and expires', () => {
    const now = new Date('2026-11-10T10:00:00Z');
    const { token, expiresAt } = createTelegramLinkToken(USER_ID, SECRET, now);
    const payload = `${TELEGRAM_LINK_PREFIX}${token}`;
    expect(payload).toMatch(/^[A-Za-z0-9_-]{1,64}$/);
    expect(verifyTelegramLinkToken(token, SECRET, now)).toEqual({ userId: USER_ID, expiresAt });
    expect(verifyTelegramLinkToken(token, SECRET, new Date(expiresAt.getTime() + 1000))).toBeNull();
    // A link token is not an unsubscribe token (separate keys per purpose).
    expect(verifyUnsubscribeToken(token, SECRET)).toBeNull();
  });
});

describe('channel selection', () => {
  const all = { push: true, telegram: true, email: true };
  const googleUser = {
    telegramId: null,
    email: 'a@gmail.com',
    googleId: 'g-1',
    emailVerified: true,
    emailOptOutAt: null,
    _count: { pushSubscriptions: 0 },
  };

  it('prefers push, then Telegram, then email', () => {
    const everything = {
      ...googleUser,
      telegramId: BigInt(5),
      telegramLinkedAt: new Date(),
      _count: { pushSubscriptions: 2 },
    };
    expect(selectChannels(userChannelEligibility(everything), all, ['push', 'telegram', 'email'])).toEqual(['push']);
    expect(
      selectChannels(userChannelEligibility(everything), { ...all, push: false }, ['push', 'telegram', 'email']),
    ).toEqual(['telegram']);
    expect(selectChannels(userChannelEligibility(everything), all, ['email', 'telegram'])).toEqual(['telegram']);
    expect(selectChannels(userChannelEligibility(everything), all, ['push', 'telegram', 'email'], 3)).toEqual([
      'push',
      'telegram',
      'email',
    ]);
  });

  it('applies per-user opt-outs', () => {
    expect(userChannelEligibility(googleUser)).toEqual({ push: false, telegram: false, email: true });
    expect(userChannelEligibility({ ...googleUser, emailOptOutAt: new Date() }).email).toBe(false);
    expect(userChannelEligibility({ ...googleUser, googleId: null }).email).toBe(false);
    // Telegram: muted with /stop, or a bot stub without a phone, is not reachable.
    expect(userChannelEligibility({ telegramId: BigInt(1), phone: '77001112233' }).telegram).toBe(true);
    expect(
      userChannelEligibility({ telegramId: BigInt(1), phone: '77001112233', notificationsMutedAt: new Date() })
        .telegram,
    ).toBe(false);
    expect(userChannelEligibility({ telegramId: BigInt(1), phone: null }).telegram).toBe(false);
    expect(userChannelEligibility({ telegramId: BigInt(1), telegramLinkedAt: new Date() }).telegram).toBe(true);
  });

  it('matches nobody when no channel is configured', () => {
    expect(reachableUserWhere(['push', 'telegram', 'email'], { push: false, telegram: false, email: false })).toEqual({
      id: { in: [] },
    });
  });

  it('never gates web accounts that linked Telegram for reminders', async () => {
    expect(isChannelGateExempt({ telegramId: null })).toBe(true);
    expect(isChannelGateExempt({ telegramId: BigInt(5), telegramLinkedAt: new Date() })).toBe(true);
    expect(isChannelGateExempt({ telegramId: BigInt(5), telegramLinkedAt: null })).toBe(false);

    const telegramBot = { checkChannelMembership: jest.fn() };
    const guard = new ChannelMemberGuard(
      {
        user: {
          findUnique: jest.fn().mockResolvedValue({
            id: USER_ID,
            telegramId: BigInt(5),
            telegramLinkedAt: new Date(),
            isChannelMember: false,
            channelCheckedAt: null,
          }),
        },
      } as any,
      telegramBot as any,
      config({}) as any,
    );
    const context = {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: USER_ID } }) }),
    } as unknown as ExecutionContext;
    await expect(guard.canActivate(context)).resolves.toBe(true);
    expect(telegramBot.checkChannelMembership).not.toHaveBeenCalled();
  });
});

describe('WebPushService', () => {
  const vapid = config({
    VAPID_PUBLIC_KEY: 'BPublicKeyExample',
    VAPID_PRIVATE_KEY: 'privateKeyExample',
    VAPID_SUBJECT: 'mailto:support@my-test.kz',
  });

  it('only accepts browser push service endpoints', () => {
    expect(isAllowedPushEndpoint(FCM_ENDPOINT)).toBe(true);
    expect(isAllowedPushEndpoint('https://updates.push.services.mozilla.com/wpush/v2/x')).toBe(true);
    expect(isAllowedPushEndpoint('https://web.push.apple.com/QGx')).toBe(true);
    expect(isAllowedPushEndpoint('https://wns2-par02p.notify.windows.com/w/?token=x')).toBe(true);
    expect(isAllowedPushEndpoint('https://evil.example.com/fcm.googleapis.com')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com.evil.com/x')).toBe(false);
    expect(isAllowedPushEndpoint('http://fcm.googleapis.com/fcm/send/x')).toBe(false);
    expect(isAllowedPushEndpoint('https://fcm.googleapis.com:8443/x')).toBe(false);
  });

  it('is disabled without VAPID keys', async () => {
    const prisma = { pushSubscription: { findMany: jest.fn() } };
    const push = new WebPushService(prisma as any, config({}) as any);
    expect(push.isConfigured()).toBe(false);
    expect(push.getPublicKey()).toBeNull();
    await expect(push.sendToUser(USER_ID, { title: 't', body: 'b', url: 'https://my-test.kz' })).resolves.toMatchObject({
      sent: 0,
    });
    expect(prisma.pushSubscription.findMany).not.toHaveBeenCalled();
  });

  it('deletes subscriptions the push service reports as gone (404/410)', async () => {
    const prisma = {
      pushSubscription: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'gone', endpoint: `${FCM_ENDPOINT}1`, p256dh: P256DH, auth: AUTH },
          { id: 'flaky', endpoint: `${FCM_ENDPOINT}2`, p256dh: P256DH, auth: AUTH },
          { id: 'ok', endpoint: `${FCM_ENDPOINT}3`, p256dh: P256DH, auth: AUTH },
        ]),
        deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    mockSendNotification
      .mockRejectedValueOnce(Object.assign(new Error('Gone'), { statusCode: 410 }))
      .mockRejectedValueOnce(Object.assign(new Error('Server error'), { statusCode: 500 }))
      .mockResolvedValueOnce({ statusCode: 201 });
    const push = new WebPushService(prisma as any, vapid as any);

    const result = await push.sendToUser(USER_ID, {
      title: 'Заголовок',
      body: 'Текст',
      url: 'https://my-test.kz/dashboard',
      tag: 'welcome',
    });

    expect(result).toMatchObject({ sent: 1, failed: 1, removed: 1, firstSuccessId: 'ok' });
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({ where: { id: 'gone' } });
    expect(prisma.pushSubscription.updateMany).toHaveBeenCalledWith({
      where: { id: 'flaky' },
      data: expect.objectContaining({ failureCount: { increment: 1 } }),
    });
    expect(prisma.pushSubscription.update).toHaveBeenCalledWith({
      where: { id: 'ok' },
      data: expect.objectContaining({ failureCount: 0 }),
    });
    expect(JSON.parse(mockSendNotification.mock.calls[2][1])).toMatchObject({
      title: 'Заголовок',
      url: 'https://my-test.kz/dashboard',
    });
  });
});

describe('notifications HTTP endpoints', () => {
  let app: INestApplication;
  const prisma = {
    user: {
      findUnique: jest.fn(),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    pushSubscription: {
      upsert: jest.fn().mockResolvedValue({ id: 'sub-1' }),
      findMany: jest.fn().mockResolvedValue([]),
      deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const env = config({
    VAPID_PUBLIC_KEY: 'BPublicKeyExample',
    VAPID_PRIVATE_KEY: 'privateKeyExample',
    VAPID_SUBJECT: 'mailto:support@my-test.kz',
    NOTIFICATIONS_TOKEN_SECRET: SECRET,
  });

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      controllers: [NotificationsController],
      providers: [
        WebPushService,
        NotificationPreferencesService,
        { provide: PrismaService, useValue: prisma },
        { provide: ConfigService, useValue: env },
        {
          provide: TelegramBotService,
          useValue: { canSendLifecycleNotifications: () => true, getBotUsername: () => 'bilimhan_bot' },
        },
      ],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate(context: ExecutionContext) {
          context.switchToHttp().getRequest().user = { id: USER_ID };
          return true;
        },
      })
      .compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  beforeEach(() => {
    prisma.user.findUnique.mockReset();
    prisma.user.updateMany.mockClear();
    prisma.pushSubscription.upsert.mockClear();
    prisma.pushSubscription.deleteMany.mockClear();
  });

  it('exposes the VAPID public key', async () => {
    const res = await request(app.getHttpServer()).get('/notifications/push/public-key').expect(200);
    expect(res.body).toEqual({ enabled: true, publicKey: 'BPublicKeyExample' });
  });

  it('stores a push subscription for the signed-in user', async () => {
    await request(app.getHttpServer())
      .post('/notifications/push/subscribe')
      .set('User-Agent', 'jest-browser')
      .send({ endpoint: FCM_ENDPOINT, expirationTime: null, keys: { p256dh: P256DH, auth: AUTH } })
      .expect(200);
    expect(prisma.pushSubscription.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { endpoint: FCM_ENDPOINT },
        create: expect.objectContaining({ userId: USER_ID, p256dh: P256DH, auth: AUTH, userAgent: 'jest-browser' }),
        update: expect.objectContaining({ userId: USER_ID }),
      }),
    );
  });

  it('rejects foreign endpoints and malformed keys', async () => {
    const evil = await request(app.getHttpServer())
      .post('/notifications/push/subscribe')
      .send({ endpoint: 'https://evil.example.com/hook', keys: { p256dh: P256DH, auth: AUTH } })
      .expect(400);
    expect(evil.body.code).toBe('PUSH_ENDPOINT_NOT_ALLOWED');
    await request(app.getHttpServer())
      .post('/notifications/push/subscribe')
      .send({ endpoint: FCM_ENDPOINT, keys: { p256dh: 'short', auth: AUTH } })
      .expect(400);
    expect(prisma.pushSubscription.upsert).not.toHaveBeenCalled();
  });

  it('removes only the caller’s subscription', async () => {
    await request(app.getHttpServer())
      .delete('/notifications/push/subscribe')
      .send({ endpoint: FCM_ENDPOINT })
      .expect(200);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { userId: USER_ID, endpoint: FCM_ENDPOINT },
    });
  });

  it('unsubscribes from email with a signed link (GET page and one-click POST)', async () => {
    prisma.user.findUnique.mockResolvedValue({ id: USER_ID, preferredLanguage: 'kk' });
    const token = createUnsubscribeToken(USER_ID, SECRET);
    const page = await request(app.getHttpServer())
      .get(`/notifications/unsubscribe?t=${token}`)
      .expect(200)
      .expect('Content-Type', /text\/html/);
    expect(page.text).toContain('Сіз хаттардан бас тарттыңыз');
    expect(prisma.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, emailOptOutAt: null },
      data: { emailOptOutAt: expect.any(Date) },
    });

    await request(app.getHttpServer())
      .post(`/notifications/unsubscribe?t=${token}`)
      .type('form')
      .send('List-Unsubscribe=One-Click')
      .expect(200, { ok: true });
  });

  it('does not unsubscribe anyone with a forged link', async () => {
    const forged = createUnsubscribeToken(USER_ID, 'another-secret-value-123');
    const page = await request(app.getHttpServer()).get(`/notifications/unsubscribe?t=${forged}`).expect(200);
    expect(page.text).toContain('Ссылка недействительна');
    await request(app.getHttpServer()).post(`/notifications/unsubscribe?t=${forged}`).expect(400);
    expect(prisma.user.updateMany).not.toHaveBeenCalled();
  });

  it('creates a Telegram connect deep link for an account without Telegram', async () => {
    prisma.user.findUnique.mockResolvedValue({ telegramId: null });
    const res = await request(app.getHttpServer()).post('/notifications/telegram/link').expect(200);
    expect(res.body.linked).toBe(false);
    const match = /^https:\/\/t\.me\/bilimhan_bot\?start=link_([A-Za-z0-9_-]+)$/.exec(res.body.url);
    expect(match).not.toBeNull();
    expect(verifyTelegramLinkToken(match![1], SECRET)?.userId).toBe(USER_ID);

    prisma.user.findUnique.mockResolvedValue({ telegramId: BigInt(42) });
    const linked = await request(app.getHttpServer()).post('/notifications/telegram/link').expect(200);
    expect(linked.body).toEqual({ linked: true, url: null, expiresAt: null });
  });
});

describe('TelegramBotService.linkTelegramAccount', () => {
  const telegramUser = { id: 777, username: 'student' };

  function setup(target: object | null, owner: object | null) {
    const tx = { user: { updateMany: jest.fn().mockResolvedValue({ count: 1 }) } };
    const prisma = {
      user: {
        findUnique: jest.fn(({ where }: { where: { id?: string } }) =>
          Promise.resolve(where.id ? target : owner),
        ),
      },
      $transaction: jest.fn((fn: (client: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const bot = new TelegramBotService(config({}) as any, prisma as any, {} as any);
    return { bot, prisma, tx };
  }

  const emptyCounts = { testSessions: 0, subscriptions: 0, paymentOrders: 0, socialPosts: 0, chatMessages: 0 };

  it('links a free Telegram account and marks it as linked', async () => {
    const { bot, tx } = setup({ id: USER_ID, telegramId: null, preferredLanguage: 'ru' }, null);
    await expect(bot.linkTelegramAccount(USER_ID, telegramUser)).resolves.toEqual({
      result: 'linked',
      language: 'ru',
    });
    expect(tx.user.updateMany).toHaveBeenCalledTimes(1);
    expect(tx.user.updateMany).toHaveBeenCalledWith({
      where: { id: USER_ID, telegramId: null },
      data: expect.objectContaining({
        telegramId: BigInt(777),
        telegramUsername: 'student',
        telegramLinkedAt: expect.any(Date),
      }),
    });
  });

  it('does nothing when the Telegram account belongs to another real user', async () => {
    const { bot, prisma } = setup(
      { id: USER_ID, telegramId: null, preferredLanguage: 'kk' },
      { id: 'other', phone: '77001112233', email: null, googleId: null, passwordHash: null, _count: emptyCounts },
    );
    await expect(bot.linkTelegramAccount(USER_ID, telegramUser)).resolves.toEqual({
      result: 'telegram_taken',
      language: 'kk',
    });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('releases an empty /start stub and links', async () => {
    const { bot, tx } = setup(
      { id: USER_ID, telegramId: null, preferredLanguage: 'ru' },
      { id: 'stub', phone: null, email: null, googleId: null, passwordHash: null, _count: emptyCounts },
    );
    await expect(bot.linkTelegramAccount(USER_ID, telegramUser)).resolves.toMatchObject({ result: 'linked' });
    expect(tx.user.updateMany).toHaveBeenNthCalledWith(1, {
      where: { id: 'stub', telegramId: BigInt(777), phone: null, email: null, googleId: null },
      data: { telegramId: null },
    });
  });

  it('keeps a stub that has activity', async () => {
    const { bot, prisma } = setup(
      { id: USER_ID, telegramId: null, preferredLanguage: 'ru' },
      { id: 'stub', phone: null, email: null, googleId: null, passwordHash: null, _count: { ...emptyCounts, testSessions: 1 } },
    );
    await expect(bot.linkTelegramAccount(USER_ID, telegramUser)).resolves.toMatchObject({ result: 'telegram_taken' });
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it('refuses when the account already has a different Telegram', async () => {
    const { bot } = setup({ id: USER_ID, telegramId: BigInt(1), preferredLanguage: 'ru' }, null);
    await expect(bot.linkTelegramAccount(USER_ID, telegramUser)).resolves.toMatchObject({
      result: 'account_has_other_telegram',
    });
  });
});

describe('NotificationsService channels', () => {
  const quietOff = config({ NOTIFICATIONS_QUIET_HOURS: '0-0', NOTIFICATIONS_TOKEN_SECRET: SECRET });

  function harness(options: {
    campaignKey: string;
    campaigns?: Array<{ key: string; isActive: boolean }>;
    users?: object[];
    sessions?: object[];
    replies?: object[];
    blocks?: object[];
    recentlyMessaged?: string[];
    capRows?: string[];
    push?: { configured: boolean; result?: object };
    mail?: boolean;
    telegram?: boolean;
    score?: object;
  }) {
    const deliveryUpsert = jest.fn(({ create }: { create: { dedupeKey: string } }) =>
      Promise.resolve({ id: `delivery:${create.dedupeKey}` }),
    );
    const prisma = {
      notificationCampaign: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue(
          (options.campaigns ?? [{ key: options.campaignKey, isActive: true }]).map((row) => ({
            ...row,
            cooldownHours: 24,
            createdAt: new Date(),
          })),
        ),
      },
      notificationRun: {
        create: jest.fn().mockResolvedValue({ id: 'run' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue(options.users ?? []),
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      testSession: { findMany: jest.fn().mockResolvedValue(options.sessions ?? []) },
      socialPost: { findMany: jest.fn().mockResolvedValue(options.replies ?? []) },
      socialBlock: { findMany: jest.fn().mockResolvedValue(options.blocks ?? []) },
      userExamEntitlement: { findFirst: jest.fn().mockResolvedValue(null) },
      subscription: { findFirst: jest.fn().mockResolvedValue(null) },
      notificationDelivery: {
        findMany: jest.fn(({ where }: { where: Record<string, unknown> }) => {
          if (where.dedupeKey) return Promise.resolve([]);
          if (where.campaignKey) return Promise.resolve((options.capRows ?? []).map((userId) => ({ userId })));
          return Promise.resolve((options.recentlyMessaged ?? []).map((userId) => ({ userId })));
        }),
        upsert: deliveryUpsert,
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const telegramBot = {
      canSendLifecycleNotifications: () => options.telegram ?? false,
      sendLifecycleNotification: jest.fn().mockResolvedValue(undefined),
      isUnreachableChatError: () => false,
    };
    const mailer = {
      isConfigured: () => options.mail ?? false,
      hasCapacity: jest.fn().mockResolvedValue(options.mail ?? false),
      send: jest.fn().mockResolvedValue({ status: 'sent', messageId: 'm' }),
    };
    const webPush = {
      isConfigured: () => options.push?.configured ?? false,
      sendToUser: jest.fn().mockResolvedValue(
        options.push?.result ?? { sent: 1, failed: 0, removed: 0, firstSuccessId: 'sub-1', lastError: null },
      ),
    };
    const preferences = new NotificationPreferencesService(prisma as any, quietOff as any, telegramBot as any);
    const scorer = { calculateScore: jest.fn().mockResolvedValue(options.score) };
    const monetization = { getConfig: jest.fn().mockResolvedValue({ freeTier: { enabled: true, dailyEntAttempts: 1 } }) };
    const service = new NotificationsService(
      prisma as any,
      quietOff as any,
      telegramBot as any,
      fakeRedis() as any,
      mailer as any,
      webPush as any,
      preferences,
      scorer as any,
      monetization as any,
    );
    return { service, prisma, telegramBot, mailer, webPush, scorer };
  }

  const googleUser = {
    id: USER_ID,
    telegramId: null,
    email: 'student@gmail.com',
    googleId: 'google-1',
    emailVerified: true,
    emailOptOutAt: null,
    preferredLanguage: 'kk',
    timezone: 'Asia/Almaty',
    _count: { pushSubscriptions: 0 },
  };

  it('welcomes a Google user by email with a working unsubscribe link', async () => {
    const { service, prisma, mailer, telegramBot } = harness({
      campaignKey: 'welcome',
      users: [googleUser],
      mail: true,
      telegram: true,
    });
    const result = await service.runAutomation('manual', { campaignKey: 'welcome' });

    expect(result.sent).toBe(1);
    expect(telegramBot.sendLifecycleNotification).not.toHaveBeenCalled();
    const mail = mailer.send.mock.calls[0][0];
    expect(mail.to).toBe('student@gmail.com');
    expect(mail.subject).toBe('mytest-ке қош келдіңіз');
    expect(mail.unsubscribeUrl).toMatch(
      /^https:\/\/my-test\.kz\/api\/v1\/notifications\/unsubscribe\?t=[A-Za-z0-9_-]{43}$/,
    );
    expect(mail.html).toContain(mail.unsubscribeUrl);
    expect(mail.html).toContain('https://my-test.kz/dashboard/exams');
    expect(mail.text).toContain('Хаттардан бас тарту');
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: `welcome:${USER_ID}:email` },
        create: expect.objectContaining({ channel: 'email', targetEmail: 'student@gmail.com', targetTelegramId: null }),
      }),
    );
    // The welcome audience excludes users who already finished a test and asks only reachable users.
    const where = prisma.user.findMany.mock.calls[0][0].where;
    expect(where.notificationDeliveries).toEqual({ none: { campaignKey: 'welcome' } });
    expect(where.AND[0].OR).toEqual(
      expect.arrayContaining([expect.objectContaining({ googleId: { not: null }, emailOptOutAt: null })]),
    );
  });

  it('uses push first and falls back to email when every subscription is gone', async () => {
    const withPush = { ...googleUser, preferredLanguage: 'ru', _count: { pushSubscriptions: 1 } };
    const { service, prisma, mailer, webPush } = harness({
      campaignKey: 'no_trial_day1',
      users: [withPush],
      mail: true,
      push: {
        configured: true,
        result: { sent: 0, failed: 0, removed: 1, firstSuccessId: null, lastError: '410: Gone' },
      },
    });
    const result = await service.runAutomation('manual', { campaignKey: 'no_trial_day1' });

    expect(result.sent).toBe(1);
    expect(webPush.sendToUser).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ title: 'Ваш первый ЕНТ ждёт', url: 'https://my-test.kz/dashboard/exams' }),
    );
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: `delivery:no_trial_day1:${USER_ID}:push` },
      data: expect.objectContaining({ status: 'failed', errorCode: 'PUSH_GONE', nextAttemptAt: null }),
    });
    expect(mailer.send).toHaveBeenCalledTimes(1);
  });

  it('sends only one channel when push works', async () => {
    const withPush = { ...googleUser, _count: { pushSubscriptions: 1 } };
    const { service, prisma, mailer } = harness({
      campaignKey: 'no_trial_day1',
      users: [withPush],
      mail: true,
      push: { configured: true },
    });
    await service.runAutomation('manual', { campaignKey: 'no_trial_day1' });
    expect(mailer.send).not.toHaveBeenCalled();
    expect(prisma.notificationDelivery.update).toHaveBeenCalledWith({
      where: { id: `delivery:no_trial_day1:${USER_ID}:push` },
      data: expect.objectContaining({ status: 'sent', targetPushId: 'sub-1' }),
    });
  });

  it('recaps a finished ENT with the score and the three weakest subjects, despite the daily cooldown', async () => {
    const telegramUser = {
      id: USER_ID,
      telegramId: BigInt(55),
      phone: '77001112233',
      preferredLanguage: 'ru',
      timezone: 'Asia/Almaty',
    };
    const name = (ru: string) => ({ ru, kk: ru });
    const { service, telegramBot } = harness({
      campaignKey: 'result_recap',
      telegram: true,
      recentlyMessaged: [USER_ID],
      sessions: [{ id: 'session-1', rawScore: 82, maxScore: 130, finishedAt: new Date(), user: telegramUser }],
      score: {
        rawScore: 82,
        maxScore: 130,
        sections: [
          { subjectName: name('Математика'), rawPoints: 20, maxPoints: 50, correctCount: 0, totalCount: 40 },
          { subjectName: name('Физика'), rawPoints: 40, maxPoints: 50, correctCount: 0, totalCount: 40 },
          { subjectName: name('История Казахстана'), rawPoints: 12, maxPoints: 20, correctCount: 0, totalCount: 20 },
          { subjectName: name('Грамотность чтения'), rawPoints: 7, maxPoints: 10, correctCount: 0, totalCount: 10 },
          { subjectName: name('Математическая грамотность'), rawPoints: 10, maxPoints: 10, correctCount: 0, totalCount: 10 },
        ],
      },
    });
    const result = await service.runAutomation('manual', { campaignKey: 'result_recap' });

    expect(result.sent).toBe(1);
    const text = telegramBot.sendLifecycleNotification.mock.calls[0][1] as string;
    expect(text).toContain('Ваш результат ЕНТ: 82 из 130');
    expect(text).toContain('• Математика — −30');
    expect(text).toContain('• Физика — −10');
    expect(text).toContain('• История Казахстана — −8');
    expect(text).not.toContain('Грамотность чтения');
    expect(text).toContain('Premium');
  });

  it('creates the new campaigns switched off; existing ones keep running', async () => {
    const { service, prisma } = harness({ campaignKey: 'welcome' });
    await service.ensureDefaultCampaigns();
    const created = new Map(
      prisma.notificationCampaign.upsert.mock.calls.map(([args]: [any]) => [args.create.key, args]),
    );
    for (const key of ['welcome', 'result_recap', 'community_reply', 'free_ent_available']) {
      expect(created.get(key).create.isActive).toBe(false);
    }
    expect(created.get('no_trial_day1').create.isActive).toBe(true);
    // Admin toggles are never overwritten on restart.
    expect(created.get('welcome').update).not.toHaveProperty('isActive');
  });

  it('sends the 15-minute post-trial upsell only while «result recap» is off', async () => {
    const telegramUser = {
      id: USER_ID,
      telegramId: BigInt(55),
      phone: '77001112233',
      preferredLanguage: 'ru',
      timezone: 'Asia/Almaty',
    };
    const session = { id: 'session-1', rawScore: 70, maxScore: 140, score: 50, finishedAt: new Date(), user: telegramUser };

    const off = harness({
      campaignKey: 'post_trial_no_payment',
      campaigns: [
        { key: 'post_trial_no_payment', isActive: true },
        { key: 'result_recap', isActive: false },
      ],
      telegram: true,
      sessions: [session],
    });
    await expect(off.service.runAutomation('manual')).resolves.toMatchObject({ sent: 1 });
    expect(off.telegramBot.sendLifecycleNotification.mock.calls[0][1]).toContain('Вы уже прошли пробный ЕНТ');

    const on = harness({
      campaignKey: 'post_trial_no_payment',
      campaigns: [
        { key: 'post_trial_no_payment', isActive: true },
        { key: 'result_recap', isActive: true },
      ],
      telegram: true,
      sessions: [session],
      score: { rawScore: 70, maxScore: 140, sections: [] },
    });
    await expect(on.service.runAutomation('manual')).resolves.toMatchObject({ sent: 1 });
    // Only the recap went out, not the old upsell.
    expect(on.telegramBot.sendLifecycleNotification).toHaveBeenCalledTimes(1);
    expect(on.telegramBot.sendLifecycleNotification.mock.calls[0][1]).toContain('Ваш результат ЕНТ: 70 из 140');
  });

  it('respects the frequency cap of «free ENT available» (2 per week)', async () => {
    const { service, mailer } = harness({
      campaignKey: 'free_ent_available',
      users: [googleUser],
      mail: true,
      capRows: [USER_ID, USER_ID],
    });
    const result = await service.runAutomation('manual', { campaignKey: 'free_ent_available' });
    expect(result.sent).toBe(0);
    expect(mailer.send).not.toHaveBeenCalled();
  });

  it('tells about community replies from others, never about own or blocked users’ replies', async () => {
    const withPush = { ...googleUser, preferredLanguage: 'ru', _count: { pushSubscriptions: 1 } };
    const parent = { id: 'post-1', authorId: USER_ID, body: 'Как поступить на грант по B057?' };
    const { service, webPush } = harness({
      campaignKey: 'community_reply',
      users: [withPush],
      push: { configured: true },
      replies: [
        { id: 'r3', authorId: 'blocked-user', parent },
        { id: 'r2', authorId: USER_ID, parent },
        { id: 'r1', authorId: 'helper', parent },
      ],
      blocks: [{ blockerId: USER_ID, blockedId: 'blocked-user' }],
    });
    const result = await service.runAutomation('manual', { campaignKey: 'community_reply' });

    expect(result.sent).toBe(1);
    expect(webPush.sendToUser).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        title: 'Вам ответили в сообществе',
        body: '1 новый ответ на ваш пост «Как поступить на грант по B057?».',
        url: 'https://my-test.kz/dashboard/community/post/post-1',
      }),
    );
  });
});
