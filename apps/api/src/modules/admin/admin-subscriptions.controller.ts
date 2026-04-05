import { Controller, Post, Delete, Param, Body, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminService } from './admin.service';

@Controller('admin/subscriptions')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminSubscriptionsController {
  constructor(private adminService: AdminService) {}

  @Post()
  async grantSubscription(
    @CurrentUser('id') adminId: string,
    @Body() data: {
      userId: string;
      planType: string;
      examTypeId?: string;
      startsAt: string;
      expiresAt: string;
      paymentNote?: string;
    },
  ) {
    return this.adminService.grantSubscription(adminId, data);
  }

  @Delete(':id')
  async revokeSubscription(@Param('id') id: string) {
    return this.adminService.revokeSubscription(id);
  }
}
