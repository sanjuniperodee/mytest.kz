import { BillingService } from '../src/modules/billing/billing.service';
import { staticMonetization } from './helpers/monetization';

/**
 * «Один живой платёж на аккаунт». До этой правки повторный запрос оплаты возвращал любой
 * незакрытый заказ того же тарифа — в том числе счёт недельной давности на другой номер,
 * истёкший QR или заказ без номера операции («unknown-{json}»), с которого страница оплаты
 * не открывалась. Здесь проверяется, что продолжается только свежий подходящий заказ,
 * а остальное закрывается.
 */

const USER = 'aaaaaaaa-0000-4000-8000-000000000001';
const PHONE = '77011234567';
const OTHER_PHONE = '77029998877';
const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

type OrderRow = {
  id: string;
  userId: string;
  planCode: string;
  planSnapshot: unknown;
  amount: number;
  currency: string;
  provider: string;
  providerOrderId: string;
  providerPaymentId: string | null;
  checkoutUrl: string | null;
  status: string;
  providerPayload: Record<string, unknown> | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

let seq = 0;
function order(over: Partial<OrderRow> & { ageMs?: number }): OrderRow {
  seq += 1;
  const { ageMs = 5 * MINUTE, ...rest } = over;
  const createdAt = new Date(Date.now() - ageMs);
  return {
    id: `ord-${seq}`,
    userId: USER,
    planCode: 'starter',
    planSnapshot: null,
    amount: 490,
    currency: 'KZT',
    provider: 'kaspi',
    providerOrderId: String(16_000_000_000 + seq),
    providerPaymentId: null,
    checkoutUrl: null,
    status: 'pending',
    providerPayload: { paymentType: 'invoice', status: 'RemotePaymentCreated', payerPhone: PHONE },
    paidAt: null,
    createdAt,
    updatedAt: createdAt,
    ...rest,
  };
}

function invoice(over: Partial<OrderRow> & { ageMs?: number; phone?: string } = {}) {
  const { phone = PHONE, ...rest } = over;
  return order({
    providerPayload: { paymentType: 'invoice', status: 'RemotePaymentCreated', payerPhone: phone },
    ...rest,
  });
}

function qr(over: Partial<OrderRow> & { ageMs?: number; leftMs?: number } = {}) {
  const { leftMs = 3 * MINUTE, ...rest } = over;
  return order({
    checkoutUrl: 'https://pay.kaspi.kz/pay/old-qr',
    providerPayload: {
      paymentType: 'qr',
      status: 'QrTokenCreated',
      qrToken: 'https://pay.kaspi.kz/pay/old-qr',
      expiresAt: new Date(Date.now() + leftMs).toISOString(),
    },
    ...rest,
  });
}

function matches(row: OrderRow, where: Record<string, any> = {}): boolean {
  return Object.entries(where).every(([key, expected]) => {
    const actual = (row as any)[key];
    if (expected && typeof expected === 'object' && !(expected instanceof Date)) {
      if ('not' in expected) return actual !== expected.not;
      if ('in' in expected) return expected.in.includes(actual);
      if ('gte' in expected) return actual >= expected.gte;
      throw new Error(`Unsupported filter for ${key}: ${JSON.stringify(expected)}`);
    }
    return actual === expected;
  });
}

const PENDING = { Code: 0, Data: { Status: 'RemotePaymentCreated' } };
const CANCELLED = { Code: 0, Data: { Status: 'RemotePaymentCanceled' } };
const PROCESSED = { Code: 0, Data: { Status: 'Processed', Amount: 490 } };

function makeService(orders: OrderRow[]) {
  const store = { orders };
  let newId = 17_000_000_000;

  const paymentOrder = {
    findMany: jest.fn(async ({ where, take }: any) => {
      const found = store.orders
        .filter((row) => matches(row, where))
        .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      return typeof take === 'number' ? found.slice(0, take) : found;
    }),
    findFirst: jest.fn(async ({ where }: any) => store.orders.find((row) => matches(row, where)) ?? null),
    findUnique: jest.fn(async ({ where }: any) => store.orders.find((row) => matches(row, where)) ?? null),
    updateMany: jest.fn(async ({ where, data }: any) => {
      const found = store.orders.filter((row) => matches(row, where));
      found.forEach((row) => Object.assign(row, data));
      return { count: found.length };
    }),
    update: jest.fn(async ({ where, data }: any) => {
      const row = store.orders.find((item) => matches(item, where));
      if (!row) throw new Error('Record to update not found');
      return Object.assign(row, data);
    }),
    upsert: jest.fn(async ({ where, create, update }: any) => {
      const existing = store.orders.find((row) => matches(row, where));
      if (existing) return Object.assign(existing, update);
      seq += 1;
      const created: OrderRow = {
        id: `ord-${seq}`,
        currency: 'KZT',
        providerPaymentId: null,
        paidAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        ...create,
      };
      store.orders.push(created);
      return created;
    }),
  };
  const subscriptionCreate = jest.fn(async ({ data }: any) => ({ id: 'sub-1', ...data }));
  const prisma: any = { paymentOrder, subscription: { create: subscriptionCreate } };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));

  const kaspi = {
    createInvoice: jest.fn(async (phone: string) => ({
      id: (newId += 1),
      receiptUrl: '',
      orderNumber: 'N-1',
      status: 'RemotePaymentCreated',
      clientMobile: phone,
    })),
    createQr: jest.fn(async () => ({
      id: (newId += 1),
      status: 'QrTokenCreated',
      qrToken: 'https://pay.kaspi.kz/pay/new-qr',
      receiptUrl: '',
      expiresAt: new Date(Date.now() + 5 * MINUTE).toISOString(),
    })),
    getInvoiceDetails: jest.fn(async (_id: string): Promise<unknown> => PENDING),
    getQrStatus: jest.fn(async (_id: string): Promise<unknown> => ({ Code: 0, Data: { Status: 'QrTokenCreated' } })),
    cancelInvoice: jest.fn(async (_id: string): Promise<unknown> => CANCELLED),
  };
  const accessService: any = { syncSubscriptionEntitlements: jest.fn().mockResolvedValue(undefined) };
  const analytics: any = { recordEvent: jest.fn().mockResolvedValue(undefined) };
  const config: any = { get: jest.fn(() => undefined) };

  const service = new BillingService(prisma, config, accessService, kaspi as any, analytics, staticMonetization());
  return { service, store, kaspi, subscriptionCreate, analytics };
}

describe('Kaspi checkout: one live payment per account', () => {
  it('continues a fresh invoice for the same plan and the same phone', async () => {
    const existing = invoice({ ageMs: 5 * MINUTE });
    const { service, kaspi, store } = makeService([existing]);

    const result = await service.createKaspiCheckout(USER, 'starter', '+7 701 123 45 67', 'invoice');

    expect(result).toMatchObject({ providerOrderId: existing.providerOrderId, status: 'pending', reused: true });
    expect(kaspi.createInvoice).not.toHaveBeenCalled();
    expect(kaspi.cancelInvoice).not.toHaveBeenCalled();
    expect(store.orders).toHaveLength(1);
  });

  it('sends a new invoice to another phone and withdraws the previous one', async () => {
    const existing = invoice({ phone: OTHER_PHONE });
    const { service, kaspi, store } = makeService([existing]);

    const result = await service.createKaspiCheckout(USER, 'starter', PHONE, 'invoice');

    expect(kaspi.cancelInvoice).toHaveBeenCalledWith(existing.providerOrderId);
    expect(existing.status).toBe('cancelled');
    expect(existing.providerPayload).toMatchObject({ cancelSource: 'superseded' });
    expect(kaspi.createInvoice).toHaveBeenCalledWith(PHONE, 490, expect.any(String));
    expect(result.reused).toBe(false);
    expect(result.providerOrderId).not.toBe(existing.providerOrderId);
    expect(store.orders.filter((row) => row.status === 'pending')).toHaveLength(1);
  });

  it('does not continue an invoice older than 30 minutes — the payer asked for it again', async () => {
    const existing = invoice({ ageMs: 31 * MINUTE });
    const { service, kaspi } = makeService([existing]);

    const result = await service.createKaspiCheckout(USER, 'starter', PHONE, 'invoice');

    expect(kaspi.cancelInvoice).toHaveBeenCalledWith(existing.providerOrderId);
    expect(existing.status).toBe('cancelled');
    expect(kaspi.createInvoice).toHaveBeenCalledTimes(1);
    expect(result.reused).toBe(false);
  });

  it('withdraws an invoice for another plan before billing the new plan', async () => {
    const existing = invoice({ planCode: 'premium', amount: 2990 });
    const { service, kaspi } = makeService([existing]);

    const result = await service.createKaspiCheckout(USER, 'starter', PHONE, 'invoice');

    expect(existing.status).toBe('cancelled');
    expect(kaspi.createInvoice).toHaveBeenCalledWith(PHONE, 490, expect.any(String));
    expect(result.reused).toBe(false);
  });

  it('still creates the payment when Kaspi does not confirm the withdrawal', async () => {
    const existing = invoice({ phone: OTHER_PHONE });
    const { service, kaspi } = makeService([existing]);
    kaspi.cancelInvoice.mockRejectedValueOnce(new Error('ECONNRESET'));

    const result = await service.createKaspiCheckout(USER, 'starter', PHONE, 'invoice');

    expect(existing.status).toBe('pending');
    expect(result).toMatchObject({ status: 'pending', reused: false });
  });

  it('continues a QR that still has more than a minute left', async () => {
    const existing = qr({ leftMs: 3 * MINUTE });
    const { service, kaspi } = makeService([existing]);

    const result = await service.createKaspiCheckout(USER, 'starter', '', 'qr');

    expect(result).toMatchObject({
      providerOrderId: existing.providerOrderId,
      paymentType: 'qr',
      checkoutUrl: 'https://pay.kaspi.kz/pay/old-qr',
      reused: true,
    });
    expect(kaspi.createQr).not.toHaveBeenCalled();
  });

  it('creates a new QR when the previous one is about to expire', async () => {
    const existing = qr({ leftMs: 30_000 });
    const { service, kaspi } = makeService([existing]);

    const result = await service.createKaspiCheckout(USER, 'starter', '', 'qr');

    expect(kaspi.createQr).toHaveBeenCalledWith(490);
    expect(result).toMatchObject({ paymentType: 'qr', checkoutUrl: 'https://pay.kaspi.kz/pay/new-qr', reused: false });
    // QR отменить нельзя — он истекает сам.
    expect(kaspi.cancelInvoice).not.toHaveBeenCalled();
  });

  it('does not hand a QR of another plan to the payer', async () => {
    const existing = qr({ planCode: 'premium', amount: 2990 });
    const { service, kaspi } = makeService([existing]);

    const result = await service.createKaspiCheckout(USER, 'starter', '', 'qr');

    expect(kaspi.createQr).toHaveBeenCalledWith(490);
    expect(result.providerOrderId).not.toBe(existing.providerOrderId);
  });

  it('switching from an invoice to QR withdraws the invoice', async () => {
    const existing = invoice();
    const { service, kaspi } = makeService([existing]);

    const result = await service.createKaspiCheckout(USER, 'starter', '', 'qr');

    expect(existing.status).toBe('cancelled');
    expect(kaspi.createQr).toHaveBeenCalledTimes(1);
    expect(result.paymentType).toBe('qr');
  });

  it('closes an order whose Kaspi operation id was never saved and creates a real payment', async () => {
    const broken = invoice({ providerOrderId: 'unknown-{"error":"timeout"}', ageMs: 20 * 24 * HOUR });
    const { service, kaspi } = makeService([broken]);

    const result = await service.createKaspiCheckout(USER, 'starter', PHONE, 'invoice');

    expect(broken.status).toBe('cancelled');
    expect(broken.providerPayload).toMatchObject({ cancelReason: 'invalid_provider_order_id' });
    // У Kaspi про такой заказ спрашивать нечего.
    expect(kaspi.getInvoiceDetails).not.toHaveBeenCalledWith(broken.providerOrderId);
    expect(kaspi.cancelInvoice).not.toHaveBeenCalled();
    expect(result.providerOrderId).toMatch(/^\d+$/);
    expect(result.reused).toBe(false);
  });

  it('returns the already paid order instead of charging twice', async () => {
    const existing = invoice();
    const { service, kaspi, subscriptionCreate } = makeService([existing]);
    kaspi.getInvoiceDetails.mockResolvedValue(PROCESSED);

    const result = await service.createKaspiCheckout(USER, 'starter', PHONE, 'invoice');

    expect(result).toMatchObject({ providerOrderId: existing.providerOrderId, status: 'paid', reused: true });
    expect(existing.status).toBe('paid');
    expect(subscriptionCreate).toHaveBeenCalledTimes(1);
    expect(kaspi.createInvoice).not.toHaveBeenCalled();
  });

  it('an invoice paid at the moment it is being withdrawn counts as paid', async () => {
    const existing = invoice({ phone: OTHER_PHONE });
    const { service, kaspi, subscriptionCreate } = makeService([existing]);
    kaspi.cancelInvoice.mockResolvedValueOnce(PROCESSED);

    const result = await service.createKaspiCheckout(USER, 'starter', PHONE, 'invoice');

    expect(result).toMatchObject({ providerOrderId: existing.providerOrderId, status: 'paid' });
    expect(subscriptionCreate).toHaveBeenCalledTimes(1);
    expect(kaspi.createInvoice).not.toHaveBeenCalled();
  });

  it('records who created the payment', async () => {
    const { service, store, analytics } = makeService([]);

    await service.createKaspiCheckout(USER, 'starter', PHONE, 'invoice', { payer: 'parent_link' });

    expect(store.orders[0].providerPayload).toMatchObject({ payer: 'parent_link', payerPhone: PHONE });
    expect(analytics.recordEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        step: 'checkout_created',
        metadata: expect.objectContaining({ payer: 'parent_link', paymentType: 'invoice' }),
      }),
    );
  });
});

describe('Kaspi invoices get a lifetime of their own', () => {
  it('withdraws an invoice older than 48 hours on a status check', async () => {
    const stale = invoice({ ageMs: 49 * HOUR });
    const { service, kaspi } = makeService([stale]);

    const view = await service.getOrder(USER, stale.providerOrderId);

    expect(kaspi.cancelInvoice).toHaveBeenCalledWith(stale.providerOrderId);
    expect(view.status).toBe('cancelled');
    expect(stale.providerPayload).toMatchObject({ cancelSource: 'auto-expired' });
  });

  it('keeps a 47-hour-old invoice payable', async () => {
    const recent = invoice({ ageMs: 47 * HOUR });
    const { service, kaspi } = makeService([recent]);

    const view = await service.getOrder(USER, recent.providerOrderId);

    expect(view.status).toBe('pending');
    expect(kaspi.cancelInvoice).not.toHaveBeenCalled();
  });

  it('provides a late payment instead of withdrawing a paid invoice', async () => {
    const stale = invoice({ ageMs: 60 * HOUR });
    const { service, kaspi, subscriptionCreate } = makeService([stale]);
    kaspi.getInvoiceDetails.mockResolvedValue(PROCESSED);

    const view = await service.getOrder(USER, stale.providerOrderId);

    expect(view.status).toBe('paid');
    expect(subscriptionCreate).toHaveBeenCalledTimes(1);
    expect(kaspi.cancelInvoice).not.toHaveBeenCalled();
  });

  it('leaves the invoice pending while Kaspi refuses to withdraw it, and does not retry every poll', async () => {
    const stale = invoice({ ageMs: 49 * HOUR });
    const { service, kaspi } = makeService([stale]);
    kaspi.cancelInvoice.mockRejectedValue(new Error('timeout'));

    const first = await service.getOrder(USER, stale.providerOrderId);
    const second = await service.getOrder(USER, stale.providerOrderId);

    // Счёт всё ещё можно оплатить в Kaspi — закрывать заказ у себя рано.
    expect(first.status).toBe('pending');
    expect(second.status).toBe('pending');
    expect(stale.providerPayload).toHaveProperty('autoCancelAttemptAt');
    expect(kaspi.cancelInvoice).toHaveBeenCalledTimes(1);
  });

  it('closes the order locally after 7 days even if Kaspi never confirmed the withdrawal', async () => {
    const ancient = invoice({ ageMs: 8 * 24 * HOUR });
    const { service, kaspi } = makeService([ancient]);
    kaspi.cancelInvoice.mockRejectedValue(new Error('timeout'));

    const view = await service.getOrder(USER, ancient.providerOrderId);

    expect(view.status).toBe('failed');
    expect(ancient.providerPayload).toHaveProperty('locallyExpiredAt');
  });

  it('the list of active payments shows neither stale invoices nor orders without a Kaspi id', async () => {
    const fresh = invoice({ ageMs: 10 * MINUTE });
    const stale = invoice({ ageMs: 30 * 24 * HOUR, planCode: 'premium', amount: 2990 });
    const broken = invoice({ providerOrderId: 'unknown', ageMs: 3 * 24 * HOUR });
    const { service } = makeService([fresh, stale, broken]);

    const active = await service.getActiveKaspiOrders(USER);

    expect(active.map((item) => item.providerOrderId)).toEqual([fresh.providerOrderId]);
    expect(stale.status).toBe('cancelled');
    expect(broken.status).toBe('cancelled');
  });

  it('shows only a mask of the phone the invoice was sent to', async () => {
    const existing = invoice();
    const { service } = makeService([existing]);

    const view = await service.getOrder(USER, existing.providerOrderId);

    expect(view.phoneMask).toBe('+7 701 ** *** 67');
    expect(JSON.stringify({ mask: view.phoneMask })).not.toContain(PHONE);
  });
});
