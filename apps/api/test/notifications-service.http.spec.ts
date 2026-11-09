import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('NotificationsService', () => {
  it('sends localized no-trial reminders to eligible Telegram bot users', async () => {
    const users = [
      {
        id: 'user-ru',
        telegramId: BigInt(1001),
        phone: '77001234501',
        preferredLanguage: 'ru',
        timezone: 'Asia/Almaty',
      },
      {
        id: 'user-kk',
        telegramId: BigInt(1002),
        phone: '77001234502',
        preferredLanguage: 'kk',
        timezone: 'Asia/Almaty',
      },
    ];
    const prisma = {
      notificationCampaign: {
        upsert: jest.fn().mockResolvedValue({}),
        findMany: jest.fn().mockResolvedValue([
          {
            key: 'no_trial_day1',
            isActive: true,
            createdAt: new Date('2026-05-08T00:00:00.000Z'),
          },
        ]),
      },
      notificationRun: {
        create: jest.fn().mockResolvedValue({ id: 'run-1' }),
        update: jest.fn().mockResolvedValue({}),
      },
      user: {
        findMany: jest.fn().mockResolvedValue(users),
        findFirst: jest.fn().mockResolvedValue(null),
      },
      notificationDelivery: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        upsert: jest
          .fn()
          .mockImplementation(({ create }: { create: { userId: string } }) =>
            Promise.resolve({ id: `delivery-${create.userId}` }),
          ),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'NOTIFICATIONS_QUIET_HOURS') return '0-0';
        return undefined;
      }),
    };
    const telegramBot = {
      sendLifecycleNotification: jest.fn().mockResolvedValue(undefined),
      canSendLifecycleNotifications: jest.fn().mockReturnValue(true),
      isUnreachableChatError: jest.fn().mockReturnValue(false),
    };
    const redis = {
      set: jest.fn().mockResolvedValue('OK'),
      eval: jest.fn().mockResolvedValue(1),
    };
    const mailer = { isConfigured: () => false, hasCapacity: async () => false };
    const webPush = { isConfigured: () => false };
    const preferences = { siteUrl: () => 'https://my-test.kz', unsubscribeUrl: () => null };
    const service = new NotificationsService(
      prisma as any,
      config as any,
      telegramBot as any,
      redis as any,
      mailer as any,
      webPush as any,
      preferences as any,
      {} as any,
      {} as any,
    );

    const result = await service.runAutomation('manual', {
      campaignKey: 'no_trial_day1',
    });

    expect(result.sent).toBe(2);
    const where = prisma.user.findMany.mock.calls[0][0].where;
    // Only Telegram is configured here: the reachability filter is the Telegram clause alone.
    expect(where.AND).toEqual(
      expect.arrayContaining([
        {
          OR: [
            {
              telegramId: { not: null },
              notificationsMutedAt: null,
              OR: [{ phone: { not: null } }, { telegramLinkedAt: { not: null } }],
            },
          ],
        },
        {
          OR: [
            { telegramId: null },
            { telegramLinkedAt: { not: null } },
            { isChannelMember: true },
          ],
        },
      ]),
    );
    expect(prisma.notificationDelivery.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { dedupeKey: 'no_trial_day1:user-ru' },
        create: expect.objectContaining({ channel: 'telegram', targetTelegramId: BigInt(1001) }),
      }),
    );
    expect(telegramBot.sendLifecycleNotification).toHaveBeenCalledWith(
      BigInt(1001),
      expect.stringContaining('Вы уже в MyTest'),
      expect.objectContaining({ language: 'ru' }),
    );
    expect(telegramBot.sendLifecycleNotification).toHaveBeenCalledWith(
      BigInt(1002),
      expect.stringContaining('Сіз MyTest-ке кірдіңіз'),
      expect.objectContaining({ language: 'kk' }),
    );
  });
});
