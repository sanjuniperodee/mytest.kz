import { Controller, Get, Header, UseGuards, Query } from '@nestjs/common';
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

  @Get('ent-trials/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="ent-trials-analytics.csv"')
  async exportEntTrials() {
    return `\ufeff${await this.adminService.exportEntTrialAnalytics()}`;
  }

  @Get('ent-profile-pairs')
  async getEntProfilePairs() {
    return this.adminService.getEntProfilePairsAnalytics();
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

  @Get('visitors/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="visitors.csv"')
  async exportVisitors(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('examTypeId') examTypeId?: string,
    @Query('step') step?: string,
  ) {
    return `\ufeff${await this.analyticsService.exportVisitors({ from, to, examTypeId, step })}`;
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

  @Get('test-takers/export')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  @Header('Content-Disposition', 'attachment; filename="test-takers.csv"')
  async exportTestTakers(
    @Query('from') from?: string,
    @Query('to') to?: string,
    @Query('examTypeId') examTypeId?: string,
  ) {
    return `\ufeff${await this.analyticsService.exportTestTakers({ from, to, examTypeId })}`;
  }
}
