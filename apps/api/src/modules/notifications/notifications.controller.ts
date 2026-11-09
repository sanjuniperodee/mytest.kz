import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Header,
  Headers,
  HttpCode,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { WebPushService } from './channels/web-push.service';
import { NotificationPreferencesService } from './notification-preferences.service';
import { renderUnsubscribePage } from './notification-templates';
import { PushSubscribeDto, PushUnsubscribeDto } from './notifications.dto';

/** User-facing notification endpoints: web push opt-in, Telegram connect, email unsubscribe. */
@Controller('notifications')
export class NotificationsController {
  constructor(
    private readonly push: WebPushService,
    private readonly preferences: NotificationPreferencesService,
  ) {}

  /** Public: VAPID application server key (null while web push is not configured). */
  @Get('push/public-key')
  publicKey() {
    const publicKey = this.push.getPublicKey();
    return { enabled: publicKey !== null, publicKey };
  }

  @Post('push/subscribe')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  subscribe(
    @CurrentUser('id') userId: string,
    @Body() dto: PushSubscribeDto,
    @Headers('user-agent') userAgent?: string,
  ) {
    return this.push.subscribe(
      userId,
      { endpoint: dto.endpoint, keys: { p256dh: dto.keys.p256dh, auth: dto.keys.auth } },
      userAgent ?? null,
    );
  }

  @Delete('push/subscribe')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  unsubscribe(@CurrentUser('id') userId: string, @Body() dto: PushUnsubscribeDto) {
    return this.push.unsubscribe(userId, dto.endpoint);
  }

  /** Deep link `t.me/<bot>?start=link_<token>` that attaches Telegram to the signed-in account. */
  @Post('telegram/link')
  @HttpCode(200)
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  telegramLink(@CurrentUser('id') userId: string) {
    return this.preferences.createTelegramLink(userId);
  }

  /** Link from the email footer: unsubscribes and shows a confirmation page. */
  @Get('unsubscribe')
  @Header('Content-Type', 'text/html; charset=utf-8')
  @Header('Cache-Control', 'no-store')
  @Header('X-Robots-Tag', 'noindex')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async unsubscribePage(@Query('t') token?: string) {
    const result = await this.preferences.unsubscribeEmail(token);
    return renderUnsubscribePage(result.language, result.ok, this.preferences.siteUrl());
  }

  /** RFC 8058 one-click unsubscribe (`List-Unsubscribe-Post`), called by the mail provider. */
  @Post('unsubscribe')
  @HttpCode(200)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async unsubscribeOneClick(@Query('t') token?: string) {
    const result = await this.preferences.unsubscribeEmail(token);
    if (!result.ok) throw new BadRequestException('INVALID_UNSUBSCRIBE_TOKEN');
    return { ok: true };
  }
}
