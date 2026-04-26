import { Controller, Get, UseGuards, Query } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';
import { AnalyticsService } from '../analytics/analytics.service';

@Controller('admin/analytics')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminAnalyticsController {
  constructor(
    private adminService: AdminService,
    private analyticsService: AnalyticsService,
  ) {}

  @Get('overview')
  async getOverview() {
    return this.adminService.getAnalyticsOverview();
  }

  @Get('ent-trials')
  async getEntTrials() {
    return this.adminService.getEntTrialAnalytics();
  }

  @Get('funnel')
  async getFunnel(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('examTypeId') examTypeId?: string,
  ) {
    return this.analyticsService.getFunnelAnalytics({ from, to, examTypeId });
  }

  @Get('visitors')
  async getVisitors(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('search') search?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('step') step?: string,
  ) {
    return this.analyticsService.getVisitors({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      from,
      to,
      search,
      examTypeId,
      step,
    });
  }

  @Get('test-takers')
  async getTestTakers(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('examTypeId') examTypeId?: string,
  ) {
    return this.analyticsService.getTestTakers({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      from,
      to,
      examTypeId,
    });
  }
}
