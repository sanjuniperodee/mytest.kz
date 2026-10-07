import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AttemptLedgerAction, EntitlementStatus, EntitlementTier } from '@prisma/client';
import type { PremiumFeatureKey } from '@bilimland/shared';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../../modules/subscriptions/access.service';
import { MonetizationService } from '../../modules/subscriptions/monetization.service';
import { PREMIUM_FEATURE_METADATA } from '../decorators/premium-feature.decorator';

function premiumRequired(feature: PremiumFeatureKey | undefined) {
  // message не меняем: клиенты различают отказ по статусу 403 и этому тексту.
  return new ForbiddenException({
    statusCode: 403,
    error: 'Forbidden',
    message: 'Premium subscription required',
    code: 'PREMIUM_REQUIRED',
    feature: feature ?? null,
  });
}

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private accessService: AccessService,
    private monetization: MonetizationService,
    private reflector: Reflector,
  ) {}

  private async resolveTargetExamTypeId(request: {
    user?: { id?: string };
    body?: Record<string, unknown>;
    params?: Record<string, unknown>;
  }): Promise<string | null> {
    const bodyExamTypeId = request.body?.examTypeId;
    if (typeof bodyExamTypeId === 'string' && bodyExamTypeId.trim()) {
      return bodyExamTypeId.trim();
    }

    const sessionId = request.params?.id;
    if (
      typeof sessionId !== 'string' ||
      !sessionId.trim() ||
      typeof request.user?.id !== 'string'
    ) {
      return null;
    }

    const session = await this.prisma.testSession.findFirst({
      where: { id: sessionId, userId: request.user.id },
      select: { examTypeId: true },
    });
    return session?.examTypeId ?? null;
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const feature = this.reflector.getAllAndOverride<PremiumFeatureKey | undefined>(
      PREMIUM_FEATURE_METADATA,
      [context.getHandler(), context.getClass()],
    );
    if (feature) {
      await this.monetization.getConfig();
      if (!this.monetization.isPremiumFeature(feature)) return true;
    }

    const request = context.switchToHttp().getRequest();
    const user = request.user;
    const targetExamTypeId = await this.resolveTargetExamTypeId(request);

    const now = new Date();
    if (this.accessService.isV2Enabled()) {
      const paidEntitlement = await this.prisma.userExamEntitlement.findFirst({
        where: {
          userId: user.id,
          // When no specific exam requested (e.g. mistakes/practice "all exams"):
          // accept any active paid entitlement rather than the magic global UUID.
          ...(targetExamTypeId ? { examTypeId: targetExamTypeId } : {}),
          tier: { in: [EntitlementTier.paid, EntitlementTier.admin] },
          status: EntitlementStatus.active,
          windowStartsAt: { lte: now },
          OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
        },
      });
      if (paidEntitlement) return true;

      const activePaidSubscription = await this.prisma.subscription.findFirst({
        where: {
          userId: user.id,
          isActive: true,
          startsAt: { lte: now },
          expiresAt: { gt: now },
          planType: { not: 'free' },
          // When a specific exam is requested: match that exam or global subscriptions.
          // When no exam is specified (e.g. mistakes/practice "all exams"): accept any subscription.
          ...(targetExamTypeId
            ? { OR: [{ examTypeId: null }, { examTypeId: targetExamTypeId }] }
            : {}),
        },
        select: { id: true },
      });
      if (activePaidSubscription) return true;

      const sessionId = request.params?.id;
      if (typeof sessionId === 'string' && sessionId.trim()) {
        const paidSessionLedger = await this.prisma.attemptUsageLedger.findFirst({
          where: {
            userId: user.id,
            sessionId,
            action: AttemptLedgerAction.attempt_consumed,
            entitlement: {
              tier: { in: [EntitlementTier.paid, EntitlementTier.admin] },
            },
          },
          select: { id: true },
        });
        if (paidSessionLedger) return true;
      }

      throw premiumRequired(feature);
    }

    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        expiresAt: { gt: now },
        startsAt: { lte: now },
        planType: { not: 'free' },
        ...(targetExamTypeId
          ? { OR: [{ examTypeId: null }, { examTypeId: targetExamTypeId }] }
          : {}),
      },
    });

    if (!activeSubscription) {
      throw premiumRequired(feature);
    }

    return true;
  }
}
