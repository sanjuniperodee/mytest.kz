import { Body, Controller, Delete, Get, Param, ParseUUIDPipe, Patch, Query, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
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

  @Get(':id')
  async getUserDetail(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUserDetail(id);
  }

  @Patch(':id')
  async updateUser(@Param('id') id: string, @Body() data: { isAdmin?: boolean }) {
    return this.adminService.updateUser(id, data);
  }

  @Delete(':id')
  async deleteUser(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.adminService.deleteUser(adminId, id);
  }
}
