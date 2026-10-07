/**
 * Проходные баллы на грант для публичных SEO-страниц. Данные — агрегаты
 * официальных списков обладателей грантов МНВО (те же, что в /admission),
 * снимок генерируется `npm run seo:grant-data`. Только для серверных
 * компонентов: страницы собираются статически при билде.
 */
import data from "./grant-cutoffs.data.json"

export type SeoLang = "ru" | "kk"

export interface SeoUniversity {
  code: number
  name: string
  nameKk: string | null
  shortName: string | null
  slug: string
}

export interface SeoProgram {
  code: string
  name: string
  nameKk: string | null
  subjects: string[]
  subjectsKk: string[]
  slug: string
}

export interface CutoffYear {
  year: number
  min: number
  avg: number
  max: number
  grants: number
  ruralMin: number | null
}

/** Одна пара вуз × группа программ: все годы, по возрастанию. */
export interface CutoffSeries {
  universityCode: number
  programCode: string
  years: CutoffYear[]
  latest: CutoffYear
  /** Тот же показатель годом раньше (для динамики), если был. */
  previous: CutoffYear | null
}

type Row = [number, string, number, number, number, number, number, number | null]

const universities = data.universities as SeoUniversity[]
const programs = data.programs as SeoProgram[]
const rows = data.rows as Row[]

export const GRANT_YEARS: number[] = data.years
/** Год последнего конкурса в данных (ЕНТ этого года). */
export const LATEST_YEAR = Math.max(...data.years)
/** Следующий приём — для формулировок «ориентир на 2027». */
export const NEXT_YEAR = LATEST_YEAR + 1
export const DATA_UPDATED_AT = data.generatedAt

const universityByCode = new Map(universities.map((u) => [u.code, u]))
const universityBySlug = new Map(universities.map((u) => [u.slug, u]))
const programByCode = new Map(programs.map((p) => [p.code, p]))
const programBySlug = new Map(programs.map((p) => [p.slug, p]))

const series: CutoffSeries[] = (() => {
  const byPair = new Map<string, CutoffYear[]>()
  for (const [uni, code, year, min, avg, max, grants, ruralMin] of rows) {
    const key = `${uni}|${code}`
    const list = byPair.get(key) ?? []
    list.push({ year, min, avg, max, grants, ruralMin })
    byPair.set(key, list)
  }
  return [...byPair.entries()].map(([key, years]) => {
    const [uni, code] = key.split("|")
    years.sort((a, b) => a.year - b.year)
    const latest = years[years.length - 1]
    return {
      universityCode: Number(uni),
      programCode: code,
      years,
      latest,
      previous: years.find((y) => y.year === latest.year - 1) ?? null,
    }
  })
})()

/** Пары, по которым были гранты в последнем конкурсе. */
const currentSeries = series.filter((s) => s.latest.year === LATEST_YEAR)

export function universityName(u: SeoUniversity, lang: SeoLang): string {
  return lang === "kk" && u.nameKk ? u.nameKk : u.name
}

/** Короткое имя для заголовков: «КазНУ»; без аббревиатуры — полное. */
export function universityShortName(u: SeoUniversity, lang: SeoLang): string {
  return lang === "ru" && u.shortName ? u.shortName : universityName(u, lang)
}

export function programName(p: SeoProgram, lang: SeoLang): string {
  return lang === "kk" && p.nameKk ? p.nameKk : p.name
}

export function programSubjects(p: SeoProgram, lang: SeoLang): string[] {
  return lang === "kk" && p.subjectsKk.length ? p.subjectsKk : p.subjects
}

export function getUniversity(slug: string) {
  return universityBySlug.get(slug) ?? null
}

export function getUniversityByCode(code: number) {
  return universityByCode.get(code) ?? null
}

export function getProgram(slug: string) {
  return programBySlug.get(slug) ?? null
}

export function getProgramByCode(code: string) {
  return programByCode.get(code) ?? null
}

/** Вузы с грантами в последнем конкурсе (страницы строятся только для них). */
export function listUniversities(): SeoUniversity[] {
  const codes = new Set(currentSeries.map((s) => s.universityCode))
  return universities.filter((u) => codes.has(u.code))
}

export function listPrograms(): SeoProgram[] {
  const codes = new Set(currentSeries.map((s) => s.programCode))
  return programs.filter((p) => codes.has(p.code))
}

/** Группы программ вуза за последний конкурс — от самого высокого проходного балла. */
export function universitySeries(code: number): CutoffSeries[] {
  return currentSeries
    .filter((s) => s.universityCode === code)
    .sort((a, b) => b.latest.min - a.latest.min || b.latest.grants - a.latest.grants)
}

/** Вузы по группе программ за последний конкурс — от самого высокого проходного балла. */
export function programSeries(code: string): CutoffSeries[] {
  return currentSeries
    .filter((s) => s.programCode === code)
    .sort((a, b) => b.latest.min - a.latest.min || b.latest.grants - a.latest.grants)
}

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
}

export interface SeriesSummary {
  count: number
  grants: number
  minCutoff: CutoffSeries | null
  maxCutoff: CutoffSeries | null
  medianMin: number | null
  /** Медиана изменения проходного балла к прошлому году (по парам, что были в оба года). */
  medianChange: number | null
}

export function summarize(list: CutoffSeries[]): SeriesSummary {
  const byMin = [...list].sort((a, b) => a.latest.min - b.latest.min)
  const changes = list
    .filter((s) => s.previous)
    .map((s) => s.latest.min - s.previous!.min)
  return {
    count: list.length,
    grants: list.reduce((sum, s) => sum + s.latest.grants, 0),
    minCutoff: byMin[0] ?? null,
    maxCutoff: byMin[byMin.length - 1] ?? null,
    medianMin: median(list.map((s) => s.latest.min)),
    medianChange: median(changes),
  }
}

/** Медианный проходной балл группы программ по годам (для динамики на странице специальности). */
export function programTrend(code: string): { year: number; medianMin: number; grants: number }[] {
  return GRANT_YEARS.map((year) => {
    const ofYear = series.flatMap((s) =>
      s.programCode === code ? s.years.filter((y) => y.year === year) : [],
    )
    return {
      year,
      medianMin: median(ofYear.map((y) => y.min)) ?? 0,
      grants: ofYear.reduce((sum, y) => sum + y.grants, 0),
    }
  }).filter((point) => point.grants > 0)
}

/** Самые «грантовые» вузы — для перелинковки и хабов. */
export function topUniversitiesByGrants(limit: number, exceptCode?: number): SeoUniversity[] {
  const grants = new Map<number, number>()
  for (const s of currentSeries) {
    grants.set(s.universityCode, (grants.get(s.universityCode) ?? 0) + s.latest.grants)
  }
  return listUniversities()
    .filter((u) => u.code !== exceptCode)
    .sort((a, b) => (grants.get(b.code) ?? 0) - (grants.get(a.code) ?? 0))
    .slice(0, limit)
}

/** Сводка по группам программ для хаба: проходной балл «от» и медиана по стране. */
export function programOverview(): {
  program: SeoProgram
  lowest: number
  median: number
  grants: number
  universities: number
}[] {
  return listPrograms().map((program) => {
    const list = programSeries(program.code)
    const summary = summarize(list)
    return {
      program,
      lowest: summary.minCutoff?.latest.min ?? 0,
      median: summary.medianMin ?? 0,
      grants: summary.grants,
      universities: summary.count,
    }
  })
}

export function universityOverview(): {
  university: SeoUniversity
  lowest: number
  highest: number
  grants: number
  programs: number
}[] {
  return listUniversities().map((university) => {
    const summary = summarize(universitySeries(university.code))
    return {
      university,
      lowest: summary.minCutoff?.latest.min ?? 0,
      highest: summary.maxCutoff?.latest.min ?? 0,
      grants: summary.grants,
      programs: summary.count,
    }
  })
}

/** Медианный проходной балл и число грантов вуза по годам. */
export function universityTrend(code: number): { year: number; medianMin: number; grants: number }[] {
  return GRANT_YEARS.map((year) => {
    const ofYear = series.flatMap((s) =>
      s.universityCode === code ? s.years.filter((y) => y.year === year) : [],
    )
    return {
      year,
      medianMin: median(ofYear.map((y) => y.min)) ?? 0,
      grants: ofYear.reduce((sum, y) => sum + y.grants, 0),
    }
  }).filter((point) => point.grants > 0)
}

/** Другие группы программ с тем же сочетанием профильных предметов. */
export function relatedPrograms(program: SeoProgram, limit: number): SeoProgram[] {
  const subjects = new Set(program.subjects)
  return listPrograms()
    .filter((p) => p.code !== program.code && p.subjects.some((s) => subjects.has(s)))
    .slice(0, limit)
}

/** Сводка по всем вузам и программам последнего конкурса. */
export function nationalSummary(): SeriesSummary {
  return summarize(currentSeries)
}
