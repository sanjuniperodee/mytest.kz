  import { freedomPaySign, freedomPayVerifySignature } from '../src/modules/billing/freedompay-signature';

describe('FreedomPay signature', () => {
  it('generates deterministic md5 signature for sorted fields', () => {
    const sig = freedomPaySign(
      'init_payment.php',
      {
        pg_order_id: '23',
        pg_merchant_id: '12345',
        pg_amount: '25',
        pg_description: 'test',
        pg_salt: 'abc',
      },
      'secret',
    );
    expect(sig).toBe('318f9e53b34234e174afc3a272acc958');
  });

  it('verifies callback signature and ignores pg_sig in payload body', () => {
    const payload = {
      pg_order_id: 'order-1',
      pg_result: '1',
      pg_status: 'ok',
      pg_salt: 'salt',
    } as Record<string, string>;
    const pg_sig = freedomPaySign('callback', payload, 'secret-key');

    expect(
      freedomPayVerifySignature(
        'callback',
        { ...payload, pg_sig },
        'secret-key',
      ),
    ).toBe(true);
    expect(
      freedomPayVerifySignature(
        'callback',
        { ...payload, pg_sig },
        'wrong-key',
      ),
    ).toBe(false);
  });
});
