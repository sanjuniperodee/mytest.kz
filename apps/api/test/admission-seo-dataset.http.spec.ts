import { readFileSync } from 'fs';
import { join } from 'path';
import { buildSeoDataset, type SeoDatasetSource } from '../src/modules/admission/domain/seo-dataset';

const cycle = (id: string, slug: string, admissionYear: number | null, createdAt = '2026-08-10') => ({
  id,
  slug,
  admissionYear,
  createdAt: new Date(createdAt),
});

const program = (id: string, code: string, profileVariant: number, profileSubjects: string) => ({
  id,
  code,
  profileVariant,
  name: `Program ${code}`,
  nameKk: null,
  profileSubjects,
  profileSubjectsKk: null,
});

const cutoff = (
  cycleId: string,
  universityCode: number,
  programId: string,
  quotaType: 'GRANT' | 'RURAL',
  minScore: number | null,
) => ({ cycleId, universityCode, programId, quotaType, minScore, maxScore: 130, avgScore: 110.04, grantCount: 7 });

describe('admission SEO dataset', () => {
  const source: SeoDatasetSource = {
    cycles: [cycle('c25', '2025-2026', 2025, '2025-08-10'), cycle('c26', '2026-2027', null)],
    universities: [
      { code: 27, name: 'КазНУ полное', nameKk: 'ҚазҰУ', shortName: 'КазНУ' },
      { code: 99, name: 'Без грантов', nameKk: null, shortName: null },
    ],
    programs: [
      program('p0', 'B018', 0, 'Английский язык - Всемирная история'),
      program('p1', 'B018', 1, 'Немецкий язык - Всемирная история'),
    ],
    cutoffs: [
      cutoff('c26', 27, 'p1', 'GRANT', 101),
      cutoff('c26', 27, 'p0', 'GRANT', 100),
      cutoff('c26', 27, 'p0', 'RURAL', 92),
      cutoff('c25', 27, 'p0', 'GRANT', 97),
      cutoff('c25', 27, 'p0', 'RURAL', null),
      cutoff('c25', 99, 'p0', 'GRANT', null),
    ],
  };

  it('collapses ГОП variants, merges the rural cutoff and skips empty scores', () => {
    const dataset = buildSeoDataset(source);
    expect(dataset.years).toEqual([2025, 2026]); // 2026 taken from the slug
    expect(dataset.rows).toEqual([
      [27, 'B018', 2025, 97, 110, 130, 7, null],
      [27, 'B018', 2026, 100, 110, 130, 7, 92],
    ]);
    expect(dataset.universities.map((u) => u.code)).toEqual([27]);
    expect(dataset.programs).toEqual([
      {
        code: 'B018',
        name: 'Program B018',
        nameKk: null,
        subjects: ['Английский язык - Всемирная история', 'Немецкий язык - Всемирная история'],
        subjectsKk: ['Английский язык - Всемирная история', 'Немецкий язык - Всемирная история'],
      },
    ]);
    expect(dataset.generatedAt).toBe(new Date('2026-08-10').toISOString());
  });

  it('matches the web fallback snapshot when built from the committed seed', () => {
    const root = join(__dirname, '../..');
    const seed = JSON.parse(
      readFileSync(join(root, 'api/prisma/data/grant-admission/grant-admission-seed-data.json'), 'utf8'),
    );
    const snapshot = JSON.parse(readFileSync(join(root, 'web/lib/seo/grant-cutoffs.data.json'), 'utf8'));

    const programId = (code: string, variant: number) => `${code}:${variant}`;
    const dataset = buildSeoDataset({
      cycles: seed.cycles.map((c: { slug: string; admissionYear: number }, i: number) =>
        cycle(c.slug, c.slug, c.admissionYear, `202${3 + i}-08-10`),
      ),
      universities: seed.universities.map((u: any) => ({
        code: u.code,
        name: u.name,
        nameKk: u.nameKk ?? null,
        shortName: u.shortName ?? null,
      })),
      programs: seed.programs.map((p: any) => ({
        id: programId(p.code, p.profileVariant),
        code: p.code,
        profileVariant: p.profileVariant,
        name: p.name,
        nameKk: p.nameKk ?? null,
        profileSubjects: p.profileSubjects,
        profileSubjectsKk: p.profileSubjectsKk ?? null,
      })),
      cutoffs: seed.cutoffs.map((c: any) => ({
        cycleId: c.cycleSlug,
        universityCode: c.universityCode,
        programId: c.programKey,
        quotaType: c.quotaType,
        minScore: c.minScore,
        maxScore: c.maxScore ?? null,
        avgScore: c.avgScore ?? null,
        grantCount: c.grantCount ?? null,
      })),
    });

    expect(dataset.years).toEqual(snapshot.years);
    expect(dataset.rows).toEqual(snapshot.rows);
    expect(dataset.universities).toEqual(snapshot.universities);
    expect(dataset.programs).toEqual(snapshot.programs);
  });
});
