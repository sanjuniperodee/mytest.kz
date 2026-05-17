import {
  Controller,
  Post,
  Body,
  Res,
  Req,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Request, Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AnalyticsService } from './analytics.service';

@Controller('analytics')
export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  @Post('visit')
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
    const visitorId = body.visitorId || req.cookies?.['blm_vid'] || crypto.randomUUID();

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
