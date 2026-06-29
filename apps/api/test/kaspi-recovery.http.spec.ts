import { BillingService } from '../src/modules/billing/billing.service';

/**
 * Verifies late Kaspi payment recovery: an order we locally marked `failed` (the QR/invoice
 * window elapsed) but which Kaspi actually `Processed` is recovered to `paid` + a subscription
 * is created. Genuinely-failed orders (no locallyExpiredAt, or Kaspi not paid) are left alone.
 */

type OrderRow = {
  id: string;
  userId: string;
  planCode: string;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  status: string;
  providerPayload: Record<string, unknown> | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function makeOrder(over: Partial<OrderRow>): OrderRow {
  return {
    id: 'ord-1',
    userId: 'user-1',
    planCode: 'starter',
    amount: 690,
    currency: 'KZT',
    provider: 'kaspi',
    providerOrderId: '16140556221',
    providerPaymentId: null,
    status: 'failed',
    providerPayload: {
      paymentType: 'qr',
      status: 'expired',
      locallyExpiredAt: '2026-06-22T11:02:54.459Z',
    },
    paidAt: null,
    createdAt: new Date('2026-06-22T10:57:45Z'),
    updatedAt: new Date('2026-06-22T11:02:54Z'),
    ...over,
  };
}

function makeService(opts: {
  orders: OrderRow[];
  kaspiStatus: Record<string, unknown>;
}) {
  const store = { orders: opts.orders };
  const subscriptionCreate = jest.fn(async ({ data }: any) => ({
    id: 'sub-1',
    ...data,
  }));
  const prisma: any = {
    paymentOrder: {
      findMany: jest.fn(async ({ where }: any) =>
        store.orders.filter(
          (o) =>
            o.provider === where.provider &&
            (Array.isArray(where.status?.in)
              ? where.status.in.includes(o.status)
              : o.status === where.status),
        ),
      ),
      findUnique: jest.fn(async ({ where }: any) =>
        store.orders.find((o) => o.providerOrderId === where.providerOrderId) ?? null,
      ),
      updateMany: jest.fn(async ({ where, data }: any) => {
        const o = store.orders.find((x) => x.id === where.id);
        if (!o) return { count: 0 };
        if (where.status?.not === 'paid' && o.status === 'paid') return { count: 0 };
        Object.assign(o, data);
        return { count: 1 };
      }),
    },
    subscription: { create: subscriptionCreate },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));

  const accessService: any = {
    syncSubscriptionEntitlements: jest.fn().mockResolvedValue(undefined),
  };
  const kaspiPosService: any = {
    getQrStatus: jest.fn().mockResolvedValue(opts.kaspiStatus),
    getInvoiceDetails: jest.fn().mockResolvedValue(opts.kaspiStatus),
  };
  const analytics: any = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const config: any = { get: jest.fn(() => undefined) };

  const service = new BillingService(prisma, config, accessService, kaspiPosService, analytics);
  return { service, store, subscriptionCreate, accessService, kaspiPosService };
}

const KASPI_PROCESSED = {
  Code: 0,
  Message: 'OK',
  Data: { Id: 16140556221, Status: 'Processed', Amount: 690, StatusDesc: 'Платеж успешно совершен' },
};

describe('Kaspi late-payment recovery', () => {
  it('recovers a locally-expired order that Kaspi actually processed', async () => {
    const { service, store, subscriptionCreate, accessService } = makeService({
      orders: [makeOrder({})],
      kaspiStatus: KASPI_PROCESSED,
    });

    const res = await service.recoverStaleKaspiPayments({ lookbackHours: 72 });

    expect(res.checked).toBe(1);
    expect(res.recovered).toBe(1);
    expect(res.recoveredOrderIds).toEqual(['16140556221']);
    expect(store.orders[0].status).toBe('paid');
    expect(store.orders[0].paidAt).toBeInstanceOf(Date);
    expect(subscriptionCreate).toHaveBeenCalledTimes(1);
    expect(subscriptionCreate.mock.calls[0][0].data.planType).toBe('starter');
    expect(accessService.syncSubscriptionEntitlements).toHaveBeenCalledWith('sub-1');
  });

  it('recovers a stuck PENDING order Kaspi processed, even when the status omits the amount', async () => {
    const { service, store, subscriptionCreate } = makeService({
      orders: [
        makeOrder({
          status: 'pending',
          providerPayload: { paymentType: 'qr', status: 'QrTokenCreated' },
        }),
      ],
      // Authoritative success but NO Amount field (typical Kaspi Gold QR status).
      kaspiStatus: { Code: 0, Data: { Status: 'Processed', StatusDesc: 'Платеж успешно совершен' } },
    });

    const res = await service.recoverStaleKaspiPayments({ lookbackHours: 72 });

    expect(res.recovered).toBe(1);
    expect(store.orders[0].status).toBe('paid');
    expect(subscriptionCreate).toHaveBeenCalledTimes(1);
  });

  it('skips orders without a local-expiry marker (genuine failures are untouched)', async () => {
    const { service, store, subscriptionCreate } = makeService({
      orders: [makeOrder({ providerPayload: { paymentType: 'qr', status: 'failed' } })],
      kaspiStatus: KASPI_PROCESSED,
    });

    const res = await service.recoverStaleKaspiPayments({ lookbackHours: 72 });

    expect(res.checked).toBe(0);
    expect(res.recovered).toBe(0);
    expect(store.orders[0].status).toBe('failed');
    expect(subscriptionCreate).not.toHaveBeenCalled();
  });

  it('does not promote when Kaspi still does not report a successful payment', async () => {
    const { service, store, subscriptionCreate } = makeService({
      orders: [makeOrder({})],
      kaspiStatus: { Code: 0, Data: { Status: 'Expired' } },
    });

    const res = await service.recoverStaleKaspiPayments({ lookbackHours: 72 });

    expect(res.recovered).toBe(0);
    expect(store.orders[0].status).not.toBe('paid');
    expect(subscriptionCreate).not.toHaveBeenCalled();
  });

  it('does not promote on amount mismatch (safety guard)', async () => {
    const { service, store, subscriptionCreate } = makeService({
      orders: [makeOrder({})],
      kaspiStatus: { Code: 0, Data: { Status: 'Processed', Amount: 100 } }, // wrong amount
    });

    const res = await service.recoverStaleKaspiPayments({ lookbackHours: 72 });

    expect(res.recovered).toBe(0);
    expect(store.orders[0].status).not.toBe('paid');
    expect(subscriptionCreate).not.toHaveBeenCalled();
  });
});
