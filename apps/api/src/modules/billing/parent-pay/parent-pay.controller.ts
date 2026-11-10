import { Body, Controller, Get, Header, HttpCode, Param, Post, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../../common/decorators/current-user.decorator';
import { ParentPayService } from './parent-pay.service';

/**
 * «Оплатить за ученика». Ученик получает постоянную ссылку /pay/<token>; родитель открывает
 * её без входа, выбирает тариф и платит со своего Kaspi. Платёж создаётся только на стороне
 * родителя — поэтому ссылка не устаревает за те 5 минут, что живёт QR Kaspi.
 *
 * Публичные ручки отвечают одинаковым 404 на любой негодный токен и ничего не кэшируют.
 */
@Controller()
export class ParentPayController {
  constructor(private readonly service: ParentPayService) {}

  @Post('billing/parent-pay-link')
  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createLink(@CurrentUser('id') userId: string, @Body() body: { planId?: string } = {}) {
    return this.service.createLink(userId, body?.planId);
  }

  @Get('public/parent-pay/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Referrer-Policy', 'no-referrer')
  getInfo(@Param('token') token: string) {
    return this.service.getInfo(token);
  }

  // Создание платежа — самая дорогая и самая «громкая» операция (счёт уходит в чужой Kaspi),
  // поэтому лимит по IP жёстче, а в сервисе есть ещё суточные лимиты на ученика.
  @Post('public/parent-pay/:token/checkout')
  @HttpCode(200)
  @Throttle({ default: { limit: 8, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Referrer-Policy', 'no-referrer')
  checkout(
    @Param('token') token: string,
    @Body() body: { planId?: unknown; method?: unknown; phoneNumber?: unknown } = {},
  ) {
    return this.service.checkout(token, body ?? {});
  }

  // Страница опрашивает статус раз в несколько секунд, пока родитель платит в Kaspi.
  @Get('public/parent-pay/:token/orders/:orderId')
  @Throttle({ default: { limit: 90, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Referrer-Policy', 'no-referrer')
  getOrder(@Param('token') token: string, @Param('orderId') orderId: string) {
    return this.service.getOrder(token, orderId);
  }
}
