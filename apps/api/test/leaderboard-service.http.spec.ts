import { ENT_CONFIG } from '@bilimland/shared';
import { LeaderboardService } from '../src/modules/leaderboard/leaderboard.service';

const session = (overrides: Record<string, unknown>) => ({
  id: 'session',
  userId: 'user',
  rawScore: 100,
  maxScore: ENT_CONFIG.maxTotalPoints,
  score: 71.43,
  durationSecs: 6000,
  finishedAt: new Date('2026-04-01T10:00:00.000Z'),
  user: {
    firstName: 'User',
    lastName: 'Name',
    telegramUsername: 'user_name',
  },
  ...overrides,
});

describe('LeaderboardService', () => {
  it('queries only eligible full ENT sessions', async () => {
    const prismaMock = {
      testSession: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
    const service = new LeaderboardService(prismaMock);

    await service.getEntLeaderboard('user-1');

    expect(prismaMock.testSession.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          status: { in: ['completed', 'timed_out'] },
          totalQuestions: ENT_CONFIG.totalQuestions,
          rawScore: { not: null },
          maxScore: ENT_CONFIG.maxTotalPoints,
          examType: { slug: 'ent' },
        },
      }),
    );
  });

  it('keeps the best result per user and tie-breaks by duration then finish date', async () => {
    const prismaMock = {
      testSession: {
        findMany: jest.fn().mockResolvedValue([
          session({
            id: 'u1-old',
            userId: 'user-1',
            rawScore: 119,
            durationSecs: 6200,
            finishedAt: new Date('2026-04-01T10:00:00.000Z'),
          }),
          session({
            id: 'u1-best',
            userId: 'user-1',
            rawScore: 121,
            durationSecs: 6400,
            finishedAt: new Date('2026-04-02T10:00:00.000Z'),
          }),
          session({
            id: 'u2-fast',
            userId: 'user-2',
            rawScore: 121,
            durationSecs: 6100,
            finishedAt: new Date('2026-04-03T10:00:00.000Z'),
          }),
          session({
            id: 'u3-earlier',
            userId: 'user-3',
            rawScore: 121,
            durationSecs: 6100,
            finishedAt: new Date('2026-04-01T09:00:00.000Z'),
          }),
        ]),
      },
    } as any;
    const service = new LeaderboardService(prismaMock);

    const result = await service.getEntLeaderboard('user-1');

    expect(result.items.map((row) => row.sessionId)).toEqual([
      'u3-earlier',
      'u2-fast',
      'u1-best',
    ]);
    expect(result.me).toMatchObject({ rank: 3, sessionId: 'u1-best' });
  });

  it('returns me null when the current user has no eligible result', async () => {
    const prismaMock = {
      testSession: {
        findMany: jest.fn().mockResolvedValue([
          session({ id: 'other', userId: 'other-user' }),
        ]),
      },
    } as any;
    const service = new LeaderboardService(prismaMock);

    const result = await service.getEntLeaderboard('missing-user');

    expect(result.me).toBeNull();
  });
});
