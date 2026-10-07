#!/usr/bin/env node
/**
 * Fallback snapshot for the public "проходной балл" SEO pages. The pages load the
 * live dataset from the API (GET /admission/seo-dataset — same format, built by
 * apps/api/src/modules/admission/domain/seo-dataset.ts); this file is used only when
 * the API is unreachable at build time, so a deploy never fails or ships empty pages.
 *
 * Built from the committed grant-admission seed. Refresh after re-seeding:
 *   cd apps/web && npm run seo:grant-data
 * (an API test checks that this snapshot equals what the API builds from the seed).
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const SEED = join(here, "../../api/prisma/data/grant-admission/grant-admission-seed-data.json")
const OUT = join(here, "../lib/seo/grant-cutoffs.data.json")

const seed = JSON.parse(readFileSync(SEED, "utf8"))
const yearByCycle = new Map(seed.cycles.map((c) => [c.slug, c.admissionYear]))

// A ГОП's cutoff applies to every profile-subject variant (grants are per ГОП),
// so variant rows are duplicates — keep one per university × ГОП × year × quota.
const cutoffs = new Map()
for (const row of seed.cutoffs) {
  if (row.minScore == null) continue
  const year = yearByCycle.get(row.cycleSlug)
  const programCode = row.programKey.split(":")[0]
  const key = `${row.universityCode}|${programCode}|${year}|${row.quotaType}`
  const variant = Number(row.programKey.split(":")[1] ?? 0)
  const current = cutoffs.get(key)
  if (!current || variant < current.variant) cutoffs.set(key, { ...row, variant })
}

const rows = []
for (const [key, row] of cutoffs) {
  if (row.quotaType !== "GRANT") continue
  const [uni, code, year] = key.split("|")
  const rural = cutoffs.get(`${uni}|${code}|${year}|RURAL`)
  rows.push([
    Number(uni),
    code,
    Number(year),
    row.minScore,
    row.avgScore != null ? Math.round(row.avgScore * 10) / 10 : row.minScore,
    row.maxScore ?? row.minScore,
    row.grantCount ?? 0,
    rural ? rural.minScore : null,
  ])
}
rows.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]) || a[2] - b[2])

const usedUnis = new Set(rows.map((r) => r[0]))
const usedPrograms = new Set(rows.map((r) => r[1]))

const universities = seed.universities
  .filter((u) => usedUnis.has(u.code))
  .sort((a, b) => a.code - b.code)
  .map((u) => ({ code: u.code, name: u.name, nameKk: u.nameKk || null, shortName: u.shortName || null }))

const programsByCode = new Map()
for (const p of [...seed.programs].sort((a, b) => a.profileVariant - b.profileVariant)) {
  if (!usedPrograms.has(p.code)) continue
  const entry = programsByCode.get(p.code) ?? {
    code: p.code,
    name: p.name,
    nameKk: p.nameKk || null,
    subjects: [],
    subjectsKk: [],
  }
  if (p.profileSubjects && !entry.subjects.includes(p.profileSubjects)) entry.subjects.push(p.profileSubjects)
  const kk = p.profileSubjectsKk || p.profileSubjects
  if (kk && !entry.subjectsKk.includes(kk)) entry.subjectsKk.push(kk)
  programsByCode.set(p.code, entry)
}
const programs = [...programsByCode.values()].sort((a, b) => a.code.localeCompare(b.code))

const out = {
  generatedAt: seed.meta.generatedAt,
  source: seed.meta.source,
  years: [...new Set(rows.map((r) => r[2]))].sort((a, b) => a - b),
  universities,
  programs,
  /** [universityCode, programCode, year, minScore, avgScore, maxScore, grantCount, ruralMinScore|null] */
  rows,
}
writeFileSync(OUT, `${JSON.stringify(out)}\n`)
console.log(
  `grant SEO data: ${universities.length} universities, ${programs.length} programs, ${rows.length} rows → ${OUT}`,
)
