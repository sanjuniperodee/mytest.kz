import { TestSessionService } from '../src/modules/tests/test-session.service';

describe('TestSessionService session filters', () => {
  function serviceWithPrisma(prismaMock: any) {
    return new TestSessionService(
      prismaMock,
      {} as any,
      {} as any,
      {} as any,
      {} as any,
    );
  }

  it('keeps legacy pagination behavior without filters', async () => {
    const prismaMock = {
      testSession: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = serviceWithPrisma(prismaMock);

    await service.getSessions('user-1', 2, 10);

    expect(prismaMock.testSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { userId: 'user-1' },
        skip: 10,
        take: 10,
      }),
    );
    expect(prismaMock.testSession.count).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
    });
  });

  it('filters sessions by examTypeId and status', async () => {
    const prismaMock = {
      testSession: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
      },
    };
    const service = serviceWithPrisma(prismaMock);

    await service.getSessions('user-1', 1, 20, {
      examTypeId: 'exam-ent',
      status: 'completed',
    });

    expect(prismaMock.testSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          userId: 'user-1',
          examTypeId: 'exam-ent',
          status: 'completed',
        },
        skip: 0,
        take: 20,
      }),
    );
    expect(prismaMock.testSession.count).toHaveBeenCalledWith({
      where: {
        userId: 'user-1',
        examTypeId: 'exam-ent',
        status: 'completed',
      },
    });
  });
});
