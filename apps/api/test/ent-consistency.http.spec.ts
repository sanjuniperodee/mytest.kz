import { BadRequestException } from '@nestjs/common';
import { ENT_CONFIG } from '@bilimland/shared';
import { TestScorerService } from '../src/modules/tests/test-scorer.service';
import { TestSessionService } from '../src/modules/tests/test-session.service';
import { UsersService } from '../src/modules/users/users.service';

type EntSectionSeed = {
  subjectId: string;
  slug: string;
  isMandatory: boolean;
  questionCount: number;
  sortOrder: number;
};

const ENT_FULL_SECTIONS: EntSectionSeed[] = [
  { subjectId: 'history', slug: 'history_kz', isMandatory: true, questionCount: 20, sortOrder: 1 },
  { subjectId: 'reading', slug: 'reading_literacy', isMandatory: true, questionCount: 10, sortOrder: 2 },
  { subjectId: 'math-lit', slug: 'math_literacy', isMandatory: true, questionCount: 10, sortOrder: 3 },
  { subjectId: 'profile-1', slug: 'math', isMandatory: false, questionCount: 40, sortOrder: 4 },
  { subjectId: 'profile-2', slug: 'physics', isMandatory: false, questionCount: 40, sortOrder: 5 },
];

function makeQuestionIds(subjectId: string, count: number): string[] {
  return Array.from({ length: count }, (_, idx) => `${subjectId}-q${idx + 1}`);
}

function buildEntFullSessionForScoring(params?: {
  allCorrect?: boolean;
  correctQuestionIds?: Set<string>;
}) {
  const questionOrder: string[] = [];
  const sectionsMeta = ENT_FULL_SECTIONS.map((sec) => ({
    subjectId: sec.subjectId,
    isMandatory: sec.isMandatory,
    questionCount: sec.questionCount,
    sortOrder: sec.sortOrder,
    profileHeavyFrom: sec.isMandatory ? null : 31,
  }));
  const questionIdsBySubject = new Map<string, string[]>();

  const answers: any[] = [];
  for (const sec of ENT_FULL_SECTIONS) {
    const ids = makeQuestionIds(sec.subjectId, sec.questionCount);
    questionIdsBySubject.set(sec.subjectId, ids);
    for (const qid of ids) {
      questionOrder.push(qid);
      const shouldBeCorrect =
        params?.allCorrect === true || (params?.correctQuestionIds?.has(qid) ?? false);
      answers.push({
        id: `ans-${qid}`,
        questionId: qid,
        selectedIds: shouldBeCorrect ? [`opt-${qid}`] : [],
        question: {
          subjectId: sec.subjectId,
          scoreWeight: sec.isMandatory ? null : 5,
          answerOptions: [
            { id: `opt-${qid}`, isCorrect: true },
            { id: `wrong-${qid}`, isCorrect: false },
          ],
          subject: {
            id: sec.subjectId,
            name: sec.slug,
            slug: sec.slug,
            isMandatory: sec.isMandatory,
          },
        },
      });
    }
  }

  return {
    session: {
      id: 'ent-full-session',
      metadata: {
        entScope: 'full',
        sections: sectionsMeta,
        questionOrder,
      },
      examType: { slug: 'ent' },
      answers,
    },
    questionIdsBySubject,
  };
}

function buildGeneratedSections(profile2Count = ENT_CONFIG.profileQuestionsPerSubject) {
  return [
    {
      subjectId: 'history',
      questionIds: makeQuestionIds('history', 20),
      sortOrder: 1,
      profileHeavyFrom: null,
    },
    {
      subjectId: 'reading',
      questionIds: makeQuestionIds('reading', 10),
      sortOrder: 2,
      profileHeavyFrom: null,
    },
    {
      subjectId: 'math-lit',
      questionIds: makeQuestionIds('math-lit', 10),
      sortOrder: 3,
      profileHeavyFrom: null,
    },
    {
      subjectId: 'profile-1',
      questionIds: makeQuestionIds('profile-1', ENT_CONFIG.profileQuestionsPerSubject),
      sortOrder: 4,
      profileHeavyFrom: 31,
    },
    {
      subjectId: 'profile-2',
      questionIds: makeQuestionIds('profile-2', profile2Count),
      sortOrder: 5,
      profileHeavyFrom: 31,
    },
  ];
}

describe('ENT 120/140 consistency', () => {
  it('scores ENT full with fixed 140 max and ignores custom scoreWeight', async () => {
    const prismaMock = {
      testSession: {
        findUnique: jest.fn(),
      },
      testAnswer: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as any;
    const scorer = new TestScorerService(prismaMock);

    const built = buildEntFullSessionForScoring({ allCorrect: true });
    prismaMock.testSession.findUnique.mockResolvedValue(built.session);

    const result = await scorer.calculateScore('ent-full-session');

    expect(result.maxScore).toBe(ENT_CONFIG.maxTotalPoints);
    expect(result.rawScore).toBe(ENT_CONFIG.maxTotalPoints);
    expect(result.correctCount).toBe(ENT_CONFIG.totalQuestions);
    const profileSections = result.sections.filter((s) => s.subjectSlug === 'math' || s.subjectSlug === 'physics');
    expect(profileSections.map((s) => s.maxPoints)).toEqual([50, 50]);
  });

  it('uses 1 point for first 30 profile questions and 2 points from 31st', async () => {
    const prismaMock = {
      testSession: {
        findUnique: jest.fn(),
      },
      testAnswer: {
        update: jest.fn().mockResolvedValue(undefined),
      },
    } as any;
    const scorer = new TestScorerService(prismaMock);

    const all = buildEntFullSessionForScoring();
    const profile1Ids = all.questionIdsBySubject.get('profile-1')!;
    const correctQuestionIds = new Set<string>([profile1Ids[29], profile1Ids[30]]);
    const built = buildEntFullSessionForScoring({ correctQuestionIds });
    prismaMock.testSession.findUnique.mockResolvedValue(built.session);

    const result = await scorer.calculateScore('ent-full-session');

    expect(result.maxScore).toBe(ENT_CONFIG.maxTotalPoints);
    expect(result.rawScore).toBe(3);
    expect(result.correctCount).toBe(2);
  });

  it('starts ENT full with exactly 120 questions and 40 profile questions per subject', async () => {
    const profileSubjects = ['profile-1', 'profile-2'];
    const generatedSections = buildGeneratedSections();
    const subjectMetaById: Record<string, { id: string; slug: string; isMandatory: boolean }> = {
      history: { id: 'history', slug: 'history_kz', isMandatory: true },
      reading: { id: 'reading', slug: 'reading_literacy', isMandatory: true },
      'math-lit': { id: 'math-lit', slug: 'math_literacy', isMandatory: true },
      'profile-1': { id: 'profile-1', slug: 'math', isMandatory: false },
      'profile-2': { id: 'profile-2', slug: 'physics', isMandatory: false },
    };
    const prismaMock = {
      testTemplate: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tpl-ent',
          examTypeId: 'exam-ent',
          durationMins: 240,
          examType: { slug: 'ent' },
          sections: [
            {
              subjectId: 'history',
              questionCount: 20,
              selectionMode: 'random',
              sortOrder: 1,
              subject: subjectMetaById.history,
            },
            {
              subjectId: 'reading',
              questionCount: 10,
              selectionMode: 'random',
              sortOrder: 2,
              subject: subjectMetaById.reading,
            },
            {
              subjectId: 'math-lit',
              questionCount: 10,
              selectionMode: 'random',
              sortOrder: 3,
              subject: subjectMetaById['math-lit'],
            },
          ],
        }),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            isActive: true,
            planType: 'premium',
            startsAt: new Date(Date.now() - 1000),
            expiresAt: new Date(Date.now() + 1000 * 60),
          },
        ]),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      subject: {
        findMany: jest.fn().mockResolvedValue(profileSubjects.map((id) => ({ id }))),
        findUnique: jest.fn().mockImplementation(({ where: { id } }: any) =>
          Promise.resolve({
            ...subjectMetaById[id],
            name: subjectMetaById[id].slug,
          }),
        ),
      },
      testSession: {
        create: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'session-1',
            score: null,
            ...data,
          }),
        ),
      },
    } as any;
    const generatorMock = {
      generateFromTemplate: jest.fn().mockResolvedValue(generatedSections),
    } as any;
    const scorerMock = {} as any;
    const mistakesMock = {} as any;
    const accessMock = {
      assertAndConsumeAttempt: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new TestSessionService(
      prismaMock,
      generatorMock,
      scorerMock,
      mistakesMock,
      accessMock,
    );

    await service.startTest(
      'user-1',
      'tpl-ent',
      'ru',
      profileSubjects,
      'full',
    );

    expect(generatorMock.generateFromTemplate).toHaveBeenCalledWith(
      'tpl-ent',
      profileSubjects,
      ENT_CONFIG.profileQuestionsPerSubject,
      'user-1',
      'ru',
      { entScope: 'full' },
    );
    expect(prismaMock.testSession.create).toHaveBeenCalled();
    const createData = prismaMock.testSession.create.mock.calls[0][0].data;
    expect(createData.totalQuestions).toBe(ENT_CONFIG.totalQuestions);
  });

  it('excludes non-120/140 ENT sessions from profile analytics stats', async () => {
    const entValidFinished = {
      examTypeId: 'exam-ent',
      examType: { id: 'exam-ent', slug: 'ent', name: 'ENT' },
      status: 'completed',
      score: 78.5,
      rawScore: 110,
      maxScore: 140,
      totalQuestions: 120,
      correctCount: 95,
      durationSecs: 6000,
      finishedAt: new Date('2026-04-01T10:00:00.000Z'),
    };
    const entInvalidFinished = {
      examTypeId: 'exam-ent',
      examType: { id: 'exam-ent', slug: 'ent', name: 'ENT' },
      status: 'completed',
      score: 90,
      rawScore: 18,
      maxScore: 20,
      totalQuestions: 20,
      correctCount: 18,
      durationSecs: 900,
      finishedAt: new Date('2026-04-02T10:00:00.000Z'),
    };
    const nuetFinished = {
      examTypeId: 'exam-nuet',
      examType: { id: 'exam-nuet', slug: 'nuet', name: 'NUET' },
      status: 'completed',
      score: 65,
      rawScore: 20,
      maxScore: 30,
      totalQuestions: 30,
      correctCount: 20,
      durationSecs: 2400,
      finishedAt: new Date('2026-04-03T10:00:00.000Z'),
    };
    const entInvalidInProgress = {
      examTypeId: 'exam-ent',
      examType: { id: 'exam-ent', slug: 'ent', name: 'ENT' },
      status: 'in_progress',
      score: null,
      rawScore: null,
      maxScore: null,
      totalQuestions: 20,
      correctCount: null,
      durationSecs: null,
      finishedAt: null,
    };
    const entValidInProgress = {
      examTypeId: 'exam-ent',
      examType: { id: 'exam-ent', slug: 'ent', name: 'ENT' },
      status: 'in_progress',
      score: null,
      rawScore: null,
      maxScore: null,
      totalQuestions: 120,
      correctCount: null,
      durationSecs: null,
      finishedAt: null,
    };

    const prismaMock = {
      testSession: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([entValidFinished, entInvalidFinished, nuetFinished])
          .mockResolvedValueOnce([entInvalidInProgress, entValidInProgress]),
      },
    } as any;
    const accessMock = {
      getUserAccessByExam: jest.fn().mockResolvedValue([
        {
          examTypeId: 'exam-ent',
          examSlug: 'ent',
          hasAccess: true,
          reasonCode: null,
          nextAllowedAt: null,
          hasPaidTier: false,
          total: { used: 1, limit: 2, remaining: 1, isUnlimited: false },
          daily: { used: 0, limit: null, remaining: null, isUnlimited: true, nextResetAt: null },
        },
      ]),
    } as any;
    const users = new UsersService(prismaMock, {} as any, accessMock);

    const stats = await users.getStats('user-1');

    expect(stats.totalTests).toBe(2);
    expect(stats.inProgressSessionsCount).toBe(1);
    const entStats = stats.byExamType.find((r) => r.examSlug === 'ent');
    expect(entStats?.testsCount).toBe(1);
    expect(entStats?.bestMaxScore).toBe(140);
    expect(entStats?.inProgressCount).toBe(1);
  });

  it('returns combined trial status when free attempts and purchased trial both exist', async () => {
    const now = new Date();
    const trialSubStartsAt = new Date(now.getTime() - 60 * 60 * 1000);
    const trialSubExpiresAt = new Date(now.getTime() + 60 * 60 * 1000);
    const prismaMock = {
      user: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'user-1',
          telegramId: BigInt(1001),
          telegramUsername: 'u1',
          phone: '+77001112233',
          firstName: 'User',
          lastName: 'One',
          preferredLanguage: 'ru',
          isAdmin: false,
          isChannelMember: true,
          channelCheckedAt: now,
          entTrialUsed: 1,
        }),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            id: 'sub-trial',
            userId: 'user-1',
            isActive: true,
            planType: 'trial',
            startsAt: trialSubStartsAt,
            expiresAt: trialSubExpiresAt,
          },
        ]),
      },
      testSession: {
        count: jest.fn().mockResolvedValue(0),
      },
    } as any;
    const accessMock = {
      getUserAccessByExam: jest.fn().mockResolvedValue([
        {
          examTypeId: 'exam-ent',
          examSlug: 'ent',
          hasAccess: true,
          reasonCode: null,
          nextAllowedAt: null,
          hasPaidTier: false,
          total: { used: 0, limit: 2, remaining: 2, isUnlimited: false },
          daily: { used: 0, limit: null, remaining: null, isUnlimited: true, nextResetAt: null },
        },
      ]),
    } as any;
    const users = new UsersService(prismaMock, {} as any, accessMock);

    const profile = await users.getProfile('user-1');
    const ent = profile?.trialStatus?.ent;

    expect(profile?.hasActiveSubscription).toBe(false);
    expect(ent?.freeRemaining).toBe(1);
    expect(ent?.paidTrialRemaining).toBe(1);
    expect(ent?.totalRemaining).toBe(2);
    expect(ent?.exhausted).toBe(false);
  });

  it('rejects ENT full start when generated composition is not exactly 120', async () => {
    const generatedSections = buildGeneratedSections(39);
    const subjectMetaById: Record<string, { id: string; slug: string; isMandatory: boolean }> = {
      history: { id: 'history', slug: 'history_kz', isMandatory: true },
      reading: { id: 'reading', slug: 'reading_literacy', isMandatory: true },
      'math-lit': { id: 'math-lit', slug: 'math_literacy', isMandatory: true },
      'profile-1': { id: 'profile-1', slug: 'math', isMandatory: false },
      'profile-2': { id: 'profile-2', slug: 'physics', isMandatory: false },
    };
    const prismaMock = {
      testTemplate: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'tpl-ent',
          examTypeId: 'exam-ent',
          durationMins: 240,
          examType: { slug: 'ent' },
          sections: [
            {
              subjectId: 'history',
              questionCount: 20,
              selectionMode: 'random',
              sortOrder: 1,
              subject: subjectMetaById.history,
            },
            {
              subjectId: 'reading',
              questionCount: 10,
              selectionMode: 'random',
              sortOrder: 2,
              subject: subjectMetaById.reading,
            },
            {
              subjectId: 'math-lit',
              questionCount: 10,
              selectionMode: 'random',
              sortOrder: 3,
              subject: subjectMetaById['math-lit'],
            },
          ],
        }),
      },
      subscription: {
        findMany: jest.fn().mockResolvedValue([
          {
            isActive: true,
            planType: 'premium',
            startsAt: new Date(Date.now() - 1000),
            expiresAt: new Date(Date.now() + 1000 * 60),
          },
        ]),
      },
      user: {
        updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      },
      subject: {
        findMany: jest
          .fn()
          .mockResolvedValue([{ id: 'profile-1' }, { id: 'profile-2' }]),
        findUnique: jest.fn().mockImplementation(({ where: { id } }: any) =>
          Promise.resolve({
            ...subjectMetaById[id],
            name: subjectMetaById[id].slug,
          }),
        ),
      },
      testSession: {
        create: jest.fn(),
      },
    } as any;
    const generatorMock = {
      generateFromTemplate: jest.fn().mockResolvedValue(generatedSections),
    } as any;
    const scorerMock = {} as any;
    const mistakesMock = {} as any;
    const accessMock = {
      assertAndConsumeAttempt: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new TestSessionService(
      prismaMock,
      generatorMock,
      scorerMock,
      mistakesMock,
      accessMock,
    );

    await expect(
      service.startTest('user-1', 'tpl-ent', 'ru', ['profile-1', 'profile-2'], 'full'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prismaMock.testSession.create).not.toHaveBeenCalled();
  });
});
