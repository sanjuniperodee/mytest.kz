/**
 * Проходные баллы на грант для публичных SEO-страниц. Источник — прод API
 * (GET /admission/seo-dataset: те же данные, что в калькуляторе /admission, из
 * официальных списков грантников МНВО). Next кэширует ответ на 6 часов; запасной
 * снимок `grant-cutoffs.data.json` (`npm run seo:grant-data`) используется, только
 * если API недоступен при сборке. Только для серверных компонентов.
 */
import type { AdmissionSeoDatasetDto } from "@bilimland/shared"
import snapshot from "./grant-cutoffs.data.json"

export type SeoLang = "ru" | "kk"

/** Как часто страницы с баллами перечитывают API (секунды). Дублируется литералом в `revalidate` роутов. */
export const GRANT_DATA_REVALIDATE = 21600

const API_ORIGIN = process.env.NEXT_PUBLIC_API_BASE_URL || "https://api.my-test.kz"

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

/** Одна пара вуз × группа программ: все годы по возрастанию. */
export interface CutoffSeries {
  universityCode: number
  programCode: string
  years: CutoffYear[]
  latest: CutoffYear
  /** Тот же показатель годом раньше (для динамики), если был. */
  previous: CutoffYear | null
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

export type TrendPoint = { year: number; medianMin: number; grants: number }

// ─── Слаги: стабильны по коду, текст — для читаемости ───────────────────────

const TRANSLIT: Record<string, string> = {
  а: "a", б: "b", в: "v", г: "g", д: "d", е: "e", ё: "e", ж: "zh", з: "z", и: "i", й: "y",
  к: "k", л: "l", м: "m", н: "n", о: "o", п: "p", р: "r", с: "s", т: "t", у: "u", ф: "f",
  х: "h", ц: "c", ч: "ch", ш: "sh", щ: "sch", ъ: "", ы: "y", ь: "", э: "e", ю: "yu", я: "ya",
  ә: "a", ғ: "g", қ: "k", ң: "n", ө: "o", ұ: "u", ү: "u", һ: "h", і: "i",
}

function slugify(text: string, maxLength: number): string {
  const latin = [...text.toLowerCase()].map((ch) => TRANSLIT[ch] ?? ch).join("")
  const slug = latin.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")
  if (slug.length <= maxLength) return slug
  const cut = slug.slice(0, maxLength)
  return cut.slice(0, cut.lastIndexOf("-") > 20 ? cut.lastIndexOf("-") : maxLength)
}

/** «kaznu-27»: адрес держится на коде вуза, текстовая часть может поменяться (тогда 301). */
function universitySlug(u: { code: number; name: string; shortName: string | null }): string {
  return `${slugify(u.shortName || u.name, 32)}-${u.code}`
}

/** «b057-informacionnye-tehnologii»: адрес держится на коде группы программ. */
function programSlug(p: { code: string; name: string }): string {
  return `${p.code.toLowerCase()}-${slugify(p.name, 48)}`
}

function universityCodeFromSlug(slug: string): number | null {
  const match = slug.match(/-(\d+)$/)
  return match ? Number(match[1]) : null
}

function programCodeFromSlug(slug: string): string | null {
  const match = slug.match(/^([a-z]{1,3}\d{2,4})(?:-|$)/)
  return match ? match[1].toUpperCase() : null
}

// ─── Тексты ──────────────────────────────────────────────────────────────────

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

function median(values: number[]): number | null {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : Math.round(((sorted[mid - 1] + sorted[mid]) / 2) * 10) / 10
}

export function summarize(list: CutoffSeries[]): SeriesSummary {
  const byMin = [...list].sort((a, b) => a.latest.min - b.latest.min)
  const changes = list.filter((s) => s.previous).map((s) => s.latest.min - s.previous!.min)
  return {
    count: list.length,
    grants: list.reduce((sum, s) => sum + s.latest.grants, 0),
    minCutoff: byMin[0] ?? null,
    maxCutoff: byMin[byMin.length - 1] ?? null,
    medianMin: median(list.map((s) => s.latest.min)),
    medianChange: median(changes),
  }
}

// ─── Датасет ─────────────────────────────────────────────────────────────────

export class GrantData {
  readonly years: number[]
  /** Год последнего конкурса в данных (ЕНТ этого года). */
  readonly latestYear: number
  /** Следующий приём — для формулировок «ориентир на 2027». */
  readonly nextYear: number
  readonly updatedAt: string
  readonly origin: "api" | "snapshot"

  private readonly universities: SeoUniversity[]
  private readonly programs: SeoProgram[]
  private readonly universityByCode: Map<number, SeoUniversity>
  private readonly programByCode: Map<string, SeoProgram>
  private readonly series: CutoffSeries[]
  /** Пары, по которым были гранты в последнем конкурсе (страницы строятся только для них). */
  private readonly current: CutoffSeries[]

  constructor(raw: AdmissionSeoDatasetDto, origin: "api" | "snapshot") {
    this.origin = origin
    this.years = [...raw.years].sort((a, b) => a - b)
    this.latestYear = Math.max(...this.years)
    this.nextYear = this.latestYear + 1
    this.updatedAt = raw.generatedAt
    this.universities = raw.universities.map((u) => ({ ...u, slug: universitySlug(u) }))
    this.programs = raw.programs.map((p) => ({ ...p, slug: programSlug(p) }))
    this.universityByCode = new Map(this.universities.map((u) => [u.code, u]))
    this.programByCode = new Map(this.programs.map((p) => [p.code, p]))

    const byPair = new Map<string, CutoffYear[]>()
    for (const [uni, code, year, min, avg, max, grants, ruralMin] of raw.rows) {
      const key = `${uni}|${code}`
      const list = byPair.get(key) ?? []
      list.push({ year, min, avg, max, grants, ruralMin })
      byPair.set(key, list)
    }
    this.series = [...byPair.entries()].map(([key, years]) => {
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
    this.current = this.series.filter(
      (s) =>
        s.latest.year === this.latestYear &&
        this.universityByCode.has(s.universityCode) &&
        this.programByCode.has(s.programCode),
    )
  }

  listUniversities(): SeoUniversity[] {
    const codes = new Set(this.current.map((s) => s.universityCode))
    return this.universities.filter((u) => codes.has(u.code))
  }

  listPrograms(): SeoProgram[] {
    const codes = new Set(this.current.map((s) => s.programCode))
    return this.programs.filter((p) => codes.has(p.code))
  }

  /** Вуз по слагу (по коду в его конце). Сверьте `slug` результата — если отличается, нужен редирект. */
  findUniversity(slug: string): SeoUniversity | null {
    const code = universityCodeFromSlug(slug)
    const university = code == null ? null : this.universityByCode.get(code)
    return university && this.current.some((s) => s.universityCode === university.code) ? university : null
  }

  findProgram(slug: string): SeoProgram | null {
    const code = programCodeFromSlug(slug)
    const program = code == null ? null : this.programByCode.get(code)
    return program && this.current.some((s) => s.programCode === program.code) ? program : null
  }

  getUniversityByCode(code: number): SeoUniversity | null {
    return this.universityByCode.get(code) ?? null
  }

  getProgramByCode(code: string): SeoProgram | null {
    return this.programByCode.get(code) ?? null
  }

  /** Группы программ вуза за последний конкурс — от самого высокого проходного балла. */
  universitySeries(code: number): CutoffSeries[] {
    return this.current
      .filter((s) => s.universityCode === code)
      .sort((a, b) => b.latest.min - a.latest.min || b.latest.grants - a.latest.grants)
  }

  /** Вузы по группе программ за последний конкурс — от самого высокого проходного балла. */
  programSeries(code: string): CutoffSeries[] {
    return this.current
      .filter((s) => s.programCode === code)
      .sort((a, b) => b.latest.min - a.latest.min || b.latest.grants - a.latest.grants)
  }

  nationalSummary(): SeriesSummary {
    return summarize(this.current)
  }

  private trend(filter: (s: CutoffSeries) => boolean): TrendPoint[] {
    return this.years
      .map((year) => {
        const ofYear = this.series.flatMap((s) => (filter(s) ? s.years.filter((y) => y.year === year) : []))
        return {
          year,
          medianMin: median(ofYear.map((y) => y.min)) ?? 0,
          grants: ofYear.reduce((sum, y) => sum + y.grants, 0),
        }
      })
      .filter((point) => point.grants > 0)
  }

  /** Медианный проходной балл и число грантов вуза по годам. */
  universityTrend(code: number): TrendPoint[] {
    return this.trend((s) => s.universityCode === code)
  }

  /** Медианный проходной балл группы программ по годам. */
  programTrend(code: string): TrendPoint[] {
    return this.trend((s) => s.programCode === code)
  }

  /** Другие группы программ с тем же сочетанием профильных предметов. */
  relatedPrograms(program: SeoProgram, limit: number): SeoProgram[] {
    const subjects = new Set(program.subjects)
    return this.listPrograms()
      .filter((p) => p.code !== program.code && p.subjects.some((s) => subjects.has(s)))
      .slice(0, limit)
  }

  /** Самые «грантовые» вузы — для перелинковки. */
  topUniversitiesByGrants(limit: number, exceptCode?: number): SeoUniversity[] {
    const grants = new Map<number, number>()
    for (const s of this.current) {
      grants.set(s.universityCode, (grants.get(s.universityCode) ?? 0) + s.latest.grants)
    }
    return this.listUniversities()
      .filter((u) => u.code !== exceptCode)
      .sort((a, b) => (grants.get(b.code) ?? 0) - (grants.get(a.code) ?? 0))
      .slice(0, limit)
  }

  /** Сводка по группам программ для хаба: проходной балл «от» и медиана по стране. */
  programOverview() {
    return this.listPrograms().map((program) => {
      const summary = summarize(this.programSeries(program.code))
      return {
        program,
        lowest: summary.minCutoff?.latest.min ?? 0,
        median: summary.medianMin ?? 0,
        grants: summary.grants,
        universities: summary.count,
      }
    })
  }

  universityOverview() {
    return this.listUniversities().map((university) => {
      const summary = summarize(this.universitySeries(university.code))
      return {
        university,
        lowest: summary.minCutoff?.latest.min ?? 0,
        highest: summary.maxCutoff?.latest.min ?? 0,
        grants: summary.grants,
        programs: summary.count,
      }
    })
  }
}

function isDataset(value: unknown): value is AdmissionSeoDatasetDto {
  const v = value as Partial<AdmissionSeoDatasetDto> | null
  return Boolean(
    v &&
      typeof v.generatedAt === "string" &&
      Array.isArray(v.years) &&
      v.years.length > 0 &&
      Array.isArray(v.universities) &&
      v.universities.length > 0 &&
      Array.isArray(v.programs) &&
      Array.isArray(v.rows) &&
      v.rows.length > 0,
  )
}

async function fetchDataset(): Promise<AdmissionSeoDatasetDto | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api/v1/admission/seo-dataset`, {
      next: { revalidate: GRANT_DATA_REVALIDATE },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const json: unknown = await res.json()
    return isDataset(json) ? json : null
  } catch {
    return null
  }
}

let memo: { key: string; data: GrantData } | null = null
let inflight: Promise<AdmissionSeoDatasetDto | null> | null = null
let failedAt = 0
const RETRY_AFTER_FAILURE_MS = 5 * 60_000

/** Один запрос на всех: при сборке сотни страниц не ждут таймаут каждая по отдельности. */
function fetchDatasetShared(): Promise<AdmissionSeoDatasetDto | null> {
  if (Date.now() - failedAt < RETRY_AFTER_FAILURE_MS) return Promise.resolve(null)
  inflight ??= fetchDataset()
    .then((dataset) => {
      if (!dataset) failedAt = Date.now()
      return dataset
    })
    .finally(() => {
      inflight = null
    })
  return inflight
}

/**
 * Актуальный датасет из прод API. Если API недоступен:
 *  - при сборке — снимок из репозитория (деплой не падает и не выкатывает пустые страницы);
 *  - при фоновом обновлении (ISR) — ошибка, и Next продолжает отдавать последнюю
 *    удачную версию страницы вместо отката на снимок.
 * Индекс строится один раз на версию данных, а не на каждую из ~450 страниц.
 */
export async function loadGrantData(): Promise<GrantData> {
  const live = await fetchDatasetShared()
  if (!live && process.env.NEXT_PHASE !== "phase-production-build") {
    throw new Error("Grant SEO dataset is unavailable (GET /admission/seo-dataset)")
  }
  const raw = live ?? (snapshot as AdmissionSeoDatasetDto)
  const origin = live ? "api" : "snapshot"
  let checksum = 0
  for (const row of raw.rows) checksum = (checksum * 31 + row[3] * 7 + row[6]) % 2_147_483_647
  const key = `${origin}|${raw.generatedAt}|${raw.rows.length}|${checksum}`
  if (memo?.key !== key) memo = { key, data: new GrantData(raw, origin) }
  return memo.data
}
