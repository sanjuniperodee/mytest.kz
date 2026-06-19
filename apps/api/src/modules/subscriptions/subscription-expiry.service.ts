import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { EntitlementStatus } from '@prisma/client';
import { PrismaService } from '../../database/prisma.service';
import { AccessService } from './access.service';

// Runs every hour: deactivates expired subscriptions and syncs entitlements.
@Injectable()
export class SubscriptionExpiryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SubscriptionExpiryService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prisma: PrismaService,
    private readonly accessService: AccessService,
  ) {}

  onModuleInit() {
    // Run once shortly after startup, then every hour.
    const startDelay = 30_000; // 30 seconds
    const intervalMs = 60 * 60 * 1000; // 1 hour

    setTimeout(() => {
      void this.tick();
      this.timer = setInterval(() => void this.tick(), intervalMs);
      this.timer.unref?.();
    }, startDelay);
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.expireSubscriptions();
      await this.fixStaleEntitlements();
    } catch (err) {
      this.logger.error('Subscription expiry tick failed', err);
    } finally {
      this.running = false;
    }
  }

  private async expireSubscriptions() {
    const now = new Date();

    // Find active subscriptions that have passed their expiry date.
    const stale = await this.prisma.subscription.findMany({
      where: {
        isActive: true,
        expiresAt: { lte: now },
      },
      select: { id: true, planType: true },
    });

    if (stale.length === 0) return;

    const ids = stale.map((s) => s.id);
    await this.prisma.subscription.updateMany({
      where: { id: { in: ids } },
      data: { isActive: false },
    });

    this.logger.log(`Deactivated ${stale.length} expired subscription(s)`);

    // Sync entitlements for each — this sets their status to 'expired'.
    await Promise.allSettled(
      ids.map((id) => this.accessService.syncSubscriptionEntitlements(id)),
    );
  }

  private async fixStaleEntitlements() {
    const now = new Date();

    // Entitlements whose window has passed but status is still 'active'.
    const result = await this.prisma.userExamEntitlement.updateMany({
      where: {
        status: EntitlementStatus.active,
        windowEndsAt: { not: null, lte: now },
      },
      data: {
        status: EntitlementStatus.expired,
        exhaustedAt: now,
      },
    });

    if (result.count > 0) {
      this.logger.log(`Fixed ${result.count} stale active entitlement(s) → expired`);
    }
  }
}
