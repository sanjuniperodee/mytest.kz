import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntitlementSourceType, EntitlementStatus, EntitlementTier, Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';

@Injectable()
export class AdminPlanTemplateService {
  constructor(private prisma: PrismaService) {}

  async listPlanTemplates() {
    return this.prisma.subscriptionPlanTemplate.findMany({
      include: {
        examRules: {
          include: { examType: { select: { id: true, slug: true, name: true } } },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createPlanTemplate(
    adminId: string,
    data: {
      code: string;
      name: string;
      description?: string | null;
      isPremium?: boolean;
      durationDays?: number | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezoneMode?: string;
      metadata?: unknown;
      rules?: Array<{
        examTypeId: string;
        totalAttemptsLimit?: number | null;
        dailyAttemptsLimit?: number | null;
        isUnlimited?: boolean;
        sortOrder?: number;
      }>;
    },
  ) {
    const created = await this.prisma.subscriptionPlanTemplate.create({
      data: {
        code: data.code,
        name: data.name,
        description: data.description ?? null,
        isPremium: data.isPremium ?? false,
        durationDays: data.durationDays ?? null,
        totalAttemptsLimit: data.totalAttemptsLimit ?? null,
        dailyAttemptsLimit: data.dailyAttemptsLimit ?? null,
        timezoneMode: data.timezoneMode ?? 'user',
        metadata: (data.metadata as object | undefined) ?? undefined,
        createdBy: adminId,
        examRules: data.rules?.length
          ? {
              create: data.rules.map((rule) => ({
                examTypeId: rule.examTypeId,
                totalAttemptsLimit: rule.totalAttemptsLimit ?? null,
                dailyAttemptsLimit: rule.dailyAttemptsLimit ?? null,
                isUnlimited: rule.isUnlimited ?? false,
                sortOrder: rule.sortOrder ?? 0,
              })),
            }
          : undefined,
      },
      include: { examRules: true },
    });

    await this.prisma.adminAudit.create({
      data: {
        actorUserId: adminId,
        targetType: 'plan_template',
        targetId: created.id,
        action: 'create_plan_template',
        before: Prisma.DbNull,
        after: {
          code: created.code,
          name: created.name,
          isPremium: created.isPremium,
          durationDays: created.durationDays,
          rulesCount: created.examRules.length,
        },
      },
    });

    return created;
  }

  async updatePlanTemplate(
    adminId: string,
    id: string,
    data: {
      name?: string;
      description?: string | null;
      isActive?: boolean;
      isPremium?: boolean;
      durationDays?: number | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezoneMode?: string;
      metadata?: unknown;
      replaceRules?: Array<{
        examTypeId: string;
        totalAttemptsLimit?: number | null;
        dailyAttemptsLimit?: number | null;
        isUnlimited?: boolean;
        sortOrder?: number;
      }>;
    },
  ) {
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.subscriptionPlanTemplate.findUnique({
        where: { id },
      });
      if (!before) throw new NotFoundException('Plan template not found');

      if (data.replaceRules) {
        await tx.subscriptionPlanTemplateExamRule.deleteMany({
          where: { planTemplateId: id },
        });
      }
      const updated = await tx.subscriptionPlanTemplate.update({
        where: { id },
        data: {
          ...(data.name !== undefined ? { name: data.name } : {}),
          ...(data.description !== undefined ? { description: data.description } : {}),
          ...(data.isActive !== undefined ? { isActive: data.isActive } : {}),
          ...(data.isPremium !== undefined ? { isPremium: data.isPremium } : {}),
          ...(data.durationDays !== undefined ? { durationDays: data.durationDays } : {}),
          ...(data.totalAttemptsLimit !== undefined
            ? { totalAttemptsLimit: data.totalAttemptsLimit }
            : {}),
          ...(data.dailyAttemptsLimit !== undefined
            ? { dailyAttemptsLimit: data.dailyAttemptsLimit }
            : {}),
          ...(data.timezoneMode !== undefined ? { timezoneMode: data.timezoneMode } : {}),
          ...(data.metadata !== undefined ? { metadata: data.metadata as object } : {}),
          ...(data.replaceRules
            ? {
                examRules: {
                  create: data.replaceRules.map((rule) => ({
                    examTypeId: rule.examTypeId,
                    totalAttemptsLimit: rule.totalAttemptsLimit ?? null,
                    dailyAttemptsLimit: rule.dailyAttemptsLimit ?? null,
                    isUnlimited: rule.isUnlimited ?? false,
                    sortOrder: rule.sortOrder ?? 0,
                  })),
                },
              }
            : {}),
        },
        include: { examRules: true },
      });

      await tx.adminAudit.create({
        data: {
          actorUserId: adminId,
          targetType: 'plan_template',
          targetId: id,
          action: 'update_plan_template',
          before: {
            name: before.name,
            isActive: before.isActive,
            isPremium: before.isPremium,
            durationDays: before.durationDays,
          },
          after: {
            name: updated.name,
            isActive: updated.isActive,
            isPremium: updated.isPremium,
            durationDays: updated.durationDays,
          },
        },
      });

      return updated;
    });
  }

  async applyPlanTemplateToUser(
    adminId: string,
    data: {
      userId: string;
      planTemplateId: string;
      windowStartsAt: string;
      windowEndsAt?: string | null;
      paymentNote?: string | null;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, timezone: true },
    });
    if (!user) throw new NotFoundException('User not found');

    const tpl = await this.prisma.subscriptionPlanTemplate.findFirst({
      where: { id: data.planTemplateId, isActive: true },
      include: {
        examRules: { orderBy: { sortOrder: 'asc' } },
      },
    });
    if (!tpl) {
      throw new NotFoundException('PLAN_TEMPLATE_NOT_FOUND');
    }
    if (tpl.examRules.length === 0) {
      throw new BadRequestException(
        'PLAN_TEMPLATE_HAS_NO_EXAM_RULES: add at least one exam rule to the template, or use legacy subscription',
      );
    }

    const start = new Date(data.windowStartsAt);
    if (Number.isNaN(start.getTime())) {
      throw new BadRequestException('INVALID_WINDOW_START');
    }

    let end: Date | null = null;
    if (data.windowEndsAt != null && String(data.windowEndsAt).trim() !== '') {
      end = new Date(data.windowEndsAt);
      if (Number.isNaN(end.getTime())) {
        throw new BadRequestException('INVALID_WINDOW_END');
      }
    } else if (tpl.durationDays != null) {
      end = new Date(start.getTime() + tpl.durationDays * 86400000);
    }

    const tz = user.timezone || 'Asia/Almaty';

    return this.prisma.$transaction(async (tx) => {
      const entitlements: { id: string; examTypeId: string }[] = [];
      for (const rule of tpl.examRules) {
        const totalLimit = rule.isUnlimited
          ? null
          : (rule.totalAttemptsLimit ?? tpl.totalAttemptsLimit);
        const dailyLimit = rule.dailyAttemptsLimit ?? tpl.dailyAttemptsLimit;
        const row = await tx.userExamEntitlement.create({
          data: {
            userId: data.userId,
            examTypeId: rule.examTypeId,
            tier: tpl.isPremium ? EntitlementTier.paid : EntitlementTier.trial,
            status: EntitlementStatus.active,
            sourceType: EntitlementSourceType.plan_template,
            sourceRef: `plan_template:${tpl.id}:exam:${rule.examTypeId}:${Date.now()}`,
            planTemplateId: tpl.id,
            subscriptionId: null,
            totalAttemptsLimit: totalLimit,
            dailyAttemptsLimit: dailyLimit,
            usedAttemptsTotal: 0,
            timezone: tz,
            windowStartsAt: start,
            windowEndsAt: end,
            createdBy: adminId,
            metadata: {
              ...(data.paymentNote != null && String(data.paymentNote).trim() !== ''
                ? { paymentNote: String(data.paymentNote).trim() }
                : {}),
              planTemplateCode: tpl.code,
            },
          },
        });
        entitlements.push({ id: row.id, examTypeId: rule.examTypeId });
      }
      return {
        template: { id: tpl.id, code: tpl.code, name: tpl.name },
        entitlements,
      };
    });
  }
}
