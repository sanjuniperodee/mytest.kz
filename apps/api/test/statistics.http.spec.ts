import { Test } from '@nestjs/testing';
import { AuthGuard } from '@nestjs/passport';
import request from 'supertest';
import {
  buildStatistics,
  statisticsFormat,
  statisticsPercent,
  StatisticsSession,
} from '../src/modules/users/domain/statistics';
import { StatisticsController } from '../src/modules/users/statistics.controller';
import { StatisticsService } from '../src/modules/users/statistics.service';
import { StatisticsRepository } from '../src/modules/users/infrastructure/statistics.repository';

const filter = { period: '90', format: 'exam', page: 1 } as const;
function session(
  id: string,
  overrides: Partial<StatisticsSession> = {},
): StatisticsSession {
  return {
    id,
    examTypeId: 'ent',
    examType: { id: 'ent', slug: 'ent', name: { ru: 'ЕНТ', kk: 'ҰБТ' } },
    status: 'completed',
    finishedAt: new Date('2026-09-21T00:00:00Z'),
    rawScore: 70,
    maxScore: 140,
    score: 50,
    totalQuestions: 120,
    durationSecs: 3600,
    language: 'ru',
    metadata: { entScope: 'full', profileSubjectIds: ['a', 'b'] },
    ...overrides,
  };
}

describe('Statistics calculations', () => {
  it('separates remediation, partial ENT, and full attempts, retaining legacy full metadata', () => {
    expect(statisticsFormat(session('full', { metadata: null }))).toBe('exam');
    expect(
      statisticsFormat(
        session('practice', { metadata: { kind: 'remediation' } }),
      ),
    ).toBe('practice');
    expect(
      statisticsFormat(
        session('partial', { totalQuestions: 40, maxScore: 40 }),
      ),
    ).toBe('practice');
    expect(
      statisticsFormat(session('scope', { metadata: { entScope: 'profile' } })),
    ).toBe('practice');
    const rows = [
      session('full'),
      session('practice', { metadata: { kind: 'remediation' } }),
      session('active', { status: 'in_progress' }),
    ];
    expect(buildStatistics(rows, filter).sessionIds).toEqual(['full']);
    expect(
      buildStatistics(rows, { ...filter, format: 'practice' }).sessionIds,
    ).toEqual(['practice']);
  });
  it('does not coerce missing grades to zero, keeps real zero, and uses raw/max for partial credit', () => {
    expect(statisticsPercent(session('zero', { rawScore: 0 }))).toBe(0);
    expect(
      statisticsPercent(session('missing', { rawScore: null, score: null })),
    ).toBeNull();
    expect(
      statisticsPercent(
        session('fallback', { rawScore: null, score: '67.75' }),
      ),
    ).toBe(67.8);
    expect(statisticsPercent(session('invalid', { rawScore: 141 }))).toBeNull();
    expect(
      statisticsPercent(session('partial', { rawScore: 71, score: 1 })),
    ).toBe(50.7);
  });
  it('uses arithmetic mean of attempt percentages, not pooled points', () => {
    const examType = { id: 'nuet', slug: 'nuet', name: { ru: 'NUET' } };
    const rows = [
      session('a', { examType, examTypeId: 'nuet', rawScore: 8, maxScore: 10 }),
      session('b', { examType, examTypeId: 'nuet', rawScore: 5, maxScore: 5 }),
    ];
    const { report } = buildStatistics(rows, filter);
    expect(report.summary.averagePercent).toBe(90);
    expect(report.summary.best?.sessionId).toBe('b');
    expect(report.summary.deltaPercentPoints).toBeNull();
  });
  it('compares only immediately preceding matching compositions, including profile order normalization', () => {
    const rows = [
      session('b', {
        rawScore: 84,
        metadata: { entScope: 'full', profileSubjectIds: ['b', 'a'] },
      }),
      session('a'),
    ];
    expect(
      buildStatistics(rows, filter).report.summary.deltaPercentPoints,
    ).toBe(10);
    rows[0].metadata = { entScope: 'full', profileSubjectIds: ['a', 'c'] };
    expect(
      buildStatistics(rows, filter).report.summary.deltaPercentPoints,
    ).toBeNull();
    rows[0].metadata = null;
    rows[1].metadata = null;
    expect(
      buildStatistics(rows, filter).report.summary.deltaPercentPoints,
    ).toBeNull();
    rows[0].rawScore = null;
    rows[0].score = null;
    expect(
      buildStatistics(rows, filter).report.summary.latest?.percent,
    ).toBeNull();
  });
  it('paginates without changing summary/chart, sorts deterministic ties and caps chart at 30', () => {
    const rows = Array.from({ length: 35 }, (_, i) =>
      session(String(i).padStart(2, '0')),
    );
    const first = buildStatistics(rows, filter).report;
    const last = buildStatistics(rows, { ...filter, page: 999 }).report;
    expect(first.summary).toEqual(last.summary);
    expect(first.chart).toEqual(last.chart);
    expect(last.page).toBe(4);
    expect(last.history).toHaveLength(5);
    expect(first.chart).toHaveLength(30);
    expect(first.chart.at(-1)?.sessionId).toBe('34');
    expect(first.history[0].sessionId).toBe('34');
  });
  it('includes timeouts, excludes other exams, and handles empty/unscored sets', () => {
    const rows = [
      session('timeout', { status: 'timed_out' }),
      session('other', { examTypeId: 'other' }),
      session('undated', { finishedAt: null }),
    ];
    const { report } = buildStatistics(rows, { ...filter, examTypeId: 'ent' });
    expect(report.summary.total).toBe(1);
    expect(report.summary.timedOutCount).toBe(1);
    expect(
      buildStatistics([], filter).report.summary.averagePercent,
    ).toBeNull();
    expect(
      buildStatistics(
        [session('none', { rawScore: null, score: null })],
        filter,
      ).report.summary,
    ).toMatchObject({ total: 1, scored: 0, unscored: 1, best: null });
  });
});

describe('Statistics repository and orchestration', () => {
  it('queries only the current user, finished sessions and exact rolling window', async () => {
    const prisma: any = {
      testSession: { findMany: jest.fn().mockResolvedValue([]) },
    };
    const repository = new StatisticsRepository(prisma);
    const now = new Date('2026-09-21T12:00:00Z');
    await repository.sessions(
      'user',
      { ...filter, period: '30', examTypeId: 'ent' },
      now,
    );
    expect(prisma.testSession.findMany.mock.calls[0][0].where).toEqual({
      userId: 'user',
      status: { in: ['completed', 'timed_out'] },
      examTypeId: 'ent',
      finishedAt: {
        not: null,
        gte: new Date('2026-08-22T12:00:00Z'),
        lte: now,
      },
    });
    await repository.sessions('user', { ...filter, period: 'all' }, now);
    expect(
      prisma.testSession.findMany.mock.calls[1][0].where.finishedAt.gte,
    ).toBeUndefined();
  });
  it('subject query is scoped to the user and selected sessions and handles bigint aggregates', async () => {
    const prisma: any = {
      $queryRaw: jest
        .fn()
        .mockResolvedValue([
          {
            subjectId: 'math',
            subjectName: { ru: 'Математика' },
            examTypeId: 'ent',
            total: 10n,
            correct: 4n,
          },
        ]),
    };
    const repository = new StatisticsRepository(prisma);
    expect(await repository.subjects('owner', [])).toEqual([]);
    expect(prisma.$queryRaw).not.toHaveBeenCalled();
    expect(await repository.subjects('owner', ['session-1'])).toEqual([
      {
        subjectId: 'math',
        subjectName: { ru: 'Математика' },
        examTypeId: 'ent',
        total: 10,
        correct: 4,
        accuracy: 40,
      },
    ]);
    const sql = prisma.$queryRaw.mock.calls[0][0];
    expect(sql.values).toEqual(['owner', 'session-1']);
    expect(sql.text).toContain('a.is_correct IS NOT NULL');
  });
  it('passes the full filtered set (not just the history page) to subject aggregation', async () => {
    const rows = Array.from({ length: 12 }, (_, i) => session(String(i)));
    const repo: any = {
      sessions: jest
        .fn()
        .mockResolvedValue([
          ...rows,
          session('practice', { metadata: { kind: 'remediation' } }),
        ]),
      exams: jest.fn().mockResolvedValue([]),
      subjects: jest.fn().mockResolvedValue([]),
    };
    const result = await new StatisticsService(repo).get('owner', {
      ...filter,
      page: 2,
    });
    expect(repo.subjects.mock.calls[0][0]).toBe('owner');
    expect(repo.subjects.mock.calls[0][1]).toHaveLength(12);
    expect(result.history).toHaveLength(2);
    expect(result.summary.total).toBe(12);
  });
});

describe('Statistics HTTP contract', () => {
  let app: any;
  const service = {
    get: jest.fn(async (userId, query) => ({ userId, filters: query })),
  };
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [StatisticsController],
      providers: [{ provide: StatisticsService, useValue: service }],
    })
      .overrideGuard(AuthGuard('jwt'))
      .useValue({
        canActivate: (ctx: any) => {
          const req = ctx.switchToHttp().getRequest();
          if (req.headers.authorization !== 'Bearer fixture') return false;
          req.user = { id: 'owner' };
          return true;
        },
      })
      .compile();
    app = module.createNestApplication();
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('rejects unauthenticated requests', () =>
    request(app.getHttpServer()).get('/users/me/statistics').expect(403));
  it('defaults and validates typed filters, bound to the authenticated user', async () => {
    const res = await request(app.getHttpServer())
      .get('/users/me/statistics')
      .set('Authorization', 'Bearer fixture')
      .expect(200);
    expect(res.body).toEqual({
      userId: 'owner',
      filters: { period: '90', format: 'exam', page: 1 },
    });
  });
  it.each([
    'period=7',
    'page=1.5',
    'page=0',
    'page=100001',
    'examTypeId=no',
    'format=other',
    'userId=other',
  ])('rejects invalid query %s', (query) =>
    request(app.getHttpServer())
      .get(`/users/me/statistics?${query}`)
      .set('Authorization', 'Bearer fixture')
      .expect(400),
  );
});
