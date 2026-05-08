import { ExecutionContext } from '@nestjs/common';
import {
  AttemptLedgerAction,
  EntitlementTier,
} from '@prisma/client';
import { PremiumGuard } from '../src/common/guards/premium.guard';
import { AccessService } from '../src/modules/subscriptions/access.service';

function httpContext(request: unknown): ExecutionContext {
  return {
    switchToHttp: () => ({
      getRequest: () => request,
    }),
  } as ExecutionContext;
}

describe('subscription premium access', () => {
  it('syncs purchased trial subscriptions as premium entitlements with one attempt', async () => {
    const future = new Date(Date.now() + 24 * 60 * 60 * 1000);
    const tx = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sub-trial',
          userId: 'user-1',
          planType: 'trial',
          examTypeId: null,
          startsAt: new Date(Date.now() - 1000),
          expiresAt: future,
          isActive: true,
        }),
      },
      examType: {
        findMany: jest.fn().mockResolvedValue([{ id: 'exam-ent' }]),
      },
      userExamEntitlement: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const prisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    } as any;
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SUBSCRIPTION_ENGINE_V2') return 'true';
        return undefined;
      }),
    } as any;
    const service = new AccessService(prisma, config);

    await service.syncSubscriptionEntitlements('sub-trial');

    expect(tx.userExamEntitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          tier: EntitlementTier.paid,
          totalAttemptsLimit: 1,
        }),
        create: expect.objectContaining({
          tier: EntitlementTier.paid,
          totalAttemptsLimit: 1,
          subscriptionId: 'sub-trial',
        }),
      }),
    );
  });

  it('syncs weekly subscriptions as five premium ENT attempts', async () => {
    const tx = {
      subscription: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'sub-week',
          userId: 'user-1',
          planType: 'week',
          examTypeId: null,
          startsAt: new Date(Date.now() - 1000),
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
          isActive: true,
        }),
      },
      examType: {
        findMany: jest.fn().mockResolvedValue([{ id: 'exam-ent' }]),
      },
      userExamEntitlement: {
        upsert: jest.fn().mockResolvedValue({}),
      },
    } as any;
    const prisma = {
      $transaction: jest.fn().mockImplementation((cb: any) => cb(tx)),
    } as any;
    const config = {
      get: jest.fn((key: string) => {
        if (key === 'SUBSCRIPTION_ENGINE_V2') return 'true';
        return undefined;
      }),
    } as any;
    const service = new AccessService(prisma, config);

    await service.syncSubscriptionEntitlements('sub-week');

    expect(tx.examType.findMany).toHaveBeenCalledWith({
      where: { slug: 'ent' },
      select: { id: true },
    });
    expect(tx.userExamEntitlement.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        create: expect.objectContaining({
          tier: EntitlementTier.paid,
          totalAttemptsLimit: 5,
          subscriptionId: 'sub-week',
        }),
      }),
    );
  });

  it('allows premium explanations for a session consumed from a paid entitlement', async () => {
    const prisma = {
      userExamEntitlement: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      attemptUsageLedger: {
        findFirst: jest.fn().mockResolvedValue({ id: 'ledger-1' }),
      },
    } as any;
    const access = { isV2Enabled: jest.fn().mockReturnValue(true) } as any;
    const guard = new PremiumGuard(prisma, access);

    await expect(
      guard.canActivate(
        httpContext({
          user: { id: 'user-1' },
          params: { id: 'session-1' },
        }),
      ),
    ).resolves.toBe(true);

    expect(prisma.attemptUsageLedger.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          userId: 'user-1',
          sessionId: 'session-1',
          action: AttemptLedgerAction.attempt_consumed,
          entitlement: {
            tier: { in: [EntitlementTier.paid, EntitlementTier.admin] },
          },
        }),
      }),
    );
  });
});
