import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { normalizeKzPhone } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_PLANS, ENT_TRIAL_LIMIT } from './billing.config';
import { freedomPaySalt, freedomPaySign, freedomPayVerifySignature } from './freedompay-signature';
import { AccessService } from '../subscriptions/access.service';
import { KaspiPosService } from './kaspi-pos.service';

type FreedomPayload = Record<string, string | number | boolean | null | undefined>;

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

    // Block if user already has a pending Kaspi order for this plan
    const pending = await this.prisma.paymentOrder.findFirst({
      where: { userId, provider: 'kaspi', status: 'pending', planCode: plan.id },
    });
    if (pending) {
      throw new BadRequestException('PENDING_ORDER_EXISTS');
    }

    const normalized = normalizeKzPhone(phoneNumber || '');
    if (!normalized) {
      throw new BadRequestException('INVALID_PHONE');
    }

    const comment = `MyTest ${plan.name} - ${userId.slice(0, 8)}`;

    let invoiceId: string;
    let receiptUrl: string;
    let orderNumber: string;

    try {
      const invoice = await this.kaspiPosService.createInvoice(
        normalized,
        Number(plan.priceKzt),
        comment,
      );
      invoiceId = String(invoice.id);
      receiptUrl = invoice.receiptUrl;
      orderNumber = invoice.orderNumber;
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
        providerPayload: { orderNumber, provider: 'kaspi' },
      },
      update: {
        status: 'pending',
        checkoutUrl: receiptUrl,
      },
    });

    return { invoiceId, receiptUrl, orderNumber };
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
        where: { providerOrderId: paymentId, provider: 'kaspi' },
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
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paidAt: now,
          providerPayload: payload as object,
          providerPaymentId: paymentId,
        },
      });
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
    await this.accessService.syncSubscriptionEntitlements(createdSubscription.id);

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
    const order = await this.prisma.paymentOrder.findFirst({
      where: {
        userId,
        providerOrderId: orderId,
      },
      select: {
        providerOrderId: true,
        status: true,
        amount: true,
        currency: true,
        planCode: true,
        checkoutUrl: true,
        paidAt: true,
        createdAt: true,
      },
    });
    if (!order) throw new NotFoundException('ORDER_NOT_FOUND');
    return order;
  }

  async getActiveKaspiOrders(userId: string) {
    const orders = await this.prisma.paymentOrder.findMany({
      where: {
        userId,
        provider: 'kaspi',
        status: 'pending',
      },
      select: {
        id: true,
        providerOrderId: true,
        planCode: true,
        amount: true,
        checkoutUrl: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    return orders;
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
