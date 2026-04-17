import { BadRequestException, Injectable, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../database/prisma.service';
import { BILLING_PLANS, ENT_TRIAL_LIMIT, type BillingPlan } from './billing.config';
import { freedomPaySalt, freedomPaySign, freedomPayVerifySignature } from './freedompay-signature';

type FreedomPayload = Record<string, string | number | boolean | null | undefined>;

@Injectable()
export class BillingService {
  constructor(
    private prisma: PrismaService,
    private config: ConfigService,
  ) {}

  getPlans() {
    return BILLING_PLANS;
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

    const response = await fetch(`${apiUrl}/init_payment.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });
    const text = await response.text();
    if (!response.ok) {
      throw new BadRequestException(`PAYMENT_GATEWAY_ERROR:${response.status}`);
    }
    const gatewayData = this.parseGatewayResponse(text);
    const checkoutUrl = gatewayData.pg_payment_url || gatewayData.payment_url;
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

    await this.prisma.$transaction(async (tx) => {
      await tx.paymentOrder.update({
        where: { id: order.id },
        data: {
          status: 'paid',
          paidAt: now,
          providerPayload: normalized,
          providerPaymentId: normalized.pg_payment_id || order.providerPaymentId,
        },
      });
      await tx.subscription.create({
        data: {
          userId: order.userId,
          planType: plan.id,
          startsAt: now,
          expiresAt,
          paymentNote: `FreedomPay:${order.providerOrderId}`,
        },
      });
    });

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

    const tags = ['pg_payment_url', 'payment_url', 'pg_status', 'pg_error_description', 'pg_error_code'];
    const result: Record<string, string> = {};
    for (const tag of tags) {
      const m = trimmed.match(new RegExp(`<${tag}>([\\s\\S]*?)<\\/${tag}>`));
      if (m) result[tag] = m[1];
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
