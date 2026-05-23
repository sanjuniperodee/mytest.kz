import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentOrderStatus } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { AdminGuard } from '../../common/guards/admin.guard';
import { AdminService } from './admin.service';

@Controller('admin/finance')
@UseGuards(AuthGuard('jwt'), AdminGuard)
export class AdminFinanceController {
  constructor(private adminService: AdminService) {}

  @Get('orders')
  async getOrders(
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: PaymentOrderStatus | 'all',
    @Query('provider') provider?: string,
    @Query('compact') compact?: string,
  ) {
    return this.adminService.getFinanceOrders({
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      status,
      provider,
      compact: compact === 'true',
    });
  }

  @Post('orders/:orderId/kaspi-refund')
  async refundKaspiOrder(
    @CurrentUser('id') adminId: string,
    @Param('orderId', ParseUUIDPipe) orderId: string,
  ) {
    return this.adminService.refundKaspiOrder(adminId, orderId);
  }
}
