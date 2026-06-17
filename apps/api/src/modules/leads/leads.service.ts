import { Injectable, Logger } from '@nestjs/common';
import { LeadNotificationStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  private readonly logger = new Logger(LeadsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly telegramBotService: TelegramBotService,
  ) {}

  async create(
    dto: CreateLeadDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ ok: true; id: string; notificationStatus: LeadNotificationStatus }> {
    const lead = await this.prisma.lead.create({
      data: {
        name: dto.name.trim(),
        phone: dto.phone.trim(),
        message: dto.message?.trim() || null,
        source: dto.source?.trim() || 'landing',
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });

    try {
      await this.telegramBotService.sendLeadNotificationToAdmin({
        name: lead.name,
        phone: lead.phone,
        message: lead.message,
        source: lead.source,
        ip: lead.ip ?? undefined,
        userAgent: lead.userAgent ?? undefined,
      });
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          notificationStatus: LeadNotificationStatus.sent,
          notifiedAt: new Date(),
          notificationError: null,
        },
      });
      return { ok: true, id: lead.id, notificationStatus: LeadNotificationStatus.sent };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      await this.prisma.lead.update({
        where: { id: lead.id },
        data: {
          notificationStatus: LeadNotificationStatus.failed,
          notificationError: message.slice(0, 2000),
        },
      });
      this.logger.warn(`Lead ${lead.id} was saved but Telegram notification failed: ${message}`);
      return { ok: true, id: lead.id, notificationStatus: LeadNotificationStatus.failed };
    }
  }
}
