/**
 * Loads prisma/data/grant-admission/grant-admission-seed-data.json (generate via npm run import:grant-admission).
 * Run: npm run seed:grant-admission -w @bilimland/api
 */
import * as fs from 'fs';
import * as path from 'path';
import { PrismaClient, GrantQuotaType } from '@prisma/client';

const JSON_PATH = path.join(__dirname, 'data', 'grant-admission', 'grant-admission-seed-data.json');

type SeedJson = {
  universities: { code: number; name: string; shortName: string | null }[];
  programs: {
    code: string;
    profileVariant: number;
    name: string;
    profileSubjects: string;
    profileShortLabel: string | null;
  }[];
  cycles: { slug: string; sortOrder: number }[];
  cutoffs: {
    cycleSlug: string;
    universityCode: number;
    programKey: string;
    quotaType: 'GRANT' | 'RURAL';
    minScore: number | null;
  }[];
};

type CutoffRow = {
  cycleId: string;
  universityCode: number;
  programId: string;
  quotaType: GrantQuotaType;
  minScore: number | null;
};

/** Одна строка на (cycle, вуз, программа, квота): в исходной матрице бывают повторы блоков. */
function dedupeGrantCutoffs(rows: CutoffRow[]): CutoffRow[] {
  const map = new Map<string, CutoffRow>();
  for (const r of rows) {
    const key = `${r.cycleId}\t${r.universityCode}\t${r.programId}\t${r.quotaType}`;
    const prev = map.get(key);
    if (!prev) {
      map.set(key, r);
      continue;
    }
    const minScore =
      r.minScore != null ? r.minScore : prev.minScore != null ? prev.minScore : null;
    map.set(key, { ...r, minScore });
  }
  return [...map.values()];
}

export async function seedGrantAdmission(prisma: PrismaClient): Promise<void> {
  if (!fs.existsSync(JSON_PATH)) {
    throw new Error(`Missing ${JSON_PATH}. Run: npm run import:grant-admission -w @bilimland/api`);
  }
  const data = JSON.parse(fs.readFileSync(JSON_PATH, 'utf8')) as SeedJson;

  for (const u of data.universities) {
    await prisma.university.upsert({
      where: { code: u.code },
      create: { code: u.code, name: u.name, shortName: u.shortName },
      update: { name: u.name, shortName: u.shortName },
    });
  }

  for (const p of data.programs) {
    await prisma.entEducationalProgram.upsert({
      where: { code_profileVariant: { code: p.code, profileVariant: p.profileVariant } },
      create: {
        code: p.code,
        profileVariant: p.profileVariant,
        name: p.name,
        profileSubjects: p.profileSubjects,
        profileShortLabel: p.profileShortLabel,
      },
      update: {
        name: p.name,
        profileSubjects: p.profileSubjects,
        profileShortLabel: p.profileShortLabel,
      },
    });
  }

  const programsDb = await prisma.entEducationalProgram.findMany({
    select: { id: true, code: true, profileVariant: true },
  });
  const programIdByKey = new Map<string, string>();
  for (const p of programsDb) {
    programIdByKey.set(`${p.code}:${p.profileVariant}`, p.id);
  }

  for (const c of data.cycles) {
    await prisma.grantAdmissionCycle.upsert({
      where: { slug: c.slug },
      create: { slug: c.slug, sortOrder: c.sortOrder },
      update: { sortOrder: c.sortOrder },
    });
  }

  const cyclesDb = await prisma.grantAdmissionCycle.findMany({ select: { id: true, slug: true } });
  const cycleIdBySlug = new Map(cyclesDb.map((x) => [x.slug, x.id]));

  for (const slug of cycleIdBySlug.keys()) {
    const id = cycleIdBySlug.get(slug)!;
    await prisma.grantCutoff.deleteMany({ where: { cycleId: id } });
  }

  const CHUNK = 800;
  let skipped = 0;

  for (const slug of data.cycles.map((c) => c.slug)) {
    const cycleId = cycleIdBySlug.get(slug);
    if (!cycleId) continue;
    const rows = data.cutoffs.filter((r) => r.cycleSlug === slug);
    const prismaRows: CutoffRow[] = [];
    for (const row of rows) {
      const programId = programIdByKey.get(row.programKey);
      if (!programId) {
        skipped++;
        continue;
      }
      prismaRows.push({
        cycleId,
        universityCode: row.universityCode,
        programId,
        quotaType: row.quotaType as GrantQuotaType,
        minScore: row.minScore,
      });
    }
    const uniqueRows = dedupeGrantCutoffs(prismaRows);
    if (uniqueRows.length < prismaRows.length) {
      // eslint-disable-next-line no-console
      console.warn(
        `seed-grant-admission: deduped ${prismaRows.length - uniqueRows.length} duplicate cutoff(s) for cycle ${slug}`,
      );
    }
    for (let i = 0; i < uniqueRows.length; i += CHUNK) {
      await prisma.grantCutoff.createMany({
        data: uniqueRows.slice(i, i + CHUNK),
        skipDuplicates: true,
      });
    }
  }

  if (skipped > 0) {
    // eslint-disable-next-line no-console
    console.warn(`seed-grant-admission: skipped ${skipped} cutoff rows (missing program or cycle).`);
  }
}

async function main() {
  const prisma = new PrismaClient();
  try {
    await seedGrantAdmission(prisma);
    // eslint-disable-next-line no-console
    console.log('Grant admission seed OK');
  } finally {
    await prisma.$disconnect();
  }
}

if (require.main === module) {
  main().catch((e) => {
    // eslint-disable-next-line no-console
    console.error(e);
    process.exit(1);
  });
}
