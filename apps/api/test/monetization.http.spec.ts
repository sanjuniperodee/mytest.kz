import { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import {
  DEFAULT_MONETIZATION_CONFIG,
  normalizeMonetizationConfig,
  toBillingPlanDto,
  toPublicMonetizationConfig,
  validateMonetizationConfig,
} from '@bilimland/shared';
import { PremiumGuard } from '../src/common/guards/premium.guard';
import { PremiumFeature } from '../src/common/decorators/premium-feature.decorator';
import { MonetizationService } from '../src/modules/subscriptions/monetization.service';
import { staticMonetization } from './helpers/monetization';

describe('monetization config contract', () => {
  it('keeps default prices and limits (what users see before the admin saves anything)', () => {
    const defaults = normalizeMonetizationConfig(null);
    expect(
      Object.fromEntries(
        defaults.plans.map((plan) => [
          plan.code,
          { priceKzt: plan.priceKzt, originalPriceKzt: plan.originalPriceKzt, attemptsLimit: plan.attemptsLimit },
        ]),
      ),
    ).toEqual({
      starter: { priceKzt: 490, originalPriceKzt: null, attemptsLimit: 1 },
      basic: { priceKzt: 900, originalPriceKzt: 1470, attemptsLimit: 3 },
      pro: { priceKzt: 1490, originalPriceKzt: 2450, attemptsLimit: 5 },
      premium: { priceKzt: 2990, originalPriceKzt: 5890, attemptsLimit: null },
    });
    expect(defaults.freeTier).toEqual({ enabled: true, dailyEntAttempts: 1 });
    expect(defaults.premiumFeatures.aiCoach).toBe(true);
    expect(validateMonetizationConfig(defaults)).toEqual([]);
  });

  it('keeps the mobile-compatible /billing/plans shape', () => {
    const premium = DEFAULT_MONETIZATION_CONFIG.plans.find((p) => p.code === 'premium')!;
    expect(toBillingPlanDto(premium, 'ru')).toEqual({
      id: 'premium',
      name: 'Месяц без лимита',
      description: expect.any(String),
      priceKzt: 2990,
      originalPriceKzt: 5890,
      durationDays: 30,
      highlight: 'популярно',
      features: expect.arrayContaining(['AI-разбор ошибок']),
      attemptsLimit: null,
      dailyLimit: null,
    });
  });

  it('never turns a plan with a missing limit into an unlimited one', () => {
    const config = normalizeMonetizationConfig({ plans: [{ code: 'school', name: 'Школа', priceKzt: 100, durationDays: 10 }] });
    expect(config.plans[0].attemptsLimit).toBe(1);
  });

  it('rejects broken configs with field paths for the admin form', () => {
    const config = normalizeMonetizationConfig({
      freeTier: { enabled: true, dailyEntAttempts: 99 },
      plans: [
        { code: 'basic', name: { ru: 'A', kk: '' }, priceKzt: 900, durationDays: 30, attemptsLimit: 3, dailyLimit: null },
        { code: 'free', name: { ru: 'B', kk: '' }, priceKzt: 0, durationDays: 30, attemptsLimit: 3, dailyLimit: null, originalPriceKzt: 0 },
      ],
      ads: { enabled: true, adsenseClientId: '', slots: { results: 'abc' } },
    });
    const paths = validateMonetizationConfig(config).map((e) => e.path);
    expect(paths).toEqual(
      expect.arrayContaining([
        'freeTier.dailyEntAttempts',
        'plans.1.code',
        'plans.1.priceKzt',
        'ads.adsenseClientId',
        'ads.slots.results',
      ]),
    );
  });

  it('publishes only plans on sale and hides ads until a publisher id is set', () => {
    const config = normalizeMonetizationConfig({
      plans: [
        { code: 'basic', name: { ru: 'A', kk: 'Ә' }, priceKzt: 900, durationDays: 30, attemptsLimit: 3, dailyLimit: null, isActive: true },
        { code: 'old', name: { ru: 'Old', kk: '' }, priceKzt: 500, durationDays: 30, attemptsLimit: 1, dailyLimit: null, isActive: false },
      ],
      ads: { enabled: true, adsenseClientId: '' },
    });
    const pub = toPublicMonetizationConfig(config, 'kk');
    expect(pub.plans.map((p) => p.id)).toEqual(['basic']);
    expect(pub.plans[0].name).toBe('Ә');
    expect(pub.ads.enabled).toBe(false);
  });
});

function adminTx(stored: unknown, usage = { orders: 0, subscriptions: 0 }) {
  return {
    siteSetting: {
      findUnique: jest.fn().mockResolvedValue(stored ? { key: 'monetization', value: stored } : null),
      upsert: jest.fn().mockResolvedValue({}),
    },
    adminAudit: { create: jest.fn().mockResolvedValue({}) },
    paymentOrder: { count: jest.fn().mockResolvedValue(usage.orders) },
    subscription: { count: jest.fn().mockResolvedValue(usage.subscriptions) },
  };
}

describe('MonetizationService.update', () => {
  const defaults = normalizeMonetizationConfig(null);

  it('saves, audits and serves the new config immediately', async () => {
    const tx = adminTx(null);
    const service = new MonetizationService({ $transaction: (cb: any) => cb(tx) } as any);
    const next = { ...defaults, freeTier: { enabled: true, dailyEntAttempts: 2 } };

    const saved = await service.update('admin-1', next);

    expect(saved.freeTier.dailyEntAttempts).toBe(2);
    expect(saved.updatedAt).toEqual(expect.any(String));
    expect(tx.adminAudit.create).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ action: 'update_monetization' }) }),
    );
    expect(service.freeDailyEntAttempts()).toBe(2);
  });

  it('refuses to delete a plan that was already sold', async () => {
    const tx = adminTx({ ...defaults, updatedAt: null }, { orders: 3, subscriptions: 2 });
    const service = new MonetizationService({ $transaction: (cb: any) => cb(tx) } as any);
    const next = { ...defaults, plans: defaults.plans.filter((p) => p.code !== 'starter') };

    await expect(service.update('admin-1', next)).rejects.toMatchObject({
      response: { code: 'MONETIZATION_INVALID' },
    });
    expect(tx.siteSetting.upsert).not.toHaveBeenCalled();
  });

  it('rejects a save made on top of a stale version', async () => {
    const tx = adminTx({ ...defaults, updatedAt: '2026-10-01T00:00:00.000Z' });
    const service = new MonetizationService({ $transaction: (cb: any) => cb(tx) } as any);

    await expect(service.update('admin-1', { ...defaults, updatedAt: null })).rejects.toMatchObject({
      response: { code: 'MONETIZATION_STALE' },
    });
  });

  it('prefers the purchase snapshot over the current catalog for plan terms', () => {
    const service = staticMonetization();
    expect(service.planTerms({ planType: 'basic' })?.attemptsLimit).toBe(3);
    expect(
      service.planTerms({
        planType: 'basic',
        planSnapshot: { code: 'basic', name: 'x', priceKzt: 1, durationDays: 7, attemptsLimit: 10, dailyLimit: 2 },
      }),
    ).toMatchObject({ attemptsLimit: 10, dailyLimit: 2, durationDays: 7 });
    expect(service.planTerms({ planType: 'unknown-legacy' })).toBeNull();
  });
});

describe('PremiumGuard with configurable premium features', () => {
  class Controller {
    @PremiumFeature('explanations')
    explanation() {}

    @PremiumFeature('aiCoach')
    analyze() {}
  }

  function context(handler: () => void): ExecutionContext {
    return {
      switchToHttp: () => ({ getRequest: () => ({ user: { id: 'user-1' }, params: {}, body: {} }) }),
      getHandler: () => handler,
      getClass: () => Controller,
    } as unknown as ExecutionContext;
  }

  const prisma = {
    userExamEntitlement: { findFirst: jest.fn().mockResolvedValue(null) },
    subscription: { findFirst: jest.fn().mockResolvedValue(null) },
    attemptUsageLedger: { findFirst: jest.fn().mockResolvedValue(null) },
    testSession: { findFirst: jest.fn().mockResolvedValue(null) },
  } as any;
  const access = { isV2Enabled: () => true } as any;

  it('lets everyone in when the admin made the feature free', async () => {
    const guard = new PremiumGuard(
      prisma,
      access,
      staticMonetization({ premiumFeatures: { explanations: false } }),
      new Reflector(),
    );
    await expect(guard.canActivate(context(Controller.prototype.explanation))).resolves.toBe(true);
  });

  it('keeps AI analysis behind a subscription', async () => {
    const guard = new PremiumGuard(
      prisma,
      access,
      staticMonetization({ premiumFeatures: { explanations: false } }),
      new Reflector(),
    );
    await expect(guard.canActivate(context(Controller.prototype.analyze))).rejects.toMatchObject({
      response: { message: 'Premium subscription required', code: 'PREMIUM_REQUIRED', feature: 'aiCoach' },
    });
  });
});
