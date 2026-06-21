import { ENT_CONFIG } from '@bilimland/shared';
import { TestGeneratorService } from '../src/modules/tests/test-generator.service';

/**
 * Verifies the deterministic ("free attempt") generation mode:
 * - the same seed yields a byte-identical question set + order, for every account;
 * - the result is independent of the DB row order (canonicalization);
 * - all strict ENT profile selection rules (tier1 1-30, tier2A 31-35, tier2B 36-40,
 *   text block, exact 40) are still honored;
 * - without a seed, generation stays randomized.
 */

type Q = {
  id: string;
  content: unknown;
  answerOptions: Array<{ isCorrect: boolean }>;
  subject: { slug: string };
};

function opts(count: number, correct: number) {
  return Array.from({ length: count }, (_, i) => ({ isCorrect: i < correct }));
}

function buildMathBank(): Q[] {
  const bank: Q[] = [];
  // 25 tier-1 questions WITHOUT a passage (slots 1-25): 4 options, 1 correct.
  for (let i = 0; i < 25; i++) {
    bank.push({
      id: `math-t1-${String(i).padStart(2, '0')}`,
      content: { ru: { text: `q${i}` } },
      answerOptions: opts(ENT_CONFIG.profileTier1OptionCount, ENT_CONFIG.profileTier1CorrectCount),
      subject: { slug: 'math' },
    });
  }
  // A 6-question text block sharing one passage (slots 26-30 are drawn from here).
  for (let i = 0; i < 6; i++) {
    bank.push({
      id: `math-tb-${i}`,
      content: { passage: 'SHARED PASSAGE', ru: { text: `tb${i}` } },
      answerOptions: opts(ENT_CONFIG.profileTier1OptionCount, ENT_CONFIG.profileTier1CorrectCount),
      subject: { slug: 'math' },
    });
  }
  // 6 tier-2A questions (slots 31-35): 8 options, up to 3 correct.
  for (let i = 0; i < 6; i++) {
    bank.push({
      id: `math-2a-${i}`,
      content: { ru: { text: `a${i}` } },
      answerOptions: opts(ENT_CONFIG.profileTier2AOptionCount, ENT_CONFIG.profileTier2ACorrectCount),
      subject: { slug: 'math' },
    });
  }
  // 6 tier-2B questions (slots 36-40): 6 options, up to 3 correct.
  for (let i = 0; i < 6; i++) {
    bank.push({
      id: `math-2b-${i}`,
      content: { ru: { text: `b${i}` } },
      answerOptions: opts(ENT_CONFIG.profileTier2BOptionCount, 2),
      subject: { slug: 'math' },
    });
  }
  return bank;
}

function makeGenerator(bank: Q[]): TestGeneratorService {
  const prismaMock = {
    testTemplate: {
      findUnique: jest.fn().mockResolvedValue({
        id: 'tpl-ent',
        examTypeId: 'exam-ent',
        examType: { slug: 'ent' },
        sections: [],
      }),
    },
    question: {
      // Ignore the where/select shape — return the (test-controlled) bank as-is.
      // The generator only reads the fields it needs; extra fields are harmless.
      findMany: jest.fn().mockImplementation(() => Promise.resolve(bank)),
    },
    testAnswer: {
      findMany: jest.fn().mockResolvedValue([]),
    },
  } as any;
  return new TestGeneratorService(prismaMock);
}

const TB_IDS = new Set(['math-tb-0', 'math-tb-1', 'math-tb-2', 'math-tb-3', 'math-tb-4', 'math-tb-5']);
const T2A_IDS = new Set(['math-2a-0', 'math-2a-1', 'math-2a-2', 'math-2a-3', 'math-2a-4', 'math-2a-5']);
const T2B_IDS = new Set(['math-2b-0', 'math-2b-1', 'math-2b-2', 'math-2b-3', 'math-2b-4', 'math-2b-5']);

async function genProfile(
  generator: TestGeneratorService,
  seed?: string,
): Promise<string[]> {
  const sections = await generator.generateFromTemplate(
    'tpl-ent',
    ['math'],
    ENT_CONFIG.profileQuestionsPerSubject,
    'user-x',
    'ru',
    seed ? { entScope: 'profile', seed } : { entScope: 'profile' },
  );
  expect(sections).toHaveLength(1);
  return sections[0].questionIds;
}

describe('free attempt → deterministic test generation', () => {
  const SEED = 'free|tpl-ent|ru';

  it('produces a byte-identical test for the same seed, independent of DB row order', async () => {
    const bankA = buildMathBank();
    const bankB = [...buildMathBank()].reverse(); // different physical/DB order

    const run1 = await genProfile(makeGenerator(bankA), SEED);
    const run2 = await genProfile(makeGenerator(bankA), SEED);
    const run3 = await genProfile(makeGenerator(bankB), SEED); // reversed bank

    expect(run1).toEqual(run2); // same seed → identical
    expect(run1).toEqual(run3); // canonicalized → DB order doesn't matter
  });

  it('still honors strict ENT profile composition under a seed', async () => {
    const ids = await genProfile(makeGenerator(buildMathBank()), SEED);

    expect(ids).toHaveLength(ENT_CONFIG.profileQuestionsPerSubject); // exactly 40
    expect(new Set(ids).size).toBe(ids.length); // no duplicates

    // 31-35 are tier-2A, 36-40 are tier-2B.
    const tier2A = ids.slice(ENT_CONFIG.profileTier1Count, ENT_CONFIG.profileTier1Count + ENT_CONFIG.profileTier2ACount);
    const tier2B = ids.slice(ENT_CONFIG.profileTier1Count + ENT_CONFIG.profileTier2ACount);
    expect(tier2A).toHaveLength(ENT_CONFIG.profileTier2ACount);
    expect(tier2B).toHaveLength(ENT_CONFIG.profileTier2BCount);
    expect(tier2A.every((id) => T2A_IDS.has(id))).toBe(true);
    expect(tier2B.every((id) => T2B_IDS.has(id))).toBe(true);

    // 1-30 are tier-1; the text block (slots 26-30) is contiguous and from one passage.
    const tier1 = ids.slice(0, ENT_CONFIG.profileTier1Count);
    expect(tier1.every((id) => id.startsWith('math-t1-') || TB_IDS.has(id))).toBe(true);
    const textSlots = tier1.slice(ENT_CONFIG.profileTextBlockStart - 1); // slots 26-30
    expect(textSlots).toHaveLength(ENT_CONFIG.profileTextBlockQuestionCount);
    expect(textSlots.every((id) => TB_IDS.has(id))).toBe(true);
  });

  it('stays randomized without a seed (different order across runs)', async () => {
    const generator = makeGenerator(buildMathBank());
    const runs = await Promise.all([
      genProfile(generator),
      genProfile(generator),
      genProfile(generator),
      genProfile(generator),
    ]);
    // With 40 ordered items, two random runs being identical is astronomically unlikely;
    // require that at least one of the later runs differs from the first.
    const allIdenticalToFirst = runs.slice(1).every((r) => JSON.stringify(r) === JSON.stringify(runs[0]));
    expect(allIdenticalToFirst).toBe(false);
  });
});
