import { BillingService } from '../src/modules/billing/billing.service';
import { freedomPaySign } from '../src/modules/billing/freedompay-signature';

const SECRET = 'freedom-secret';
const CALLBACK_SCRIPT = 'callback';

function signedPayload(fields: Record<string, string>) {
  return {
    ...fields,
    pg_sig: freedomPaySign(CALLBACK_SCRIPT, fields, SECRET),
  };
}

function makeService(order?: Record<string, unknown>) {
  const prisma = {
    paymentOrder: {
      findUnique: jest.fn().mockResolvedValue(order ?? null),
      updateMany: jest.fn().mockResolvedValue({ count: 1 }),
    },
  };
  const config = {
    get: jest.fn((key: string) => {
      if (key === 'FREEDOMPAY_SECRET_KEY') return SECRET;
      if (key === 'FREEDOMPAY_CALLBACK_SCRIPT') return CALLBACK_SCRIPT;
      return undefined;
    }),
  };
  const analytics = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const service = new BillingService(
    prisma as any,
    config as any,
    { syncSubscriptionEntitlements: jest.fn() } as any,
    {} as any,
    analytics as any,
  );
  return { service, prisma, analytics };
}

describe('FreedomPay callback handling', () => {
  it('acknowledges check requests without mutating a pending order', async () => {
    const { service, prisma } = makeService({
      id: 'order-db-id',
      userId: 'user-1',
      provider: 'freedompay',
      providerOrderId: 'order-1',
      providerPaymentId: null,
      status: 'pending',
      planCode: 'trial',
      amount: 570,
      currency: 'KZT',
    });

    const xml = await service.handleFreedomPayCallback(
      signedPayload({
        pg_order_id: 'order-1',
        pg_amount: '570',
        pg_currency: 'KZT',
        pg_salt: 'salt-check',
      }),
    );

    expect(xml).toContain('<pg_status>ok</pg_status>');
    expect(xml).toContain('<pg_description>CHECK_OK</pg_description>');
    expect(prisma.paymentOrder.updateMany).not.toHaveBeenCalled();
  });

  it('treats pg_result=0 as a result callback and marks the order failed', async () => {
    const { service, prisma, analytics } = makeService({
      id: 'order-db-id',
      userId: 'user-1',
      provider: 'freedompay',
      providerOrderId: 'order-1',
      providerPaymentId: null,
      status: 'pending',
      planCode: 'trial',
      amount: 570,
      currency: 'KZT',
    });

    const xml = await service.handleFreedomPayCallback(
      signedPayload({
        pg_order_id: 'order-1',
        pg_amount: '570',
        pg_currency: 'KZT',
        pg_result: '0',
        pg_payment_id: 'fp-1',
        pg_salt: 'salt-failed',
      }),
    );

    expect(xml).toContain('<pg_status>ok</pg_status>');
    expect(xml).toContain('<pg_description>PAYMENT_FAILED</pg_description>');
    expect(prisma.paymentOrder.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'order-db-id', status: { not: 'paid' } },
        data: expect.objectContaining({
          status: 'failed',
          providerPaymentId: 'fp-1',
        }),
      }),
    );
    expect(analytics.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        step: 'payment_failed',
      }),
    );
  });
});
