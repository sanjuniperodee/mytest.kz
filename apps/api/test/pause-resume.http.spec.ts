import { BadRequestException } from '@nestjs/common';
import { TestSessionService } from '../src/modules/tests/test-session.service';

/**
 * Verifies the pause/resume time model:
 * - pausing freezes the remaining time;
 * - a paused session does NOT auto-finish on read;
 * - resuming continues the countdown exactly where it stopped (paused span excluded).
 */

const BASE = Date.UTC(2026, 0, 1, 12, 0, 0); // fixed wall-clock origin

function makeStore() {
  return {
    s: {
      id: 'sess-1',
      userId: 'u1',
      status: 'in_progress',
      templateId: null,
      examTypeId: 'exam-1',
      startedAt: new Date(BASE),
      finishedAt: null,
      timeRemaining: 3600,
      score: null,
      answers: [],
      metadata: {
        kind: 'remediation',
        remediationDurationMins: 60, // → 3600s total, no template lookup
        sections: [],
        questionOrder: [],
        profileSubjectIds: [],
      } as Record<string, unknown>,
      examType: { id: 'exam-1', slug: 'ent' },
    },
  };
}

function makePrisma(store: ReturnType<typeof makeStore>): any {
  const prisma: any = {
    testSession: {
      findFirst: jest.fn(async () => ({ ...store.s, metadata: { ...store.s.metadata } })),
      updateMany: jest.fn(async ({ data }: any) => {
        store.s = { ...store.s, ...data };
        return { count: 1 };
      }),
      update: jest.fn(async ({ data }: any) => {
        store.s = { ...store.s, ...data };
        return { ...store.s };
      }),
      create: jest.fn(),
    },
    testTemplate: { findUnique: jest.fn(async () => ({ durationMins: 60 })) },
    questionAppeal: { findMany: jest.fn(async () => []) },
    funnelStep: { findFirst: jest.fn(async () => null), create: jest.fn() },
    testAnswer: { findMany: jest.fn(async () => []) },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return prisma;
}

function makeService(store: ReturnType<typeof makeStore>) {
  const prisma = makePrisma(store);
  const accessMock: any = {
    assertAndConsumeAttempt: jest.fn().mockResolvedValue(undefined),
    assertAndConsumeAttemptTx: jest.fn().mockResolvedValue(undefined),
  };
  const scorerMock: any = {
    calculateScore: jest.fn().mockResolvedValue({
      correctCount: 0,
      rawScore: 0,
      maxScore: 0,
      score: 0,
      sections: [],
      answerScores: [],
    }),
  };
  const service = new TestSessionService(
    prisma,
    {} as any,
    scorerMock,
    {} as any,
    accessMock,
  );
  return { service, prisma };
}

describe('exam pause / resume', () => {
  let nowSpy: jest.SpyInstance;
  const setNow = (ms: number) => nowSpy.mockReturnValue(ms);

  beforeEach(() => {
    nowSpy = jest.spyOn(Date, 'now');
  });
  afterEach(() => {
    nowSpy.mockRestore();
  });

  it('freezes the clock on pause and resumes seamlessly', async () => {
    const store = makeStore();
    const { service } = makeService(store);

    // 60s into the exam → pause.
    setNow(BASE + 60_000);
    const paused = await service.pauseSession('sess-1', 'u1');
    expect(paused.isPaused).toBe(true);
    expect(paused.timeRemaining).toBe(3540); // 3600 - 60
    expect(typeof (store.s.metadata as any).pausedAt).toBe('string');

    // 100s elapse while paused → reading the session keeps time frozen, no finish.
    setNow(BASE + 60_000 + 100_000);
    const whilePaused = await service.getSession('sess-1', 'u1');
    expect(whilePaused.isPaused).toBe(true);
    expect(whilePaused.status).toBe('in_progress');
    expect(whilePaused.timeRemaining).toBe(3540); // still frozen

    // Resume at +160s wall-clock.
    const resumed = await service.resumeSession('sess-1', 'u1');
    expect(resumed.isPaused).toBe(false);
    expect(resumed.timeRemaining).toBe(3540); // continues where it stopped
    expect((store.s.metadata as any).pausedMs).toBe(100_000);
    expect((store.s.metadata as any).pausedAt).toBeUndefined();

    // 60s more of real work → clock advances again.
    setNow(BASE + 220_000);
    const running = await service.getSession('sess-1', 'u1');
    expect(running.isPaused).toBe(false);
    expect(running.timeRemaining).toBe(3480); // 3600 - (60 worked before + 60 after)
  });

  it('is idempotent: double pause does not double-count', async () => {
    const store = makeStore();
    const { service } = makeService(store);

    setNow(BASE + 30_000);
    await service.pauseSession('sess-1', 'u1');
    const firstPausedAt = (store.s.metadata as any).pausedAt;

    setNow(BASE + 90_000);
    const second = await service.pauseSession('sess-1', 'u1');
    expect(second.isPaused).toBe(true);
    // pausedAt unchanged → the pause window is not reset/extended by a repeat call.
    expect((store.s.metadata as any).pausedAt).toBe(firstPausedAt);
  });

  it('resume on a non-paused session is a no-op', async () => {
    const store = makeStore();
    const { service } = makeService(store);
    setNow(BASE + 10_000);
    const res = await service.resumeSession('sess-1', 'u1');
    expect(res.isPaused).toBe(false);
    expect((store.s.metadata as any).pausedMs).toBeUndefined();
  });

  it('rejects pause once time has run out (times the session out instead)', async () => {
    const store = makeStore();
    const { service, prisma } = makeService(store);
    // Make finishTest a harmless no-op for this path.
    prisma.testSession.findFirst.mockResolvedValue({ ...store.s, metadata: { ...store.s.metadata } });
    setNow(BASE + 3_601_000); // 1s past the 3600s budget
    await expect(service.pauseSession('sess-1', 'u1')).rejects.toBeInstanceOf(BadRequestException);
  });
});
