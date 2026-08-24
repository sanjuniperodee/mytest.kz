import { InternalServerErrorException } from '@nestjs/common';
import { BillingService } from '../src/modules/billing/billing.service';

function makeService(configValues: Record<string, string> = {}) {
  const config = { get: jest.fn((key: string) => configValues[key]) };
  return new BillingService(
    { paymentOrder: { findUnique: jest.fn() } } as any,
    config as any,
    { syncSubscriptionEntitlements: jest.fn() } as any,
    {} as any,
    { recordEvent: jest.fn() } as any,
  );
}

describe('store billing contract', () => {
  it('maps every released App Store and Google Play product to the current API plan', () => {
    const service = makeService() as any;
    expect(service.mapStoreProductToPlan('com.sanjuniperodee.mobile.premium.trial')).toBe('starter');
    expect(service.mapStoreProductToPlan('com.sanjuniperodee.mobile.premium.week')).toBe('basic');
    expect(service.mapStoreProductToPlan('com.sanjuniperodee.mobile.premium.annual')).toBe('pro');
    expect(service.mapStoreProductToPlan('com.sanjuniperodee.mobile.premium.month')).toBe('premium');
    expect(service.mapStoreProductToPlan('com.example.untrusted')).toBe('');
  });

  it('supports an explicit product map without accepting unmapped products', () => {
    const service = makeService({
      STORE_PRODUCT_PLAN_MAP: JSON.stringify({ 'com.example.starter': 'starter' }),
    }) as any;
    expect(service.mapStoreProductToPlan('com.example.starter')).toBe('starter');
    expect(service.mapStoreProductToPlan('com.example.other')).toBe('');
  });

  it('fails closed when Google Play server credentials are absent', async () => {
    const service = makeService();
    await expect(service.verifyStorePurchase('user-id', {
      platform: 'android',
      productId: 'com.sanjuniperodee.mobile.premium.trial',
      purchaseToken: 'purchase-token-long-enough',
    })).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
