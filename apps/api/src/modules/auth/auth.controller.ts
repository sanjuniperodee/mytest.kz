import { Controller, Post, Body, Req, UseGuards } from '@nestjs/common';
import { Request } from 'express';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('telegram')
  async authenticateTelegram(
    @Body('initData') initData: string,
    @Req() req: Request,
  ) {
    const visitorId = req.cookies?.['blm_vid'];
    return this.authService.authenticateTelegram(initData, visitorId);
  }

  @Post('web/request-code')
  async requestWebCode(@Body('phone') phone: string) {
    return this.authService.requestWebCode(phone);
  }

  @Post('web/verify-code')
  async verifyWebCode(
    @Body('phone') phone: string,
    @Body('code') code: string,
    @Req() req: Request,
  ) {
    const visitorId = req.cookies?.['blm_vid'];
    return this.authService.verifyWebCode(phone, code, visitorId);
  }

  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
