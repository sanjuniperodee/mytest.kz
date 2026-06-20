import { HttpException, HttpStatus, Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';

export type AiCallKind = 'analyze' | 'lesson' | 'explain' | 'classify' | 'taxonomy';

// Relative DeepSeek cost in "credits" per real generation (cache misses / forces only).
const KIND_COST: Record<AiCallKind, number> = {
  analyze: 3,
  lesson: 5,
  explain: 1,
  classify: 1, // one batch of question→theme classification
  taxonomy: 2, // one-time theme list for a subject
};

const DAY_TTL_SECS = 60 * 60 * 40; // ~40h — covers the day bucket + clock skew.

/**
 * Daily DeepSeek spend guard. Two ceilings, both in Redis, both reset daily:
 *   - per-user budget   → stops one student from draining the AI budget
 *   - global budget     → hard safety net across ALL users (protects total spend)
 *
 * Credits are reserved ONLY when an actual DeepSeek call is about to happen
 * (cache hits and stored reads cost nothing). On Redis failure we fail OPEN and
 * log — the per-minute ThrottlerGuard still bounds bursts, so a Redis blip never
 * blocks paying users.
 */
@Injectable()
export class AiQuotaService {
  private readonly logger = new Logger(AiQuotaService.name);
  private readonly userDailyBudget: number;
  private readonly globalDailyBudget: number;

  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    private readonly config: ConfigService,
  ) {
    this.userDailyBudget =
      Number(this.config.get<string>('AI_DAILY_USER_BUDGET')) || 40;
    this.globalDailyBudget =
      Number(this.config.get<string>('AI_DAILY_GLOBAL_BUDGET')) || 4000;
  }

  /** Reserve credits for an imminent DeepSeek call. Throws 429/503 when over budget. */
  async reserve(userId: string, kind: AiCallKind): Promise<void> {
    const cost = KIND_COST[kind];
    const day = this.dayBucket();
    const userKey = `ai:budget:u:${userId}:${day}`;
    const globalKey = `ai:budget:g:${day}`;

    let userTotal: number;
    try {
      userTotal = await this.redis.incrby(userKey, cost);
      if (userTotal === cost) await this.redis.expire(userKey, DAY_TTL_SECS);
    } catch (err) {
      // Redis unavailable → fail open (Throttler still caps bursts).
      this.logger.warn(`AI quota check skipped (redis): ${errMsg(err)}`);
      return;
    }

    if (userTotal > this.userDailyBudget) {
      await this.safeDecr(userKey, cost);
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          error: 'Too Many Requests',
          code: 'AI_DAILY_LIMIT',
          message: 'AI_DAILY_LIMIT',
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    let globalTotal: number;
    try {
      globalTotal = await this.redis.incrby(globalKey, cost);
      if (globalTotal === cost) await this.redis.expire(globalKey, DAY_TTL_SECS);
    } catch (err) {
      this.logger.warn(`AI global quota check skipped (redis): ${errMsg(err)}`);
      return;
    }

    if (globalTotal > this.globalDailyBudget) {
      await this.safeDecr(globalKey, cost);
      await this.safeDecr(userKey, cost); // roll back the user reservation too
      this.logger.error(
        `Global AI daily budget exhausted (${globalTotal}/${this.globalDailyBudget})`,
      );
      throw new HttpException(
        {
          statusCode: HttpStatus.SERVICE_UNAVAILABLE,
          error: 'Service Unavailable',
          code: 'AI_BUSY',
          message: 'AI_BUSY',
        },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }

  private async safeDecr(key: string, by: number): Promise<void> {
    try {
      await this.redis.decrby(key, by);
    } catch {
      /* best-effort rollback */
    }
  }

  /** Calendar day in Asia/Almaty so the reset lines up with the user's day. */
  private dayBucket(): string {
    return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Almaty' }).format(
      new Date(),
    );
  }
}

function errMsg(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}
