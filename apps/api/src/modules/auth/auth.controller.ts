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
  async requestWebCode(@Body('username') username: string) {
    return this.authService.requestWebCode(username);
  }

  @Post('web/verify-code')
  async verifyWebCode(
    @Body('username') username: string,
    @Body('code') code: string,
  ) {
    return this.authService.verifyWebCode(username, code);
  }

  @Post('refresh')
  async refreshToken(@Body('refreshToken') refreshToken: string) {
    return this.authService.refreshToken(refreshToken);
  }
}
