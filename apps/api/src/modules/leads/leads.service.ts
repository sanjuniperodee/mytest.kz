import { Injectable } from '@nestjs/common';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { CreateLeadDto } from './dto/create-lead.dto';

@Injectable()
export class LeadsService {
  constructor(private readonly telegramBotService: TelegramBotService) {}

  async create(
    dto: CreateLeadDto,
    meta: { ip?: string; userAgent?: string },
  ): Promise<{ ok: true }> {
    await this.telegramBotService.sendLeadNotificationToAdmin({
      name: dto.name.trim(),
      phone: dto.phone.trim(),
      message: dto.message?.trim() || null,
      source: dto.source?.trim() || 'landing',
      ip: meta.ip,
      userAgent: meta.userAgent,
    });

    return { ok: true };
  }
}
