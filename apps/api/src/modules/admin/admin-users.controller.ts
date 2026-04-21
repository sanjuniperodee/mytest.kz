import { Controller, Get, Patch, Post, Param, Query, Body, UseGuards, Req } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin/users')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminUsersController {
  constructor(private adminService: AdminService) {}

  @Get()
  async getUsers(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.adminService.getUsers(
      search,
      page ? parseInt(page, 10) : 1,
      limit ? parseInt(limit, 10) : 20,
    );
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() data: { isAdmin?: boolean }) {
    return this.adminService.updateUser(id, data);
  }

  @Post(':id/grant-trial')
  async grantTrial(@Param('id') userId: string, @Req() req: any) {
    const adminId = req.user.id;
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // 1 day
    return this.adminService.grantSubscription(adminId, {
      userId,
      planType: 'trial',
      startsAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      paymentNote: 'Granted by admin: trial',
    });
  }
}
