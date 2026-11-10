import { BadRequestException, HttpException, ServiceUnavailableException } from '@nestjs/common';
import {
  PARENT_PAY_TOKEN_LENGTH,
  signParentPayToken,
  verifyParentPayToken,
} from '../src/modules/billing/parent-pay/parent-pay-token';
import { ParentPayService } from '../src/modules/billing/parent-pay/parent-pay.service';
import {
  signParentReportToken,
  verifyParentReportToken,
} from '../src/modules/parent-report/domain/parent-report-token';

/**
 * «Оплатить за ученика»: ссылка /pay/<token> открывается без входа и умеет создавать платёж
 * Kaspi в пользу аккаунта. Проверяем, что токен не подделать и не спутать с другими, что
 * наружу не уходит ничего лишнего и что публичная ссылка не превращается в рассылку счетов.
 */

const SECRET = 'test-secret-for-parent-pay-0123456789';
const USER_ID = '7f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b';
const NOW = new Date('2026-11-10T10:00:00.000Z');
const DAY = 24 * 60 * 60 * 1000;

function httpError(error: unknown): { status: number; body: any } {
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

async function rejection(promise: Promise<unknown>) {
  try {
    await promise;
  } catch (error) {
    return httpError(error);
  }
  throw new Error('Expected the call to be rejected');
}

describe('parent pay token', () => {
  const expiresAt = new Date(NOW.getTime() + 30 * DAY);

  it('signs and verifies the account and the expiry', () => {
    const token = signParentPayToken({ userId: USER_ID, expiresAt }, SECRET);

    expect(token).toHaveLength(PARENT_PAY_TOKEN_LENGTH);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifyParentPayToken(token, SECRET, NOW)).toEqual({ userId: USER_ID, expiresAt });
  });

  it('stops working at the expiry moment', () => {
    const token = signParentPayToken({ userId: USER_ID, expiresAt }, SECRET);

    expect(verifyParentPayToken(token, SECRET, new Date(expiresAt.getTime() - 1000))).not.toBeNull();
    expect(verifyParentPayToken(token, SECRET, expiresAt)).toBeNull();
    expect(verifyParentPayToken(token, SECRET, new Date(expiresAt.getTime() + DAY))).toBeNull();
  });

  it('rejects a token changed in any position', () => {
    const token = signParentPayToken({ userId: USER_ID, expiresAt }, SECRET);
    for (let i = 0; i < token.length; i += 1) {
      const replacement = token[i] === 'A' ? 'B' : 'A';
      const forged = token.slice(0, i) + replacement + token.slice(i + 1);
      expect(verifyParentPayToken(forged, SECRET, NOW)).toBeNull();
    }
  });

  it('cannot be extended by rewriting the expiry', () => {
    const token = signParentPayToken({ userId: USER_ID, expiresAt: new Date(NOW.getTime() + 1000) }, SECRET);
    const raw = Buffer.from(token, 'base64url');
    raw.writeUInt32BE(Math.floor((NOW.getTime() + 365 * DAY) / 1000), 17);

    expect(verifyParentPayToken(raw.toString('base64url'), SECRET, NOW)).toBeNull();
  });

  it('rejects another secret, garbage and non-strings', () => {
    const token = signParentPayToken({ userId: USER_ID, expiresAt }, SECRET);

    expect(verifyParentPayToken(token, `${SECRET}x`, NOW)).toBeNull();
    expect(verifyParentPayToken(token.slice(1), SECRET, NOW)).toBeNull();
    expect(verifyParentPayToken(`${token}A`, SECRET, NOW)).toBeNull();
    expect(verifyParentPayToken('', SECRET, NOW)).toBeNull();
    expect(verifyParentPayToken(undefined, SECRET, NOW)).toBeNull();
    expect(verifyParentPayToken(['x'.repeat(50)], SECRET, NOW)).toBeNull();
    expect(verifyParentPayToken('../'.repeat(16) + 'ab', SECRET, NOW)).toBeNull();
  });

  it('is not interchangeable with the parent report link signed by the same secret', () => {
    const reportToken = signParentReportToken({ userId: USER_ID, version: 1_900_000_000 }, SECRET);
    const payToken = signParentPayToken({ userId: USER_ID, expiresAt }, SECRET);

    expect(verifyParentPayToken(reportToken, SECRET, NOW)).toBeNull();
    expect(verifyParentReportToken(payToken, SECRET)).toBeNull();
  });

  it('refuses to sign without a secret or for a malformed account id', () => {
    expect(() => signParentPayToken({ userId: USER_ID, expiresAt }, '  ')).toThrow();
    expect(() => signParentPayToken({ userId: 'not-a-uuid', expiresAt }, SECRET)).toThrow();
  });
});

type BillingView = {
  invoiceId: string;
  providerOrderId: string;
  status: string;
  amount: number;
  currency: string;
  planCode: string;
  planName: string;
  paymentType: 'qr' | 'invoice';
  checkoutUrl: string | null;
  receiptUrl: string | null;
  qrToken: string | null;
  expiresAt: string | null;
  expiresAtIso: string | null;
  fallbackToQr: boolean;
  phoneMask: string | null;
  payer: string;
  orderNumber: string | null;
  statusDesc: string | null;
  paidAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

function billingView(over: Partial<BillingView> = {}): BillingView {
  return {
    invoiceId: '16140556221',
    providerOrderId: '16140556221',
    status: 'pending',
    amount: 2990,
    currency: 'KZT',
    planCode: 'premium',
    planName: 'Месяц',
    paymentType: 'qr',
    checkoutUrl: 'https://pay.kaspi.kz/pay/abc123',
    receiptUrl: 'https://receipt.kaspi.kz/internal/receipt-1',
    qrToken: 'https://pay.kaspi.kz/pay/abc123',
    expiresAt: '2026-11-10T15:05:00',
    expiresAtIso: '2026-11-10T10:05:00.000Z',
    fallbackToQr: false,
    phoneMask: null,
    payer: 'parent_link',
    orderNumber: 'N-777',
    statusDesc: 'raw kaspi description',
    paidAt: null,
    createdAt: new Date('2026-11-10T10:00:00.000Z'),
    updatedAt: new Date('2026-11-10T10:00:00.000Z'),
    ...over,
  };
}

function fakeRedis() {
  const counters = new Map<string, number>();
  const sets = new Map<string, Set<string>>();
  return {
    counters,
    sets,
    incr: jest.fn(async (key: string) => {
      const next = (counters.get(key) ?? 0) + 1;
      counters.set(key, next);
      return next;
    }),
    expire: jest.fn(async () => 1),
    sismember: jest.fn(async (key: string, member: string) => (sets.get(key)?.has(member) ? 1 : 0)),
    scard: jest.fn(async (key: string) => sets.get(key)?.size ?? 0),
    sadd: jest.fn(async (key: string, member: string) => {
      if (!sets.has(key)) sets.set(key, new Set());
      sets.get(key)!.add(member);
      return 1;
    }),
  };
}

function makeService(opts: { student?: { firstName: string | null } | null; env?: Record<string, string> } = {}) {
  const student = opts.student === undefined ? { firstName: 'Айгерим' } : opts.student;
  const env: Record<string, string> = { JWT_SECRET: SECRET, ...(opts.env ?? {}) };
  const prisma = {
    user: { findUnique: jest.fn(async () => (student ? { id: USER_ID, ...student } : null)) },
    paymentOrder: { findFirst: jest.fn(async (_args: any): Promise<any> => null) },
    subscription: { findFirst: jest.fn(async (_args: any): Promise<any> => null) },
    userExamEntitlement: { findFirst: jest.fn(async (_args: any): Promise<any> => null) },
  };
  const config = { get: jest.fn((key: string) => env[key]) };
  const billing = {
    createKaspiCheckout: jest.fn(async (..._args: any[]): Promise<any> => ({ providerOrderId: '16140556221' })),
    getOrder: jest.fn(async (..._args: any[]): Promise<any> => billingView()),
  };
  const analytics = { recordEvent: jest.fn(async (_event: any) => undefined) };
  const redis = fakeRedis();
  const service = new ParentPayService(prisma as any, config as any, billing as any, analytics as any, redis as any);
  const token = signParentPayToken({ userId: USER_ID, expiresAt: new Date(NOW.getTime() + 30 * DAY) }, SECRET);
  return { service, prisma, config, billing, analytics, redis, token };
}

describe('ParentPayService.createLink', () => {
  it('builds a 30-day link that leads to the account and preselects the plan', async () => {
    const { service, analytics } = makeService();

    const link = await service.createLink(USER_ID, 'premium', NOW);

    const url = new URL(link.url);
    expect(url.origin).toBe('https://my-test.kz');
    expect(url.searchParams.get('plan')).toBe('premium');
    const token = url.pathname.replace('/pay/', '');
    expect(token).toHaveLength(PARENT_PAY_TOKEN_LENGTH);
    expect(verifyParentPayToken(token, SECRET, NOW)).toEqual({
      userId: USER_ID,
      expiresAt: new Date(link.expiresAt),
    });
    expect(new Date(link.expiresAt).getTime()).toBe(NOW.getTime() + 30 * DAY);
    expect(analytics.recordEvent).toHaveBeenCalledWith({
      userId: USER_ID,
      step: 'parent_pay_link_created',
      metadata: { planCode: 'premium' },
    });
  });

  it('uses the configured site and drops a plan value that is not a plan code', async () => {
    const { service } = makeService({ env: { PUBLIC_SITE_URL: 'https://staging.my-test.kz/' } });

    const link = await service.createLink(USER_ID, 'premium&lang=<script>', NOW);

    expect(link.url).toMatch(/^https:\/\/staging\.my-test\.kz\/pay\/[A-Za-z0-9_-]{50}$/);
  });

  it('still returns the link when analytics is down', async () => {
    const { service, analytics } = makeService();
    analytics.recordEvent.mockRejectedValueOnce(new Error('db down'));

    await expect(service.createLink(USER_ID, undefined, NOW)).resolves.toMatchObject({
      url: expect.stringContaining('/pay/'),
    });
  });

  it('prefers a dedicated secret, so the link survives a JWT secret rotation', async () => {
    const { service } = makeService({ env: { PARENT_PAY_SECRET: 'dedicated-parent-pay-secret-123456' } });

    const link = await service.createLink(USER_ID, undefined, NOW);
    const token = new URL(link.url).pathname.replace('/pay/', '');

    expect(verifyParentPayToken(token, 'dedicated-parent-pay-secret-123456', NOW)).not.toBeNull();
    expect(verifyParentPayToken(token, SECRET, NOW)).toBeNull();
  });
});

describe('ParentPayService.getInfo', () => {
  it('answers the same 404 for a forged link, an expired link and a deleted account', async () => {
    const forged = await rejection(makeService().service.getInfo('A'.repeat(50), NOW));

    const live = makeService();
    const expired = await rejection(live.service.getInfo(live.token, new Date(NOW.getTime() + 31 * DAY)));

    const gone = makeService({ student: null });
    const deleted = await rejection(gone.service.getInfo(gone.token, NOW));

    for (const result of [forged, expired, deleted]) {
      expect(result.status).toBe(404);
      expect(result.body).toEqual(forged.body);
      expect(result.body.code).toBe('PARENT_PAY_NOT_FOUND');
    }
    // Негодный токен отсекается до любого запроса в БД.
    expect(live.prisma.user.findUnique).not.toHaveBeenCalled();
  });

  it('shows only the first name and the access state', async () => {
    const { service, prisma, token } = makeService({ student: { firstName: `  ${'Я'.repeat(60)}  ` } });
    prisma.subscription.findFirst.mockResolvedValueOnce({ expiresAt: new Date('2026-12-01T00:00:00.000Z') });

    const info = await service.getInfo(token, NOW);

    expect(info.studentName).toBe('Я'.repeat(40));
    expect(info.access).toEqual({ active: true, until: '2026-12-01T00:00:00.000Z' });
    expect(info.order).toBeNull();
    expect(Object.keys(info).sort()).toEqual(['access', 'linkExpiresAt', 'order', 'studentName']);
    expect(prisma.user.findUnique).toHaveBeenCalledWith({ where: { id: USER_ID }, select: { firstName: true } });
  });

  it('resumes a payment started in the last 30 minutes', async () => {
    const { service, prisma, billing, token } = makeService();
    prisma.paymentOrder.findFirst.mockResolvedValueOnce({ providerOrderId: '16140556221' });

    const info = await service.getInfo(token, NOW);

    const where = prisma.paymentOrder.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: USER_ID, provider: 'kaspi', status: { in: ['pending', 'paid'] } });
    expect(where.createdAt.gte).toEqual(new Date(NOW.getTime() - 30 * 60 * 1000));
    expect(billing.getOrder).toHaveBeenCalledWith(USER_ID, '16140556221');
    expect(info.order).toMatchObject({ orderId: '16140556221', status: 'pending', planCode: 'premium' });
  });

  it('does not show a payment that turned out to be failed, and survives a billing error', async () => {
    const failed = makeService();
    failed.prisma.paymentOrder.findFirst.mockResolvedValueOnce({ providerOrderId: '16140556221' });
    failed.billing.getOrder.mockResolvedValueOnce(billingView({ status: 'failed' }));
    expect((await failed.service.getInfo(failed.token, NOW)).order).toBeNull();

    const broken = makeService();
    broken.prisma.paymentOrder.findFirst.mockResolvedValueOnce({ providerOrderId: '16140556221' });
    broken.billing.getOrder.mockRejectedValueOnce(new Error('kaspi down'));
    expect((await broken.service.getInfo(broken.token, NOW)).order).toBeNull();
  });
});

describe('public view of a payment', () => {
  it('exposes the Kaspi link of a pending QR and nothing internal', async () => {
    const { service, token } = makeService();

    const order = await service.checkout(token, { planId: 'premium', method: 'qr' }, NOW);

    expect(order).toEqual({
      orderId: '16140556221',
      status: 'pending',
      paymentType: 'qr',
      planCode: 'premium',
      planName: 'Месяц',
      amount: 2990,
      payUrl: 'https://pay.kaspi.kz/pay/abc123',
      expiresAt: '2026-11-10T10:05:00.000Z',
      phoneMask: null,
      createdAt: '2026-11-10T10:00:00.000Z',
      paidAt: null,
      serverTime: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
    });
    const serialized = JSON.stringify(order);
    expect(serialized).not.toContain('receipt');
    expect(serialized).not.toContain('N-777');
    expect(serialized).not.toContain('raw kaspi description');
  });

  it.each([
    ['https://evil.example/pay/abc', null],
    ['https://pay.kaspi.kz.evil.example/pay/abc', null],
    ['http://pay.kaspi.kz/pay/abc', null],
    ['javascript:alert(1)', null],
    ['not a url', null],
    ['https://kaspi.kz/pay/abc', 'https://kaspi.kz/pay/abc'],
    ['kaspi://pay?token=abc', 'kaspi://pay?token=abc'],
  ])('lets the payer follow only a Kaspi address: %s', async (checkoutUrl, expected) => {
    const { service, billing, token } = makeService();
    billing.getOrder.mockResolvedValueOnce(billingView({ checkoutUrl, qrToken: checkoutUrl }));

    const order = await service.checkout(token, { planId: 'premium', method: 'qr' }, NOW);

    expect(order.payUrl).toBe(expected);
  });

  it('an invoice has no link and no countdown, only the masked phone', async () => {
    const { service, billing, token } = makeService();
    billing.getOrder.mockResolvedValueOnce(
      billingView({
        paymentType: 'invoice',
        checkoutUrl: 'https://receipt.kaspi.kz/internal/receipt-1',
        qrToken: null,
        expiresAtIso: null,
        phoneMask: '+7 701 ** *** 67',
      }),
    );

    const order = await service.checkout(token, { planId: 'premium', method: 'invoice', phoneNumber: '8 701 123 45 67' }, NOW);

    expect(order).toMatchObject({ paymentType: 'invoice', payUrl: null, expiresAt: null, phoneMask: '+7 701 ** *** 67' });
  });

  it('hides the link once the payment is no longer pending and maps unknown statuses to failed', async () => {
    const { service, billing, token } = makeService();
    billing.getOrder.mockResolvedValueOnce(billingView({ status: 'paid', paidAt: new Date('2026-11-10T10:02:00.000Z') }));
    const paid = await service.checkout(token, { planId: 'premium', method: 'qr' }, NOW);
    expect(paid).toMatchObject({ status: 'paid', payUrl: null, paidAt: '2026-11-10T10:02:00.000Z' });

    billing.getOrder.mockResolvedValueOnce(billingView({ status: 'refund_pending' }));
    const odd = await service.checkout(token, { planId: 'premium', method: 'qr' }, NOW);
    expect(odd).toMatchObject({ status: 'failed', payUrl: null });
  });
});

describe('ParentPayService.checkout', () => {
  it('creates the payment for the account from the link, marked as paid by a parent', async () => {
    const { service, billing, token } = makeService();

    await service.checkout(token, { planId: ' premium ', method: 'invoice', phoneNumber: '+7 (701) 123-45-67' }, NOW);

    expect(billing.createKaspiCheckout).toHaveBeenCalledWith(USER_ID, 'premium', '77011234567', 'invoice', {
      payer: 'parent_link',
    });
  });

  it('pays by link unless an invoice is asked for explicitly, and ignores a phone sent with QR', async () => {
    const { service, billing, redis, token } = makeService();

    await service.checkout(token, { planId: 'premium', method: 'anything', phoneNumber: '77011234567' }, NOW);

    expect(billing.createKaspiCheckout).toHaveBeenCalledWith(USER_ID, 'premium', '', 'qr', { payer: 'parent_link' });
    expect(redis.sadd).not.toHaveBeenCalled();
  });

  it('rejects bad input before touching Kaspi or the daily quota', async () => {
    const { service, billing, redis, token } = makeService();

    const noPlan = await rejection(service.checkout(token, { method: 'qr' }, NOW));
    const badPhone = await rejection(
      service.checkout(token, { planId: 'premium', method: 'invoice', phoneNumber: '12345' }, NOW),
    );
    const noPhone = await rejection(service.checkout(token, { planId: 'premium', method: 'invoice' }, NOW));
    const objectPlan = await rejection(service.checkout(token, { planId: { $ne: null }, method: 'qr' }, NOW));

    expect(noPlan).toMatchObject({ status: 400, body: { code: 'PLAN_NOT_FOUND' } });
    expect(objectPlan).toMatchObject({ status: 400, body: { code: 'PLAN_NOT_FOUND' } });
    expect(badPhone).toMatchObject({ status: 400, body: { code: 'INVALID_PHONE' } });
    expect(noPhone).toMatchObject({ status: 400, body: { code: 'INVALID_PHONE' } });
    expect(billing.createKaspiCheckout).not.toHaveBeenCalled();
    expect(redis.incr).not.toHaveBeenCalled();
  });

  it('refuses a forged link and a deleted account without creating anything', async () => {
    const forged = makeService();
    expect(await rejection(forged.service.checkout('B'.repeat(50), { planId: 'premium' }, NOW))).toMatchObject({
      status: 404,
      body: { code: 'PARENT_PAY_NOT_FOUND' },
    });
    expect(forged.billing.createKaspiCheckout).not.toHaveBeenCalled();

    const gone = makeService({ student: null });
    expect(await rejection(gone.service.checkout(gone.token, { planId: 'premium' }, NOW))).toMatchObject({
      status: 404,
      body: { code: 'PARENT_PAY_NOT_FOUND' },
    });
    expect(gone.billing.createKaspiCheckout).not.toHaveBeenCalled();
  });

  it('turns billing errors into short codes without leaking the raw Kaspi answer', async () => {
    const { service, billing, token } = makeService();
    const input = { planId: 'premium', method: 'invoice', phoneNumber: '77011234567' };

    billing.createKaspiCheckout.mockRejectedValueOnce(new BadRequestException('PLAN_NOT_FOUND'));
    expect(await rejection(service.checkout(token, input, NOW))).toMatchObject({
      status: 400,
      body: { code: 'PLAN_NOT_FOUND' },
    });

    billing.createKaspiCheckout.mockRejectedValueOnce(
      new BadRequestException('KASPI_INVOICE_CREATE_ERROR:{"Code":-14,"Message":"client 77011234567 not found","session":"abc"}'),
    );
    const invoiceFailed = await rejection(service.checkout(token, input, NOW));
    expect(invoiceFailed).toMatchObject({ status: 400, body: { code: 'INVOICE_FAILED' } });
    expect(JSON.stringify(invoiceFailed.body)).not.toContain('77011234567');
    expect(JSON.stringify(invoiceFailed.body)).not.toContain('session');

    billing.createKaspiCheckout.mockRejectedValueOnce(new ServiceUnavailableException('KASPI_TEMPORARILY_UNAVAILABLE'));
    expect(await rejection(service.checkout(token, input, NOW))).toMatchObject({
      status: 503,
      body: { code: 'KASPI_UNAVAILABLE' },
    });

    billing.createKaspiCheckout.mockRejectedValueOnce(new Error('connect ECONNREFUSED 127.0.0.1:3032'));
    const unknown = await rejection(service.checkout(token, input, NOW));
    expect(unknown).toMatchObject({ status: 503, body: { code: 'KASPI_UNAVAILABLE' } });
    expect(JSON.stringify(unknown.body)).not.toContain('3032');
  });
});

describe('ParentPayService daily limits', () => {
  const qrInput = { planId: 'premium', method: 'qr' };
  const invoiceTo = (phone: string) => ({ planId: 'premium', method: 'invoice', phoneNumber: phone });

  it('allows 12 payment attempts per student per day, then answers 429', async () => {
    const { service, billing, token } = makeService();

    for (let i = 0; i < 12; i += 1) await service.checkout(token, qrInput, NOW);
    const blocked = await rejection(service.checkout(token, qrInput, NOW));

    expect(blocked).toMatchObject({ status: 429, body: { code: 'PARENT_PAY_LIMIT' } });
    expect(billing.createKaspiCheckout).toHaveBeenCalledTimes(12);
  });

  it('sends invoices to at most 4 different phones a day; repeating a known phone is fine', async () => {
    const { service, billing, token } = makeService();

    for (const phone of ['77010000001', '77010000002', '77010000003', '77010000004']) {
      await service.checkout(token, invoiceTo(phone), NOW);
    }
    await service.checkout(token, invoiceTo('8 701 000 00 01'), NOW);
    const blocked = await rejection(service.checkout(token, invoiceTo('77010000005'), NOW));
    await service.checkout(token, qrInput, NOW);

    expect(blocked).toMatchObject({ status: 429, body: { code: 'PARENT_PAY_LIMIT' } });
    expect(billing.createKaspiCheckout).toHaveBeenCalledTimes(6);
    expect(billing.createKaspiCheckout).not.toHaveBeenCalledWith(
      USER_ID,
      'premium',
      '77010000005',
      'invoice',
      expect.anything(),
    );
  });

  it('counts by Almaty days and keeps students apart', async () => {
    const { service, redis, token } = makeService();
    // 18:59 UTC = 23:59 в Алматы, 19:00 UTC — уже следующий день.
    await service.checkout(token, qrInput, new Date('2026-11-10T18:59:00.000Z'));
    await service.checkout(token, qrInput, new Date('2026-11-10T19:00:00.000Z'));

    expect([...redis.counters.keys()]).toEqual([
      `parent-pay:checkouts:${USER_ID}:2026-11-10`,
      `parent-pay:checkouts:${USER_ID}:2026-11-11`,
    ]);
    expect(redis.expire).toHaveBeenCalledWith(`parent-pay:checkouts:${USER_ID}:2026-11-10`, 26 * 60 * 60);
  });

  it('keeps a fingerprint of the phone in Redis, not the phone itself', async () => {
    const { service, redis, token } = makeService();

    await service.checkout(token, invoiceTo('77011234567'), NOW);

    const [key, member] = redis.sadd.mock.calls[0];
    expect(key).not.toContain('77011234567');
    expect(member).toMatch(/^[0-9a-f]{24}$/);
    expect(member).not.toContain('7701');
  });

  it('creates no payment when the limiter is unavailable', async () => {
    const { service, billing, redis, token } = makeService();
    redis.incr.mockRejectedValueOnce(new Error('Redis is down'));

    const result = await rejection(service.checkout(token, qrInput, NOW));

    expect(result).toMatchObject({ status: 503, body: { code: 'PARENT_PAY_UNAVAILABLE' } });
    expect(billing.createKaspiCheckout).not.toHaveBeenCalled();
  });
});

describe('ParentPayService.getOrder', () => {
  it('looks up only a numeric Kaspi operation of this account from the last 48 hours', async () => {
    const { service, prisma, billing, token } = makeService();
    prisma.paymentOrder.findFirst.mockResolvedValueOnce({ id: 'ord-1' });

    const order = await service.getOrder(token, '16140556221', NOW);

    const where = prisma.paymentOrder.findFirst.mock.calls[0][0].where;
    expect(where).toMatchObject({ userId: USER_ID, provider: 'kaspi', providerOrderId: '16140556221' });
    expect(where.createdAt.gte).toEqual(new Date(NOW.getTime() - 48 * 60 * 60 * 1000));
    expect(billing.getOrder).toHaveBeenCalledWith(USER_ID, '16140556221');
    expect(order.orderId).toBe('16140556221');
  });

  it('answers 404 for a foreign, old or malformed order id', async () => {
    const { service, prisma, billing, token } = makeService();

    const foreign = await rejection(service.getOrder(token, '999', NOW));
    const malformed = await rejection(service.getOrder(token, 'unknown-{"a":1}', NOW));
    const injected = await rejection(service.getOrder(token, { not: '' } as any, NOW));

    for (const result of [foreign, malformed, injected]) {
      expect(result).toMatchObject({ status: 404, body: { code: 'ORDER_NOT_FOUND' } });
    }
    expect(prisma.paymentOrder.findFirst).toHaveBeenCalledTimes(1);
    expect(billing.getOrder).not.toHaveBeenCalled();
  });

  it('needs a valid link', async () => {
    const { service, prisma } = makeService();

    const result = await rejection(service.getOrder('C'.repeat(50), '16140556221', NOW));

    expect(result).toMatchObject({ status: 404, body: { code: 'PARENT_PAY_NOT_FOUND' } });
    expect(prisma.paymentOrder.findFirst).not.toHaveBeenCalled();
  });
});
