import { EntitlementSourceType, EntitlementStatus, EntitlementTier } from '@prisma/client';
import { UsersService } from '../src/modules/users/users.service';

describe('UsersService current tariff', () => {
  it('skips exhausted trial subscriptions and shows active admin/template tariff', async () => {
    const now = new Date();
    const user = {
      id: 'user-1',
      telegramId: null,
      telegramUsername: 'sanjuniperodee',
      email: null,
      phone: '77082420482',
      firstName: 'San',
      lastName: null,
      avatarUrl: null,
      preferredLanguage: 'ru',
      timezone: 'Asia/Almaty',
      isAdmin: false,
      isChannelMember: true,
      channelCheckedAt: now,
      entTrialUsed: 1,
    };
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
      userExamEntitlement: {
        findFirst: jest.fn().mockResolvedValue({
          totalAttemptsLimit: 2,
          usedAttemptsTotal: 2,
        }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { usedAttemptsTotal: 1 },
        }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'admin-entitlement',
            tier: EntitlementTier.paid,
            sourceType: EntitlementSourceType.plan_template,
            sourceRef: 'plan_template:annual:exam:ent',
            totalAttemptsLimit: 1588,
            dailyAttemptsLimit: 5,
            usedAttemptsTotal: 9,
            windowStartsAt: new Date(now.getTime() - 86400000),
            windowEndsAt: new Date(now.getTime() + 365 * 86400000),
            planTemplate: {
              id: 'tpl-annual',
              code: 'ent-paid-anually',
              name: 'Подписка на год',
              description: 'Подписка на год',
            },
            examType: { id: 'exam-ent', slug: 'ent', name: 'ENT' },
          },
        ]),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue(null),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-trial',
            planType: 'trial',
            startsAt: new Date(now.getTime() - 1000),
            expiresAt: new Date(now.getTime() + 7 * 86400000),
            examType: null,
          },
        ]),
      },
    } as any;
    const accessMock = {
      ensureSignupEntitlementsForUser: jest.fn().mockResolvedValue(undefined),
      getUserAccessByExam: jest.fn().mockResolvedValue([
        {
          examTypeId: 'exam-ent',
          examSlug: 'ent',
          hasAccess: false,
          reasonCode: 'DAILY_LIMIT_REACHED',
          nextAllowedAt: null,
          hasPaidTier: true,
          total: { used: 9, limit: 1588, remaining: 1579, isUnlimited: false },
          daily: { used: 5, limit: 5, remaining: 0, isUnlimited: false, nextResetAt: null },
        },
      ]),
    } as any;
    const users = new UsersService(prismaMock, {} as any, accessMock);

    const profile = await users.getProfile('user-1');

    expect(profile?.currentTariff?.code).toBe('ent-paid-anually');
    expect(profile?.currentTariff?.isActive).toBe(true);
    expect(profile?.currentTariff?.remainingAttempts).toBe(1579);
    expect(prismaMock.userExamEntitlement.aggregate).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          subscriptionId: 'sub-trial',
          sourceType: EntitlementSourceType.subscription,
          status: { in: [EntitlementStatus.active, EntitlementStatus.exhausted] },
        }),
      }),
    );
  });

  it('keeps premium status while a paid subscription is still active by time', async () => {
    const now = new Date();
    const user = {
      id: 'user-1',
      telegramId: null,
      telegramUsername: 'premium-user',
      email: null,
      phone: '77001112233',
      firstName: 'Premium',
      lastName: null,
      avatarUrl: null,
      preferredLanguage: 'ru',
      timezone: 'Asia/Almaty',
      isAdmin: false,
      isChannelMember: true,
      channelCheckedAt: now,
      entTrialUsed: 0,
    };
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue(user),
      },
      userExamEntitlement: {
        findFirst: jest.fn().mockResolvedValue({
          totalAttemptsLimit: 0,
          usedAttemptsTotal: 0,
        }),
        aggregate: jest.fn().mockResolvedValue({
          _sum: { usedAttemptsTotal: 1 },
        }),
        findMany: jest.fn().mockResolvedValue([]),
      },
      subscription: {
        findFirst: jest.fn().mockResolvedValue({ id: 'sub-trial' }),
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-trial',
            planType: 'trial',
            startsAt: new Date(now.getTime() - 1000),
            expiresAt: new Date(now.getTime() + 7 * 86400000),
            examType: null,
          },
        ]),
      },
    } as any;
    const accessMock = {
      ensureSignupEntitlementsForUser: jest.fn().mockResolvedValue(undefined),
      getUserAccessByExam: jest.fn().mockResolvedValue([
        {
          examTypeId: 'exam-ent',
          examSlug: 'ent',
          hasAccess: false,
          reasonCode: 'TOTAL_LIMIT_EXHAUSTED',
          nextAllowedAt: null,
          hasPaidTier: true,
          total: { used: 1, limit: 1, remaining: 0, isUnlimited: false },
          daily: { used: 0, limit: null, remaining: null, isUnlimited: true, nextResetAt: null },
        },
      ]),
    } as any;
    const users = new UsersService(prismaMock, {} as any, accessMock);

    const profile = await users.getProfile('user-1');

    expect(profile?.hasActiveSubscription).toBe(true);
    expect(profile?.currentTariff?.isPaid).toBe(true);
    expect(profile?.currentTariff?.isActive).toBe(false);
    expect(prismaMock.subscription.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          isActive: true,
          planType: { not: 'free' },
        }),
        select: { id: true },
      }),
    );
  });
});
