import { NotFoundException } from '@nestjs/common';
import {
  PARENT_REPORT_TOKEN_LENGTH,
  signParentReportToken,
  verifyParentReportToken,
} from '../src/modules/parent-report/domain/parent-report-token';
import {
  buildFullEnt,
  buildAttempts,
  pickWeakSubjectsSession,
  sessionScope,
  studentFirstName,
  type ParentReportSession,
} from '../src/modules/parent-report/domain/parent-report';
import { ParentReportService } from '../src/modules/parent-report/parent-report.service';
import { ParentReportRepository } from '../src/modules/parent-report/infrastructure/parent-report.repository';

const SECRET = 'test-secret-for-parent-report-0123456789';
const USER_ID = '7f1c2a3b-4d5e-4f60-8a9b-0c1d2e3f4a5b';
const OTHER_USER_ID = '11111111-2222-4333-8444-555555555555';
const PROGRAM_ID = 'aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee';

let seq = 0;
function session(
  daysAgo: number,
  raw: number | null,
  opts: {
    max?: number | null;
    totalQuestions?: number;
    entScope?: string;
    kind?: string;
    status?: string;
  } = {},
): ParentReportSession {
  seq += 1;
  const metadata: Record<string, unknown> = {};
  if (opts.entScope) metadata.entScope = opts.entScope;
  if (opts.kind) metadata.kind = opts.kind;
  return {
    id: `00000000-0000-4000-8000-${String(seq).padStart(12, '0')}`,
    examTypeId: 'exam-ent',
    examType: { id: 'exam-ent', slug: 'ent', name: null },
    status: opts.status ?? 'completed',
    finishedAt: new Date(Date.UTC(2026, 10, 10) - daysAgo * 86_400_000),
    rawScore: raw,
    maxScore: opts.max === undefined ? 140 : opts.max,
    score: null,
    totalQuestions: opts.totalQuestions ?? 120,
    durationSecs: null,
    language: '',
    metadata,
  };
}

const full = (daysAgo: number, raw: number) => session(daysAgo, raw, { entScope: 'full' });

describe('parent report token', () => {
  it('signs and verifies user id + version', () => {
    const token = signParentReportToken({ userId: USER_ID, version: 42 }, SECRET);
    expect(token).toHaveLength(PARENT_REPORT_TOKEN_LENGTH);
    expect(token).toMatch(/^[A-Za-z0-9_-]+$/);
    expect(verifyParentReportToken(token, SECRET)).toEqual({ userId: USER_ID, version: 42 });
  });

  it('does not expose the user id as text', () => {
    const token = signParentReportToken({ userId: USER_ID, version: 7 }, SECRET);
    expect(token).not.toContain(USER_ID);
    expect(token).not.toContain(USER_ID.replace(/-/g, ''));
  });

  it('rejects tampered, foreign-secret and malformed tokens', () => {
    const token = signParentReportToken({ userId: USER_ID, version: 9 }, SECRET);
    const flip = (s: string, i: number) =>
      s.slice(0, i) + (s[i] === 'A' ? 'B' : 'A') + s.slice(i + 1);
    for (const i of [0, 5, 20, 30, 49]) {
      expect(verifyParentReportToken(flip(token, i), SECRET)).toBeNull();
    }
    expect(verifyParentReportToken(token, `${SECRET}-other`)).toBeNull();
    expect(verifyParentReportToken(token.slice(1), SECRET)).toBeNull();
    expect(verifyParentReportToken(`${token}A`, SECRET)).toBeNull();
    expect(verifyParentReportToken('../../etc/passwd', SECRET)).toBeNull();
    expect(verifyParentReportToken(undefined, SECRET)).toBeNull();
    expect(verifyParentReportToken('A'.repeat(50), SECRET)).toBeNull();
  });

  it('changes when the version changes (revocation)', () => {
    const v1 = signParentReportToken({ userId: USER_ID, version: 1 }, SECRET);
    const v2 = signParentReportToken({ userId: USER_ID, version: 2 }, SECRET);
    expect(v1).not.toEqual(v2);
    expect(verifyParentReportToken(v1, SECRET)?.version).toBe(1);
  });

  it('refuses to sign with a missing secret or bad input', () => {
    expect(() => signParentReportToken({ userId: USER_ID, version: 1 }, '')).toThrow();
    expect(() => signParentReportToken({ userId: 'not-a-uuid', version: 1 }, SECRET)).toThrow();
    expect(() => signParentReportToken({ userId: USER_ID, version: 0 }, SECRET)).toThrow();
  });
});

describe('parent report: full ENT vs partial sessions', () => {
  const sessions = [
    full(30, 70), // first full ENT
    full(20, 88),
    // Partial scopes with high points must never count as a full ENT result.
    session(15, 38, { entScope: 'mandatory', max: 40, totalQuestions: 40 }),
    session(12, 99, { entScope: 'profile', max: 100, totalQuestions: 80 }),
    // Express-like: marked full but not the real 120-question / 140-point format.
    session(11, 60, { entScope: 'full', max: 70, totalQuestions: 60 }),
    session(10, 18, { kind: 'remediation', max: 20, totalQuestions: 20 }),
    session(5, 81, {}), // legacy full ENT without entScope
    session(1, 12, { entScope: 'mandatory', max: 40, totalQuestions: 40 }), // newest, partial
  ];

  it('classifies only real full ENT sessions as full', () => {
    expect(sessions.map(sessionScope)).toEqual([
      'full',
      'full',
      'other',
      'other',
      'other',
      'other',
      'full',
      'other',
    ]);
  });

  it('computes best / latest / first / change from full ENT only', () => {
    const summary = buildFullEnt(sessions);
    expect(summary.count).toBe(3);
    expect(summary.maxScore).toBe(140);
    expect(summary.best?.score).toBe(88);
    expect(summary.latest?.score).toBe(81);
    expect(summary.first?.score).toBe(70);
    expect(summary.changeSinceFirst).toBe(11);
    expect(summary.series.map((p) => p.score)).toEqual([70, 88, 81]);
  });

  it('lists the last 8 attempts newest first with their scope', () => {
    const many = [...sessions, full(40, 50), full(45, 40)];
    const attempts = buildAttempts(many);
    expect(attempts).toHaveLength(8);
    expect(attempts[0]).toMatchObject({ score: 12, maxScore: 40, scope: 'other' });
    expect(attempts[1]).toMatchObject({ score: 81, maxScore: 140, scope: 'full' });
  });

  it('takes weak subjects from the latest full ENT even if a partial test is newer', () => {
    expect(pickWeakSubjectsSession(sessions)?.rawScore).toBe(81);
    const partialOnly = [
      session(3, 30, { entScope: 'mandatory', max: 40, totalQuestions: 40 }),
      session(1, 15, { kind: 'remediation', max: 20, totalQuestions: 20 }),
    ];
    expect(pickWeakSubjectsSession(partialOnly)?.rawScore).toBe(30);
  });

  it('has no full ENT figures when only partial tests exist', () => {
    const summary = buildFullEnt([
      session(3, 38, { entScope: 'mandatory', max: 40, totalQuestions: 40 }),
    ]);
    expect(summary).toMatchObject({ count: 0, best: null, latest: null, changeSinceFirst: null });
  });

  it('keeps only the first name', () => {
    expect(studentFirstName('  Айдана   Серикова ')).toBe('Айдана');
    expect(studentFirstName('')).toBeNull();
    expect(studentFirstName(null)).toBeNull();
  });
});

/** In-memory stand-in for Redis + Prisma behind the repository. */
class FakeRepository {
  links = new Map<string, number>();
  cache = new Map<string, string>();
  constructor(private readonly sessions: ParentReportSession[]) {}
  async getLinkVersion(userId: string) {
    return this.links.get(userId) ?? null;
  }
  async createLinkVersionIfAbsent(userId: string, version: number) {
    if (!this.links.has(userId)) this.links.set(userId, version);
  }
  async touchLink() {}
  async deleteLink(userId: string) {
    this.links.delete(userId);
  }
  async getCachedReport(userId: string, version: number, lang: string) {
    return this.cache.get(`${userId}:${version}:${lang}`) ?? null;
  }
  async cacheReport(userId: string, version: number, lang: string, json: string) {
    this.cache.set(`${userId}:${version}:${lang}`, json);
  }
  async findStudent(userId: string) {
    // A full name typed into «Имя» — the report must still show only the first word.
    return userId === USER_ID ? { firstName: 'Айдана Серикова' } : null;
  }
  async entSessions() {
    return this.sessions;
  }
  async countFinishedSince() {
    return 4;
  }
  async activePlan() {
    return { active: true, until: '2026-12-01T00:00:00.000Z' };
  }
}

function makeService(sessions: ParentReportSession[] = [full(20, 70), full(2, 90)]) {
  const repo = new FakeRepository(sessions);
  const scorer = {
    calculateScore: jest.fn(async (sessionId: string) => ({
      correctCount: 80,
      rawScore: 90,
      maxScore: 140,
      score: 64.29,
      answerScores: [{ answerId: 'a1', questionId: 'q1', earnedPoints: 0, maxPoints: 1 }],
      sections: [
        { subjectId: 's-math', subjectSlug: 'math', subjectName: { ru: 'Математика', kk: 'Математика', en: 'Math' }, correctCount: 20, totalCount: 40, rawPoints: 28, maxPoints: 50, score: 56, sessionId },
        { subjectId: 's-phys', subjectSlug: 'physics', subjectName: { ru: 'Физика', kk: 'Физика', en: 'Physics' }, correctCount: 30, totalCount: 40, rawPoints: 36, maxPoints: 50, score: 72 },
        { subjectId: 's-hist', subjectSlug: 'history', subjectName: { ru: 'История Казахстана', kk: 'Қазақстан тарихы', en: 'History' }, correctCount: 14, totalCount: 20, rawPoints: 14, maxPoints: 20, score: 70 },
        { subjectId: 's-read', subjectSlug: 'reading', subjectName: { ru: 'Грамотность чтения', kk: 'Оқу сауаттылығы', en: 'Reading' }, correctCount: 10, totalCount: 10, rawPoints: 10, maxPoints: 10, score: 100 },
        { subjectId: 's-mlit', subjectSlug: 'math-lit', subjectName: { ru: 'Мат. грамотность', kk: 'Математикалық сауаттылық', en: 'Math lit' }, correctCount: 8, totalCount: 10, rawPoints: 8, maxPoints: 10, score: 80 },
      ],
    })),
  };
  const goals = {
    getGoal: jest.fn(async () => ({
      goal: {
        cycleSlug: '2026-2027',
        quotaType: 'GRANT',
        universityCode: 27,
        universityName: { ru: 'КазНУ им. аль-Фараби', kk: 'әл-Фараби атындағы ҚазҰУ' },
        universityShortName: 'КазНУ',
        programId: PROGRAM_ID,
        programCode: 'B057',
        programName: { ru: 'Информационные технологии', kk: 'Ақпараттық технологиялар' },
        profileSubjects: null,
        profileSubjectsLabel: null,
        requiredScore: 112,
        requiredScoreQuotaType: 'GRANT',
        grantCount: 40,
        avgScore: 118,
        topScore: 135,
        admissionYear: 2026,
        history: [{ cycleSlug: '2025-2026', admissionYear: 2025, minScore: 110 }],
        maxScore: 140,
      },
    })),
  };
  const config = {
    get: (key: string) => ({ JWT_SECRET: SECRET, PUBLIC_SITE_URL: 'https://my-test.kz/' } as Record<string, string>)[key],
  };
  const service = new ParentReportService(repo as any, scorer as any, goals as any, config as any);
  return { service, repo, scorer, goals };
}

const tokenOf = (url: string) => url.split('/progress/')[1];

describe('parent report link lifecycle', () => {
  it('creates a stable link, serves the report and revokes it', async () => {
    const { service } = makeService();
    expect(await service.getLink(USER_ID)).toEqual({ url: null });

    const { url } = await service.createLink(USER_ID);
    expect(url).toMatch(/^https:\/\/my-test\.kz\/progress\/[A-Za-z0-9_-]{50}$/);
    expect((await service.createLink(USER_ID)).url).toBe(url);
    expect((await service.getLink(USER_ID)).url).toBe(url);

    const report = await service.getPublicReport(tokenOf(url), 'ru');
    expect(report.studentFirstName).toBe('Айдана');

    await service.revokeLink(USER_ID);
    expect(await service.getLink(USER_ID)).toEqual({ url: null });
    await expect(service.getPublicReport(tokenOf(url), 'ru')).rejects.toBeInstanceOf(NotFoundException);

    const fresh = await service.createLink(USER_ID);
    expect(fresh.url).not.toBe(url);
    await expect(service.getPublicReport(tokenOf(url), 'ru')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getPublicReport(tokenOf(fresh.url), 'ru')).resolves.toBeTruthy();
  });

  it('rejects forged and foreign tokens with the same 404', async () => {
    const { service, repo } = makeService();
    await service.createLink(USER_ID);
    const foreign = signParentReportToken({ userId: USER_ID, version: 123 }, 'another-secret-0123456789');
    await expect(service.getPublicReport(foreign, 'ru')).rejects.toBeInstanceOf(NotFoundException);
    // Correctly signed, but no active link for that user.
    const noLink = signParentReportToken({ userId: OTHER_USER_ID, version: 5 }, SECRET);
    await expect(service.getPublicReport(noLink, 'ru')).rejects.toBeInstanceOf(NotFoundException);
    // Active link, but the account was deleted.
    repo.links.set(OTHER_USER_ID, 5);
    await expect(service.getPublicReport(noLink, 'ru')).rejects.toBeInstanceOf(NotFoundException);
    await expect(service.getPublicReport('garbage', 'ru')).rejects.toBeInstanceOf(NotFoundException);
  });
});

describe('parent report payload privacy', () => {
  const FORBIDDEN_KEYS = [
    'id',
    'userId',
    'sessionId',
    'email',
    'phone',
    'lastName',
    'telegramId',
    'telegramUsername',
    'answers',
    'answerScores',
    'explanation',
    'selectedIds',
    'questionId',
    'subjectId',
    'programId',
    'universityCode',
    'history',
    'metadata',
  ];

  function collectKeys(value: unknown, out = new Set<string>()): Set<string> {
    if (Array.isArray(value)) value.forEach((v) => collectKeys(v, out));
    else if (value && typeof value === 'object') {
      for (const [k, v] of Object.entries(value)) {
        out.add(k);
        collectKeys(v, out);
      }
    }
    return out;
  }

  it('contains only aggregate fields, no ids, contacts, surname or answers', async () => {
    const sessions = [full(20, 70), session(3, 38, { entScope: 'mandatory', max: 40, totalQuestions: 40 }), full(2, 90)];
    const { service } = makeService(sessions);
    const { url } = await service.createLink(USER_ID);
    const report = await service.getPublicReport(tokenOf(url), 'kk');

    expect(Object.keys(report).sort()).toEqual(
      ['attempts', 'fullEnt', 'generatedAt', 'goal', 'lang', 'plan', 'studentFirstName', 'testsLast7Days', 'weakSubjects'].sort(),
    );
    const keys = collectKeys(report);
    for (const key of FORBIDDEN_KEYS) expect(keys.has(key)).toBe(false);

    const json = JSON.stringify(report);
    for (const secret of [USER_ID, PROGRAM_ID, 'Серикова', ...sessions.map((s) => s.id), 's-math', 'q1']) {
      expect(json).not.toContain(secret);
    }

    expect(report.lang).toBe('kk');
    expect(report.studentFirstName).toBe('Айдана');
    expect(report.fullEnt).toMatchObject({ count: 2, best: { score: 90 }, latest: { score: 90 }, changeSinceFirst: 20 });
    expect(report.attempts.map((a) => a.scope)).toEqual(['full', 'other', 'full']);
    expect(report.testsLast7Days).toBe(4);
    expect(report.plan).toEqual({ active: true, until: '2026-12-01T00:00:00.000Z' });
    expect(report.goal).toEqual({
      university: 'әл-Фараби атындағы ҚазҰУ',
      program: 'Ақпараттық технологиялар',
      programCode: 'B057',
      requiredScore: 112,
      admissionYear: 2026,
      currentScore: 90,
      gap: 22,
    });
    expect(report.weakSubjects?.scope).toBe('full');
    expect(report.weakSubjects?.items).toEqual([
      { name: 'Математика', earnedPoints: 28, maxPoints: 50, lostPoints: 22 },
      { name: 'Физика', earnedPoints: 36, maxPoints: 50, lostPoints: 14 },
      { name: 'Қазақстан тарихы', earnedPoints: 14, maxPoints: 20, lostPoints: 6 },
    ]);
  });

  it('scores the latest full ENT, not a newer partial test', async () => {
    const latestFull = full(5, 90);
    const { service, scorer } = makeService([full(20, 70), latestFull, session(1, 38, { entScope: 'mandatory', max: 40, totalQuestions: 40 })]);
    await service.buildReport(USER_ID, 'ru');
    expect(scorer.calculateScore).toHaveBeenCalledWith(latestFull.id, undefined, { readOnly: true });
  });

  it('reads only the first name from the user row', async () => {
    const findUnique = jest.fn(async () => ({ firstName: 'Айдана' }));
    const repo = new ParentReportRepository({ user: { findUnique } } as any, {} as any);
    await repo.findStudent(USER_ID);
    expect(findUnique).toHaveBeenCalledWith({ where: { id: USER_ID }, select: { firstName: true } });
  });
});
