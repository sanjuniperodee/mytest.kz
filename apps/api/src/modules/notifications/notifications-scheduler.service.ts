import { Inject, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';
import { NotificationsService } from './notifications.service';

@Injectable()
export class NotificationsSchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsSchedulerService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private notifications: NotificationsService,
    @Inject(REDIS_CLIENT) private redis: Redis,
  ) {}

  async onModuleInit() {
    await this.notifications.ensureDefaultCampaigns();
    if (!this.notifications.isEnabled()) {
      this.logger.warn('Lifecycle notifications are disabled by NOTIFICATIONS_ENABLED');
      return;
    }

    const intervalMs = this.notifications.getPollIntervalMinutes() * 60_000;
    this.timer = setInterval(() => {
      void this.tick();
    }, intervalMs);
    this.timer.unref?.();

    setTimeout(() => {
      void this.tick();
    }, 10_000).unref?.();
  }

  onModuleDestroy() {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private async tick() {
    if (this.running) return;
    this.running = true;
    const token = `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
    const ttlMs = Math.max(
      60_000,
      this.notifications.getPollIntervalMinutes() * 60_000 - 5_000,
    );

    try {
      const acquired = await this.redis.set(
        'notifications:scheduler:lock',
        token,
        'PX',
        ttlMs,
        'NX',
      );
      if (acquired !== 'OK') return;
      await this.notifications.runAutomation('scheduler');
    } catch (error) {
      this.logger.error(`Notification scheduler tick failed: ${error}`);
    } finally {
      await this.releaseLock(token);
      this.running = false;
    }
  }

  private async releaseLock(token: string) {
    try {
      await this.redis.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        'notifications:scheduler:lock',
        token,
      );
    } catch (error) {
      this.logger.warn(`Could not release notification scheduler lock: ${error}`);
    }
  }
}
