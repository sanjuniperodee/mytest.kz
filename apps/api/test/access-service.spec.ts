import { AccessService } from '../src/modules/subscriptions/access.service';

describe('AccessService', () => {
  it('returns NO access for ENT in legacy when free limit exhausted', async () => {
    const prismaMock = {
      examType: {
        findMany: jest.fn().mockResolvedValue([
          { id: 'exam-ent', slug: 'ent' },
          { id: 'exam-nuet', slug: 'nuet' },
        ]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ entTrialUsed: 2 }),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
    const cfg = { get: jest.fn().mockReturnValue('false') } as any;
    const service = new AccessService(prismaMock, cfg);

    const access = await service.getUserAccessByExam('user-1');
    const ent = access.find((x) => x.examSlug === 'ent');
    const nuet = access.find((x) => x.examSlug === 'nuet');

    expect(ent?.hasAccess).toBe(false);
    expect(ent?.reasonCode).toBe('TOTAL_LIMIT_EXHAUSTED');
    expect(nuet?.hasAccess).toBe(true);
  });

  it('consumes legacy free trial counter for ENT', async () => {
    const prismaMock = {
      examType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'exam-ent', slug: 'ent' }),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
    } as any;
    const cfg = { get: jest.fn().mockReturnValue('false') } as any;
    const service = new AccessService(prismaMock, cfg);

    await service.assertAndConsumeAttempt('user-1', 'exam-ent');

    expect(prismaMock.user.updateMany).toHaveBeenCalled();
  });

  it('returns DAILY_LIMIT_REACHED in v2 mode', async () => {
    const tx = {
      examType: {
        findUnique: jest.fn().mockResolvedValue({ id: 'exam-ent', slug: 'ent' }),
      },
      userExamEntitlement: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'ent-1',
            sourceType: 'manual',
            totalAttemptsLimit: 10,
            usedAttemptsTotal: 2,
            dailyAttemptsLimit: 1,
            timezone: 'Asia/Almaty',
            tier: 'trial',
            windowEndsAt: null,
            createdAt: new Date(),
          },
        ]),
      },
      userExamDailyUsage: {
        findUnique: jest.fn().mockResolvedValue({ attemptsUsed: 1 }),
      },
      attemptUsageLedger: {
        create: jest.fn().mockResolvedValue({}),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      user: {
        findUnique: jest.fn().mockResolvedValue({ id: 'user-1', entTrialUsed: 0, timezone: 'Asia/Almaty' }),
      },
      testSession: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    const prismaMock = {
      $transaction: jest.fn().mockImplementation(async (cb: any) => cb(tx)),
    } as any;
    const cfg = {
      get: jest.fn((key: string) => {
        if (key === 'SUBSCRIPTION_ENGINE_V2') return 'true';
        if (key === 'SUBSCRIPTION_ENGINE_V2_DUAL_READ') return 'false';
        return undefined;
      }),
    } as any;
    const service = new AccessService(prismaMock, cfg);

    await expect(service.assertAndConsumeAttempt('user-1', 'exam-ent')).rejects.toMatchObject({
      response: { message: 'DAILY_LIMIT_REACHED' },
    });
  });
});
