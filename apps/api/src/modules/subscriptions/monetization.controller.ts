import { Body, Controller, Get, Headers, Put, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { toPublicMonetizationConfig } from '@bilimland/shared';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../database/prisma.service';
import { MonetizationService } from './monetization.service';

@Controller()
export class MonetizationController {
  constructor(
    private readonly monetization: MonetizationService,
    private readonly prisma: PrismaService,
  ) {}

  /** Бесплатный лимит, платные функции, тарифы в продаже и настройки рекламы для клиентов. */
  @Get('public/monetization')
  async getPublic(
    @Query('lang') langQuery?: string,
    @Headers('accept-language') acceptLanguage?: string,
  ) {
    const lang =
      langQuery === 'kk' || acceptLanguage?.toLowerCase().startsWith('kk') ? 'kk' : 'ru';
    return toPublicMonetizationConfig(await this.monetization.getConfig(), lang);
  }

  @Get('admin/monetization')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async getAdmin() {
    const config = await this.monetization.getConfig();
    const now = new Date();
    const [activeSubs, paidOrders] = await Promise.all([
      this.prisma.subscription.groupBy({
        by: ['planType'],
        where: { isActive: true, startsAt: { lte: now }, expiresAt: { gt: now } },
        _count: { _all: true },
      }),
      this.prisma.paymentOrder.groupBy({
        by: ['planCode'],
        where: { status: 'paid' },
        _count: { _all: true },
        _sum: { amount: true },
      }),
    ]);
    const usage = Object.fromEntries(
      config.plans.map((plan) => {
        const active = activeSubs.find((row) => row.planType === plan.code);
        const paid = paidOrders.find((row) => row.planCode === plan.code);
        return [
          plan.code,
          {
            activeSubscriptions: active?._count._all ?? 0,
            paidOrders: paid?._count._all ?? 0,
            revenueKzt: Number(paid?._sum.amount ?? 0),
          },
        ];
      }),
    );
    return { config, usage };
  }

  @Put('admin/monetization')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async update(@CurrentUser('id') adminId: string, @Body() body: Record<string, unknown>) {
    return this.monetization.update(adminId, body);
  }
}
