import { Body, Controller, Get, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { BillingService } from './billing.service';

@Controller('billing')
export class BillingController {
  constructor(private billingService: BillingService) {}

  @Get('plans')
  getPlans() {
    return this.billingService.getPlans();
  }

  @Post('checkout')
  @UseGuards(AuthGuard('jwt'))
  createCheckout(
    @CurrentUser('id') userId: string,
    @Body('planId') planId: string,
  ) {
    return this.billingService.createCheckout(userId, planId);
  }

  @Post('freedompay/callback')
  freedomPayCallback(@Body() payload: Record<string, unknown>) {
    return this.billingService.handleFreedomPayCallback(payload);
  }

  @Get('orders/:orderId')
  @UseGuards(AuthGuard('jwt'))
  getOrder(
    @CurrentUser('id') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.billingService.getOrder(userId, orderId);
  }
}
