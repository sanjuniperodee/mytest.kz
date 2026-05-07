import { NotificationsService } from '../src/modules/notifications/notifications.service';

describe('NotificationsService', () => {
  it('sends localized no-trial reminders to eligible Telegram bot users', async () => {
    const users = [
      {
        id: 'user-ru',
        telegramId: BigInt(1001),
        preferredLanguage: 'ru',
        timezone: 'Asia/Almaty',
      },
      {
        id: 'user-kk',
        telegramId: BigInt(1002),
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
      },
      notificationDelivery: {
        findMany: jest.fn().mockResolvedValue([]),
        findFirst: jest.fn().mockResolvedValue(null),
        create: jest
          .fn()
          .mockImplementation(({ data }: { data: { userId: string } }) =>
            Promise.resolve({ id: `delivery-${data.userId}` }),
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
    };
    const service = new NotificationsService(
      prisma as any,
      config as any,
      telegramBot as any,
    );

    const result = await service.runAutomation('manual', {
      campaignKey: 'no_trial_day1',
    });

    expect(result.sent).toBe(2);
    expect(prisma.user.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          isChannelMember: true,
          telegramId: { not: null },
          phone: { not: null },
        }),
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
