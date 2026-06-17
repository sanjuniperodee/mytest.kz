import type { ThrottlerStorage } from '@nestjs/throttler';
import type Redis from 'ioredis';

type RedisThrottlerRecord = {
  totalHits: number;
  timeToExpire: number;
  isBlocked: boolean;
  timeToBlockExpire: number;
};

export class RedisThrottlerStorage implements ThrottlerStorage {
  constructor(private readonly redis: Redis) {}

  async increment(
    key: string,
    ttl: number,
    limit: number,
    blockDuration: number,
    throttlerName: string,
  ): Promise<RedisThrottlerRecord> {
    const baseKey = `throttle:${throttlerName}:${key}`;
    const blockKey = `${baseKey}:blocked`;
    const normalizedTtl = Math.max(1, Math.floor(ttl));
    const normalizedBlockDuration = Math.max(1, Math.floor(blockDuration || ttl));

    const currentBlockTtl = await this.redis.pttl(blockKey);
    if (currentBlockTtl > 0) {
      const [hitsRaw, expireTtl] = await Promise.all([
        this.redis.get(baseKey),
        this.redis.pttl(baseKey),
      ]);
      return {
        totalHits: Number(hitsRaw ?? limit + 1),
        timeToExpire: this.toSeconds(expireTtl),
        isBlocked: true,
        timeToBlockExpire: this.toSeconds(currentBlockTtl),
      };
    }

    const hits = await this.redis.incr(baseKey);
    if (hits === 1) {
      await this.redis.pexpire(baseKey, normalizedTtl);
    }

    const timeToExpire = this.toSeconds(await this.redis.pttl(baseKey));
    if (hits > limit) {
      await this.redis.psetex(blockKey, normalizedBlockDuration, '1');
      return {
        totalHits: hits,
        timeToExpire,
        isBlocked: true,
        timeToBlockExpire: this.toSeconds(normalizedBlockDuration),
      };
    }

    return {
      totalHits: hits,
      timeToExpire,
      isBlocked: false,
      timeToBlockExpire: 0,
    };
  }

  private toSeconds(ms: number): number {
    if (ms <= 0) return 0;
    return Math.ceil(ms / 1000);
  }
}
