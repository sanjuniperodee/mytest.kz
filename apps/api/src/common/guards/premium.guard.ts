import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { AttemptLedgerAction, EntitlementStatus, EntitlementTier } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from '../../modules/subscriptions/access.service';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(
    private prisma: PrismaService,
    private accessService: AccessService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const now = new Date();
    if (this.accessService.isV2Enabled()) {
      const paidEntitlement = await this.prisma.userExamEntitlement.findFirst({
        where: {
          userId: user.id,
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

      throw new ForbiddenException('Premium subscription required');
    }

    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        expiresAt: { gt: now },
        startsAt: { lte: now },
        planType: { not: 'free' },
      },
    });

    if (!activeSubscription) {
      throw new ForbiddenException('Premium subscription required');
    }

    return true;
  }
}
