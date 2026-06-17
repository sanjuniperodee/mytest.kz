import { BadRequestException, Body, Controller, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { NotificationsService } from './notifications.service';
import { getNotificationCampaignDefinition, type NotificationCampaignKey } from './notification-campaigns';

@Controller('admin/notifications')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminNotificationsController {
  constructor(private notifications: NotificationsService) {}

  @Get('overview')
  async getOverview() {
    return this.notifications.getOverview();
  }

  @Get('logs')
  async getLogs(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('campaignKey') campaignKey?: string,
    @Query('status') status?: string,
  ) {
    return this.notifications.getLogs({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      campaignKey,
      status,
    });
  }

  @Post('run')
  async runNow(
    @CurrentUser('id') adminId: string,
    @Body() body: { campaignKey?: NotificationCampaignKey },
  ) {
    const campaignKey = body?.campaignKey;
    if (campaignKey && !getNotificationCampaignDefinition(campaignKey)) {
      throw new BadRequestException('Unknown notification campaign');
    }
    return this.notifications.runAutomation('manual', { campaignKey, adminId });
  }

  @Patch('campaigns/:key')
  async updateCampaign(
    @CurrentUser('id') adminId: string,
    @Param('key') key: string,
    @Body() body: { isActive?: boolean; cooldownHours?: number },
  ) {
    return this.notifications.updateCampaign(adminId, key, body);
  }
}
