import { TestSessionService } from '../src/modules/tests/test-session.service';
import { toSessionQuestionPayload } from '../src/modules/tests/session-question-payload';

/**
 * Explanations are a paid feature (`GET /tests/sessions/:id/review/:questionId/explanation`,
 * PremiumGuard `explanations`). The session and review payloads, which free users get too,
 * must never contain the explanation text — only `hasExplanation` and the image URLs the
 * explanation embeds.
 */

const SECRET_RU = 'Разбор: секретное объяснение';
const SECRET_KK = 'Талдау: құпия түсіндірме';

function questionRow(id: string, explanation: unknown, imageUrls: unknown = []) {
  // Full DB row, as the old `include` returned it — the service must not pass it through.
  return {
    id,
    topicId: 'topic-1',
    subjectId: 'subj-1',
    examTypeId: 'exam-1',
    difficulty: 2,
    type: 'single_choice',
    content: { ru: { text: `Вопрос ${id}` } },
    explanation,
    imageUrls,
    metadata: { contentLocale: 'ru' },
    scoreWeight: 1,
    isActive: true,
    subject: { id: 'subj-1', name: { ru: 'Математика' }, slug: 'math' },
    answerOptions: [
      { id: `${id}-a`, content: { ru: 'A' }, sortOrder: 1, isCorrect: true },
      { id: `${id}-b`, content: { ru: 'B' }, sortOrder: 2, isCorrect: false },
    ],
  };
}

function sessionRow(status: string) {
  return {
    id: 'sess-1',
    userId: 'free-user',
    status,
    templateId: null,
    examTypeId: 'exam-1',
    startedAt: new Date(),
    finishedAt: status === 'in_progress' ? null : new Date(),
    timeRemaining: 3600,
    score: status === 'in_progress' ? null : 50,
    metadata: { kind: 'remediation', remediationDurationMins: 60, questionOrder: [] },
    examType: { id: 'exam-1', slug: 'ent' },
    answers: [
      {
        id: 'ans-1',
        questionId: 'q-with-images',
        selectedIds: ['q-with-images-b'],
        isCorrect: false,
        question: questionRow(
          'q-with-images',
          { ru: `${SECRET_RU}\n\n[[img:2]]`, kk: `${SECRET_KK}\n\n![схема](/api/media/uploads/q/3.png)` },
          ['/uploads/q/1.png', '/uploads/q/2.png', '/uploads/q/3.png'],
        ),
      },
      {
        id: 'ans-2',
        questionId: 'q-text-only',
        selectedIds: [],
        isCorrect: null,
        question: questionRow('q-text-only', { ru: SECRET_RU, kk: SECRET_KK }),
      },
      {
        id: 'ans-3',
        questionId: 'q-no-explanation',
        selectedIds: [],
        isCorrect: null,
        question: questionRow('q-no-explanation', null),
      },
    ],
  };
}

function makeService(status: string) {
  const prisma: any = {
    testSession: { findFirst: jest.fn(async () => sessionRow(status)) },
    questionAppeal: { findMany: jest.fn(async () => []) },
  };
  const scorer: any = {
    calculateScore: jest.fn(async () => ({
      correctCount: 0,
      rawScore: 0,
      maxScore: 3,
      score: 0,
      sections: [],
      answerScores: [],
    })),
  };
  const service = new TestSessionService(prisma, {} as any, scorer, {} as any, {} as any);
  return { service, prisma };
}

function expectNoExplanationText(payload: unknown) {
  const json = JSON.stringify(payload);
  expect(json).not.toContain(SECRET_RU);
  expect(json).not.toContain(SECRET_KK);
  expect(json).not.toContain('Разбор');
}

function expectExplanationFlags(answers: any[]) {
  const byId = new Map(answers.map((a) => [a.questionId, a.question]));

  expect(byId.get('q-with-images')).toMatchObject({
    hasExplanation: true,
    explanationImageUrls: ['/uploads/q/2.png', '/uploads/q/3.png'],
    // Compat for mobile builds ≤ 1.2.0: non-null, only image tokens.
    explanation: '[[img:2]]\n[[img:3]]',
  });
  expect(byId.get('q-text-only')).toMatchObject({
    hasExplanation: true,
    explanationImageUrls: [],
    explanation: '',
  });
  expect(byId.get('q-no-explanation')).toMatchObject({
    hasExplanation: false,
    explanationImageUrls: [],
    explanation: null,
  });
}

describe('session payloads do not leak paid explanations', () => {
  it.each(['in_progress', 'completed', 'timed_out'])(
    'GET /tests/sessions/:id (%s) has no explanation text',
    async (status) => {
      const { service } = makeService(status);

      const result = await service.getSession('sess-1', 'free-user');

      expect(result.answers).toHaveLength(3);
      expectNoExplanationText(result);
      expectExplanationFlags(result.answers);
    },
  );

  it('GET /tests/sessions/:id/review has no explanation text', async () => {
    const { service } = makeService('completed');

    const result = await service.getReview('sess-1', 'free-user');

    expect(result.answers).toHaveLength(3);
    expectNoExplanationText(result);
    expectExplanationFlags(result.answers ?? []);
    // The review still shows correct answers — those are free.
    expect(result.answers?.[0].question.answerOptions[0]).toMatchObject({ isCorrect: true });
  });

  it.each([
    ['getSession', (s: TestSessionService) => s.getSession('sess-1', 'free-user')],
    ['getReview', (s: TestSessionService) => s.getReview('sess-1', 'free-user')],
  ])('%s selects question columns explicitly (no blanket include)', async (_name, call) => {
    const { service, prisma } = makeService('completed');

    await call(service);

    const args = prisma.testSession.findFirst.mock.calls[0][0];
    const questionQuery = args.include.answers.include.question;
    expect(questionQuery.include).toBeUndefined();
    expect(Object.keys(questionQuery.select).sort()).toEqual(
      [
        'answerOptions',
        'content',
        'difficulty',
        'explanation',
        'id',
        'imageUrls',
        'subject',
        'subjectId',
        'type',
      ].sort(),
    );
  });
});

describe('toSessionQuestionPayload', () => {
  it('treats an explanation with only empty locales as absent', () => {
    expect(toSessionQuestionPayload({ explanation: { kk: '', ru: '  ', en: null }, imageUrls: [] })).toEqual({
      imageUrls: [],
      explanation: null,
      hasExplanation: false,
      explanationImageUrls: [],
    });
  });

  it('indexes images the way clients do (blank entries skipped, out-of-range tokens ignored)', () => {
    const result = toSessionQuestionPayload({
      explanation: { ru: 'см. [[img:2]] и [[img:9]]' },
      imageUrls: ['', '/uploads/a.png', '  ', '/uploads/b.png'],
    });
    expect(result.explanationImageUrls).toEqual(['/uploads/b.png']);
    expect(result.explanation).toBe('[[img:2]]');
  });
});
