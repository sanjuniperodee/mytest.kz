import { UsersService } from '../src/modules/users/users.service';

describe('UsersService stats activity rows', () => {
  it('includes exams with in-progress-only sessions', async () => {
    const prismaMock = {
      testSession: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([])
          .mockResolvedValueOnce([
            {
              examTypeId: 'exam-nuet',
              examType: { id: 'exam-nuet', slug: 'nuet', name: 'NUET' },
              status: 'in_progress',
              score: null,
              rawScore: null,
              maxScore: null,
              totalQuestions: 30,
              correctCount: null,
              durationSecs: null,
              finishedAt: null,
            },
          ]),
      },
    } as any;
    const service = new UsersService(prismaMock, {} as any, {} as any);

    const result = await service.getStats('user-1');

    expect(result.byExamType).toHaveLength(1);
    expect(result.byExamType[0]).toMatchObject({
      examTypeId: 'exam-nuet',
      examSlug: 'nuet',
      testsCount: 0,
      totalSessionsCount: 1,
      inProgressCount: 1,
    });
  });
});
