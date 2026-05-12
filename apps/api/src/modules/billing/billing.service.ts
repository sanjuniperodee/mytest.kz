import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Prisma } from '@prisma/client';
import { createHmac, timingSafeEqual } from 'crypto';
import { normalizeKzPhone } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_PLANS, ENT_TRIAL_LIMIT } from './billing.config';
import { freedomPaySalt, freedomPaySign, freedomPayVerifySignature } from './freedompay-signature';
import { AccessService } from '../subscriptions/access.service';
import { KaspiPosService } from './kaspi-pos.service';

type FreedomPayload = Record<string, string | number | boolean | null | undefined>;
type KaspiOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled';

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function getString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

function firstString(...values: unknown[]): string | null {
  for (const value of values) {
    const str = getString(value);
    if (str) return str;
  }
  return null;
}

function isInvalidKaspiOperationId(value: string | null | undefined): boolean {
  const normalized = value?.trim().toLowerCase();
  return !normalized || normalized === 'undefined' || normalized === 'null' || normalized === 'unknown';
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private accessService: AccessService,
    private kaspiPosService: KaspiPosService,
  ) {}

  getPlans() {
    return BILLING_PLANS;
  }

  /** OTP-вход Kaspi POS; номер уже нормализован (normalizeKzPhone). */
  async kaspiSetupRequestCode(phoneNumber: string) {
    try {
      return await this.kaspiPosService.initAuth(phoneNumber);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(
        message.startsWith('KASPI_') ? message : `KASPI_SETUP_FAILED:${message}`,
      );
    }
  }

  async kaspiSetupVerifyOtp(processId: string, otp: string) {
    try {
      const auth = await this.kaspiPosService.verifyOtp(processId, otp.trim());
      return {
        ok: true as const,
        profileId: auth.profileId,
        organizationId: auth.organizationId,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (
        message === 'KASPI_NEEDS_PASSWORD' ||
        message === 'KASPI_NEEDS_MOBILE_CONFIRMATION' ||
        message === 'KASPI_OTP_FAILED'
      ) {
        throw new BadRequestException(message);
      }
      throw new BadRequestException(
        message.startsWith('KASPI_') ? message : `KASPI_VERIFY_FAILED:${message}`,
      );
    }
  }

  async kaspiSetupStatus() {
    const configured = this.kaspiPosService.isAuthenticated();
    const sessionActive = configured
      ? await this.kaspiPosService.checkSession()
      : false;
    return { configured, sessionActive };
  }

  async createKaspiCheckout(userId: string, planId: string, phoneNumber: string) {
    const plan = BILLING_PLANS.find((p) => p.id === planId);
    if (!plan) throw new BadRequestException('PLAN_NOT_FOUND');

    const pending = await this.prisma.paymentOrder.findFirst({
      where: { userId, provider: 'kaspi', status: 'pending', planCode: plan.id },
      orderBy: { createdAt: 'desc' },
    });
    if (pending) {
      if (isInvalidKaspiOperationId(pending.providerOrderId)) {
        await this.cancelInvalidKaspiOrder(pending, 'invalid-provider-order-before-checkout');
      } else {
        const reconciled = (await this.reconcileKaspiOrder(pending.providerOrderId)) ?? pending;
        const payload = asRecord(reconciled.providerPayload);
        const checkoutUrl = reconciled.checkoutUrl ?? pending.checkoutUrl;
        return {
          invoiceId: reconciled.providerOrderId,
          providerOrderId: reconciled.providerOrderId,
          checkoutUrl,
          receiptUrl: checkoutUrl,
          orderNumber: getString(payload?.orderNumber),
          reused: true,
        };
      }
    }

    const normalized = normalizeKzPhone(phoneNumber || '');
    if (!normalized) {
      throw new BadRequestException('INVALID_PHONE');
    }

    const comment = `MyTest ${plan.name} - ${userId.slice(0, 8)}`;

    let invoiceId: string;
    let receiptUrl: string;
    let orderNumber: string;
    let invoiceStatus: string;
    let clientMobile: string;

    try {
      const invoice = await this.kaspiPosService.createInvoice(
        normalized,
        Number(plan.priceKzt),
        comment,
      );
      invoiceId = String(invoice.id);
      receiptUrl = invoice.receiptUrl;
      orderNumber = invoice.orderNumber;
      invoiceStatus = invoice.status;
      clientMobile = invoice.clientMobile;
      if (!receiptUrl) {
        try {
          const detailsPayload = asRecord(await this.kaspiPosService.getInvoiceDetails(invoiceId));
          const details = asRecord(detailsPayload?.Data) ?? asRecord(detailsPayload?.data) ?? detailsPayload;
          receiptUrl =
            firstString(
              details?.ReceiptUrl,
              details?.receiptUrl,
              details?.CheckoutUrl,
              details?.checkoutUrl,
              details?.PaymentUrl,
              details?.paymentUrl,
              details?.Url,
              details?.url,
            ) ?? '';
          orderNumber = firstString(orderNumber, details?.OrderNumber, details?.orderNumber) ?? orderNumber;
          invoiceStatus = firstString(invoiceStatus, details?.Status, details?.status) ?? invoiceStatus;
        } catch {
          // The invoice is already created; keep it and let polling/webhook reconcile details later.
        }
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (message === 'KASPI_NOT_AUTHENTICATED') {
        throw new BadRequestException('KASPI_NOT_AUTHENTICATED');
      }
      throw new BadRequestException(`KASPI_INVOICE_ERROR:${message}`);
    }

    await this.prisma.paymentOrder.upsert({
      where: { providerOrderId: invoiceId },
      create: {
        userId,
        planCode: plan.id,
        amount: plan.priceKzt,
        provider: 'kaspi',
        providerOrderId: invoiceId,
        checkoutUrl: receiptUrl,
        status: 'pending',
        providerPayload: {
          orderNumber,
          provider: 'kaspi',
          status: invoiceStatus,
          receiptUrl,
          clientMobile,
        },
      },
      update: {
        status: 'pending',
        checkoutUrl: receiptUrl,
        providerPayload: {
          orderNumber,
          provider: 'kaspi',
          status: invoiceStatus,
          receiptUrl,
          clientMobile,
        },
      },
    });

    return {
      invoiceId,
      providerOrderId: invoiceId,
      checkoutUrl: receiptUrl,
      receiptUrl,
      orderNumber,
      reused: false,
    };
  }

  /**
   * Вебхук от kaspi-pos-automation (webhooks.json → payment.success / failed / expired).
   * Подпись: заголовок X-Webhook-Signature, секрет KASPI_WEBHOOK_SECRET.
   */
  async handleKaspiWebhook(
    rawBody: Buffer,
    signatureHeader: string | string[] | undefined,
    payload: Record<string, unknown>,
  ) {
    const secret = this.config.get<string>('KASPI_WEBHOOK_SECRET')?.trim();
    const sig = Array.isArray(signatureHeader) ? signatureHeader[0] : signatureHeader;
    if (secret) {
      if (!sig || !this.verifyKaspiWebhookSignature(rawBody, sig, secret)) {
        throw new UnauthorizedException('INVALID_WEBHOOK_SIGNATURE');
      }
    }

    const event = String(payload.event ?? '');
    const paymentId = String(payload.paymentId ?? '');
    const type = String(payload.type ?? '');

    if (!paymentId) {
      return { ok: false, reason: 'PAYMENT_ID_REQUIRED' };
    }

    if (event === 'payment.success' && type === 'invoice') {
      return this.finalizeKaspiInvoicePaid(paymentId, payload);
    }

    if (event === 'payment.failed' || event === 'payment.expired') {
      await this.prisma.paymentOrder.updateMany({
        where: { providerOrderId: paymentId, provider: 'kaspi', status: { not: 'paid' } },
        data: {
          status: 'failed',
          providerPayload: payload as object,
        },
      });
      return { ok: true, status: 'failed' };
    }

    return { ok: true, ignored: true };
  }

  private verifyKaspiWebhookSignature(rawBody: Buffer, signature: string, secret: string): boolean {
    const expected = `sha256=${createHmac('sha256', secret).update(rawBody).digest('hex')}`;
    try {
      const a = Buffer.from(signature);
      const b = Buffer.from(expected);
      if (a.length !== b.length) return false;
      return timingSafeEqual(a, b);
    } catch {
      return false;
    }
  }

  private async finalizeKaspiInvoicePaid(paymentId: string, payload: Record<string, unknown>) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { providerOrderId: paymentId },
    });
    if (!order) {
      return { ok: false, reason: 'ORDER_NOT_FOUND' };
    }
    if (order.provider !== 'kaspi') {
      return { ok: false, reason: 'NOT_KASPI_ORDER' };
    }

    if (order.status === 'paid') {
      return { ok: true, status: 'paid' };
    }

    const plan = BILLING_PLANS.find((p) => p.id === order.planCode);
    if (!plan) {
      return { ok: false, reason: 'PLAN_NOT_FOUND' };
    }

    const now = new Date();
    const expiresAt = this.addDays(now, plan.durationDays);

    const createdSubscription = await this.prisma.$transaction(async (tx) => {
      const previousPayload = asRecord(order.providerPayload);
      const updated = await tx.paymentOrder.updateMany({
        where: { id: order.id, status: { not: 'paid' } },
        data: {
          status: 'paid',
          paidAt: now,
          providerPayload: {
            ...(previousPayload ?? {}),
            ...payload,
          } as Prisma.InputJsonObject,
          providerPaymentId: paymentId,
        },
      });
      if (updated.count === 0) return null;
      return tx.subscription.create({
        data: {
          userId: order.userId,
          planType: plan.id,
          startsAt: now,
          expiresAt,
          paymentNote: `Kaspi:${order.providerOrderId}`,
        },
      });
    });
    if (createdSubscription) {
      await this.accessService.syncSubscriptionEntitlements(createdSubscription.id);
    }

    return { ok: true, status: 'paid' };
  }

  getEntTrialStatus(entTrialUsed: number) {
    const used = Math.max(0, entTrialUsed);
    const remaining = Math.max(0, ENT_TRIAL_LIMIT - used);
    return {
      limit: ENT_TRIAL_LIMIT,
      used,
      remaining,
      exhausted: remaining <= 0,
    };
  }

  async createCheckout(userId: string, planId: string) {
    const plan = BILLING_PLANS.find((p) => p.id === planId);
    if (!plan) throw new BadRequestException('PLAN_NOT_FOUND');

    const merchantId = this.config.get<string>('FREEDOMPAY_MERCHANT_ID');
    const secretKey = this.config.get<string>('FREEDOMPAY_SECRET_KEY');
    if (!merchantId || !secretKey) {
      throw new InternalServerErrorException('FREEDOMPAY_NOT_CONFIGURED');
    }

    const apiUrl = this.resolveFreedomPayApiUrl();
    const callbackUrl = this.resolveCallbackUrl();
    const successUrl = this.config.get<string>('FREEDOMPAY_SUCCESS_URL') || this.resolveSiteUrl('/paywall?payment=success');
    const failureUrl = this.config.get<string>('FREEDOMPAY_FAILURE_URL') || this.resolveSiteUrl('/paywall?payment=failed');
    const orderId = this.buildOrderId(userId, plan.id);
    const salt = freedomPaySalt(16);
    const amount = this.formatAmount(plan.priceKzt);

    const payload: FreedomPayload = {
      pg_merchant_id: merchantId,
      pg_order_id: orderId,
      pg_amount: amount,
      pg_currency: 'KZT',
      pg_description: `MyTest ${plan.name}`,
      pg_salt: salt,
      pg_result_url: callbackUrl,
      pg_check_url: callbackUrl,
      pg_success_url: successUrl,
      pg_failure_url: failureUrl,
    };
    payload.pg_sig = freedomPaySign('init_payment.php', payload, secretKey);

    const body = new URLSearchParams();
    for (const [key, value] of Object.entries(payload)) {
      if (value === undefined || value === null) continue;
      body.set(key, String(value));
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10_000);
    let response: Response;
    try {
      response = await fetch(`${apiUrl}/init_payment.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timeoutId);
    }
    const text = await response.text();
    if (!response.ok) {
      throw new BadRequestException(`PAYMENT_GATEWAY_ERROR:${response.status}`);
    }
    const gatewayData = this.parseGatewayResponse(text);
    const status = (gatewayData.pg_status || '').toLowerCase();
    if (status && status !== 'ok' && status !== 'success' && status !== 'pending') {
      const code = gatewayData.pg_error_code || 'unknown';
      const description =
        gatewayData.pg_error_description ||
        gatewayData.pg_description ||
        'unknown';
      throw new BadRequestException(`PAYMENT_GATEWAY_${code}:${description}`);
    }
    const checkoutUrl =
      gatewayData.pg_redirect_url ||
      gatewayData.pg_payment_url ||
      gatewayData.payment_url;
    if (!checkoutUrl) throw new BadRequestException('PAYMENT_URL_MISSING');

    await this.prisma.paymentOrder.create({
      data: {
        userId,
        planCode: plan.id,
        amount: plan.priceKzt,
        providerOrderId: orderId,
        checkoutUrl,
        status: 'pending',
        providerPayload: gatewayData,
      },
    });

    return { orderId, checkoutUrl };
  }

  async handleFreedomPayCallback(payload: Record<string, unknown>) {
    const secretKey = this.config.get<string>('FREEDOMPAY_SECRET_KEY');
    if (!secretKey) throw new InternalServerErrorException('FREEDOMPAY_NOT_CONFIGURED');
    const callbackScript = this.config.get<string>('FREEDOMPAY_CALLBACK_SCRIPT') || 'callback';
    const normalized: Record<string, string> = {};
    for (const [key, value] of Object.entries(payload)) {
      normalized[key] = value == null ? '' : String(value);
    }

    const signatureOk = freedomPayVerifySignature(callbackScript, normalized, secretKey);
    if (!signatureOk) {
      return { ok: false, reason: 'INVALID_SIGNATURE' };
    }

    const orderId = normalized.pg_order_id;
    if (!orderId) return { ok: false, reason: 'ORDER_ID_REQUIRED' };

    const order = await this.prisma.paymentOrder.findUnique({
      where: { providerOrderId: orderId },
    });
    if (!order) return { ok: false, reason: 'ORDER_NOT_FOUND' };

    const isPaid = this.isPaidCallback(normalized);
    if (!isPaid) {
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'failed',
          providerPayload: normalized,
          providerPaymentId: normalized.pg_payment_id || order.providerPaymentId,
        },
      });
      return { ok: true, status: 'failed' };
    }

    if (order.status === 'paid') {
      return { ok: true, status: 'paid' };
    }

    const plan = BILLING_PLANS.find((p) => p.id === order.planCode);
    if (!plan) return { ok: false, reason: 'PLAN_NOT_FOUND' };

    const now = new Date();
    const expiresAt = this.addDays(now, plan.durationDays);

    const createdSubscription = await this.prisma.$transaction(async (tx) => {
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paidAt: now,
          providerPayload: normalized,
          providerPaymentId: normalized.pg_payment_id || order.providerPaymentId,
        },
      });
      return tx.subscription.create({
        data: {
          userId: order.userId,
          planType: plan.id,
          startsAt: now,
          expiresAt,
          paymentNote: `FreedomPay:${order.providerOrderId}`,
        },
      });
    });
    await this.accessService.syncSubscriptionEntitlements(createdSubscription.id);

    return { ok: true, status: 'paid' };
  }

  async getOrder(userId: string, orderId: string) {
    const found = await this.prisma.paymentOrder.findFirst({
      where: {
        userId,
        providerOrderId: orderId,
      },
    });
    if (!found) throw new NotFoundException('ORDER_NOT_FOUND');

    const order =
      found.provider === 'kaspi' && found.status === 'pending'
        ? (await this.reconcileKaspiOrder(found.providerOrderId)) ?? found
        : found;

    return this.presentPaymentOrder(order);
  }

  async getActiveKaspiOrders(userId: string) {
    const pendingOrders = await this.prisma.paymentOrder.findMany({
      where: {
        userId,
        provider: 'kaspi',
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });

    for (const order of pendingOrders) {
      if (isInvalidKaspiOperationId(order.providerOrderId)) {
        await this.cancelInvalidKaspiOrder(order, 'invalid-provider-order-active-list');
      } else {
        await this.reconcileKaspiOrder(order.providerOrderId);
      }
    }

    const orders = await this.prisma.paymentOrder.findMany({
      where: {
        userId,
        provider: 'kaspi',
        status: 'pending',
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders.map((order) => this.presentPaymentOrder(order));
  }

  async cancelKaspiOrder(userId: string, orderId: string) {
    const found = await this.prisma.paymentOrder.findFirst({
      where: {
        userId,
        provider: 'kaspi',
        providerOrderId: orderId,
      },
    });
    if (!found) throw new NotFoundException('ORDER_NOT_FOUND');

    if (isInvalidKaspiOperationId(found.providerOrderId)) {
      if (found.status === 'pending') {
        const updated = await this.cancelInvalidKaspiOrder(found, 'invalid-provider-order-cancel');
        return this.presentPaymentOrder(updated);
      }
      return this.presentPaymentOrder(found);
    }

    const reconciled =
      found.status === 'pending'
        ? (await this.reconcileKaspiOrder(found.providerOrderId)) ?? found
        : found;

    if (reconciled.status === 'paid') {
      return this.presentPaymentOrder(reconciled);
    }
    if (reconciled.status !== 'pending') {
      return this.presentPaymentOrder(reconciled);
    }

    let cancelPayload: Record<string, unknown> | null = null;
    try {
      cancelPayload = asRecord(await this.kaspiPosService.cancelInvoice(reconciled.providerOrderId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      throw new BadRequestException(`KASPI_CANCEL_ERROR:${message}`);
    }

    const cancelData = asRecord(cancelPayload?.Data) ?? asRecord(cancelPayload?.data) ?? cancelPayload;
    const cancelStatus = getString(cancelData?.Status ?? cancelData?.status);
    const normalized = this.normalizeKaspiInvoiceStatus(cancelStatus);
    if (normalized === 'paid') {
      await this.finalizeKaspiInvoicePaid(reconciled.providerOrderId, {
        event: 'payment.success',
        paymentId: reconciled.providerOrderId,
        type: 'invoice',
        status: cancelStatus,
        data: cancelPayload,
        source: 'cancel-reconcile',
        timestamp: new Date().toISOString(),
      });
      const paid = await this.prisma.paymentOrder.findUnique({ where: { id: reconciled.id } });
      return this.presentPaymentOrder(paid ?? reconciled);
    }
    if (normalized !== 'failed' && normalized !== 'cancelled') {
      throw new BadRequestException(`KASPI_CANCEL_NOT_CONFIRMED:${cancelStatus ?? 'UNKNOWN'}`);
    }

    const previousPayload = asRecord(reconciled.providerPayload);
    const updated = await this.prisma.paymentOrder.update({
      where: { id: reconciled.id },
      data: {
        status: 'cancelled',
        providerPayload: {
          ...(previousPayload ?? {}),
          cancelResponse: cancelPayload,
          cancelledAt: new Date().toISOString(),
          cancelSource: 'user',
        } as Prisma.InputJsonObject,
      },
    });

    return this.presentPaymentOrder(updated);
  }

  private async cancelInvalidKaspiOrder(
    order: { id: string; providerPayload: unknown },
    source: string,
  ) {
    const previousPayload = asRecord(order.providerPayload);
    return this.prisma.paymentOrder.update({
      where: { id: order.id },
      data: {
        status: 'cancelled',
        providerPayload: {
          ...(previousPayload ?? {}),
          cancelledAt: new Date().toISOString(),
          cancelSource: source,
          cancelReason: 'invalid_provider_order_id',
        } as Prisma.InputJsonObject,
      },
    });
  }

  private async reconcileKaspiOrder(providerOrderId: string) {
    const order = await this.prisma.paymentOrder.findUnique({
      where: { providerOrderId },
    });
    if (!order || order.provider !== 'kaspi' || order.status !== 'pending') {
      return order;
    }

    let payload: Record<string, unknown> | null = null;
    try {
      payload = asRecord(await this.kaspiPosService.getInvoiceDetails(providerOrderId));
    } catch {
      return order;
    }

    const data = asRecord(payload?.Data) ?? payload;
    const status = getString(data?.Status);
    const normalized = this.normalizeKaspiInvoiceStatus(status);
    const receiptUrl = firstString(
      data?.ReceiptUrl,
      data?.receiptUrl,
      data?.CheckoutUrl,
      data?.checkoutUrl,
      data?.PaymentUrl,
      data?.paymentUrl,
      data?.Url,
      data?.url,
    );
    const orderNumber = firstString(data?.OrderNumber, data?.orderNumber, data?.OrderNo, data?.orderNo);
    if (receiptUrl || orderNumber) {
      const previousPayload = asRecord(order.providerPayload);
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: 'pending' },
        data: {
          ...(receiptUrl ? { checkoutUrl: receiptUrl } : {}),
          providerPayload: {
            ...(previousPayload ?? {}),
            ...(payload ?? {}),
            ...(orderNumber ? { orderNumber } : {}),
            ...(receiptUrl ? { receiptUrl } : {}),
          } as Prisma.InputJsonObject,
        },
      });
    }
    if (normalized === 'paid') {
      await this.finalizeKaspiInvoicePaid(providerOrderId, {
        event: 'payment.success',
        paymentId: providerOrderId,
        type: 'invoice',
        status,
        data: payload,
        source: 'reconcile',
        timestamp: new Date().toISOString(),
      });
    }
    if (normalized === 'failed' || normalized === 'cancelled') {
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: { not: 'paid' } },
        data: {
          status: normalized,
          providerPayload: payload as object,
        },
      });
    }

    return (
      (await this.prisma.paymentOrder.findUnique({ where: { id: order.id } })) ??
      order
    );
  }

  private normalizeKaspiInvoiceStatus(status: string | null): KaspiOrderStatus {
    const normalized = status?.trim().toLowerCase();
    if (
      normalized === 'processed' ||
      normalized === 'paid' ||
      normalized === 'success' ||
      normalized === 'succeeded'
    ) {
      return 'paid';
    }
    if (
      normalized === 'remotepaymentcanceled' ||
      normalized === 'cancelled' ||
      normalized === 'canceled'
    ) {
      return 'cancelled';
    }
    if (
      normalized === 'remotepaymentrejected' ||
      normalized === 'expired' ||
      normalized === 'sessionexpired' ||
      normalized === 'failed'
    ) {
      return 'failed';
    }
    return 'pending';
  }

  private presentPaymentOrder(order: {
    providerOrderId: string;
    status: string;
    amount: unknown;
    currency: string;
    planCode: string;
    checkoutUrl: string | null;
    providerPayload: unknown;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    const payload = asRecord(order.providerPayload);
    const data = asRecord(payload?.Data) ?? asRecord(payload?.data);
    const checkoutUrl = firstString(
      order.checkoutUrl,
      payload?.receiptUrl,
      payload?.checkoutUrl,
      data?.ReceiptUrl,
      data?.receiptUrl,
      data?.CheckoutUrl,
      data?.checkoutUrl,
      data?.PaymentUrl,
      data?.paymentUrl,
      data?.Url,
      data?.url,
    );
    const plan = BILLING_PLANS.find((p) => p.id === order.planCode);
    return {
      invoiceId: order.providerOrderId,
      providerOrderId: order.providerOrderId,
      status: order.status,
      amount: Number(order.amount),
      currency: order.currency,
      planCode: order.planCode,
      planName: plan?.name ?? order.planCode,
      checkoutUrl,
      receiptUrl: checkoutUrl,
      orderNumber: firstString(payload?.orderNumber, data?.OrderNumber, data?.orderNumber),
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  private resolveFreedomPayApiUrl() {
    const explicit = this.config.get<string>('FREEDOMPAY_API_URL');
    if (explicit) return explicit.replace(/\/+$/, '');
    const sandbox = this.config.get<string>('FREEDOMPAY_SANDBOX');
    if (sandbox === 'false' || sandbox === '0') {
      return 'https://api.freedompay.kz';
    }
    return 'https://test-api.freedompay.kz';
  }

  private resolveCallbackUrl() {
    const explicit = this.config.get<string>('FREEDOMPAY_CALLBACK_URL');
    if (explicit) return explicit;
    const apiBase = this.config.get<string>('PUBLIC_API_BASE_URL');
    if (!apiBase) {
      throw new InternalServerErrorException('PUBLIC_API_BASE_URL_REQUIRED');
    }
    return `${apiBase.replace(/\/+$/, '')}/api/v1/billing/freedompay/callback`;
  }

  private resolveSiteUrl(path: string) {
    const site = this.config.get<string>('PUBLIC_SITE_URL');
    if (!site) return path;
    return `${site.replace(/\/+$/, '')}${path}`;
  }

  private buildOrderId(userId: string, planId: string) {
    const stamp = Date.now();
    const suffix = freedomPaySalt(8);
    return `mt-${planId}-${userId.slice(0, 8)}-${stamp}-${suffix}`;
  }

  private formatAmount(priceKzt: number) {
    return priceKzt.toFixed(2);
  }

  private addDays(date: Date, days: number) {
    const next = new Date(date);
    next.setDate(next.getDate() + days);
    return next;
  }

  private parseGatewayResponse(body: string): Record<string, string> {
    const trimmed = body.trim();
    if (!trimmed) return {};
    if (trimmed.startsWith('{')) {
      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;
        return Object.fromEntries(Object.entries(parsed).map(([k, v]) => [k, v == null ? '' : String(v)]));
      } catch {
        return {};
      }
    }

    const tags = [
      'pg_redirect_url',
      'pg_redirect_url_type',
      'pg_redirect_qr',
      'pg_payment_url',
      'payment_url',
      'pg_status',
      'pg_error_description',
      'pg_error_code',
      'pg_description',
      'pg_payment_id',
      'pg_order_id',
    ];
    const result: Record<string, string> = {};
    for (const tag of tags) {
      const m = trimmed.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      if (m) result[tag] = m[1];
    }
    // Fallback: collect all simple tags under XML response
    if (Object.keys(result).length === 0 && trimmed.startsWith('<')) {
      const fallback = [...trimmed.matchAll(/<([a-zA-Z0-9_:-]+)>([\s\S]*?)<\/\1>/g)];
      for (const [, key, value] of fallback) {
        if (!key || key === 'response' || key === 'request') continue;
        result[key] = value.trim();
      }
    }
    return result;
  }

  private isPaidCallback(payload: Record<string, string>) {
    const status = (payload.pg_status || '').toLowerCase();
    const resultFlag = payload.pg_result;
    const isSuccessStatus = status === 'ok' || status === 'success' || status === 'paid';
    const isSuccessResult = resultFlag === '1' || resultFlag === 'true';
    return isSuccessStatus || isSuccessResult;
  }
}
