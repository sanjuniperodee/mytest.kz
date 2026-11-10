import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EntitlementStatus, EntitlementTier } from '@prisma/client';
import { createHash } from 'crypto';
import type Redis from 'ioredis';
import {
  normalizeKzPhone,
  type ParentPayInfoDto,
  type ParentPayLinkDto,
  type ParentPayOrderDto,
  type ParentPayOrderStatus,
} from '@bilimland/shared';
import { PrismaService } from '../../../database/prisma.service';
import { REDIS_CLIENT } from '../../../database/redis.module';
import { AnalyticsService } from '../../analytics/analytics.service';
import { BillingService } from '../billing.service';
import { signParentPayToken, verifyParentPayToken } from './parent-pay-token';

/** Ссылка живёт месяц: дольше незачем, а короткий срок ограничивает последствия утечки. */
const LINK_TTL_MS = 30 * 24 * 60 * 60 * 1000;
/** Какой платёж страница «подхватывает» при открытии и о каком заказе вообще отвечает. */
const RESUME_WINDOW_MS = 30 * 60 * 1000;
const ORDER_LOOKUP_WINDOW_MS = 48 * 60 * 60 * 1000;
/**
 * Публичная ссылка умеет слать счета Kaspi на произвольный номер — это надо ограничить
 * независимо от IP: на одного ученика не больше стольких попыток и разных номеров в сутки.
 */
const DAILY_CHECKOUT_LIMIT = 12;
const DAILY_PHONE_LIMIT = 4;
const COUNTER_TTL_SECS = 26 * 60 * 60;

export const PARENT_PAY_NOT_FOUND = 'PARENT_PAY_NOT_FOUND';
export const PARENT_PAY_LIMIT = 'PARENT_PAY_LIMIT';

type PresentedOrder = Awaited<ReturnType<BillingService['getOrder']>>;

@Injectable()
export class ParentPayService {
  private readonly logger = new Logger(ParentPayService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
    private readonly billing: BillingService,
    private readonly analytics: AnalyticsService,
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
  ) {}

  /** Ссылку можно создавать сколько угодно раз — платёж появляется, только когда её откроют. */
  async createLink(userId: string, planId?: string, now = new Date()): Promise<ParentPayLinkDto> {
    const expiresAt = new Date(now.getTime() + LINK_TTL_MS);
    const token = signParentPayToken({ userId, expiresAt }, this.secret());
    const site = (this.config.get<string>('PUBLIC_SITE_URL') || 'https://my-test.kz').replace(/\/+$/, '');
    const plan = typeof planId === 'string' && /^[a-z0-9_-]{1,40}$/i.test(planId) ? planId : null;
    try {
      await this.analytics.recordEvent({
        userId,
        step: 'parent_pay_link_created',
        metadata: plan ? { planCode: plan } : {},
      });
    } catch {
      // Аналитика не должна мешать отправить ссылку.
    }
    return {
      url: `${site}/pay/${token}${plan ? `?plan=${encodeURIComponent(plan)}` : ''}`,
      // Срок в токене хранится с точностью до секунды.
      expiresAt: new Date(Math.floor(expiresAt.getTime() / 1000) * 1000).toISOString(),
    };
  }

  async getInfo(token: string, now = new Date()): Promise<ParentPayInfoDto> {
    const link = this.verify(token, now);
    const student = await this.prisma.user.findUnique({
      where: { id: link.userId },
      select: { firstName: true },
    });
    // Подделка, истёкшая ссылка и удалённый аккаунт неотличимы снаружи — один и тот же 404.
    if (!student) throw this.notFound();

    const [access, recent] = await Promise.all([
      this.paidAccess(link.userId, now),
      this.prisma.paymentOrder.findFirst({
        where: {
          userId: link.userId,
          provider: 'kaspi',
          status: { in: ['pending', 'paid'] },
          createdAt: { gte: new Date(now.getTime() - RESUME_WINDOW_MS) },
        },
        orderBy: { createdAt: 'desc' },
        select: { providerOrderId: true },
      }),
    ]);

    let order: ParentPayOrderDto | null = null;
    if (recent) {
      try {
        const presented = toPublicOrder(await this.billing.getOrder(link.userId, recent.providerOrderId));
        // Сорвавшийся платёж при открытии ссылки не показываем — человек просто платит заново.
        if (presented.status === 'pending' || presented.status === 'paid') order = presented;
      } catch (error) {
        this.logger.warn(`Parent pay: cannot load recent order: ${String(error)}`);
      }
    }

    return {
      studentName: student.firstName?.trim().slice(0, 40) || null,
      access,
      order,
      linkExpiresAt: link.expiresAt.toISOString(),
    };
  }

  async checkout(
    token: string,
    input: { planId?: unknown; method?: unknown; phoneNumber?: unknown },
    now = new Date(),
  ): Promise<ParentPayOrderDto> {
    const link = this.verify(token, now);
    const exists = await this.prisma.user.findUnique({ where: { id: link.userId }, select: { id: true } });
    if (!exists) throw this.notFound();

    const planId = typeof input.planId === 'string' ? input.planId.trim().slice(0, 40) : '';
    if (!planId) throw this.badRequest('PLAN_NOT_FOUND', 'Тариф не найден');
    const method = input.method === 'invoice' ? 'invoice' : 'qr';
    let phone = '';
    if (method === 'invoice') {
      const normalized = normalizeKzPhone(typeof input.phoneNumber === 'string' ? input.phoneNumber : '');
      if (!normalized) throw this.badRequest('INVALID_PHONE', 'Проверьте номер телефона');
      phone = normalized;
    }

    await this.enforceDailyLimits(link.userId, phone || null, now);

    let orderId: string;
    try {
      const created = await this.billing.createKaspiCheckout(link.userId, planId, phone, method, {
        payer: 'parent_link',
      });
      orderId = created.providerOrderId;
    } catch (error) {
      throw this.publicCheckoutError(error);
    }
    return toPublicOrder(await this.billing.getOrder(link.userId, orderId));
  }

  /**
   * Ошибки Kaspi наружу не пересказываем (в них бывает сырой ответ кассы) — только короткий
   * код, по которому страница подскажет, что делать: другой номер, QR или подождать.
   */
  private publicCheckoutError(error: unknown): HttpException {
    const raw = error instanceof HttpException ? error.getResponse() : null;
    const message =
      typeof raw === 'string'
        ? raw
        : typeof (raw as { message?: unknown } | null)?.message === 'string'
          ? ((raw as { message: string }).message)
          : error instanceof Error
            ? error.message
            : String(error);
    if (message === 'PLAN_NOT_FOUND') return this.badRequest('PLAN_NOT_FOUND', 'Тариф не найден');
    if (message === 'INVALID_PHONE') return this.badRequest('INVALID_PHONE', 'Проверьте номер телефона');
    if (message.startsWith('KASPI_INVOICE_CREATE_ERROR')) {
      this.logger.warn(`Parent pay: invoice rejected: ${message.slice(0, 120)}`);
      return this.badRequest('INVOICE_FAILED', 'Не удалось выставить счёт на этот номер');
    }
    this.logger.warn(`Parent pay: checkout failed: ${message.slice(0, 120)}`);
    return new HttpException(
      { code: 'KASPI_UNAVAILABLE', message: 'Kaspi временно недоступен, попробуйте через пару минут' },
      HttpStatus.SERVICE_UNAVAILABLE,
    );
  }

  private badRequest(code: string, message: string) {
    return new BadRequestException({ code, message });
  }

  async getOrder(token: string, orderId: string, now = new Date()): Promise<ParentPayOrderDto> {
    const link = this.verify(token, now);
    // Номер операции Kaspi — число; остальное даже не ищем.
    if (typeof orderId !== 'string' || !/^\d{1,24}$/.test(orderId)) throw this.orderNotFound();
    const found = await this.prisma.paymentOrder.findFirst({
      where: {
        userId: link.userId,
        provider: 'kaspi',
        providerOrderId: orderId,
        createdAt: { gte: new Date(now.getTime() - ORDER_LOOKUP_WINDOW_MS) },
      },
      select: { id: true },
    });
    if (!found) throw this.orderNotFound();
    return toPublicOrder(await this.billing.getOrder(link.userId, orderId));
  }

  /** Открыт ли сейчас платный доступ — те же два запроса, что в отчёте для родителей. */
  private async paidAccess(userId: string, now: Date): Promise<ParentPayInfoDto['access']> {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        userId,
        isActive: true,
        planType: { not: 'free' },
        startsAt: { lte: now },
        expiresAt: { gt: now },
      },
      orderBy: { expiresAt: 'desc' },
      select: { expiresAt: true },
    });
    if (subscription) return { active: true, until: subscription.expiresAt.toISOString() };

    const entitlement = await this.prisma.userExamEntitlement.findFirst({
      where: {
        userId,
        status: EntitlementStatus.active,
        tier: { in: [EntitlementTier.paid, EntitlementTier.admin] },
        windowStartsAt: { lte: now },
        OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
      },
      orderBy: { windowEndsAt: 'desc' },
      select: { windowEndsAt: true },
    });
    if (entitlement) return { active: true, until: entitlement.windowEndsAt?.toISOString() ?? null };
    return { active: false, until: null };
  }

  /**
   * Счётчики в Redis на «алматинские» сутки. Если Redis недоступен — платёж не создаём:
   * без ограничителя публичная ссылка превращается в рассылку счетов.
   */
  private async enforceDailyLimits(userId: string, phone: string | null, now: Date) {
    const day = new Date(now.getTime() + 5 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const countKey = `parent-pay:checkouts:${userId}:${day}`;
    const phonesKey = `parent-pay:phones:${userId}:${day}`;
    try {
      const count = await this.redis.incr(countKey);
      if (count === 1) await this.redis.expire(countKey, COUNTER_TTL_SECS);
      if (count > DAILY_CHECKOUT_LIMIT) throw this.limitReached();

      if (phone) {
        // В Redis лежит не номер, а его отпечаток.
        const fingerprint = createHash('sha256').update(`${userId}:${phone}`).digest('hex').slice(0, 24);
        const known = await this.redis.sismember(phonesKey, fingerprint);
        if (!known) {
          const distinct = await this.redis.scard(phonesKey);
          if (distinct >= DAILY_PHONE_LIMIT) throw this.limitReached();
          await this.redis.sadd(phonesKey, fingerprint);
          await this.redis.expire(phonesKey, COUNTER_TTL_SECS);
        }
      }
    } catch (error) {
      if (error instanceof HttpException) throw error;
      this.logger.error(`Parent pay: rate limiter unavailable: ${String(error)}`);
      throw new HttpException(
        { code: 'PARENT_PAY_UNAVAILABLE', message: 'Оплата временно недоступна, попробуйте позже' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private verify(token: string, now: Date) {
    const payload = verifyParentPayToken(token, this.secret(), now);
    if (!payload) throw this.notFound();
    return payload;
  }

  private secret(): string {
    const secret =
      this.config.get<string>('PARENT_PAY_SECRET')?.trim() ||
      this.config.get<string>('PARENT_REPORT_SECRET')?.trim() ||
      this.config.get<string>('JWT_SECRET')?.trim();
    if (!secret) throw new Error('PARENT_PAY_SECRET or JWT_SECRET is required');
    return secret;
  }

  private notFound() {
    return new NotFoundException({
      code: PARENT_PAY_NOT_FOUND,
      message: 'Ссылка на оплату недействительна или устарела',
    });
  }

  private orderNotFound() {
    return new NotFoundException({ code: 'ORDER_NOT_FOUND', message: 'Платёж не найден' });
  }

  private limitReached() {
    return new HttpException(
      { code: PARENT_PAY_LIMIT, message: 'Слишком много попыток оплаты за сегодня. Попробуйте завтра.' },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}

function toIso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

/** Ссылку на оплату отдаём, только если она действительно ведёт в Kaspi. */
function kaspiPayUrl(value: string | null | undefined): string | null {
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol === 'kaspi:') return value;
    if (url.protocol === 'https:' && (url.hostname === 'kaspi.kz' || url.hostname.endsWith('.kaspi.kz'))) {
      return value;
    }
  } catch {
    // не URL
  }
  return null;
}

/** Публичное представление заказа: без чеков, номеров и сырых данных Kaspi. */
function toPublicOrder(order: PresentedOrder): ParentPayOrderDto {
  const status = (['pending', 'paid', 'failed', 'cancelled'] as const).includes(
    order.status as ParentPayOrderStatus,
  )
    ? (order.status as ParentPayOrderStatus)
    : 'failed';
  const isQr = order.paymentType === 'qr';
  return {
    orderId: order.providerOrderId,
    status,
    paymentType: isQr ? 'qr' : 'invoice',
    planCode: order.planCode,
    planName: order.planName,
    amount: order.amount,
    payUrl: isQr && status === 'pending' ? kaspiPayUrl(order.checkoutUrl ?? order.qrToken) : null,
    expiresAt: isQr ? order.expiresAtIso : null,
    phoneMask: order.phoneMask,
    createdAt: toIso(order.createdAt) ?? new Date(0).toISOString(),
    paidAt: toIso(order.paidAt),
    serverTime: new Date().toISOString(),
  };
}
