import { CanActivate, ExecutionContext, ForbiddenException, Inject, Injectable, Optional } from '@nestjs/common';
import type Redis from 'ioredis';
import { REDIS_CLIENT } from '../../database/redis.module';
import { PremiumGuard } from './premium.guard';

/** Сколько объяснений в одном тесте открываем бесплатно — чтобы человек увидел, за что платить. */
export const FREE_EXPLANATIONS_PER_SESSION = 3;
const TTL_SECONDS = 60 * 60 * 24 * 60;

export type FreeExplanationInfo = { used: number; limit: number; remaining: number };

/**
 * Объяснения к вопросам — платная функция. Без подписки даём попробовать: первые
 * FREE_EXPLANATIONS_PER_SESSION разных вопросов одного теста открываются бесплатно
 * (повторное открытие того же вопроса лимит не тратит). Дальше — тот же отказ
 * PREMIUM_REQUIRED, что и у PremiumGuard, поэтому клиенты показывают прежний пейволл.
 */
@Injectable()
export class ExplanationAccessGuard implements CanActivate {
  constructor(
    private readonly premium: PremiumGuard,
    @Optional() @Inject(REDIS_CLIENT) private readonly redis?: Redis,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    try {
      return await this.premium.canActivate(context);
    } catch (error) {
      if (!(error instanceof ForbiddenException) || !this.redis) throw error;
      const request = context.switchToHttp().getRequest();
      const userId: unknown = request.user?.id;
      const sessionId: unknown = request.params?.id;
      const questionId: unknown = request.params?.questionId;
      if (typeof userId !== 'string' || typeof sessionId !== 'string' || typeof questionId !== 'string') throw error;

      const key = `free-explanations:${userId}:${sessionId}`;
      const already = await this.redis.sismember(key, questionId);
      if (!already) {
        const used = await this.redis.scard(key);
        if (used >= FREE_EXPLANATIONS_PER_SESSION) throw error;
        await this.redis.multi().sadd(key, questionId).expire(key, TTL_SECONDS).exec();
      }
      const used = await this.redis.scard(key);
      const info: FreeExplanationInfo = {
        used,
        limit: FREE_EXPLANATIONS_PER_SESSION,
        remaining: Math.max(0, FREE_EXPLANATIONS_PER_SESSION - used),
      };
      request.freeExplanation = info;
      return true;
    }
  }
}
