import {
  Controller,
  Post,
  Body,
  Res,
} from '@nestjs/common';
import { Response } from 'express';
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
    @Res({ passthrough: true }) res: Response,
  ) {
    // Generate visitorId if not provided
    const visitorId =
      body.visitorId ||
      crypto.randomUUID();

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
    });

    return result;
  }
}
