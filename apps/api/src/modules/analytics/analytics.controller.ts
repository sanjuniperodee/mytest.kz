import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Request, Response } from 'express';
import { randomUUID } from 'crypto';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('visit')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  async recordVisit(
    @Body()
    body: {
      visitorId?: string;
      source?: string;
      medium?: string;
      campaign?: string;
      referrer?: string;
      landingPath?: string;
    },
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    // Prefer the server-set httpOnly cookie over the client-supplied body id to
    // limit analytics pollution; the body id is only a first-visit fallback.
    const visitorId = req.cookies?.['blm_vid'] || body.visitorId || randomUUID();

    const result = await this.analyticsService.recordVisit({
      visitorId,
      source: body.source,
      medium: body.medium,
      campaign: body.campaign,
      referrer: body.referrer,
      landingPath: body.landingPath,
    });

    // Set httpOnly cookie
    res.cookie('blm_vid', visitorId, {
      maxAge: 365 * 24 * 60 * 60 * 1000,
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
    });

    return result;
  }

  @Post('event')
  @UseGuards(AuthGuard('jwt'))
  async recordEvent(
    @CurrentUser('id') userId: string,
    @Body()
    body: {
      step?: string;
      sessionId?: string;
      metadata?: Record<string, unknown>;
      landingPath?: string;
    },
    @Req() req: Request,
  ) {
    return this.analyticsService.recordEvent({
      userId,
      visitorId: req.cookies?.['blm_vid'],
      step: body.step || '',
      sessionId: body.sessionId,
      metadata: body.metadata,
      landingPath: body.landingPath,
    });
  }
}
