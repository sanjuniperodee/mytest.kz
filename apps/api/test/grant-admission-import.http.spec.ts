import * as fs from 'fs';
import * as path from 'path';
import { buildCycleCutoffs } from '../prisma/import-grant-csvs';

const row = (over: Record<string, string>) => ({
  year: '2026',
  section: 'GENERAL',
  form: 'FULL',
  programCode: 'B057',
  programTag: '',
  programName: 'Информационные технологии',
  universityCode: '13',
  quota: 'GENERAL',
  minScore: '100',
  maxScore: '130',
  avgScore: '110',
  grantCount: '10',
  ...over,
});

const program = (code: string, profileVariant: number, profileSubjects: string) => ({
  code,
  profileVariant,
  name: code,
  profileSubjects,
  profileShortLabel: null,
});

describe('grant admission import (official grant-holder aggregates -> cutoffs)', () => {
  const programsByCode = new Map([
    ['B057', [program('B057', 0, 'Математика - Информатика')]],
    [
      'B037',
      [
        program('B037', 0, 'Казахский язык - Казахская литература'),
        program('B037', 1, 'Русский язык - Русская литература'),
      ],
    ],
  ]);

  it('merges the open full-time competitions and keeps quotas apart', () => {
    const { cutoffs, unknownPrograms } = buildCycleCutoffs(
      '2026-2027',
      [
        row({}),
        row({ section: 'UNIVERSITY_TECHNICAL', minScore: '95', maxScore: '120', avgScore: '100', grantCount: '10' }),
        row({ quota: 'RURAL', minScore: '90', maxScore: '99', avgScore: '94', grantCount: '4' }),
        // excluded: social quota, western regions, short form, joint program, out-of-competition
        row({ section: 'SOCIAL_QUOTA', minScore: '60' }),
        row({ section: 'WESTERN_REGIONS', minScore: '61' }),
        row({ form: 'SHORT', minScore: '30' }),
        row({ section: 'FOREIGN_BRANCH', programTag: 'KZ-US-013', minScore: '62' }),
        row({ section: 'OUT_OF_COMPETITION', minScore: '63' }),
      ] as never,
      programsByCode as never,
    );
    expect(unknownPrograms.size).toBe(0);
    expect(cutoffs).toEqual([
      {
        cycleSlug: '2026-2027',
        universityCode: 13,
        programKey: 'B057:0',
        quotaType: 'GRANT',
        minScore: 95,
        maxScore: 130,
        avgScore: 105,
        grantCount: 20,
      },
      {
        cycleSlug: '2026-2027',
        universityCode: 13,
        programKey: 'B057:0',
        quotaType: 'RURAL',
        minScore: 90,
        maxScore: 99,
        avgScore: 94,
        grantCount: 4,
      },
    ]);
  });

  it('keeps standalone foreign institutions and applies a cutoff to every profile variant', () => {
    const { cutoffs, unknownPrograms } = buildCycleCutoffs(
      '2026-2027',
      [
        row({ section: 'FOREIGN_BRANCH', programTag: 'DE-537', universityCode: '537' }),
        row({ programCode: 'B037', universityCode: '7', minScore: '119' }),
        row({ programCode: 'B999' }),
      ] as never,
      programsByCode as never,
    );
    expect(unknownPrograms).toEqual(new Set(['B999']));
    expect(cutoffs.map((c) => `${c.universityCode}:${c.programKey}:${c.minScore}`)).toEqual([
      '7:B037:0:119',
      '7:B037:1:119',
      '537:B057:0:100',
    ]);
  });

  it('committed seed JSON has all four cycles with grant statistics', () => {
    const json = JSON.parse(
      fs.readFileSync(
        path.join(__dirname, '..', 'prisma', 'data', 'grant-admission', 'grant-admission-seed-data.json'),
        'utf8',
      ),
    ) as {
      cycles: { slug: string; admissionYear: number }[];
      universities: { code: number }[];
      cutoffs: { cycleSlug: string; universityCode: number; minScore: number; grantCount: number }[];
    };
    expect(json.cycles.map((c) => [c.slug, c.admissionYear])).toEqual([
      ['2023-2024', 2023],
      ['2024-2025', 2024],
      ['2025-2026', 2025],
      ['2026-2027', 2026],
    ]);
    const uniCodes = new Set(json.universities.map((u) => u.code));
    for (const c of json.cutoffs) {
      expect(uniCodes.has(c.universityCode)).toBe(true);
      expect(c.minScore).toBeGreaterThanOrEqual(0);
      expect(c.minScore).toBeLessThanOrEqual(140);
      expect(c.grantCount).toBeGreaterThan(0);
    }
    for (const slug of ['2025-2026', '2026-2027']) {
      expect(new Set(json.cutoffs.filter((c) => c.cycleSlug === slug).map((c) => c.universityCode)).size).toBeGreaterThan(80);
    }
  });
});
