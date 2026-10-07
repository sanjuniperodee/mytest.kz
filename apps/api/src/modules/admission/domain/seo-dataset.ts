import type { AdmissionSeoDatasetDto } from '@bilimland/shared';

export type SeoDatasetSource = {
  cycles: { id: string; slug: string; admissionYear: number | null; createdAt: Date }[];
  universities: { code: number; name: string; nameKk: string | null; shortName: string | null }[];
  programs: {
    id: string;
    code: string;
    profileVariant: number;
    name: string;
    nameKk: string | null;
    profileSubjects: string;
    profileSubjectsKk: string | null;
  }[];
  cutoffs: {
    cycleId: string;
    universityCode: number;
    programId: string;
    quotaType: 'GRANT' | 'RURAL';
    minScore: number | null;
    maxScore: number | null;
    avgScore: number | null;
    grantCount: number | null;
  }[];
};

/** ЕНТ year of a cycle: `admissionYear`, or the first year of the slug ("2026-2027" → 2026). */
function cycleYear(cycle: { slug: string; admissionYear: number | null }): number | null {
  if (cycle.admissionYear != null) return cycle.admissionYear;
  const year = Number(cycle.slug.slice(0, 4));
  return Number.isInteger(year) && year > 2000 ? year : null;
}

/**
 * Compact dataset behind the public «проходной балл» pages: one row per
 * university × ГОП × year of the general competition, with the rural-quota cutoff
 * alongside. A ГОП's cutoff applies to all its profile-subject variants (grants are
 * awarded per ГОП), so variant duplicates collapse onto the lowest variant.
 */
export function buildSeoDataset(source: SeoDatasetSource): AdmissionSeoDatasetDto {
  const programById = new Map(source.programs.map((p) => [p.id, p]));
  const cycleById = new Map(source.cycles.map((c) => [c.id, c]));

  type Picked = { variant: number; row: SeoDatasetSource['cutoffs'][number] };
  const picked = new Map<string, Picked>();
  for (const row of source.cutoffs) {
    if (row.minScore == null) continue;
    const program = programById.get(row.programId);
    const cycle = cycleById.get(row.cycleId);
    const year = cycle ? cycleYear(cycle) : null;
    if (!program || year == null) continue;
    const key = `${row.universityCode}|${program.code}|${year}|${row.quotaType}`;
    const current = picked.get(key);
    if (!current || program.profileVariant < current.variant) {
      picked.set(key, { variant: program.profileVariant, row });
    }
  }

  const rows: AdmissionSeoDatasetDto['rows'] = [];
  for (const [key, { row }] of picked) {
    const [uni, code, year, quota] = key.split('|');
    if (quota !== 'GRANT') continue;
    const rural = picked.get(`${uni}|${code}|${year}|RURAL`)?.row;
    const min = row.minScore!;
    rows.push([
      Number(uni),
      code,
      Number(year),
      min,
      row.avgScore != null ? Math.round(row.avgScore * 10) / 10 : min,
      row.maxScore ?? min,
      row.grantCount ?? 0,
      rural?.minScore ?? null,
    ]);
  }
  rows.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]) || a[2] - b[2]);

  const usedUniversities = new Set(rows.map((r) => r[0]));
  const usedPrograms = new Set(rows.map((r) => r[1]));

  const programsByCode = new Map<string, AdmissionSeoDatasetDto['programs'][number] & { variant: number }>();
  for (const p of [...source.programs].sort((a, b) => a.profileVariant - b.profileVariant)) {
    if (!usedPrograms.has(p.code)) continue;
    const entry = programsByCode.get(p.code) ?? {
      code: p.code,
      name: p.name,
      nameKk: p.nameKk || null,
      subjects: [],
      subjectsKk: [],
      variant: p.profileVariant,
    };
    if (p.profileSubjects && !entry.subjects.includes(p.profileSubjects)) entry.subjects.push(p.profileSubjects);
    const kk = p.profileSubjectsKk || p.profileSubjects;
    if (kk && !entry.subjectsKk.includes(kk)) entry.subjectsKk.push(kk);
    programsByCode.set(p.code, entry);
  }

  const years = [...new Set(rows.map((r) => r[2]))].sort((a, b) => a - b);
  const newestCycle = [...source.cycles].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];

  return {
    generatedAt: (newestCycle?.createdAt ?? new Date(0)).toISOString(),
    source: 'MNVO RK grant-holder lists (бакалавриат)',
    years,
    universities: source.universities
      .filter((u) => usedUniversities.has(u.code))
      .sort((a, b) => a.code - b.code)
      .map((u) => ({ code: u.code, name: u.name, nameKk: u.nameKk || null, shortName: u.shortName || null })),
    programs: [...programsByCode.values()]
      .sort((a, b) => a.code.localeCompare(b.code))
      .map(({ variant: _variant, ...p }) => p),
    rows,
  };
}
