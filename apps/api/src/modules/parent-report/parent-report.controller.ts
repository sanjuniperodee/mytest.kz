import { Controller, Delete, Get, Header, Param, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParentReportService } from './parent-report.service';

/**
 * «Отчёт для родителей». Ученик создаёт/отзывает подписанную ссылку; родитель
 * открывает отчёт без входа. В ответе только агрегаты — см. buildParentReport.
 */
@Controller()
export class ParentReportController {
  constructor(private readonly service: ParentReportService) {}

  @Get('users/me/parent-report-link')
  @UseGuards(AuthGuard('jwt'))
  getLink(@CurrentUser('id') userId: string) {
    return this.service.getLink(userId);
  }

  @Post('users/me/parent-report-link')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  createLink(@CurrentUser('id') userId: string) {
    return this.service.createLink(userId);
  }

  @Delete('users/me/parent-report-link')
  @UseGuards(AuthGuard('jwt'))
  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  revokeLink(@CurrentUser('id') userId: string) {
    return this.service.revokeLink(userId);
  }

  // Неверный токен отсекается HMAC-проверкой до БД, верный — кэшируется на минуту.
  @Get('public/parent-report/:token')
  @Throttle({ default: { limit: 60, ttl: 60_000 } })
  @Header('Cache-Control', 'private, no-store')
  @Header('X-Robots-Tag', 'noindex, nofollow')
  @Header('Referrer-Policy', 'no-referrer')
  getPublicReport(@Param('token') token: string, @Query('lang') lang?: string) {
    return this.service.getPublicReport(token, lang);
  }
}
