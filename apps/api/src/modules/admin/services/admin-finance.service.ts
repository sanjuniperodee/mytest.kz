import { Injectable } from '@nestjs/common';
import { PaymentOrderStatus } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

function toNumber(value: unknown): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'bigint') return Number(value);
  if (typeof value === 'string' && value.trim() !== '') return Number(value);
  if (value && typeof value === 'object' && 'toString' in value) {
    const parsed = Number(String(value));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function startOfTodayAlmaty(now = new Date()) {
  const local = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Almaty' }));
  local.setHours(0, 0, 0, 0);
  const offsetNow = now.getTime() - new Date(now.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  const offsetLocal = local.getTime() - new Date(local.toLocaleString('en-US', { timeZone: 'UTC' })).getTime();
  return new Date(local.getTime() - (offsetLocal - offsetNow));
}

@Injectable()
export class AdminFinanceService {
  constructor(private prisma: PrismaService) {}

  async getFinanceOrders(params: {
    search?: string;
    page?: number;
    limit?: number;
    status?: PaymentOrderStatus | 'all';
    provider?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const search = params.search?.trim();
    const digits = search?.replace(/\D/g, '') ?? '';

    const where = {
      ...(params.status && params.status !== 'all' ? { status: params.status } : {}),
      ...(params.provider && params.provider !== 'all' ? { provider: params.provider } : {}),
      ...(search
        ? {
            OR: [
              { providerOrderId: { contains: search, mode: 'insensitive' as const } },
              { providerPaymentId: { contains: search, mode: 'insensitive' as const } },
              { planCode: { contains: search, mode: 'insensitive' as const } },
              {
                user: {
                  OR: [
                    { telegramUsername: { contains: search, mode: 'insensitive' as const } },
                    { email: { contains: search, mode: 'insensitive' as const } },
                    { firstName: { contains: search, mode: 'insensitive' as const } },
                    { lastName: { contains: search, mode: 'insensitive' as const } },
                    ...(digits.length >= 4 ? [{ phone: { contains: digits } }] : []),
                  ],
                },
              },
            ],
          }
        : {}),
    };

    const [orders, total, paidAgg, statusAgg, providers] = await Promise.all([
      this.prisma.paymentOrder.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              telegramUsername: true,
              phone: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.paymentOrder.count({ where }),
      this.prisma.paymentOrder.aggregate({
        where: { ...where, status: PaymentOrderStatus.paid },
        _sum: { amount: true },
        _avg: { amount: true },
        _count: { _all: true },
      }),
      this.prisma.paymentOrder.groupBy({
        by: ['status'],
        where,
        _count: { _all: true },
      }),
      this.prisma.paymentOrder.findMany({
        distinct: ['provider'],
        select: { provider: true },
        orderBy: { provider: 'asc' },
      }),
    ]);

    const todayStart = startOfTodayAlmaty();
    const paidTodayAgg = await this.prisma.paymentOrder.aggregate({
      where: {
        ...where,
        status: PaymentOrderStatus.paid,
        paidAt: { gte: todayStart },
      },
      _sum: { amount: true },
    });

    const userIds = [...new Set(orders.map((order) => order.userId))];
    const subsByUser = userIds.length
      ? await this.prisma.subscription.findMany({
          where: { userId: { in: userIds } },
          select: {
            id: true,
            userId: true,
            planType: true,
            isActive: true,
            startsAt: true,
            expiresAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
        })
      : [];

    const subscriptionsByUser = new Map<string, typeof subsByUser>();
    for (const sub of subsByUser) {
      const bucket = subscriptionsByUser.get(sub.userId) ?? [];
      bucket.push(sub);
      subscriptionsByUser.set(sub.userId, bucket);
    }

    const items = orders.map((order) => {
      let linkedSubscription: {
        id: string;
        isActive: boolean;
        startsAt: Date;
        expiresAt: Date;
        createdAt: Date;
      } | null = null;

      if (order.status === PaymentOrderStatus.paid) {
        const candidates =
          subscriptionsByUser
            .get(order.userId)
            ?.filter((sub) => {
              if (sub.planType !== order.planCode) return false;
              const from = order.createdAt.getTime() - 60_000;
              const to = (order.paidAt ?? order.updatedAt ?? order.createdAt).getTime() + 30 * 60_000;
              const ts = sub.createdAt.getTime();
              return ts >= from && ts <= to;
            })
            .sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime()) ?? [];
        linkedSubscription = candidates[0] ?? null;
      }

      const fullName = [order.user.firstName, order.user.lastName].filter(Boolean).join(' ').trim();
      return {
        id: order.id,
        planCode: order.planCode,
        amount: toNumber(order.amount),
        currency: order.currency,
        provider: order.provider,
        providerOrderId: order.providerOrderId,
        providerPaymentId: order.providerPaymentId,
        checkoutUrl: order.checkoutUrl,
        status: order.status,
        paidAt: order.paidAt,
        createdAt: order.createdAt,
        updatedAt: order.updatedAt,
        user: {
          id: order.user.id,
          displayName: fullName || order.user.telegramUsername || order.user.email || order.user.phone || order.user.id,
          telegramUsername: order.user.telegramUsername,
          phone: order.user.phone,
          email: order.user.email,
        },
        linkedSubscription: linkedSubscription
          ? {
              id: linkedSubscription.id,
              isActive: linkedSubscription.isActive,
              startsAt: linkedSubscription.startsAt,
              expiresAt: linkedSubscription.expiresAt,
              createdAt: linkedSubscription.createdAt,
            }
          : null,
      };
    });

    const statusCounts = Object.values(PaymentOrderStatus).reduce<Record<string, number>>((acc, status) => {
      acc[status] = 0;
      return acc;
    }, {});
    for (const row of statusAgg) statusCounts[row.status] = row._count._all;

    return {
      items,
      total,
      page,
      limit,
      providers: providers.map((row) => row.provider).filter(Boolean),
      summary: {
        totalOrders: total,
        paidOrders: paidAgg._count._all,
        grossRevenueKzt: toNumber(paidAgg._sum.amount),
        averagePaidCheckKzt: toNumber(paidAgg._avg.amount),
        paidTodayKzt: toNumber(paidTodayAgg._sum.amount),
        statusCounts,
      },
    };
  }
}
