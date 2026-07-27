import { Injectable, Logger } from '@nestjs/common';
import { LeadNotificationStatus, LeadStatus, Prisma } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { TelegramBotService } from '../telegram/telegram-bot.service';
import { CreateLeadDto } from './dto/create-lead.dto';
import { UpdateLeadDto } from './dto/update-lead.dto';

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

  async getAdminList(params: {
    page?: number;
    limit?: number;
    status?: LeadStatus;
    search?: string;
  }) {
    const page = Math.max(1, params.page ?? 1);
    const limit = Math.min(100, Math.max(1, params.limit ?? 25));
    const search = params.search?.trim();
    const where: Prisma.LeadWhereInput = {
      ...(params.status ? { status: params.status } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phone: { contains: search, mode: 'insensitive' } },
              { source: { contains: search, mode: 'insensitive' } },
            ],
          }
        : {}),
    };

    const [items, total, grouped] = await Promise.all([
      this.prisma.lead.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.lead.count({ where }),
      this.prisma.lead.groupBy({
        by: ['status'],
        _count: { _all: true },
      }),
    ]);

    const counts = Object.fromEntries(
      Object.values(LeadStatus).map((status) => [
        status,
        grouped.find((row) => row.status === status)?._count._all ?? 0,
      ]),
    );
    return { items, total, page, limit, counts };
  }

  async updateAdminLead(adminId: string, id: string, dto: UpdateLeadDto) {
    const current = await this.prisma.lead.findUniqueOrThrow({ where: { id } });
    const nextStatus = dto.status ?? current.status;
    const updated = await this.prisma.$transaction(async (tx) => {
      const lead = await tx.lead.update({
        where: { id },
        data: {
          ...(dto.status ? { status: dto.status } : {}),
          ...(dto.adminNote !== undefined ? { adminNote: dto.adminNote.trim() || null } : {}),
          ...(nextStatus !== LeadStatus.new && !current.contactedAt
            ? { contactedAt: new Date() }
            : {}),
        },
      });
      await tx.adminAudit.create({
        data: {
          actorUserId: adminId,
          targetType: 'lead',
          targetId: id,
          action: 'lead.updated',
          before: { status: current.status, adminNote: current.adminNote },
          after: { status: lead.status, adminNote: lead.adminNote },
        },
      });
      return lead;
    });
    return updated;
  }
}
