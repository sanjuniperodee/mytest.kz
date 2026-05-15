import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { PaymentOrderStatus } from '@prisma/client';
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
  ) {
    return this.adminService.getFinanceOrders({
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 25,
      status,
      provider,
    });
  }
}
