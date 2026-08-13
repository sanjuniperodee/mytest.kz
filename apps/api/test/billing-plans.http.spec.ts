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
      starter: { priceKzt: 750, originalPriceKzt: undefined, attemptsLimit: 1 },
      basic: { priceKzt: 1800, originalPriceKzt: 2250, attemptsLimit: 3 },
      pro: { priceKzt: 2990, originalPriceKzt: 3750, attemptsLimit: 5 },
      premium: { priceKzt: 5890, originalPriceKzt: 9000, attemptsLimit: null },
    });
  });
});
