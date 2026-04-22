import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(private prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    const activeSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: user.id,
        isActive: true,
        expiresAt: { gt: new Date() },
        startsAt: { lte: new Date() },
        planType: { not: 'trial' },
      },
    });

    if (!activeSubscription) {
      throw new ForbiddenException('Premium subscription required');
    }

    return true;
  }
}
