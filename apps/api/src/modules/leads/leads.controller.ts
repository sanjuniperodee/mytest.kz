import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import { LeadStatus } from '@prisma/client';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AdminGuard } from '../../common/guards/admin.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post()
  async createLead(@Body() dto: CreateLeadDto, @Req() req: Request) {
    const forwarded = req.headers['x-forwarded-for'];
    const ip =
      typeof forwarded === 'string'
        ? forwarded.split(',')[0]?.trim()
        : Array.isArray(forwarded)
          ? forwarded[0]
          : req.ip;
    const userAgent = req.headers['user-agent'];

    return this.leadsService.create(dto, {
      ip,
      userAgent: typeof userAgent === 'string' ? userAgent : undefined,
    });
  }

  @Get('admin/list')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async getAdminLeads(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: LeadStatus,
    @Query('search') search?: string,
  ) {
    return this.leadsService.getAdminList({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      status: status && Object.values(LeadStatus).includes(status) ? status : undefined,
      search,
    });
  }

  @Patch('admin/:id')
  @UseGuards(AuthGuard('jwt'), AdminGuard)
  async updateAdminLead(
    @CurrentUser('id') adminId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    return this.leadsService.updateAdminLead(adminId, id, dto);
  }
}
