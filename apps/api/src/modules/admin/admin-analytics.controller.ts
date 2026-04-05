import { Controller, Get, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin/analytics')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminAnalyticsController {
  constructor(private adminService: AdminService) {}

  @Get('overview')
  async getOverview() {
    return this.adminService.getAnalyticsOverview();
  }
}
