/**
 * Reads CSV sources under prisma/data/grant-admission/ and writes grant-admission-seed-data.json.
 * Run: npm run import:grant-admission -w @bilimland/api
 */
import * as fs from 'fs';
import * as path from 'path';
import { parse } from 'csv-parse/sync';

const DATA_DIR = path.join(__dirname, 'data', 'grant-admission');
const OUT_JSON = path.join(DATA_DIR, 'grant-admission-seed-data.json');

type ProgramRow = {
  code: string;
  profileVariant: number;
  name: string;
  profileSubjects: string;
  profileShortLabel: string | null;
};

type UniRow = { code: number; name: string; shortName: string | null };

type CutoffRow = {
  cycleSlug: string;
  universityCode: number;
  programKey: string;
  quotaType: 'GRANT' | 'RURAL';
  minScore: number | null;
};

function dedupeCutoffsJson(rows: CutoffRow[]): { cutoffs: CutoffRow[]; removed: number } {
  const map = new Map<string, CutoffRow>();
  for (const c of rows) {
    const key = `${c.cycleSlug}\t${c.universityCode}\t${c.programKey}\t${c.quotaType}`;
    const prev = map.get(key);
    const minScore =
      c.minScore != null ? c.minScore : prev != null && prev.minScore != null ? prev.minScore : null;
    map.set(key, { ...c, minScore });
  }
  const out = [...map.values()];
  return { cutoffs: out, removed: rows.length - out.length };
}

function readCsv(file: string): string[][] {
  const buf = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
  return parse(buf, {
    relax_column_count: true,
    skip_empty_lines: false,
    bom: true,
  }) as string[][];
}

function parseUniversities(rows: string[][]): UniRow[] {
  const out: UniRow[] = [];
  for (const row of rows) {
    const c1 = (row[1] ?? '').trim();
    const c2 = (row[2] ?? '').trim();
    if (!/^\d+$/.test(c1) || !c2) continue;
    const code = parseInt(c1, 10);
    const shortName = (row[3] ?? '').trim() || null;
    out.push({ code, name: c2, shortName });
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
      if (c0 === 'КОД' || c0.includes('КОД')) started = true;
      continue;
    }
    if (!c0) continue;
    const codeRaw = c0.replace(/\s+/g, '');
    if (!/^B\d+$/i.test(codeRaw)) continue;
    const code = codeRaw.toUpperCase().replace(/^B/, 'B'); // B001
    const name = (row[1] ?? '').replace(/\r?\n/g, ' ').trim();
    const profileSubjects = (row[2] ?? '').replace(/\r?\n/g, ' ').trim();
    const profileShortLabel = (row[3] ?? '').trim() || null;
    if (!name) continue;
    const v = counts.get(code) ?? 0;
    counts.set(code, v + 1);
    out.push({
      code,
      profileVariant: v,
      name,
      profileSubjects,
      profileShortLabel,
    });
  }
  return out;
}

function programKey(p: ProgramRow): string {
  return `${p.code}:${p.profileVariant}`;
}

function matchProgram(programs: ProgramRow[], matrixCol0: string): ProgramRow | null {
  const t = matrixCol0.replace(/\s+/g, ' ').trim();
  const m = t.match(/^B(\d+)\s*[-–]\s*(.+)$/i);
  if (!m) return null;
  const code = `B${m[1]}`;
  const tail = m[2].trim();
  const prospects = programs.filter((p) => p.code === code);
  if (prospects.length === 0) return null;
  if (prospects.length === 1) return prospects[0];

  const lowerTail = tail.toLowerCase();
  const scored = prospects.map((p) => {
    let score = 0;
    const ps = p.profileSubjects.toLowerCase();
    const pn = p.name.toLowerCase();
    if (lowerTail.includes('казах') && (ps.includes('казах') || pn.includes('казах'))) score += 10;
    if (lowerTail.includes('русск') && ps.includes('русск')) score += 10;
    if (lowerTail.includes('творческ') && ps.toLowerCase().includes('творческ')) score += 5;
    const words = lowerTail.split(/[^a-zа-яёәіңғүұқөһ]+/i).filter((w) => w.length > 4);
    for (const w of words) {
      if (pn.includes(w) || ps.includes(w)) score += 1;
    }
    return { p, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].score > 0 ? scored[0].p : prospects[0];
}

function parseCellScore(cell: string | undefined): number | null {
  if (cell == null) return null;
  const s = String(cell).trim();
  if (s === '' || s === '-' || s === '—') return null;
  const n = parseInt(s, 10);
  return Number.isFinite(n) ? n : null;
}

function findMatrixHeaderRow(rows: string[][]): number {
  for (let i = 0; i < rows.length; i++) {
    const c0 = (rows[i][0] ?? '').trim();
    if (c0 === 'Название' || c0.startsWith('Название')) {
      const nums = rows[i]
        .slice(1)
        .map((x) => parseInt(String(x ?? '').trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      if (nums.length >= 10) return i;
    }
  }
  throw new Error('Matrix header row not found');
}

function parseMatrix(
  rows: string[][],
  cycleSlug: string,
  programs: ProgramRow[],
): { cutoffs: CutoffRow[]; unknownProgramLabels: string[] } {
  const cutoffs: CutoffRow[] = [];
  const unknownProgramLabels: string[] = [];
  const hi = findMatrixHeaderRow(rows);
  const header = rows[hi].map((c) => String(c ?? '').trim());
  const uniCodes = header
    .slice(1)
    .map((x) => parseInt(x, 10))
    .filter((n) => Number.isFinite(n) && n > 0);

  let currentLabel: string | null = null;
  let currentProgram: ProgramRow | null = null;

  for (let i = hi + 1; i < rows.length; i++) {
    const row = rows[i].map((c) => String(c ?? ''));
    const c0 = row[0]?.trim() ?? '';
    const rowEmpty = row.every((c) => !String(c).trim());

    if (rowEmpty) continue;

    if (c0.toLowerCase() === 'грант') {
      if (!currentProgram || !currentLabel) continue;
      const pk = programKey(currentProgram);
      uniCodes.forEach((uniCode, idx) => {
        const cell = row[idx + 1];
        const minScore = parseCellScore(cell);
        cutoffs.push({
          cycleSlug,
          universityCode: uniCode,
          programKey: pk,
          quotaType: 'GRANT',
          minScore,
        });
      });
      continue;
    }

    if (c0.toLowerCase().startsWith('сельск')) {
      if (!currentProgram || !currentLabel) continue;
      const pk = programKey(currentProgram);
      uniCodes.forEach((uniCode, idx) => {
        const cell = row[idx + 1];
        const minScore = parseCellScore(cell);
        cutoffs.push({
          cycleSlug,
          universityCode: uniCode,
          programKey: pk,
          quotaType: 'RURAL',
          minScore,
        });
      });
      continue;
    }

    if (/^B\d+\s*[-–]/i.test(c0)) {
      currentLabel = c0;
      currentProgram = matchProgram(programs, c0);
      if (!currentProgram) unknownProgramLabels.push(c0);
      continue;
    }
  }

  return { cutoffs, unknownProgramLabels };
}

function ensureUniversitiesForMatrix(unis: UniRow[], cutoffs: CutoffRow[]): UniRow[] {
  const byCode = new Map(unis.map((u) => [u.code, u]));
  for (const c of cutoffs) {
    if (!byCode.has(c.universityCode)) {
      const stub: UniRow = {
        code: c.universityCode,
        name: `Вуз (код ${c.universityCode}, из матрицы; уточните в справочнике)`,
        shortName: null,
      };
      byCode.set(c.universityCode, stub);
    }
  }
  return [...byCode.values()].sort((a, b) => a.code - b.code);
}

function main() {
  const uniRows = readCsv('universities.csv');
  const progRows = readCsv('programs.csv');
  const matrix2324 = readCsv('matrix-2023-2024.csv');
  const matrix2526 = readCsv('matrix-2025-2026.csv');

  let universities = parseUniversities(uniRows);
  const programs = parsePrograms(progRows);

  const r1 = parseMatrix(matrix2324, '2023-2024', programs);
  const r2 = parseMatrix(matrix2526, '2025-2026', programs);

  const mergedCutoffs = [...r1.cutoffs, ...r2.cutoffs];
  const { cutoffs, removed: deduped } = dedupeCutoffsJson(mergedCutoffs);
  if (deduped > 0) {
    // eslint-disable-next-line no-console
    console.warn(`Removed ${deduped} duplicate cutoff cell(s) (same cycle / university / program / quota).`);
  }
  universities = ensureUniversitiesForMatrix(universities, cutoffs);

  const cycles = [
    { slug: '2023-2024', sortOrder: 0 },
    { slug: '2025-2026', sortOrder: 1 },
  ];

  const payload = {
    meta: { generatedAt: new Date().toISOString(), generator: 'import-grant-csvs' },
    universities,
    programs,
    cycles,
    cutoffs,
    warnings: {
      unknownMatrixProgramLabels: [...new Set([...r1.unknownProgramLabels, ...r2.unknownProgramLabels])],
    },
  };

  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2), 'utf8');
  // eslint-disable-next-line no-console
  console.log(
    `Wrote ${OUT_JSON}: ${universities.length} universities, ${programs.length} programs, ${cutoffs.length} cutoff cells.`,
  );
  if (payload.warnings.unknownMatrixProgramLabels.length) {
    // eslint-disable-next-line no-console
    console.warn('Unknown program labels (sample):', payload.warnings.unknownMatrixProgramLabels.slice(0, 15));
  }
}

main();
