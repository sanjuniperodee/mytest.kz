#!/usr/bin/env node
/**
 * Builds the compact dataset behind the public "проходной балл" SEO pages
 * (/prohodnoj-ball-ent/vuz/*, /prohodnoj-ball-ent/specialnost/*, /ubt-otu-baly/*)
 * from the API's grant-admission seed — the same official МНВО grant-holder
 * aggregates that power /admission.
 *
 * Run after refreshing the seed (see apps/api/prisma/data/grant-admission/README.md):
 *   cd apps/web && npm run seo:grant-data
 *
 * The output is committed: Vercel installs/builds apps/web alone, so the pages
 * must not read files from apps/api at build time.
 */
import { readFileSync, writeFileSync } from "node:fs"
import { dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const here = dirname(fileURLToPath(import.meta.url))
const SEED = join(here, "../../api/prisma/data/grant-admission/grant-admission-seed-data.json")
const OUT = join(here, "../lib/seo/grant-cutoffs.data.json")

const TRANSLIT = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
}

function slugify(text, maxLength = 48) {
  const latin = [...text.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("")
  const slug = latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  if (slug.length <= maxLength) return slug
  const cut = slug.slice(0, maxLength)
  return cut.slice(0, cut.lastIndexOf("-") > 20 ? cut.lastIndexOf("-") : maxLength)
}

const seed = JSON.parse(readFileSync(SEED, "utf8"))
const yearByCycle = new Map(seed.cycles.map((c) => [c.slug, c.admissionYear]))
const years = [...new Set(seed.cycles.map((c) => c.admissionYear))].sort((a, b) => a - b)

// A ГОП's cutoff applies to every profile-subject variant (grants are per ГОП),
// so variant rows are duplicates — keep one per university × ГОП × year × quota.
const cutoffs = new Map()
for (const row of seed.cutoffs) {
  const year = yearByCycle.get(row.cycleSlug)
  const programCode = row.programKey.split(":")[0]
  const key = `${row.universityCode}|${programCode}|${year}|${row.quotaType}`
  if (!cutoffs.has(key) || row.programKey.endsWith(":0")) cutoffs.set(key, row)
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
    Math.round(row.avgScore * 10) / 10,
    row.maxScore,
    row.grantCount,
    rural ? rural.minScore : null,
  ])
}
rows.sort((a, b) => a[0] - b[0] || a[1].localeCompare(b[1]) || a[2] - b[2])

const usedUnis = new Set(rows.map((r) => r[0]))
const usedPrograms = new Set(rows.map((r) => r[1]))

const universities = seed.universities
  .filter((u) => usedUnis.has(u.code))
  .map((u) => ({
    code: u.code,
    name: u.name,
    nameKk: u.nameKk || null,
    shortName: u.shortName || null,
    slug: `${slugify(u.shortName || u.name, 32)}-${u.code}`,
  }))

const programsByCode = new Map()
for (const p of seed.programs) {
  if (!usedPrograms.has(p.code)) continue
  const entry = programsByCode.get(p.code) ?? {
    code: p.code,
    name: p.name,
    nameKk: p.nameKk || null,
    subjects: [],
    subjectsKk: [],
    slug: `${p.code.toLowerCase()}-${slugify(p.name)}`,
  }
  if (p.profileSubjects && !entry.subjects.includes(p.profileSubjects)) entry.subjects.push(p.profileSubjects)
  const kk = p.profileSubjectsKk || p.profileSubjects
  if (kk && !entry.subjectsKk.includes(kk)) entry.subjectsKk.push(kk)
  programsByCode.set(p.code, entry)
}
const programs = [...programsByCode.values()].sort((a, b) => a.code.localeCompare(b.code))

for (const list of [universities, programs]) {
  const seen = new Set()
  for (const item of list) {
    if (seen.has(item.slug)) throw new Error(`Duplicate slug ${item.slug}`)
    seen.add(item.slug)
  }
}

const out = {
  generatedAt: seed.meta.generatedAt,
  source: seed.meta.source,
  years,
  universities,
  programs,
  /** [universityCode, programCode, year, minScore, avgScore, maxScore, grantCount, ruralMinScore|null] */
  rows,
}
writeFileSync(OUT, `${JSON.stringify(out)}\n`)
console.log(
  `grant SEO data: ${universities.length} universities, ${programs.length} programs, ${rows.length} rows → ${OUT}`,
)
