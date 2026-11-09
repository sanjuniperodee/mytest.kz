import { BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { ENT_CONFIG, estimateEntScoreFromExpress } from '@bilimland/shared';
import { TestGeneratorService } from '../src/modules/tests/test-generator.service';
import { TestScorerService } from '../src/modules/tests/test-scorer.service';
import { TestSessionService } from '../src/modules/tests/test-session.service';
import { MistakesService } from '../src/modules/tests/mistakes.service';
import { StartTestDto } from '../src/modules/tests/dto/start-test.dto';
import { LeaderboardService } from '../src/modules/leaderboard/leaderboard.service';
import { UsersService } from '../src/modules/users/users.service';
import {
  buildStatistics,
  statisticsFormat,
  type StatisticsSession,
} from '../src/modules/users/domain/statistics';
import { staticMonetization } from './helpers/monetization';

/**
 * Экспресс-ЕНТ: 4 + 4 + 8 + 2 × 8 = 32 вопроса одиночного выбора, по 1 баллу,
 * ~50 минут, оценка балла ЕНТ из 140; в лидерборд / «лучший ЕНТ» / цель не попадает.
 */

type BankQuestion = {
  id: string;
  subjectId: string;
  type: string;
  content: unknown;
  scoreWeight: number | null;
  answerOptions: Array<{ id: string; isCorrect: boolean }>;
};

const SUBJECTS: Record<string, { id: string; slug: string; isMandatory: boolean; name: string }> = {
  history: { id: 'history', slug: 'history_kz', isMandatory: true, name: 'История' },
  reading: { id: 'reading', slug: 'reading_literacy', isMandatory: true, name: 'Чтение' },
  'math-lit': { id: 'math-lit', slug: 'math_literacy', isMandatory: true, name: 'Мат. грамотность' },
  'profile-1': { id: 'profile-1', slug: 'math', isMandatory: false, name: 'Математика' },
  'profile-2': { id: 'profile-2', slug: 'physics', isMandatory: false, name: 'Физика' },
};

function q(
  subjectId: string,
  id: string,
  opts: {
    options?: number;
    correct?: number;
    type?: string;
    passage?: string;
    scoreWeight?: number | null;
  } = {},
): BankQuestion {
  const options = opts.options ?? 4;
  const correct = opts.correct ?? 1;
  return {
    id,
    subjectId,
    type: opts.type ?? (correct > 1 ? 'multiple_choice' : 'single_choice'),
    content: opts.passage
      ? { ru: { passage: opts.passage, text: `${id}?` } }
      : { ru: { text: `${id}?` } },
    scoreWeight: opts.scoreWeight ?? null,
    answerOptions: Array.from({ length: options }, (_, i) => ({
      id: `${id}-o${i}`,
      isCorrect: i < correct,
    })),
  };
}

function range(n: number) {
  return Array.from({ length: n }, (_, i) => i);
}

function buildBank(): BankQuestion[] {
  return [
    // Мат. грамотность: 6 одиночных + 3 multi-select + 2 восьмивариантных (формат 2-балльных).
    ...range(6).map((i) => q('math-lit', `ml-single-${i}`)),
    ...range(3).map((i) => q('math-lit', `ml-multi-${i}`, { options: 6, correct: 2 })),
    ...range(2).map((i) => q('math-lit', `ml-eight-${i}`, { options: 8, correct: 1 })),
    // Чтение: 3 текста по 3 вопроса.
    ...range(3).flatMap((p) =>
      range(3).map((i) => q('reading', `rd-p${p}-${i}`, { passage: `Текст номер ${p}` })),
    ),
    // История: 6 без текста, 6 по тексту, 2 multi-select.
    ...range(6).map((i) => q('history', `hs-plain-${i}`)),
    ...range(6).map((i) => q('history', `hs-text-${i}`, { passage: `Источник ${i % 2}` })),
    ...range(2).map((i) => q('history', `hs-multi-${i}`, { options: 6, correct: 3 })),
    // Профиль 1: 10 одиночных, 2 одиночных с весом 2, 5 + 5 двухбалльных.
    ...range(10).map((i) => q('profile-1', `p1-single-${i}`)),
    ...range(2).map((i) => q('profile-1', `p1-weighted-${i}`, { scoreWeight: 2 })),
    ...range(5).map((i) => q('profile-1', `p1-2a-${i}`, { options: 8, correct: 3 })),
    ...range(5).map((i) => q('profile-1', `p1-2b-${i}`, { options: 6, correct: 2 })),
    // Профиль 2 — тонкий банк: только 5 одиночных, остальное — двухбалльные (уйдут в добор).
    ...range(5).map((i) => q('profile-2', `p2-single-${i}`)),
    ...range(6).map((i) => q('profile-2', `p2-2a-${i}`, { options: 8, correct: 3 })),
  ];
}

function makePrisma(bank: BankQuestion[]) {
  const byId = new Map(bank.map((row) => [row.id, row]));
  const templateSections = [
    { subjectId: 'history', questionCount: 20, selectionMode: 'random', sortOrder: 1, profileHeavyFrom: null, subject: SUBJECTS.history },
    { subjectId: 'reading', questionCount: 10, selectionMode: 'random', sortOrder: 2, profileHeavyFrom: null, subject: SUBJECTS.reading },
    { subjectId: 'math-lit', questionCount: 10, selectionMode: 'random', sortOrder: 3, profileHeavyFrom: null, subject: SUBJECTS['math-lit'] },
  ];
  const prisma: any = {
    testTemplate: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'tpl-ent',
        examTypeId: 'exam-ent',
        durationMins: 240,
        examType: { slug: 'ent' },
        sections: templateSections,
      }),
    },
    question: {
      findMany: jest.fn().mockImplementation((args: any) => {
        const idIn: string[] | undefined = args?.where?.id?.in;
        if (idIn) {
          return Promise.resolve(
            idIn
              .map((id) => byId.get(id))
              .filter((row): row is BankQuestion => Boolean(row))
              .map((row) => ({
                id: row.id,
                subjectId: row.subjectId,
                examTypeId: 'exam-ent',
                topic: { subjectId: row.subjectId },
              })),
          );
        }
        const and: any[] = args?.where?.AND ?? [];
        const subjectId = and.find((clause) => typeof clause?.subjectId === 'string')?.subjectId;
        return Promise.resolve(bank.filter((row) => row.subjectId === subjectId));
      }),
    },
    subject: {
      findMany: jest.fn().mockImplementation((args: any) => {
        const ids: string[] = args?.where?.id?.in ?? [];
        return Promise.resolve(
          ids
            .map((id) => SUBJECTS[id])
            .filter(Boolean)
            .filter((s) => args?.where?.isMandatory === undefined || s.isMandatory === args.where.isMandatory),
        );
      }),
    },
    testAnswer: { findMany: jest.fn().mockResolvedValue([]) },
    testSession: {
      create: jest.fn().mockImplementation(({ data }: any) =>
        Promise.resolve({ id: 'express-1', score: null, ...data }),
      ),
    },
    visitEvent: { findFirst: jest.fn().mockResolvedValue(null) },
  };
  prisma.$transaction = jest.fn((cb: any) => cb(prisma));
  return prisma;
}

function mockAccess() {
  return {
    assertAndConsumeAttempt: jest.fn().mockResolvedValue(undefined),
    assertAndConsumeAttemptTx: jest.fn().mockResolvedValue(undefined),
  };
}

async function generateExpress(bank: BankQuestion[], seed?: string) {
  const generator = new TestGeneratorService(makePrisma(bank));
  return generator.generateFromTemplate(
    'tpl-ent',
    ['profile-1', 'profile-2'],
    ENT_CONFIG.express.profileQuestionsPerSubject,
    'user-1',
    'ru',
    seed ? { entScope: 'express', seed } : { entScope: 'express' },
  );
}

describe('ENT express — generation', () => {
  it('builds 4 + 4 + 8 + 8 + 8 = 32 questions with every item a single-choice 1-pointer', async () => {
    const bank = buildBank();
    const byId = new Map(bank.map((row) => [row.id, row]));
    const sections = await generateExpress(bank);
    const counts = Object.fromEntries(sections.map((s) => [s.subjectId, s.questionIds.length]));

    expect(counts).toEqual({
      history: ENT_CONFIG.express.questionCounts.history_kz,
      reading: ENT_CONFIG.express.questionCounts.reading_literacy,
      'math-lit': ENT_CONFIG.express.questionCounts.math_literacy,
      'profile-1': ENT_CONFIG.express.profileQuestionsPerSubject,
      'profile-2': ENT_CONFIG.express.profileQuestionsPerSubject,
    });
    const all = sections.flatMap((s) => s.questionIds);
    expect(all).toHaveLength(ENT_CONFIG.express.totalQuestions);
    expect(new Set(all).size).toBe(all.length);
    expect(sections.every((s) => s.profileHeavyFrom === null)).toBe(true);

    // Где банк позволяет — только одиночный выбор: без multi-select, 8-вариантных и веса 2.
    for (const subjectId of ['history', 'reading', 'math-lit', 'profile-1']) {
      const ids = sections.find((s) => s.subjectId === subjectId)!.questionIds;
      for (const id of ids) {
        const row = byId.get(id)!;
        expect(row.answerOptions.filter((o) => o.isCorrect)).toHaveLength(1);
        expect(row.answerOptions.length).toBeLessThanOrEqual(ENT_CONFIG.express.maxOptionCount);
        expect(row.type).toBe('single_choice');
        expect(row.scoreWeight).toBeNull();
      }
    }

    // История: сначала вопросы без текста (6), текстовые — только добором.
    const history = sections.find((s) => s.subjectId === 'history')!.questionIds;
    expect(history.slice(0, 6).every((id) => id.startsWith('hs-plain-'))).toBe(true);

    // Чтение: не больше 2 вопросов к одному тексту.
    const reading = sections.find((s) => s.subjectId === 'reading')!.questionIds;
    const perPassage = new Map<string, number>();
    for (const id of reading) {
      const passage = id.split('-')[1];
      perPassage.set(passage, (perPassage.get(passage) ?? 0) + 1);
    }
    expect(Math.max(...perPassage.values())).toBeLessThanOrEqual(
      ENT_CONFIG.express.maxQuestionsPerPassage,
    );
  });

  it('pads a thin profile bank instead of failing', async () => {
    const sections = await generateExpress(buildBank());
    const physics = sections.find((s) => s.subjectId === 'profile-2')!.questionIds;
    expect(physics).toHaveLength(ENT_CONFIG.express.profileQuestionsPerSubject);
    expect(physics.filter((id) => id.startsWith('p2-single-'))).toHaveLength(5);
    expect(physics.slice(0, 5).every((id) => id.startsWith('p2-single-'))).toBe(true);
  });

  it('is deterministic for the free-attempt seed regardless of DB row order', async () => {
    const seed = 'free|tpl-ent|ru|2026-11-10';
    const a = await generateExpress(buildBank(), seed);
    const b = await generateExpress([...buildBank()].reverse(), seed);
    expect(a).toEqual(b);
  });
});

describe('ENT express — start', () => {
  it('creates a 32-question, 50-minute session with entScope express', async () => {
    const prisma = makePrisma(buildBank());
    const access = mockAccess();
    const service = new TestSessionService(
      prisma,
      new TestGeneratorService(prisma),
      {} as any,
      {} as any,
      access as any,
    );

    await service.startTest('user-1', 'tpl-ent', 'ru', ['profile-1', 'profile-2'], 'express');

    const data = prisma.testSession.create.mock.calls[0][0].data;
    expect(data.totalQuestions).toBe(ENT_CONFIG.express.totalQuestions);
    expect(data.timeRemaining).toBe(ENT_CONFIG.express.durationMins * 60);
    expect(data.metadata.entScope).toBe('express');
    expect(data.metadata.entSessionDurationMins).toBe(ENT_CONFIG.express.durationMins);
    expect(data.metadata.questionOrder).toHaveLength(ENT_CONFIG.express.totalQuestions);
    expect(data.metadata.sections.map((s: any) => [s.subjectSlug, s.questionCount])).toEqual([
      ['history_kz', 8],
      ['reading_literacy', 4],
      ['math_literacy', 4],
      ['math', 8],
      ['physics', 8],
    ]);
    // Бесплатная попытка тратится так же, как у полного ЕНТ.
    // (сервис оборачивает Tx-вариант и делегирует в assertAndConsumeAttempt).
    expect(access.assertAndConsumeAttempt).toHaveBeenCalledTimes(1);
  });

  it('requires a profile pair', async () => {
    const prisma = makePrisma(buildBank());
    const service = new TestSessionService(
      prisma,
      new TestGeneratorService(prisma),
      {} as any,
      {} as any,
      mockAccess() as any,
    );
    await expect(
      service.startTest('user-1', 'tpl-ent', 'ru', undefined, 'express'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(prisma.testSession.create).not.toHaveBeenCalled();
  });

  it('accepts entScope express in the start DTO and rejects unknown scopes', async () => {
    const base = { templateId: '3f1c1a8e-1c2b-4c55-9a55-0d6c1f8a7b10', language: 'ru' };
    const ok = await validate(plainToInstance(StartTestDto, { ...base, entScope: 'express' }));
    const bad = await validate(plainToInstance(StartTestDto, { ...base, entScope: 'turbo' }));
    expect(ok).toHaveLength(0);
    expect(bad.map((e) => e.property)).toEqual(['entScope']);
  });
});

/** Сессия экспресса для скорера: каждый ответ верен, если его id в `correct`. */
function buildExpressSession(correctPerSubject: Record<string, number>, entScope = 'express') {
  const bank = buildBank();
  const byId = new Map(bank.map((row) => [row.id, row]));
  const pick: Record<string, string[]> = {
    history: [...range(6).map((i) => `hs-plain-${i}`), 'hs-text-0', 'hs-text-1'],
    reading: ['rd-p0-0', 'rd-p0-1', 'rd-p1-0', 'rd-p1-1'],
    'math-lit': range(4).map((i) => `ml-single-${i}`),
    // Профиль 1 — с весом 2 и «тяжёлой» позицией: в экспрессе всё равно 1 балл.
    'profile-1': [...range(6).map((i) => `p1-single-${i}`), 'p1-weighted-0', 'p1-weighted-1'],
    // Профиль 2 — с добором из multi-select (3 верных из 8): тоже 1 балл.
    'profile-2': [...range(5).map((i) => `p2-single-${i}`), 'p2-2a-0', 'p2-2a-1', 'p2-2a-2'],
  };
  const order = ['history', 'reading', 'math-lit', 'profile-1', 'profile-2'];
  const answers: any[] = [];
  const questionOrder: string[] = [];
  for (const subjectId of order) {
    pick[subjectId].forEach((qid, idx) => {
      const row = byId.get(qid)!;
      questionOrder.push(qid);
      const correctIds = row.answerOptions.filter((o) => o.isCorrect).map((o) => o.id);
      answers.push({
        id: `ans-${qid}`,
        questionId: qid,
        selectedIds: idx < (correctPerSubject[subjectId] ?? 0) ? correctIds : [row.answerOptions.at(-1)!.id],
        question: {
          id: qid,
          subjectId,
          scoreWeight: row.scoreWeight ?? (subjectId.startsWith('profile') ? 5 : null),
          content: row.content,
          answerOptions: row.answerOptions.map((o, i) => ({ ...o, sortOrder: i, content: { ru: o.id } })),
          subject: { ...SUBJECTS[subjectId], name: { ru: SUBJECTS[subjectId].name } },
        },
      });
    });
  }
  return {
    id: 'express-1',
    userId: 'user-1',
    status: 'completed',
    score: null,
    examTypeId: 'exam-ent',
    examType: { slug: 'ent' },
    metadata: {
      entScope,
      questionOrder,
      sections: order.map((subjectId, i) => ({
        subjectId,
        subjectSlug: SUBJECTS[subjectId].slug,
        isMandatory: SUBJECTS[subjectId].isMandatory,
        questionCount: pick[subjectId].length,
        sortOrder: i + 1,
        // Даже если в metadata окажется порог 2-балльных — экспресс его игнорирует.
        profileHeavyFrom: SUBJECTS[subjectId].isMandatory ? null : 1,
      })),
    },
    answers,
  };
}

function scorerFor(session: unknown) {
  return new TestScorerService({
    testSession: { findUnique: jest.fn().mockResolvedValue(session) },
  } as any);
}

describe('ENT express — scoring and estimate', () => {
  it('scores every question as exactly 1 point (max 32)', async () => {
    const session = buildExpressSession({ history: 8, reading: 4, 'math-lit': 4, 'profile-1': 8, 'profile-2': 8 });
    const result = await scorerFor(session).calculateScore('express-1', undefined, { readOnly: true });
    expect(result.maxScore).toBe(ENT_CONFIG.express.totalQuestions);
    expect(result.rawScore).toBe(ENT_CONFIG.express.totalQuestions);
    expect(result.correctCount).toBe(ENT_CONFIG.express.totalQuestions);
    expect(result.answerScores.every((a) => a.maxPoints === 1 && a.earnedPoints === 1)).toBe(true);
  });

  it('gives 0 (never a partial point) for a partly correct padded multi-select item', async () => {
    const session = buildExpressSession({});
    const padded = session.answers.find((a: any) => a.questionId === 'p2-2a-0');
    padded.selectedIds = [padded.question.answerOptions[0].id, padded.question.answerOptions[1].id];
    const result = await scorerFor(session).calculateScore('express-1', undefined, { readOnly: true });
    const score = result.answerScores.find((a) => a.questionId === 'p2-2a-0')!;
    expect(score).toMatchObject({ maxPoints: 1, earnedPoints: 0 });
    expect(result.rawScore).toBe(0);
  });

  it('scales the share of correct answers per subject to its ENT max (out of 140)', () => {
    const estimate = estimateEntScoreFromExpress([
      { subjectSlug: 'history_kz', correctCount: 6, totalCount: 8 }, // 15
      { subjectSlug: 'reading_literacy', correctCount: 3, totalCount: 4 }, // 7.5
      { subjectSlug: 'math_literacy', correctCount: 2, totalCount: 4 }, // 5
      { subjectSlug: 'math', correctCount: 5, totalCount: 8 }, // 31.25
      { subjectSlug: 'physics', correctCount: 4, totalCount: 8 }, // 25
    ]);
    expect(estimate.max).toBe(140);
    expect(estimate.score).toBe(84); // round(83.75)
    expect(estimate.sections.map((s) => [s.subjectSlug, s.maxPoints, s.points])).toEqual([
      ['history_kz', 20, 15],
      ['reading_literacy', 10, 8],
      ['math_literacy', 10, 5],
      ['math', 50, 31],
      ['physics', 50, 25],
    ]);
    const all = (correct: boolean) =>
      estimateEntScoreFromExpress(
        ['history_kz', 'reading_literacy', 'math_literacy', 'math', 'physics'].map((slug) => ({
          subjectSlug: slug,
          correctCount: correct ? 8 : 0,
          totalCount: 8,
        })),
      ).score;
    expect(all(true)).toBe(140);
    expect(all(false)).toBe(0);
  });

  it('exposes entEstimate from the review endpoint only for express sessions', async () => {
    const counts = { history: 6, reading: 3, 'math-lit': 2, 'profile-1': 5, 'profile-2': 4 };
    const reviewFor = async (entScope: string) => {
      const session = buildExpressSession(counts, entScope);
      const prisma = {
        testSession: { findFirst: jest.fn().mockResolvedValue(session) },
        questionAppeal: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const service = new TestSessionService(prisma, {} as any, scorerFor(session), {} as any, {} as any);
      return service.getReview('express-1', 'user-1');
    };

    const express = await reviewFor('express');
    expect(express.rawScore).toBe(20);
    expect(express.maxScore).toBe(32);
    expect((express as any).entEstimate).toMatchObject({ score: 84, max: 140 });

    const full = await reviewFor('full');
    expect((full as any).entEstimate).toBeUndefined();
  });
});

describe('ENT express — not a full ENT result', () => {
  const finished = new Date('2026-11-01T10:00:00Z');
  const expressRow = {
    id: 'express',
    userId: 'user-1',
    status: 'completed',
    totalQuestions: ENT_CONFIG.express.totalQuestions as number,
    rawScore: 32,
    maxScore: 32,
    score: 100,
    correctCount: 32,
    durationSecs: 1500,
    finishedAt: finished,
    metadata: { entScope: 'express', profileSubjectIds: ['profile-1', 'profile-2'] },
    examTypeId: 'exam-ent',
    examType: { id: 'exam-ent', slug: 'ent', name: 'ЕНТ' },
    user: { firstName: 'A', lastName: 'B', telegramUsername: null, avatarUrl: null },
  };
  const fullRow = {
    ...expressRow,
    id: 'full',
    totalQuestions: ENT_CONFIG.totalQuestions,
    rawScore: 90,
    maxScore: ENT_CONFIG.maxTotalPoints,
    score: 64.29,
    correctCount: 80,
    durationSecs: 12000,
    metadata: { entScope: 'full', profileSubjectIds: ['profile-1', 'profile-2'] },
  };

  /** Минимальный in-memory фильтр по where лидерборда. */
  function matchesLeaderboardWhere(row: any, where: any): boolean {
    if (where.userId && row.userId !== where.userId) return false;
    if (where.status?.in && !where.status.in.includes(row.status)) return false;
    if (where.totalQuestions !== undefined && row.totalQuestions !== where.totalQuestions) return false;
    if (where.maxScore !== undefined && row.maxScore !== where.maxScore) return false;
    if (where.rawScore?.not === null && row.rawScore == null) return false;
    if (where.examType?.slug && row.examType.slug !== where.examType.slug) return false;
    return true;
  }

  it('leaderboard and ENT standing ignore express sessions', async () => {
    const rows = [expressRow, fullRow, { ...expressRow, id: 'express-only', userId: 'user-2' }];
    const prisma = {
      testSession: {
        findMany: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(rows.filter((row) => matchesLeaderboardWhere(row, where))),
        ),
        count: jest.fn().mockImplementation(({ where }: any) =>
          Promise.resolve(rows.filter((row) => matchesLeaderboardWhere(row, where)).length),
        ),
      },
      subject: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const service = new LeaderboardService(prisma);

    const board = await service.getEntLeaderboard('user-2');
    expect(board.items.map((row: any) => row.sessionId ?? row.id)).toEqual(['full']);
    expect(board.me).toBeNull();

    const standing = await service.getEntStanding('user-1');
    expect(standing.attempts).toBe(1);
  });

  it('profile stats best ENT result ignores express sessions', async () => {
    const prisma = {
      testSession: {
        findMany: jest
          .fn()
          .mockResolvedValueOnce([expressRow, fullRow])
          .mockResolvedValueOnce([]),
      },
    } as any;
    const service = new UsersService(prisma, {} as any, {} as any, staticMonetization());
    const stats = await service.getStats('user-1');
    expect(stats.totalTests).toBe(1);
    expect(stats.byExamType[0]).toMatchObject({ bestRawScore: 90, bestMaxScore: 140, testsCount: 1 });
  });

  it('admission goal / score projection never uses an express score as the current ENT score', async () => {
    const run = async (rows: any[]) => {
      const prisma = {
        examType: { findFirst: jest.fn().mockResolvedValue({ id: 'exam-ent' }) },
        testSession: {
          findFirst: jest.fn().mockImplementation(({ where }: any) => {
            const eligible = rows
              .filter((row) => row.rawScore != null && row.maxScore >= (where.maxScore?.gte ?? 0))
              .sort((a, b) => b.rawScore - a.rawScore);
            return Promise.resolve(eligible[0] ?? null);
          }),
        },
      } as any;
      const service = new MistakesService(prisma);
      return (service as any).computeEntScoreImpact('user-1', [], []);
    };

    expect(await run([expressRow])).toEqual({ available: false });
    expect(await run([expressRow, fullRow])).toMatchObject({ available: true, lastScore: 90, maxScore: 140 });
  });

  it('statistics count express as practice activity, not as a full ENT exam', () => {
    const toStats = (row: typeof expressRow): StatisticsSession => ({
      id: row.id,
      examTypeId: row.examTypeId,
      examType: row.examType,
      status: row.status,
      finishedAt: row.finishedAt,
      rawScore: row.rawScore,
      maxScore: row.maxScore,
      score: row.score,
      totalQuestions: row.totalQuestions,
      durationSecs: row.durationSecs,
      language: 'ru',
      metadata: row.metadata,
    });
    expect(statisticsFormat(toStats(expressRow))).toBe('practice');
    const filter = { period: 'all', page: 1 } as const;
    const exam = buildStatistics([toStats(expressRow), toStats(fullRow)], { ...filter, format: 'exam' });
    const practice = buildStatistics([toStats(expressRow), toStats(fullRow)], { ...filter, format: 'practice' });
    expect(exam.sessionIds).toEqual(['full']);
    expect(practice.sessionIds).toEqual(['express']);
  });
});
