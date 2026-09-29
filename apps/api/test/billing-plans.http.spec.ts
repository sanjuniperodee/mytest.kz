import { BILLING_PLANS } from '../src/modules/billing/billing.config';

describe('billing plan price contract', () => {
  it('keeps public prices and checkout amounts in sync', () => {
    expect(
      Object.fromEntries(
        BILLING_PLANS.map((plan) => [
          plan.id,
          {
            priceKzt: plan.priceKzt,
            originalPriceKzt: plan.originalPriceKzt,
            attemptsLimit: plan.attemptsLimit,
          },
        ]),
      ),
    ).toEqual({
      starter: { priceKzt: 490, originalPriceKzt: undefined, attemptsLimit: 1 },
      basic: { priceKzt: 900, originalPriceKzt: 1470, attemptsLimit: 3 },
      pro: { priceKzt: 1490, originalPriceKzt: 2450, attemptsLimit: 5 },
      premium: { priceKzt: 2990, originalPriceKzt: 5890, attemptsLimit: null },
    });
  });
});
