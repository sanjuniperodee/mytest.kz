import { Body, Controller, Post, Req } from '@nestjs/common';
import { Request } from 'express';
import { CreateLeadDto } from './dto/create-lead.dto';
import { LeadsService } from './leads.service';

@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

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
}
