import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Req,
  UseGuards,
  type RawBodyRequest,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import type { Request } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { KaspiSessionSetupSecretGuard } from '../../common/guards/kaspi-session-setup-secret.guard';
import { BillingService } from './billing.service';
import {
  KaspiSetupRequestCodeDto,
  KaspiSetupVerifyOtpDto,
} from './dto/kaspi-setup.dto';
import { normalizeKzPhone } from '@bilimland/shared';

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

  @Post('kaspi/checkout')
  @UseGuards(AuthGuard('jwt'))
  createKaspiCheckout(
    @CurrentUser('id') userId: string,
    @Body('planId') planId: string,
    @Body('phoneNumber') phoneNumber: string,
  ) {
    return this.billingService.createKaspiCheckout(userId, planId, phoneNumber);
  }

  /** Одноразовая настройка сессии кассира (секрет в заголовке). Сессия пишется в Redis. */
  @Post('kaspi/setup/request-code')
  @UseGuards(KaspiSessionSetupSecretGuard)
  kaspiSetupRequestCode(@Body() body: KaspiSetupRequestCodeDto) {
    const normalized = normalizeKzPhone(body.phoneNumber || '');
    if (!normalized) {
      throw new BadRequestException('INVALID_PHONE');
    }
    return this.billingService.kaspiSetupRequestCode(normalized);
  }

  @Post('kaspi/setup/verify-otp')
  @UseGuards(KaspiSessionSetupSecretGuard)
  kaspiSetupVerifyOtp(@Body() body: KaspiSetupVerifyOtpDto) {
    return this.billingService.kaspiSetupVerifyOtp(body.processId, body.otp);
  }

  @Get('kaspi/setup/status')
  @UseGuards(KaspiSessionSetupSecretGuard)
  kaspiSetupStatus() {
    return this.billingService.kaspiSetupStatus();
  }

  /** Вызов из kaspi-pos-automation (webhooks.json). Требуется `rawBody: true` в main.ts. */
  @Post('kaspi/webhook')
  kaspiWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Headers('x-webhook-signature') signature: string | string[] | undefined,
  ) {
    const raw = req.rawBody;
    if (!raw?.length) {
      return { ok: false, reason: 'EMPTY_BODY' };
    }
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(raw.toString('utf8')) as Record<string, unknown>;
    } catch {
      return { ok: false, reason: 'INVALID_JSON' };
    }
    return this.billingService.handleKaspiWebhook(raw, signature, payload);
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

  @Get('kaspi/orders/active')
  @UseGuards(AuthGuard('jwt'))
  getActiveKaspiOrders(@CurrentUser('id') userId: string) {
    return this.billingService.getActiveKaspiOrders(userId);
  }

  @Post('kaspi/orders/:orderId/cancel')
  @UseGuards(AuthGuard('jwt'))
  cancelKaspiOrder(
    @CurrentUser('id') userId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.billingService.cancelKaspiOrder(userId, orderId);
  }
}
