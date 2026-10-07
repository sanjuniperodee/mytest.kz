import { EntitlementSourceType, EntitlementTier } from '@prisma/client';
import { AccessService } from '../src/modules/subscriptions/access.service';
import { staticMonetization } from './helpers/monetization';

const ENT = { id: 'exam-ent', slug: 'ent' };

function engine(mode: 'LEGACY' | 'V2') {
  return { get: jest.fn((key: string) => (key === 'SUBSCRIPTION_ENGINE_MODE' ? mode : undefined)) } as any;
}

/** Строка бесплатной квоты, уже заведённая под текущую настройку (1 в день). */
const freeDailyRow = {
  id: 'free-1',
  status: 'active',
  timezone: 'Asia/Almaty',
  dailyAttemptsLimit: 1,
};

function legacyTx(overrides: { dailyUpdated?: number; attemptsUsedToday?: number; subs?: unknown[] } = {}) {
  return {
    examType: { findUnique: jest.fn().mockResolvedValue(ENT) },
    user: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'user-1',
        timezone: 'Asia/Almaty',
        createdAt: new Date('2026-01-01T00:00:00Z'),
      }),
    },
    subscription: { findMany: jest.fn().mockResolvedValue(overrides.subs ?? []) },
    testSession: { count: jest.fn().mockResolvedValue(0) },
    userExamEntitlement: {
      findUnique: jest.fn().mockResolvedValue(freeDailyRow),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
    },
    userExamDailyUsage: {
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: overrides.dailyUpdated ?? 1 }),
      findUnique: jest
        .fn()
        .mockResolvedValue({ attemptsUsed: overrides.attemptsUsedToday ?? 0 }),
    },
    attemptUsageLedger: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

describe('free daily ENT attempt — LEGACY engine', () => {
  it('consumes today’s free attempt atomically and logs it', async () => {
    const tx = legacyTx();
    const service = new AccessService({} as any, engine('LEGACY'), staticMonetization());

    await service.assertAndConsumeAttemptTx(tx, 'user-1', ENT.id, 'session-1');

    // Строка дня создаётся без ошибки уникальности, затем условный инкремент.
    expect(tx.userExamDailyUsage.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
    expect(tx.userExamDailyUsage.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ entitlementId: 'free-1', attemptsUsed: { lt: 1 } }),
      }),
    );
    expect(tx.attemptUsageLedger.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ entitlementId: 'free-1', sessionId: 'session-1' }),
      }),
    );
  });

  it('denies the second attempt of the day with the time of the next free one', async () => {
    const tx = legacyTx({ dailyUpdated: 0, attemptsUsedToday: 1 });
    const service = new AccessService({} as any, engine('LEGACY'), staticMonetization());

    await expect(service.assertAndConsumeAttemptTx(tx, 'user-1', ENT.id)).rejects.toMatchObject({
      response: {
        message: 'DAILY_LIMIT_REACHED',
        code: 'DAILY_LIMIT_REACHED',
        nextAllowedAt: expect.stringMatching(/T19:00:00\.000Z$/), // полночь в Алматы (UTC+5)
      },
    });
    expect(tx.attemptUsageLedger.create).not.toHaveBeenCalled();
  });

  it('uses an unlimited paid plan before the free attempt', async () => {
    const tx = legacyTx({
      subs: [
        {
          id: 'sub-1',
          planType: 'premium',
          planSnapshot: null,
          startsAt: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 86400000),
        },
      ],
    });
    const service = new AccessService({} as any, engine('LEGACY'), staticMonetization());

    await service.assertAndConsumeAttemptTx(tx, 'user-1', ENT.id);

    expect(tx.userExamDailyUsage.updateMany).not.toHaveBeenCalled();
  });

  it('honours the plan snapshot over the current catalog', async () => {
    // Купили «3 пробных», затем админ сделал тариф безлимитным — купившему остаётся 3.
    const tx = legacyTx({
      subs: [
        {
          id: 'sub-1',
          planType: 'basic',
          planSnapshot: { code: 'basic', name: '3', priceKzt: 900, durationDays: 30, attemptsLimit: 3, dailyLimit: null },
          startsAt: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 86400000),
        },
      ],
    });
    tx.testSession.count.mockResolvedValue(3);
    const monetization = staticMonetization({
      plans: [{ code: 'basic', name: { ru: '3', kk: '' }, priceKzt: 900, durationDays: 30, attemptsLimit: null, dailyLimit: null }],
    });
    const service = new AccessService({} as any, engine('LEGACY'), monetization);

    await service.assertAndConsumeAttemptTx(tx, 'user-1', ENT.id);

    // Пакет исчерпан по снапшоту → списана бесплатная попытка дня.
    expect(tx.userExamDailyUsage.updateMany).toHaveBeenCalled();
  });

  it('returns NO_ENTITLEMENT when the free tier is switched off in admin', async () => {
    const tx = legacyTx();
    const service = new AccessService(
      {} as any,
      engine('LEGACY'),
      staticMonetization({ freeTier: { enabled: false, dailyEntAttempts: 1 } }),
    );

    await expect(service.assertAndConsumeAttemptTx(tx, 'user-1', ENT.id)).rejects.toMatchObject({
      response: { message: 'NO_ENTITLEMENT' },
    });
  });
});

function v2Tx(entitlements: unknown[], usage: Array<{ entitlementId: string; localDay: string; attemptsUsed: number }> = []) {
  return {
    examType: {
      findUnique: jest.fn().mockResolvedValue(ENT),
      findMany: jest.fn().mockResolvedValue([ENT]),
    },
    user: { findUnique: jest.fn().mockResolvedValue({ id: 'user-1' }) },
    userExamEntitlement: {
      findUnique: jest.fn().mockResolvedValue(freeDailyRow),
      findMany: jest.fn().mockResolvedValue(entitlements),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      update: jest.fn().mockResolvedValue({}),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    userExamDailyUsage: {
      findMany: jest.fn().mockResolvedValue(usage),
      createMany: jest.fn().mockResolvedValue({ count: 1 }),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
    attemptUsageLedger: { create: jest.fn().mockResolvedValue({}) },
  } as any;
}

const freeDailyEntitlement = {
  id: 'free-1',
  sourceType: EntitlementSourceType.free_daily,
  tier: EntitlementTier.free,
  status: 'active',
  totalAttemptsLimit: null,
  usedAttemptsTotal: 5,
  dailyAttemptsLimit: 1,
  timezone: 'Asia/Almaty',
  windowEndsAt: null,
  createdAt: new Date('2026-01-01T00:00:00Z'),
  subscription: null,
};

const paidPack = {
  id: 'paid-1',
  sourceType: EntitlementSourceType.subscription,
  tier: EntitlementTier.paid,
  status: 'active',
  totalAttemptsLimit: 3,
  usedAttemptsTotal: 1,
  dailyAttemptsLimit: null,
  timezone: 'Asia/Almaty',
  windowEndsAt: new Date(Date.now() + 10 * 86400000),
  createdAt: new Date(),
  subscription: { planType: 'basic', planSnapshot: null },
};

function today() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(new Date());
}

describe('free daily ENT attempt — V2 engine', () => {
  it('spends a paid attempt before the free one', async () => {
    const tx = v2Tx([freeDailyEntitlement, paidPack]);
    const service = new AccessService({} as any, engine('V2'), staticMonetization());

    await service.assertAndConsumeAttemptTx(tx, 'user-1', ENT.id);

    const consumed = tx.userExamEntitlement.updateMany.mock.calls.find(
      ([args]: any[]) => args.data?.usedAttemptsTotal,
    );
    expect(consumed?.[0].where.id).toBe('paid-1');
    expect(tx.userExamDailyUsage.updateMany).not.toHaveBeenCalled();
  });

  it('denies with nextAllowedAt when only the used free attempt is left', async () => {
    const tx = v2Tx([freeDailyEntitlement], [
      { entitlementId: 'free-1', localDay: today(), attemptsUsed: 1 },
    ]);
    const service = new AccessService({} as any, engine('V2'), staticMonetization());

    await expect(service.assertAndConsumeAttemptTx(tx, 'user-1', ENT.id)).rejects.toMatchObject({
      response: { message: 'DAILY_LIMIT_REACHED', nextAllowedAt: expect.any(String) },
    });
  });

  it('reports a free attempt as the deterministic "free" tier in the pre-check', async () => {
    const tx = v2Tx([freeDailyEntitlement]);
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new AccessService(prisma, engine('V2'), staticMonetization());

    await expect(service.checkAttemptAccess('user-1', ENT.id)).resolves.toEqual({
      allowed: true,
      tier: 'free',
      reasonCode: null,
      nextAllowedAt: null,
    });
  });

  it('shows the free quota separately from paid attempts in the access summary', async () => {
    const tx = v2Tx([freeDailyEntitlement, paidPack], [
      { entitlementId: 'free-1', localDay: today(), attemptsUsed: 1 },
    ]);
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new AccessService(prisma, engine('V2'), staticMonetization());

    const [ent] = await service.getUserAccessByExam('user-1');

    expect(ent.hasAccess).toBe(true);
    expect(ent.free).toMatchObject({ dailyLimit: 1, usedToday: 1, remainingToday: 0 });
    expect(ent.total).toEqual({ used: 1, limit: 3, remaining: 2, isUnlimited: false });
  });

  it('creates the free daily entitlement idempotently for a new user', async () => {
    const tx = v2Tx([]);
    tx.userExamEntitlement.findUnique.mockResolvedValue(null);
    tx.user.findUnique.mockResolvedValue({ timezone: 'Asia/Almaty', createdAt: new Date() });
    const prisma = { $transaction: jest.fn((cb: any) => cb(tx)) } as any;
    const service = new AccessService(prisma, engine('V2'), staticMonetization({ freeTier: { enabled: true, dailyEntAttempts: 2 } }));

    await service.ensureFreeEntitlementsForUser('user-1');

    expect(tx.userExamEntitlement.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          sourceType: EntitlementSourceType.free_daily,
          sourceRef: 'free_daily:user-1:exam:exam-ent',
          tier: EntitlementTier.free,
          totalAttemptsLimit: null,
          dailyAttemptsLimit: 2,
        }),
      ],
      skipDuplicates: true,
    });
  });
});
