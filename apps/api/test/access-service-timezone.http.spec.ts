import { AccessService } from '../src/modules/subscriptions/access.service';

describe('AccessService timezone updates', () => {
  it('does not apply timezone cooldown when timezone is unchanged', async () => {
    const changedAt = new Date();
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          timezone: 'Asia/Almaty',
          timezoneChangedAt: changedAt,
        }),
      },
      $transaction: jest.fn(),
    } as any;
    const cfg = { get: jest.fn().mockReturnValue(undefined) } as any;
    const service = new AccessService(prismaMock, cfg);

    const result = await service.updateUserTimezone('user-1', 'Asia/Almaty');

    expect(result).toEqual({
      timezone: 'Asia/Almaty',
      timezoneChangedAt: changedAt,
    });
    expect(prismaMock.$transaction).not.toHaveBeenCalled();
  });
});
