/**
 * Builds prisma/data/grant-admission/grant-admission-seed-data.json from:
 *   - universities.csv            — university reference (code, official name, short name)
 *   - programs.csv                — program groups (ГОП) × profile-subject combinations
 *   - results/grant-results-YYYY.csv — per (university × ГОП × quota) aggregates of the official
 *     MNVO grant-holder list, produced by prisma/scripts/parse_grant_holders_pdf.py
 * See prisma/data/grant-admission/README.md for the full pipeline.
 *
 * Run: npm run import:grant-admission -w @bilimland/api
 */
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const DATA_DIR = path.join(__dirname, 'data', 'grant-admission');
const OUT_JSON = path.join(DATA_DIR, 'grant-admission-seed-data.json');

/**
 * Admission cycles. `slug` is the academic year the grant is for (kept for backwards compatibility
 * with stored user goals), `admissionYear` is the year of the ЕНТ / grant competition.
 */
const CYCLES: { slug: string; admissionYear: number; resultsFile: string }[] = [
  { slug: '2023-2024', admissionYear: 2023, resultsFile: 'results/grant-results-2023.csv' },
  { slug: '2024-2025', admissionYear: 2024, resultsFile: 'results/grant-results-2024.csv' },
  { slug: '2025-2026', admissionYear: 2025, resultsFile: 'results/grant-results-2025.csv' },
  { slug: '2026-2027', admissionYear: 2026, resultsFile: 'results/grant-results-2026.csv' },
];

/**
 * Sections of the grant-holder list that form a university's "проходной балл".
 * Everything here is an open, nationwide competition for full-time study at that university:
 *   GENERAL                   — общий конкурс (state order by program group)
 *   HEALTH_MINISTRY           — госзаказ Минздрава (medical programs)
 *   UNIVERSITY_PEDAGOGICAL /  — госзаказ, размещённый напрямую в вузе (pedagogical /
 *   UNIVERSITY_TECHNICAL        technical & agricultural groups)
 *   FOREIGN_BRANCH            — only standalone foreign institutions with their own code (e.g. "DE-537");
 *                               joint programs hosted by a domestic university ("KZ-US-045") are a separate
 *                               competition and are excluded.
 * Excluded: social quotas (orphans, disability, large families…), western-region / relocation
 * programs (restricted by residence), short-form (college graduates), out-of-competition grants.
 */
const INCLUDED_SECTIONS = new Set([
  'GENERAL',
  'HEALTH_MINISTRY',
  'UNIVERSITY_PEDAGOGICAL',
  'UNIVERSITY_TECHNICAL',
  'FOREIGN_BRANCH',
]);
const STANDALONE_FOREIGN_TAG_RE = /^[A-Z]{2}-\d{3}$/;
const QUOTA_MAP: Record<string, 'GRANT' | 'RURAL' | undefined> = { GENERAL: 'GRANT', RURAL: 'RURAL' };

type ProgramRow = {
  code: string;
  profileVariant: number;
  name: string;
  profileSubjects: string;
  profileShortLabel: string | null;
  nameKk?: string | null;
  profileSubjectsKk?: string | null;
};

type UniRow = { code: number; name: string; shortName: string | null; nameKk?: string | null };

type KkNameRow = { kind: 'university' | 'program'; code: string; nameRu: string; nameKk: string; source: string };

type ResultRow = {
  year: string;
  section: string;
  form: string;
  programCode: string;
  programTag: string;
  programName: string;
  universityCode: string;
  quota: string;
  minScore: string;
  maxScore: string;
  avgScore: string;
  grantCount: string;
};

export type CutoffRow = {
  cycleSlug: string;
  universityCode: number;
  programKey: string;
  quotaType: 'GRANT' | 'RURAL';
  minScore: number;
  maxScore: number;
  avgScore: number;
  grantCount: number;
};

const PROGRAM_CODE_RE = /^BM?\d+$/i;

function normalizeProgramCode(value: string): string {
  return value.replace(/\s+/g, '').trim().toUpperCase();
}

function readCsvRows(file: string): string[][] {
  const buf = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
  return parse(buf, { relax_column_count: true, skip_empty_lines: false, bom: true }) as string[][];
}

function readCsvObjects<T>(file: string): T[] {
  const buf = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
  return parse(buf, { columns: true, skip_empty_lines: true, bom: true }) as T[];
}

function parseUniversities(rows: string[][]): UniRow[] {
  const out: UniRow[] = [];
  for (const row of rows) {
    const c1 = (row[1] ?? '').trim();
    const c2 = (row[2] ?? '').trim();
    if (!/^\d+$/.test(c1) || !c2) continue;
    const shortName = (row[3] ?? '').trim();
    out.push({ code: parseInt(c1, 10), name: c2, shortName: shortName && shortName !== '-' ? shortName : null });
  }
  return out;
}

function parsePrograms(rows: string[][]): ProgramRow[] {
  let started = false;
  const counts = new Map<string, number>();
  const out: ProgramRow[] = [];

  for (const row of rows) {
    const c0 = (row[0] ?? '').trim();
    if (!started) {
      if (c0.includes('КОД')) started = true;
      continue;
    }
    const code = normalizeProgramCode(c0);
    if (!PROGRAM_CODE_RE.test(code)) continue;
    const name = (row[1] ?? '').replace(/\s+/g, ' ').trim();
    const profileSubjects = (row[2] ?? '').replace(/\s+/g, ' ').trim();
    const profileShortLabel = (row[3] ?? '').trim() || null;
    if (!name) continue;
    const v = counts.get(code) ?? 0;
    counts.set(code, v + 1);
    out.push({ code, profileVariant: v, name, profileSubjects, profileShortLabel });
  }
  return out;
}

function programKey(p: ProgramRow): string {
  return `${p.code}:${p.profileVariant}`;
}

function isIncluded(r: ResultRow): boolean {
  if (r.form !== 'FULL' || !INCLUDED_SECTIONS.has(r.section) || !QUOTA_MAP[r.quota]) return false;
  if (r.section === 'FOREIGN_BRANCH') return STANDALONE_FOREIGN_TAG_RE.test(r.programTag);
  // inside the regular sections a tagged program (joint / double-degree) is a separate competition
  return r.programTag === '';
}

/**
 * Collapses the included result rows of one cycle into one cutoff per (university, ГОП, quota):
 * min / max over all included sections, grant-weighted average, total number of grants.
 * A ГОП's cutoff applies to every profile-subject variant of that code (grants are awarded per ГОП).
 */
export function buildCycleCutoffs(
  cycleSlug: string,
  results: ResultRow[],
  programsByCode: Map<string, ProgramRow[]>,
): { cutoffs: CutoffRow[]; unknownPrograms: Set<string> } {
  type Acc = { min: number; max: number; sum: number; count: number };
  const acc = new Map<string, Acc>();
  for (const r of results) {
    if (!isIncluded(r)) continue;
    const quotaType = QUOTA_MAP[r.quota]!;
    const key = `${r.universityCode}\t${normalizeProgramCode(r.programCode)}\t${quotaType}`;
    const min = Number(r.minScore);
    const max = Number(r.maxScore);
    const count = Number(r.grantCount);
    const avg = Number(r.avgScore);
    if (![min, max, count, avg].every(Number.isFinite) || count <= 0) {
      throw new Error(`Bad numbers in results row: ${JSON.stringify(r)}`);
    }
    const prev = acc.get(key);
    if (prev) {
      prev.min = Math.min(prev.min, min);
      prev.max = Math.max(prev.max, max);
      prev.sum += avg * count;
      prev.count += count;
    } else {
      acc.set(key, { min, max, sum: avg * count, count });
    }
  }

  const cutoffs: CutoffRow[] = [];
  const unknownPrograms = new Set<string>();
  for (const [key, a] of acc) {
    const [uni, code, quotaType] = key.split('\t');
    const variants = programsByCode.get(code);
    if (!variants?.length) {
      unknownPrograms.add(code);
      continue;
    }
    for (const p of variants) {
      cutoffs.push({
        cycleSlug,
        universityCode: Number(uni),
        programKey: programKey(p),
        quotaType: quotaType as 'GRANT' | 'RURAL',
        minScore: a.min,
        maxScore: a.max,
        avgScore: Math.round((a.sum / a.count) * 10) / 10,
        grantCount: a.count,
      });
    }
  }
  cutoffs.sort(
    (x, y) =>
      x.universityCode - y.universityCode ||
      x.programKey.localeCompare(y.programKey) ||
      x.quotaType.localeCompare(y.quotaType),
  );
  return { cutoffs, unknownPrograms };
}

/**
 * Kazakh names (reference/kk-names.csv, reference/kk-profile-subjects.csv). Programs match by
 * (code, Russian name) first — variants of one code can have different names (B037 каз./рус.
 * филология) — then by code. Missing translations stay null and the API falls back to Russian.
 */
function applyKazakhNames(universities: UniRow[], programs: ProgramRow[]) {
  const names = readCsvObjects<KkNameRow>('reference/kk-names.csv');
  const subjects = readCsvObjects<{ profileSubjects: string; profileSubjectsKk: string }>(
    'reference/kk-profile-subjects.csv',
  );
  const uniKk = new Map(names.filter((n) => n.kind === 'university').map((n) => [Number(n.code), n.nameKk]));
  const programKkByName = new Map<string, string>();
  const programKkByCode = new Map<string, string>();
  for (const n of names.filter((x) => x.kind === 'program')) {
    if (n.nameRu) programKkByName.set(`${n.code}\t${n.nameRu}`, n.nameKk);
    if (!programKkByCode.has(n.code)) programKkByCode.set(n.code, n.nameKk);
  }
  const subjectsKk = new Map(subjects.map((s) => [s.profileSubjects, s.profileSubjectsKk]));

  for (const u of universities) u.nameKk = uniKk.get(u.code) ?? null;
  for (const p of programs) {
    p.nameKk = programKkByName.get(`${p.code}\t${p.name}`) ?? programKkByCode.get(p.code) ?? null;
    p.profileSubjectsKk = subjectsKk.get(p.profileSubjects) ?? null;
  }
  return {
    universitiesWithoutKk: universities.filter((u) => !u.nameKk).length,
    programsWithoutKk: programs.filter((p) => !p.nameKk).map((p) => p.code),
  };
}

function main() {
  const universities = parseUniversities(readCsvRows('universities.csv'));
  const programs = parsePrograms(readCsvRows('programs.csv'));
  const kk = applyKazakhNames(universities, programs);
  const programsByCode = new Map<string, ProgramRow[]>();
  for (const p of programs) {
    const list = programsByCode.get(p.code) ?? [];
    list.push(p);
    programsByCode.set(p.code, list);
  }

  const cutoffs: CutoffRow[] = [];
  const unknownPrograms = new Set<string>();
  const stats: string[] = [];
  for (const cycle of CYCLES) {
    const results = readCsvObjects<ResultRow>(cycle.resultsFile);
    const badYear = results.find((r) => Number(r.year) !== cycle.admissionYear);
    if (badYear) throw new Error(`${cycle.resultsFile}: row for year ${badYear.year}, expected ${cycle.admissionYear}`);
    const built = buildCycleCutoffs(cycle.slug, results, programsByCode);
    built.unknownPrograms.forEach((c) => unknownPrograms.add(c));
    cutoffs.push(...built.cutoffs);
    const unis = new Set(built.cutoffs.map((c) => c.universityCode));
    stats.push(`${cycle.slug} (ЕНТ ${cycle.admissionYear}): ${built.cutoffs.length} cutoffs, ${unis.size} universities`);
  }

  if (unknownPrograms.size > 0) {
    throw new Error(
      `Program code(s) missing from programs.csv: ${[...unknownPrograms].sort().join(', ')}. ` +
        'Add them (see prisma/scripts/build_admission_reference.py).',
    );
  }
  const uniCodes = new Set(universities.map((u) => u.code));
  const unknownUnis = [...new Set(cutoffs.map((c) => c.universityCode))].filter((c) => !uniCodes.has(c));
  if (unknownUnis.length > 0) {
    throw new Error(`University code(s) missing from universities.csv: ${unknownUnis.sort((a, b) => a - b).join(', ')}`);
  }

  const payload = {
    meta: {
      generatedAt: new Date().toISOString(),
      generator: 'import-grant-csvs',
      source: 'MNVO RK grant-holder lists (бакалавриат), see data/grant-admission/README.md',
    },
    universities,
    programs,
    cycles: CYCLES.map((c, i) => ({ slug: c.slug, sortOrder: i, admissionYear: c.admissionYear })),
    cutoffs,
  };

  fs.writeFileSync(OUT_JSON, `${JSON.stringify(payload, null, 1)}\n`, 'utf8');
  // eslint-disable-next-line no-console
  const usedUnis = new Set(cutoffs.map((c) => c.universityCode));
  const usedUnisWithoutKk = universities.filter((u) => usedUnis.has(u.code) && !u.nameKk).map((u) => u.code);
  console.log(
    `Wrote ${OUT_JSON}: ${universities.length} universities, ${programs.length} programs, ${cutoffs.length} cutoffs.\n  ` +
      stats.join('\n  ') +
      `\n  kk names: ${universities.length - kk.universitiesWithoutKk}/${universities.length} universities` +
      ` (missing for universities with cutoffs: ${usedUnisWithoutKk.join(', ') || 'none'}),` +
      ` programs missing: ${kk.programsWithoutKk.join(', ') || 'none'}`,
  );
}

if (require.main === module) {
  main();
}
