import { Controller, Post, Body } from '@nestjs/common';
import { AuthService } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('telegram')
  async authenticateTelegram(@Body('initData') initData: string) {
    return this.authService.authenticateTelegram(initData);
  }

  @Post('web/request-code')
  async requestWebCode(@Body('phone') phone: string) {
    return this.authService.requestWebCode(phone);
  }

  @Post('web/verify-code')
  async verifyWebCode(
    @Body('phone') phone: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyWebCode(phone, code);
  }

  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
