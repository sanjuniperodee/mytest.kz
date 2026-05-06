import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('telegram')
  async authenticateTelegram(
    @Body('initData') initData: string,
    @Req() req: Request,
  ) {
    const visitorId = req.cookies?.['blm_vid'];
    return this.authService.authenticateTelegram(initData, visitorId);
  }

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('web/request-code')
  async requestWebCode(@Body('phone') phone: string) {
    return this.authService.requestWebCode(phone);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('web/verify-code')
  async verifyWebCode(
    @Body('phone') phone: string,
    @Body('code') code: string,
    @Req() req: Request,
  ) {
    const visitorId = req.cookies?.['blm_vid'];
    return this.authService.verifyWebCode(phone, code, visitorId);
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('google')
  async authenticateGoogle(
    @Body('credential') credential: string,
    @Req() req: Request,
  ) {
    const visitorId = req.cookies?.['blm_vid'];
    return this.authService.authenticateGoogle(credential, visitorId);
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
