import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
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
import { AnalyticsService } from '../analytics/analytics.service';

type FreedomPayload = Record<string, string | number | boolean | null | undefined>;
type KaspiOrderStatus = 'pending' | 'paid' | 'failed' | 'cancelled';
type KaspiPaymentType = 'invoice' | 'qr';

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

function parseTimestamp(value: string | null | undefined): Date | null {
  if (!value) return null;
  const raw = value.trim();
  if (!raw) return null;

  const direct = Date.parse(raw);
  if (!Number.isNaN(direct)) return new Date(direct);

  const withUtc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`;
  const asUtc = Date.parse(withUtc);
  if (!Number.isNaN(asUtc)) return new Date(asUtc);

  return null;
}

function isKaspiTemporaryFailureMessage(message: string): boolean {
  const normalized = message.toUpperCase();
  return (
    normalized.includes('TIMEOUT') ||
    normalized.includes('UNAVAILABLE') ||
    normalized.includes('UPSTREAM_TIMEOUT') ||
    normalized.includes('HTTP_502') ||
    normalized.includes('HTTP_503') ||
    normalized.includes('HTTP_504')
  );
}

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
    private accessService: AccessService,
    private kaspiPosService: KaspiPosService,
    private analytics: AnalyticsService,
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
      if (isKaspiTemporaryFailureMessage(message)) {
        throw new ServiceUnavailableException('KASPI_TEMPORARILY_UNAVAILABLE');
      }
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
      if (isKaspiTemporaryFailureMessage(message)) {
        throw new ServiceUnavailableException('KASPI_TEMPORARILY_UNAVAILABLE');
      }
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

  async createKaspiCheckout(userId: string, planId: string, phoneNumber: string, method?: string) {
    const plan = BILLING_PLANS.find((p) => p.id === planId);
    if (!plan) throw new BadRequestException('PLAN_NOT_FOUND');
    const preferredMethod = method?.trim().toLowerCase() === 'qr' ? 'qr' : 'invoice';

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

    const comment = `MyTest ${plan.name} - ${userId.slice(0, 8)}`;

    let providerOrderId = '';
    let checkoutUrl = '';
    let receiptUrl = '';
    let orderNumber = '';
    let paymentStatus = '';
    let clientMobile = '';
    let qrToken = '';
    let expiresAt = '';
    let paymentType: KaspiPaymentType = 'invoice';
    let fallbackToQr = false;
    let fallbackReason = '';

    const createQrPayment = async () => {
      try {
        const qr = await this.kaspiPosService.createQr(Number(plan.priceKzt));
        paymentType = 'qr';
        providerOrderId = String(qr.id);
        paymentStatus = qr.status;
        qrToken = qr.qrToken;
        receiptUrl = qr.receiptUrl;
        expiresAt = qr.expiresAt;
        checkoutUrl = firstString(qrToken, receiptUrl) ?? '';

        if (!checkoutUrl || !expiresAt || !paymentStatus) {
          try {
            const statusPayload = asRecord(await this.kaspiPosService.getQrStatus(providerOrderId));
            const details = asRecord(statusPayload?.Data) ?? asRecord(statusPayload?.data) ?? statusPayload;
            qrToken = firstString(qrToken, details?.QrToken, details?.qrToken, details?.PaymentUrl, details?.paymentUrl) ?? qrToken;
            receiptUrl = firstString(receiptUrl, details?.ReceiptUrl, details?.receiptUrl) ?? receiptUrl;
            expiresAt = firstString(expiresAt, details?.ExpireDate, details?.expireDate, details?.ExpiresAt, details?.expiresAt) ?? expiresAt;
            paymentStatus = firstString(paymentStatus, details?.Status, details?.status) ?? paymentStatus;
            checkoutUrl = firstString(checkoutUrl, qrToken, receiptUrl) ?? checkoutUrl;
          } catch {
            // QR is already created; let polling/webhook reconcile the rest.
          }
        }
      } catch (qrErr) {
        const qrMessage = qrErr instanceof Error ? qrErr.message : String(qrErr);
        if (isKaspiTemporaryFailureMessage(qrMessage)) {
          throw new ServiceUnavailableException('KASPI_TEMPORARILY_UNAVAILABLE');
        }
        throw new BadRequestException(`KASPI_QR_CREATE_ERROR:${qrMessage}`);
      }
    };

    if (preferredMethod === 'qr') {
      await createQrPayment();
    } else {
      const normalized = normalizeKzPhone(phoneNumber || '');
      if (!normalized) {
        throw new BadRequestException('INVALID_PHONE');
      }

      try {
        const invoice = await this.kaspiPosService.createInvoice(
          normalized,
          Number(plan.priceKzt),
          comment,
        );
        providerOrderId = String(invoice.id);
        receiptUrl = invoice.receiptUrl;
        orderNumber = invoice.orderNumber;
        paymentStatus = invoice.status;
        clientMobile = invoice.clientMobile;
        if (!receiptUrl) {
          try {
            const detailsPayload = asRecord(await this.kaspiPosService.getInvoiceDetails(providerOrderId));
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
            paymentStatus = firstString(paymentStatus, details?.Status, details?.status) ?? paymentStatus;
          } catch {
            // The invoice is already created; keep it and let polling/webhook reconcile details later.
          }
        }
        checkoutUrl = receiptUrl;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        if (message === 'KASPI_NOT_AUTHENTICATED') {
          throw new BadRequestException('KASPI_NOT_AUTHENTICATED');
        }
        if (isKaspiTemporaryFailureMessage(message)) {
          throw new ServiceUnavailableException('KASPI_TEMPORARILY_UNAVAILABLE');
        }
        throw new BadRequestException(`KASPI_INVOICE_CREATE_ERROR:${message}`);
      }
    }

    await this.prisma.paymentOrder.upsert({
      where: { providerOrderId },
      create: {
        userId,
        planCode: plan.id,
        amount: plan.priceKzt,
        provider: 'kaspi',
        providerOrderId,
        checkoutUrl,
        status: 'pending',
        providerPayload: {
          orderNumber,
          provider: 'kaspi',
          paymentType,
          status: paymentStatus,
          receiptUrl,
          qrToken,
          expiresAt,
          clientMobile,
          fallbackToQr,
          fallbackReason,
        },
      },
      update: {
        status: 'pending',
        checkoutUrl,
        providerPayload: {
          orderNumber,
          provider: 'kaspi',
          paymentType,
          status: paymentStatus,
          receiptUrl,
          qrToken,
          expiresAt,
          clientMobile,
          fallbackToQr,
          fallbackReason,
        },
      },
    });

    await this.recordBillingEvent(userId, 'checkout_created', {
      provider: 'kaspi',
      planCode: plan.id,
      amount: plan.priceKzt,
      paymentType,
      reused: false,
    });

    return {
      invoiceId: providerOrderId,
      providerOrderId,
      checkoutUrl,
      receiptUrl,
      orderNumber,
      paymentType,
      qrToken,
      expiresAt,
      fallbackToQr,
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

    if (event === 'payment.success' && (type === 'invoice' || type === 'qr')) {
      return this.finalizeKaspiPaymentPaid(paymentId, payload);
    }

    if (event === 'payment.failed' || event === 'payment.expired') {
      const order = await this.prisma.paymentOrder.findUnique({
        where: { providerOrderId: paymentId },
      });
      if (!order || order.provider !== 'kaspi' || order.status === 'paid') {
        return { ok: true, ignored: true };
      }
      const previousPayload = asRecord(order.providerPayload);
      await this.prisma.paymentOrder.update({
        where: { id: order.id },
        data: {
          status:
            this.normalizeKaspiPaymentStatus(getString(payload.status)).status === 'pending'
              ? 'failed'
              : this.normalizeKaspiPaymentStatus(getString(payload.status)).status,
          providerPayload: {
            ...(previousPayload ?? {}),
            ...payload,
          } as Prisma.InputJsonObject,
        },
      });
      await this.recordBillingEvent(order.userId, 'payment_failed', {
        provider: 'kaspi',
        planCode: order.planCode,
        providerOrderId: order.providerOrderId,
        event,
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

  private async finalizeKaspiPaymentPaid(paymentId: string, payload: Record<string, unknown>) {
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
      await this.recordBillingEvent(order.userId, 'payment_paid', {
        provider: 'kaspi',
        planCode: plan.id,
        amount: Number(order.amount),
        providerOrderId: order.providerOrderId,
      });
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

    await this.recordBillingEvent(userId, 'checkout_created', {
      provider: 'freedompay',
      planCode: plan.id,
      amount: plan.priceKzt,
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
      await this.recordBillingEvent(order.userId, 'payment_failed', {
        provider: 'freedompay',
        planCode: order.planCode,
        providerOrderId: order.providerOrderId,
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
    await this.recordBillingEvent(order.userId, 'payment_paid', {
      provider: 'freedompay',
      planCode: plan.id,
      amount: Number(order.amount),
      providerOrderId: order.providerOrderId,
    });

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

    if (order.provider === 'kaspi' && order.status === 'pending') {
      const locallyExpired = await this.expireStaleKaspiOrder(order);
      return this.presentPaymentOrder(locallyExpired ?? order);
    }

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

    await Promise.allSettled(
      pendingOrders.map(async (order) => {
        if (isInvalidKaspiOperationId(order.providerOrderId)) {
          await this.cancelInvalidKaspiOrder(order, 'invalid-provider-order-active-list');
          return;
        }

        const reconciled = (await this.reconcileKaspiOrder(order.providerOrderId)) ?? order;
        await this.expireStaleKaspiOrder(reconciled);
      }),
    );

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
    if (this.getKaspiPaymentType(reconciled.providerPayload) === 'qr') {
      throw new BadRequestException('KASPI_QR_CANCEL_NOT_SUPPORTED');
    }

    let cancelPayload: Record<string, unknown> | null = null;
    try {
      cancelPayload = asRecord(await this.kaspiPosService.cancelInvoice(reconciled.providerOrderId));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (isKaspiTemporaryFailureMessage(message)) {
        throw new ServiceUnavailableException('KASPI_TEMPORARILY_UNAVAILABLE');
      }
      throw new BadRequestException(`KASPI_CANCEL_ERROR:${message}`);
    }

    const cancelData = asRecord(cancelPayload?.Data) ?? asRecord(cancelPayload?.data) ?? cancelPayload;
    const cancelStatus = getString(cancelData?.Status ?? cancelData?.status);
    const normalized = this.normalizeKaspiPaymentStatus(cancelStatus);
    if (normalized.kind === 'paid') {
      await this.finalizeKaspiPaymentPaid(reconciled.providerOrderId, {
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
    if (normalized.kind !== 'failed' && normalized.kind !== 'cancelled') {
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

    await this.recordBillingEvent(userId, 'payment_cancelled', {
      provider: 'kaspi',
      planCode: updated.planCode,
      providerOrderId: updated.providerOrderId,
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

    const paymentType = this.getKaspiPaymentType(order.providerPayload);
    let payload: Record<string, unknown> | null = null;
    try {
      payload =
        paymentType === 'qr'
          ? asRecord(await this.kaspiPosService.getQrStatus(providerOrderId))
          : asRecord(await this.kaspiPosService.getInvoiceDetails(providerOrderId));
    } catch {
      return order;
    }

    const data = asRecord(payload?.Data) ?? payload;
    const status = getString(data?.Status);
    const normalized = this.normalizeKaspiPaymentStatus(status);
    const qrToken = firstString(
      data?.QrToken,
      data?.qrToken,
      data?.PaymentUrl,
      data?.paymentUrl,
      data?.Url,
      data?.url,
    );
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
    const expiresAt = firstString(
      data?.ExpireDate,
      data?.expireDate,
      data?.ExpiresAt,
      data?.expiresAt,
    );
    const orderNumber = firstString(data?.OrderNumber, data?.orderNumber, data?.OrderNo, data?.orderNo);
    const checkoutUrl =
      paymentType === 'qr'
        ? firstString(qrToken, receiptUrl, order.checkoutUrl)
        : firstString(receiptUrl, order.checkoutUrl);
    if (checkoutUrl || receiptUrl || orderNumber || qrToken || expiresAt) {
      const previousPayload = asRecord(order.providerPayload);
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: 'pending' },
        data: {
          ...(checkoutUrl ? { checkoutUrl } : {}),
          providerPayload: {
            ...(previousPayload ?? {}),
            ...(payload ?? {}),
            paymentType,
            ...(orderNumber ? { orderNumber } : {}),
            ...(receiptUrl ? { receiptUrl } : {}),
            ...(qrToken ? { qrToken } : {}),
            ...(expiresAt ? { expiresAt } : {}),
          } as Prisma.InputJsonObject,
        },
      });
    }
    if (normalized.kind === 'paid') {
      await this.finalizeKaspiPaymentPaid(providerOrderId, {
        event: 'payment.success',
        paymentId: providerOrderId,
        type: paymentType,
        status,
        data: payload,
        source: 'reconcile',
        timestamp: new Date().toISOString(),
      });
    }
    if (normalized.kind === 'failed' || normalized.kind === 'cancelled') {
      const previousPayload = asRecord(order.providerPayload);
      await this.prisma.paymentOrder.updateMany({
        where: { id: order.id, status: { not: 'paid' } },
        data: {
          status: normalized.status,
          providerPayload: {
            ...(previousPayload ?? {}),
            ...(payload ?? {}),
            paymentType,
          } as Prisma.InputJsonObject,
        },
      });
    }

    return (
      (await this.prisma.paymentOrder.findUnique({ where: { id: order.id } })) ??
      order
    );
  }

  private async expireStaleKaspiOrder(order: {
    id: string;
    provider: string;
    providerOrderId: string;
    amount: unknown;
    currency: string;
    planCode: string;
    checkoutUrl: string | null;
    providerPayload: unknown;
    status: string;
    paidAt: Date | null;
    createdAt: Date;
    updatedAt: Date;
  }) {
    if (order.provider !== 'kaspi' || order.status !== 'pending') {
      return order;
    }

    const expiresAt = this.getKaspiPaymentExpiry(order.providerPayload);
    if (!expiresAt || expiresAt.getTime() > Date.now()) {
      return order;
    }

    const previousPayload = asRecord(order.providerPayload);
    const updated = await this.prisma.paymentOrder.updateMany({
      where: { id: order.id, status: 'pending' },
      data: {
        status: 'failed',
        providerPayload: {
          ...(previousPayload ?? {}),
          status: 'expired',
          statusDesc: firstString(
            previousPayload?.statusDesc,
            'Expired locally by my-test after payment window elapsed',
          ),
          locallyExpiredAt: new Date().toISOString(),
        } as Prisma.InputJsonObject,
      },
    });

    if (updated.count === 0) {
      return this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
    }
    return this.prisma.paymentOrder.findUnique({ where: { id: order.id } });
  }

  private normalizeKaspiPaymentStatus(status: string | null): {
    status: KaspiOrderStatus;
    kind: 'paid' | 'failed' | 'cancelled' | 'pending';
  } {
    const normalized = status?.trim().toLowerCase();
    if (
      normalized === 'processed' ||
      normalized === 'paid' ||
      normalized === 'success' ||
      normalized === 'succeeded'
    ) {
      return { status: 'paid', kind: 'paid' };
    }
    if (
      normalized === 'cancelledbyuser' ||
      normalized === 'cancelledbyexternalsource' ||
      normalized === 'remotepaymentcanceled' ||
      normalized === 'cancelled' ||
      normalized === 'canceled'
    ) {
      return { status: 'cancelled', kind: 'cancelled' };
    }
    if (
      normalized === 'notconfirmedbyuser' ||
      normalized === 'processingfailed' ||
      normalized === 'rejected' ||
      normalized === 'insufficientfunds' ||
      normalized === 'insufficientfundserror' ||
      normalized === 'error' ||
      normalized === 'qertokendiscarded' ||
      normalized === 'qrtokendiscarded' ||
      normalized === 'remotepaymentrejected' ||
      normalized === 'expired' ||
      normalized === 'sessionexpired' ||
      normalized === 'failed'
    ) {
      return { status: 'failed', kind: 'failed' };
    }
    return { status: 'pending', kind: 'pending' };
  }

  private getKaspiPaymentType(payload: unknown): KaspiPaymentType {
    const view = asRecord(payload);
    const data = asRecord(view?.Data) ?? asRecord(view?.data);
    const raw = firstString(
      view?.paymentType,
      view?.type,
      data?.paymentType,
      data?.type,
      data?.Type,
    );
    return raw?.trim().toLowerCase() === 'qr' ? 'qr' : 'invoice';
  }

  private getKaspiPaymentExpiry(payload: unknown): Date | null {
    const view = asRecord(payload);
    const data = asRecord(view?.Data) ?? asRecord(view?.data);
    return parseTimestamp(
      firstString(
        view?.expiresAt,
        data?.ExpireDate,
        data?.expireDate,
        data?.ExpiresAt,
        data?.expiresAt,
      ),
    );
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
    const paymentType = this.getKaspiPaymentType(payload);
    const qrToken = firstString(
      payload?.qrToken,
      data?.QrToken,
      data?.qrToken,
      data?.PaymentUrl,
      data?.paymentUrl,
      data?.Url,
      data?.url,
    );
    const receiptUrl = firstString(
      payload?.receiptUrl,
      data?.ReceiptUrl,
      data?.receiptUrl,
      data?.CheckoutUrl,
      data?.checkoutUrl,
      data?.PaymentUrl,
      data?.paymentUrl,
      data?.Url,
      data?.url,
    );
    const checkoutUrl =
      paymentType === 'qr'
        ? firstString(order.checkoutUrl, qrToken, receiptUrl)
        : firstString(order.checkoutUrl, receiptUrl);
    const plan = BILLING_PLANS.find((p) => p.id === order.planCode);
    return {
      invoiceId: order.providerOrderId,
      providerOrderId: order.providerOrderId,
      status: order.status,
      amount: Number(order.amount),
      currency: order.currency,
      planCode: order.planCode,
      planName: plan?.name ?? order.planCode,
      paymentType,
      checkoutUrl,
      receiptUrl,
      qrToken,
      expiresAt: firstString(
        payload?.expiresAt,
        data?.ExpireDate,
        data?.expireDate,
        data?.ExpiresAt,
        data?.expiresAt,
      ),
      fallbackToQr: Boolean(payload?.fallbackToQr),
      orderNumber: firstString(payload?.orderNumber, data?.OrderNumber, data?.orderNumber),
      statusDesc: firstString(payload?.statusDesc, data?.StatusDesc, data?.statusDesc),
      paidAt: order.paidAt,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
    };
  }

  async verifyAppleReceipt(userId: string, receiptData: string, requestedProductId?: string) {
    const secret = this.config.get<string>('APPLE_IAP_SHARED_SECRET')?.trim();
    if (!secret) throw new InternalServerErrorException('APPLE_IAP_NOT_CONFIGURED');
    if (!receiptData?.trim()) throw new BadRequestException('RECEIPT_REQUIRED');

    const verifyBody = {
      'receipt-data': receiptData.trim(),
      password: secret,
      'exclude-old-transactions': true,
    };

    let response = await this.verifyAppleWithUrl('https://buy.itunes.apple.com/verifyReceipt', verifyBody);
    if (response.status === 21007) {
      response = await this.verifyAppleWithUrl('https://sandbox.itunes.apple.com/verifyReceipt', verifyBody);
    }
    if (response.status !== 0) {
      throw new BadRequestException(`APPLE_RECEIPT_INVALID:${String(response.status)}`);
    }

    const receipt = asRecord(response.receipt);
    const inAppRaw = Array.isArray(response.latest_receipt_info)
      ? response.latest_receipt_info
      : Array.isArray(receipt?.in_app)
        ? receipt.in_app
        : [];
    const inApp = inAppRaw
      .map((item) => asRecord(item))
      .filter((item): item is Record<string, unknown> => Boolean(item));
    if (!inApp.length) throw new BadRequestException('APPLE_RECEIPT_EMPTY');

    const matched = requestedProductId
      ? inApp.filter((item) => getString(item.product_id) === requestedProductId)
      : inApp;
    if (!matched.length) throw new BadRequestException('APPLE_PRODUCT_NOT_FOUND');

    const selected = [...matched].sort((a, b) => {
      const am = Number(getString(a.expires_date_ms) || getString(a.purchase_date_ms) || 0);
      const bm = Number(getString(b.expires_date_ms) || getString(b.purchase_date_ms) || 0);
      return bm - am;
    })[0];

    const productId = getString(selected.product_id);
    const transactionId = getString(selected.transaction_id);
    const originalTransactionId = getString(selected.original_transaction_id);
    if (!productId || !transactionId) throw new BadRequestException('APPLE_TRANSACTION_INVALID');

    const planId = this.mapAppleProductToPlan(productId);
    const plan = BILLING_PLANS.find((p) => p.id === planId);
    if (!plan) throw new BadRequestException('APPLE_PLAN_NOT_MAPPED');

    const existingOrder = await this.prisma.paymentOrder.findFirst({
      where: {
        provider: 'apple_iap',
        OR: [{ providerPaymentId: transactionId }, { providerOrderId: transactionId }],
      },
    });
    if (existingOrder) return { ok: true, reused: true, planId };

    const now = new Date();
    const expiresMs = Number(getString(selected.expires_date_ms) || 0);
    const expiresAt = Number.isFinite(expiresMs) && expiresMs > 0 ? new Date(expiresMs) : this.addDays(now, plan.durationDays);

    const createdSubscription = await this.prisma.$transaction(async (tx) => {
      await tx.paymentOrder.create({
        data: {
          userId,
          planCode: plan.id,
          amount: plan.priceKzt,
          provider: 'apple_iap',
          providerOrderId: transactionId,
          providerPaymentId: transactionId,
          status: 'paid',
          paidAt: now,
          providerPayload: {
            provider: 'apple_iap',
            productId,
            transactionId,
            originalTransactionId,
            receipt: response,
          } as Prisma.InputJsonObject,
        },
      });
      return tx.subscription.create({
        data: {
          userId,
          planType: plan.id,
          startsAt: now,
          expiresAt,
          paymentNote: `AppleIAP:${productId}:${transactionId}`,
        },
      });
    });
    await this.accessService.syncSubscriptionEntitlements(createdSubscription.id);

    return { ok: true, reused: false, planId, expiresAt };
  }

  private mapAppleProductToPlan(productId: string): string {
    const mappingRaw = this.config.get<string>('APPLE_IAP_PRODUCT_PLAN_MAP')?.trim();
    if (mappingRaw) {
      try {
        const parsed = JSON.parse(mappingRaw) as Record<string, string>;
        if (parsed[productId]) return parsed[productId];
      } catch {
        // no-op
      }
    }
    const defaults: Record<string, string> = {
      'com.sanjuniperodee.mobile.premium.trial': 'trial',
      'com.sanjuniperodee.mobile.premium.week': 'week',
      'com.sanjuniperodee.mobile.premium.month': 'month',
      'com.sanjuniperodee.mobile.premium.annual': 'annual',
    };
    return defaults[productId] || '';
  }

  private async verifyAppleWithUrl(url: string, payload: Record<string, unknown>) {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new BadRequestException(`APPLE_VERIFY_HTTP_${res.status}`);
    return (await res.json()) as Record<string, unknown>;
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

  private async recordBillingEvent(
    userId: string,
    step: 'checkout_created' | 'payment_paid' | 'payment_cancelled' | 'payment_failed',
    metadata: Record<string, unknown>,
  ) {
    try {
      await this.analytics.recordEvent({ userId, step, metadata });
    } catch {
      // Analytics must never block payment creation or activation.
    }
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
