import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { EntitlementStatus, EntitlementTier } from '@prisma/client';
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
          tier: EntitlementTier.paid,
          status: EntitlementStatus.active,
          windowStartsAt: { lte: now },
          OR: [{ windowEndsAt: null }, { windowEndsAt: { gt: now } }],
        },
      });
      if (!paidEntitlement) {
        throw new ForbiddenException('Premium subscription required');
      }
      return true;
    }

    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        expiresAt: { gt: now },
        startsAt: { lte: now },
        planType: { not: 'trial' },
      },
    });

    if (!activeSubscription) {
      throw new ForbiddenException('Premium subscription required');
    }

    return true;
  }
}
