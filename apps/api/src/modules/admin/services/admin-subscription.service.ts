import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { EntitlementSourceType, EntitlementStatus, EntitlementTier } from '@prisma/client';
import { PrismaService } from '../../../database/prisma.service';
import { AccessService } from '../../subscriptions/access.service';

@Injectable()
export class AdminSubscriptionService {
  constructor(
    private prisma: PrismaService,
    private accessService: AccessService,
  ) {}

  async grantSubscription(
    adminId: string,
    data: {
      userId: string;
      planType: string;
      examTypeId?: string;
      startsAt: string;
      expiresAt: string;
      paymentNote?: string;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
    });
    if (!user) throw new NotFoundException('User not found');

    return this.prisma.subscription.create({
      data: {
        userId: data.userId,
        planType: data.planType,
        examTypeId: data.examTypeId || null,
        grantedBy: adminId,
        startsAt: new Date(data.startsAt),
        expiresAt: new Date(data.expiresAt),
        paymentNote: data.paymentNote || null,
      },
    }).then(async (created) => {
      await this.accessService.syncSubscriptionEntitlements(created.id);
      return created;
    });
  }

  async revokeSubscription(subscriptionId: string) {
    const revoked = await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: { isActive: false },
    });
    await this.accessService.syncSubscriptionEntitlements(subscriptionId);
    return revoked;
  }

  async listUserEntitlements(userId: string) {
    return this.prisma.userExamEntitlement.findMany({
      where: { userId },
      include: {
        examType: { select: { id: true, slug: true, name: true } },
        subscription: { select: { id: true, planType: true, isActive: true } },
        planTemplate: { select: { id: true, code: true, name: true } },
      },
      orderBy: [{ status: 'asc' }, { updatedAt: 'desc' }],
    });
  }

  async grantEntitlement(
    adminId: string,
    data: {
      userId: string;
      examTypeId: string;
      tier: EntitlementTier;
      status?: EntitlementStatus;
      sourceType?: EntitlementSourceType;
      sourceRef?: string;
      planTemplateId?: string | null;
      subscriptionId?: string | null;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      usedAttemptsTotal?: number;
      timezone?: string;
      windowStartsAt: string;
      windowEndsAt?: string | null;
      metadata?: unknown;
    },
  ) {
    const user = await this.prisma.user.findUnique({
      where: { id: data.userId },
      select: { id: true, timezone: true },
    });
    if (!user) throw new NotFoundException('User not found');
    const exam = await this.prisma.examType.findUnique({
      where: { id: data.examTypeId },
      select: { id: true },
    });
    if (!exam) throw new NotFoundException('Exam type not found');

    return this.prisma.userExamEntitlement.create({
      data: {
        userId: data.userId,
        examTypeId: data.examTypeId,
        tier: data.tier,
        status: data.status ?? EntitlementStatus.active,
        sourceType: data.sourceType ?? EntitlementSourceType.admin_override,
        sourceRef:
          data.sourceRef ??
          `manual:${data.userId}:${data.examTypeId}:${Date.now()}:${Math.random().toString(36).slice(2, 8)}`,
        planTemplateId: data.planTemplateId ?? null,
        subscriptionId: data.subscriptionId ?? null,
        totalAttemptsLimit: data.totalAttemptsLimit ?? null,
        dailyAttemptsLimit: data.dailyAttemptsLimit ?? null,
        usedAttemptsTotal: Math.max(0, data.usedAttemptsTotal ?? 0),
        timezone: data.timezone || user.timezone || 'Asia/Almaty',
        windowStartsAt: new Date(data.windowStartsAt),
        windowEndsAt: data.windowEndsAt ? new Date(data.windowEndsAt) : null,
        createdBy: adminId,
        metadata: (data.metadata as object | undefined) ?? undefined,
      },
    });
  }

  async updateEntitlement(
    entitlementId: string,
    data: {
      status?: EntitlementStatus;
      tier?: EntitlementTier;
      totalAttemptsLimit?: number | null;
      dailyAttemptsLimit?: number | null;
      timezone?: string;
      windowStartsAt?: string;
      windowEndsAt?: string | null;
      nextAllowedAt?: string | null;
      metadata?: unknown;
    },
  ) {
    return this.prisma.userExamEntitlement.update({
      where: { id: entitlementId },
      data: {
        ...(data.status !== undefined ? { status: data.status } : {}),
        ...(data.tier !== undefined ? { tier: data.tier } : {}),
        ...(data.totalAttemptsLimit !== undefined
          ? { totalAttemptsLimit: data.totalAttemptsLimit }
          : {}),
        ...(data.dailyAttemptsLimit !== undefined
          ? { dailyAttemptsLimit: data.dailyAttemptsLimit }
          : {}),
        ...(data.timezone !== undefined ? { timezone: data.timezone } : {}),
        ...(data.windowStartsAt !== undefined
          ? { windowStartsAt: new Date(data.windowStartsAt) }
          : {}),
        ...(data.windowEndsAt !== undefined
          ? { windowEndsAt: data.windowEndsAt ? new Date(data.windowEndsAt) : null }
          : {}),
        ...(data.nextAllowedAt !== undefined
          ? { nextAllowedAt: data.nextAllowedAt ? new Date(data.nextAllowedAt) : null }
          : {}),
        ...(data.metadata !== undefined ? { metadata: data.metadata as object } : {}),
      },
    });
  }

  async adjustEntitlementAttempts(
    adminId: string,
    entitlementId: string,
    data: { delta: number; reasonCode?: string },
  ) {
    if (!Number.isFinite(data.delta) || data.delta === 0) {
      throw new BadRequestException('INVALID_DELTA');
    }
    return this.prisma.$transaction(async (tx) => {
      const entitlement = await tx.userExamEntitlement.findUnique({
        where: { id: entitlementId },
      });
      if (!entitlement) throw new NotFoundException('ENTITLEMENT_NOT_FOUND');
      const usedAttemptsTotal = Math.max(0, entitlement.usedAttemptsTotal + data.delta);
      const exhausted =
        entitlement.totalAttemptsLimit != null &&
        usedAttemptsTotal >= entitlement.totalAttemptsLimit;
      const status = exhausted ? EntitlementStatus.exhausted : EntitlementStatus.active;
      const updated = await tx.userExamEntitlement.update({
        where: { id: entitlement.id },
        data: {
          usedAttemptsTotal,
          status,
          exhaustedAt: exhausted ? new Date() : null,
        },
      });
      await tx.attemptUsageLedger.create({
        data: {
          userId: entitlement.userId,
          examTypeId: entitlement.examTypeId,
          entitlementId: entitlement.id,
          action: 'manual_adjust',
          reasonCode: data.reasonCode ?? 'ADMIN_MANUAL_ADJUST',
          attemptsDelta: data.delta,
          metadata: { byAdminId: adminId, inputDelta: data.delta },
        },
      });
      return updated;
    });
  }
}
