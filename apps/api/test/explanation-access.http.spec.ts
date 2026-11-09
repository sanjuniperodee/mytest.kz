import { ForbiddenException, type ExecutionContext } from '@nestjs/common';
import {
  ExplanationAccessGuard,
  FREE_EXPLANATIONS_PER_SESSION,
} from '../src/common/guards/explanation-access.guard';

function fakeRedis() {
  const sets = new Map<string, Set<string>>();
  const get = (k: string) => sets.get(k) ?? sets.set(k, new Set()).get(k)!;
  return {
    sismember: jest.fn(async (k: string, v: string) => (get(k).has(v) ? 1 : 0)),
    scard: jest.fn(async (k: string) => get(k).size),
    multi: jest.fn(() => {
      const ops: Array<() => void> = [];
      const chain = {
        sadd: (k: string, v: string) => {
          ops.push(() => get(k).add(v));
          return chain;
        },
        expire: () => chain,
        exec: async () => {
          ops.forEach((op) => op());
          return [];
        },
      };
      return chain;
    }),
  };
}

function ctx(request: Record<string, unknown>): ExecutionContext {
  return { switchToHttp: () => ({ getRequest: () => request }) } as unknown as ExecutionContext;
}

const denied = () =>
  new ForbiddenException({ message: 'Premium subscription required', code: 'PREMIUM_REQUIRED' });

describe('free explanations per test', () => {
  it('lets subscribers through without touching the free allowance', async () => {
    const redis = fakeRedis();
    const guard = new ExplanationAccessGuard({ canActivate: jest.fn().mockResolvedValue(true) } as any, redis as any);
    const request: any = { user: { id: 'u1' }, params: { id: 's1', questionId: 'q1' } };
    await expect(guard.canActivate(ctx(request))).resolves.toBe(true);
    expect(request.freeExplanation).toBeUndefined();
    expect(redis.scard).not.toHaveBeenCalled();
  });

  it('opens the first three different questions for free, then returns the premium error', async () => {
    const redis = fakeRedis();
    const guard = new ExplanationAccessGuard({ canActivate: jest.fn().mockRejectedValue(denied()) } as any, redis as any);
    const open = (questionId: string) => {
      const request: any = { user: { id: 'u1' }, params: { id: 's1', questionId } };
      return guard.canActivate(ctx(request)).then(() => request.freeExplanation);
    };

    await expect(open('q1')).resolves.toEqual({ used: 1, limit: FREE_EXPLANATIONS_PER_SESSION, remaining: 2 });
    await expect(open('q2')).resolves.toEqual(expect.objectContaining({ used: 2, remaining: 1 }));
    // Re-opening an already unlocked question doesn't spend the allowance.
    await expect(open('q1')).resolves.toEqual(expect.objectContaining({ used: 2, remaining: 1 }));
    await expect(open('q3')).resolves.toEqual(expect.objectContaining({ used: 3, remaining: 0 }));
    await expect(open('q4')).rejects.toBeInstanceOf(ForbiddenException);
    // A different test has its own allowance.
    const other: any = { user: { id: 'u1' }, params: { id: 's2', questionId: 'q4' } };
    await expect(guard.canActivate(ctx(other))).resolves.toBe(true);
  });

  it('keeps the premium error when Redis is unavailable', async () => {
    const guard = new ExplanationAccessGuard({ canActivate: jest.fn().mockRejectedValue(denied()) } as any, undefined);
    const request: any = { user: { id: 'u1' }, params: { id: 's1', questionId: 'q1' } };
    await expect(guard.canActivate(ctx(request))).rejects.toBeInstanceOf(ForbiddenException);
  });
});
