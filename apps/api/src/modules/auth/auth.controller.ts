import { Controller, Post, Body, Req, Res, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';

const REFRESH_COOKIE = 'mytest_refresh_token';
const REFRESH_COOKIE_MAX_AGE_MS = 60 * 24 * 60 * 60 * 1000;

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('telegram')
  async authenticateTelegram(
    @Body('initData') initData: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const visitorId = req.cookies?.['blm_vid'];
    const data = await this.authService.authenticateTelegram(initData, visitorId);
    this.setRefreshCookie(res, data.refreshToken);
    return data;
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
    @Res({ passthrough: true }) res: Response,
  ) {
    const visitorId = req.cookies?.['blm_vid'];
    const data = await this.authService.verifyWebCode(phone, code, visitorId);
    this.setRefreshCookie(res, data.refreshToken);
    return data;
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('google')
  async authenticateGoogle(
    @Body('credential') credential: string,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const visitorId = req.cookies?.['blm_vid'];
    const data = await this.authService.authenticateGoogle(credential, visitorId);
    this.setRefreshCookie(res, data.refreshToken);
    return data;
  }

  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @Post('refresh')
  async refreshToken(
    @Body('refreshToken') refreshToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.refreshToken(
      refreshToken || req.cookies?.[REFRESH_COOKIE] || '',
    );
    this.setRefreshCookie(res, data.refreshToken);
    return data;
  }

  @Throttle({ default: { limit: 20, ttl: 60_000 } })
  @Post('logout')
  async logout(
    @Body('refreshToken') refreshToken: string | undefined,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshCookie(res);
    return this.authService.logout(refreshToken || req.cookies?.[REFRESH_COOKIE] || '');
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @UseGuards(AuthGuard('jwt'))
  @Post('logout-all')
  async logoutAll(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    this.clearRefreshCookie(res);
    return this.authService.logoutAll(userId);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('register')
  async register(
    @Body() dto: { email: string; password: string; firstName?: string; lastName?: string },
  ) {
    return this.authService.registerEmail(dto);
  }

  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @Post('login')
  async login(
    @Body('email') email: string,
    @Body('password') password: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const data = await this.authService.loginEmail(email, password);
    this.setRefreshCookie(res, data.refreshToken);
    return data;
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    });
  }

  private clearRefreshCookie(res: Response) {
    res.clearCookie(REFRESH_COOKIE, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });
  }
}
