import type { Metadata } from "next"
import Link from "next/link"
import { ArrowRight, Calculator, Gift, Info, TrendingDown, TrendingUp } from "lucide-react"
import { SeoShell } from "@/components/seo/seo-shell"
import { ENT_SUBJECTS } from "@/lib/ent-subjects"
import { OG_IMAGES } from "@/lib/seo"
import {
  LATEST_YEAR,
  NEXT_YEAR,
  getProgramByCode,
  getUniversityByCode,
  programName,
  programSeries,
  programSubjects,
  programTrend,
  relatedPrograms,
  summarize,
  topUniversitiesByGrants,
  universityName,
  universitySeries,
  universityShortName,
  universityTrend,
  type CutoffSeries,
  type SeoLang,
  type SeoProgram,
  type SeoUniversity,
} from "@/lib/seo/grant-cutoffs"
import { GRANT_ROUTES, otherLang } from "@/lib/seo/grant-routes"
import { getSiteUrl } from "@/lib/site"

const tx = (lang: SeoLang, ru: string, kk: string) => (lang === "kk" ? kk : ru)
const num = (n: number) => n.toLocaleString("ru-RU")

/** Русское согласование с числом: 1 грант, 2 гранта, 5 грантов. Дробные — «2,5 балла». */
function ru(n: number, one: string, few: string, many: string): string {
  if (!Number.isInteger(n)) return few
  const abs = Math.abs(n)
  const mod10 = abs % 10
  const mod100 = abs % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}
const grantsRu = (n: number) => `${num(n)} ${ru(n, "грант", "гранта", "грантов")}`
/** «74–135 баллов»: в диапазоне согласуем с последним числом. */
const rangeRu = (a: number, b: number) => `${a}–${b} ${ru(b, "балл", "балла", "баллов")}`
const signed = (n: number) => `${n > 0 ? "+" : n < 0 ? "−" : ""}${Math.abs(n)}`

/** Ссылки на страницы подготовки по профильным предметам («Математика» → /ent/matematika). */
const SUBJECT_SLUG_BY_NAME = new Map(
  Object.entries(ENT_SUBJECTS).flatMap(([slug, s]) => [
    [s.ru.toLowerCase(), slug],
    [s.kk.toLowerCase(), slug],
  ]),
)

function ChangeBadge({ series, lang }: { series: CutoffSeries; lang: SeoLang }) {
  if (!series.previous) {
    return <span className="text-xs text-muted-foreground">{tx(lang, "новое", "жаңа")}</span>
  }
  const delta = series.latest.min - series.previous.min
  if (delta === 0) return <span className="text-xs text-muted-foreground">0</span>
  const up = delta > 0
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-medium tabular-nums ${up ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
      {up ? <TrendingUp className="size-3" aria-hidden /> : <TrendingDown className="size-3" aria-hidden />}
      {up ? "+" : "−"}
      {Math.abs(delta)}
    </span>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-2xl font-semibold tabular-nums tracking-tight">{value}</p>
    </div>
  )
}

function Ctas({ lang, source }: { lang: SeoLang; source: string }) {
  return (
    <div className="mt-7 flex flex-col gap-3 sm:flex-row">
      <Link
        href={`/login?source=${source}`}
        className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-opacity hover:opacity-90"
      >
        <Gift className="size-4" />
        {tx(lang, "Проверить свой балл — пробный ЕНТ бесплатно", "Балыңды тексер — ҰБТ сынағы тегін")}
        <ArrowRight className="size-4" />
      </Link>
      <Link
        href="/admission"
        className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary"
      >
        <Calculator className="size-4" />
        {tx(lang, "Рассчитать шансы на грант", "Грант мүмкіндігін есептеу")}
      </Link>
    </div>
  )
}

function Faq({ lang, items }: { lang: SeoLang; items: { q: string; a: string }[] }) {
  const ld = {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  }
  return (
    <section className="mx-auto max-w-4xl px-4 py-12 sm:px-6">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <h2 className="text-2xl font-semibold tracking-tight">{tx(lang, "Частые вопросы", "Жиі қойылатын сұрақтар")}</h2>
      <div className="mt-5 divide-y divide-border rounded-xl border border-border bg-card">
        {items.map((item) => (
          <details key={item.q} className="group p-5">
            <summary className="cursor-pointer list-none font-medium marker:hidden">{item.q}</summary>
            <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{item.a}</p>
          </details>
        ))}
      </div>
    </section>
  )
}

function SourceNote({ lang }: { lang: SeoLang }) {
  return (
    <p className="mt-4 flex items-start gap-2 text-xs leading-relaxed text-muted-foreground">
      <Info className="mt-0.5 size-3.5 shrink-0" aria-hidden />
      {tx(
        lang,
        `Источник — официальные списки обладателей образовательных грантов МНВО РК (бакалавриат, ${LATEST_YEAR}). Проходной балл — самый низкий балл ЕНТ среди получивших грант в общем конкурсе; сельская квота — отдельный конкурс для выпускников сельских школ. Баллы на ${NEXT_YEAR} год станут известны после конкурса и обычно отличаются на несколько баллов.`,
        `Дерек көзі — ҚР ҒЖБМ білім беру гранттары иегерлерінің ресми тізімдері (бакалавриат, ${LATEST_YEAR}). Өту балы — жалпы конкурста грант алғандардың ішіндегі ең төменгі ҰБТ балы; ауыл квотасы — ауыл мектептерінің түлектеріне арналған жеке конкурс. ${NEXT_YEAR} жылғы балдар конкурстан кейін белгілі болады және әдетте бірнеше балға ғана өзгереді.`,
      )}
    </p>
  )
}

function TrendTable({ lang, trend }: { lang: SeoLang; trend: { year: number; medianMin: number; grants: number }[] }) {
  if (trend.length < 2) return null
  return (
    <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
            <th className="px-4 py-2.5 font-medium">{tx(lang, "Год", "Жыл")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{tx(lang, "Медианный проходной балл", "Медианалық өту балы")}</th>
            <th className="px-4 py-2.5 text-right font-medium">{tx(lang, "Грантов", "Гранттар")}</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {trend.map((point) => (
            <tr key={point.year}>
              <td className="px-4 py-2.5 font-medium">{point.year}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{point.medianMin}</td>
              <td className="px-4 py-2.5 text-right tabular-nums">{num(point.grants)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function pageMetadata({
  lang,
  title,
  description,
  path,
  alternatePath,
}: {
  lang: SeoLang
  title: string
  description: string
  path: string
  alternatePath: string
}): Metadata {
  const siteUrl = getSiteUrl()
  const ruPath = lang === "ru" ? path : alternatePath
  const kkPath = lang === "kk" ? path : alternatePath
  return {
    title: { absolute: title },
    description,
    alternates: {
      canonical: `${siteUrl}${path}`,
      languages: { ru: `${siteUrl}${ruPath}`, kk: `${siteUrl}${kkPath}`, "x-default": `${siteUrl}${ruPath}` },
    },
    openGraph: {
      title,
      description,
      url: `${siteUrl}${path}`,
      siteName: "mytest",
      locale: lang === "kk" ? "kk_KZ" : "ru_RU",
      type: "article",
      images: OG_IMAGES,
    },
  }
}

// ─── Вуз ───────────────────────────────────────────────────────────────────

export function universityMetadata(university: SeoUniversity, lang: SeoLang): Metadata {
  const summary = summarize(universitySeries(university.code))
  const short = universityShortName(university, lang)
  const full = universityName(university, lang)
  const lo = summary.minCutoff?.latest.min ?? 0
  const hi = summary.maxCutoff?.latest.min ?? 0
  return pageMetadata({
    lang,
    path: GRANT_ROUTES[lang].university(university.slug),
    alternatePath: GRANT_ROUTES[otherLang(lang)].university(university.slug),
    title: tx(
      lang,
      `Проходной балл ${short} ${LATEST_YEAR} на грант — по специальностям | mytest`,
      `${short} өту балы ${LATEST_YEAR} — грантқа мамандықтар бойынша | mytest`,
    ),
    description: tx(
      lang,
      `${short} (${full}): проходные баллы ЕНТ на грант ${LATEST_YEAR} года — ${rangeRu(lo, hi)}, ${grantsRu(summary.grants)}, ${summary.count} ${ru(summary.count, "группа", "группы", "групп")} программ. Динамика по годам и ориентир на ${NEXT_YEAR}.`,
      `${full}: ${LATEST_YEAR} жылғы грантқа ҰБТ өту балдары — ${lo}–${hi} балл, ${num(summary.grants)} грант, ${summary.count} бағдарлама тобы. Жылдар бойынша өзгеріс және ${NEXT_YEAR} жылға бағдар.`,
    ),
  })
}

export function UniversityCutoffsPage({ university, lang }: { university: SeoUniversity; lang: SeoLang }) {
  const routes = GRANT_ROUTES[lang]
  const list = universitySeries(university.code)
  const summary = summarize(list)
  const short = universityShortName(university, lang)
  const full = universityName(university, lang)
  const highest = summary.maxCutoff
  const lowest = summary.minCutoff
  const highestProgram = highest ? getProgramByCode(highest.programCode) : null
  const lowestProgram = lowest ? getProgramByCode(lowest.programCode) : null
  const trend = universityTrend(university.code)
  const prevYear = trend.find((t) => t.year === LATEST_YEAR - 1)
  const others = topUniversitiesByGrants(12, university.code)
  const change = summary.medianChange

  const lead =
    lang === "kk"
      ? `${LATEST_YEAR} жылы ${full} ${summary.count} білім беру бағдарламаларының тобы бойынша ${num(summary.grants)} грант алды. ` +
        (highest && highestProgram ? `Ең жоғары өту балы — ${highest.latest.min} («${programName(highestProgram, lang)}»), ` : "") +
        (lowest && lowestProgram ? `ең төменгісі — ${lowest.latest.min} («${programName(lowestProgram, lang)}»).` : "")
      : `${short}: ${grantsRu(summary.grants)} в общем конкурсе ${LATEST_YEAR} года, ${summary.count} ${ru(summary.count, "группа", "группы", "групп")} образовательных программ с грантами. ` +
        (highest && highestProgram ? `Самый высокий проходной балл — ${highest.latest.min} («${programName(highestProgram, lang)}»), ` : "") +
        (lowest && lowestProgram ? `самый низкий — ${lowest.latest.min} («${programName(lowestProgram, lang)}»).` : "")

  const faq = [
    {
      q: tx(lang, `Какой проходной балл в ${short} на грант?`, `${short} грантқа өту балы қанша?`),
      a: tx(
        lang,
        `В ${LATEST_YEAR} году проходной балл в ${short} — ${lowest && highest ? rangeRu(lowest.latest.min, highest.latest.min) : "—"} ЕНТ в зависимости от специальности. Медиана по всем группам программ — ${summary.medianMin ?? "—"}.`,
        `${LATEST_YEAR} жылы ${full} өту балы мамандыққа қарай ${lowest?.latest.min ?? "—"}–${highest?.latest.min ?? "—"} ҰБТ балы аралығында болды. Барлық бағдарлама топтары бойынша медиана — ${summary.medianMin ?? "—"} балл.`,
      ),
    },
    {
      q: tx(lang, `Сколько грантов выделили ${short} в ${LATEST_YEAR} году?`, `${LATEST_YEAR} жылы ${short} қанша грант алды?`),
      a: tx(
        lang,
        `${grantsRu(summary.grants)} в общем конкурсе (групп программ с грантами: ${summary.count})${prevYear ? `; в ${LATEST_YEAR - 1} году — ${num(prevYear.grants)}` : ""}. Гранты сельской квоты считаются отдельно.`,
        `Жалпы конкурс бойынша ${summary.count} бағдарлама тобына ${num(summary.grants)} грант${prevYear ? ` (${LATEST_YEAR - 1} жылы — ${num(prevYear.grants)})` : ""}. Ауыл квотасының гранттары бөлек есептеледі.`,
      ),
    },
    {
      q: tx(lang, `Вырос ли проходной балл в ${short}?`, `${short} өту балы өсті ме?`),
      a:
        change == null
          ? tx(lang, `Для сравнения с ${LATEST_YEAR - 1} годом недостаточно данных.`, `${LATEST_YEAR - 1} жылмен салыстыруға дерек жеткіліксіз.`)
          : tx(
              lang,
              `По сравнению с ${LATEST_YEAR - 1} годом проходной балл по специальностям ${short} изменился в среднем на ${signed(change)} ${ru(change, "балл", "балла", "баллов")}. Перед подачей документов в ${NEXT_YEAR} году ориентируйтесь на баллы последних двух лет с запасом 3–5 баллов.`,
              `${LATEST_YEAR - 1} жылмен салыстырғанда ${short} мамандықтары бойынша өту балы орта есеппен ${signed(change)} балға өзгерді. ${NEXT_YEAR} жылы құжат тапсырарда соңғы екі жылдың балдарына 3–5 балл қор қосып бағдарлаңыз.`,
            ),
    },
    {
      q: tx(lang, `Как поступить в ${short} на грант?`, `${short} грантқа қалай түсуге болады?`),
      a: tx(
        lang,
        `Нужно набрать на ЕНТ не ниже порогового балла, выбрать до 4 групп программ и вузов при подаче на грант и набрать больше, чем другие участники конкурса. Пройдите пробный ЕНТ на my-test.kz, чтобы узнать свой текущий балл и сравнить его с проходными баллами ${short}.`,
        `ҰБТ-дан шекті балдан төмен емес балл жинап, грантқа өтінім бергенде 4-ке дейін бағдарлама тобы мен ЖОО таңдап, конкурстың басқа қатысушыларынан жоғары балл жинау керек. Қазіргі балыңызды біліп, ${short} өту балдарымен салыстыру үшін my-test.kz-те ҰБТ сынағын тапсырыңыз.`,
      ),
    },
  ]

  return (
    <SeoShell
      lang={lang}
      alternate={{ href: GRANT_ROUTES[otherLang(lang)].university(university.slug) }}
      crumbs={[
        { name: tx(lang, "Проходной балл ЕНТ", "ҰБТ өту балдары"), href: routes.hub },
        { name: short, href: routes.university(university.slug) },
      ]}
    >
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {tx(lang, `Гранты ${LATEST_YEAR} · данные МНВО РК`, `Гранттар ${LATEST_YEAR} · ҚР ҒЖБМ деректері`)}
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {tx(lang, `Проходной балл ${short} на грант ${LATEST_YEAR}`, `${full}: грантқа өту балы ${LATEST_YEAR}`)}
          </h1>
          {lang === "ru" && short !== full && <p className="mt-2 text-sm text-muted-foreground">{full}</p>}
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{lead}</p>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={tx(lang, "Групп программ с грантами", "Грант бөлінген бағдарлама топтары")} value={String(summary.count)} />
            <Stat label={tx(lang, `Грантов в ${LATEST_YEAR}`, `${LATEST_YEAR} жылғы гранттар`)} value={num(summary.grants)} />
            <Stat
              label={tx(lang, "Проходной балл", "Өту балы")}
              value={lowest && highest ? `${lowest.latest.min}–${highest.latest.min}` : "—"}
            />
            <Stat
              label={tx(lang, `Изменение к ${LATEST_YEAR - 1}`, `${LATEST_YEAR - 1} жылмен салыстырғанда`)}
              value={change == null ? "—" : signed(change)}
            />
          </div>
          <Ctas lang={lang} source="seo-university" />
        </section>

        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {tx(lang, `Проходные баллы ${short} по специальностям`, `${short} өту балдары мамандықтар бойынша`)}
            </h2>
            <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-3 font-medium sm:px-4">{tx(lang, "Группа образовательных программ", "Білім беру бағдарламаларының тобы")}</th>
                    <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, "Проходной", "Өту балы")}</th>
                    <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">{tx(lang, "Средний", "Орташа")}</th>
                    <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, "Грантов", "Грант")}</th>
                    <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, `К ${LATEST_YEAR - 1}`, "Өзгеріс")}</th>
                    <th className="hidden px-4 py-3 text-right font-medium md:table-cell">{tx(lang, "Сельская квота", "Ауыл квотасы")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.map((s) => {
                    const program = getProgramByCode(s.programCode)
                    if (!program) return null
                    return (
                      <tr key={s.programCode} className="transition-colors hover:bg-secondary/30">
                        <td className="px-3 py-3 sm:px-4">
                          <Link href={routes.program(program.slug)} className="font-medium hover:underline">
                            {programName(program, lang)}
                          </Link>
                          <span className="ml-2 text-xs text-muted-foreground">{program.code}</span>
                        </td>
                        <td className="px-2 py-3 text-right sm:px-3 font-semibold tabular-nums">{s.latest.min}</td>
                        <td className="hidden px-3 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{s.latest.avg}</td>
                        <td className="px-2 py-3 text-right sm:px-3 tabular-nums">{s.latest.grants}</td>
                        <td className="px-2 py-3 text-right sm:px-3"><ChangeBadge series={s} lang={lang} /></td>
                        <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">{s.latest.ruralMin ?? "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <SourceNote lang={lang} />
          </div>
        </section>

        {trend.length > 1 && (
          <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {tx(lang, `Как менялись проходные баллы ${short}`, `${short} өту балдары қалай өзгерді`)}
            </h2>
            <TrendTable lang={lang} trend={trend} />
          </section>
        )}

        <Faq lang={lang} items={faq} />

        <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
          <h2 className="text-xl font-semibold tracking-tight">
            {tx(lang, "Проходные баллы в других вузах", "Басқа ЖОО-лардың өту балдары")}
          </h2>
          <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {others.map((u) => (
              <li key={u.code}>
                <Link href={routes.university(u.slug)} className="block rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-secondary/50">
                  {universityName(u, lang)}
                </Link>
              </li>
            ))}
          </ul>
          <Link href={routes.hub} className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline">
            {tx(lang, "Все вузы и специальности", "Барлық ЖОО мен мамандықтар")}
            <ArrowRight className="size-4" />
          </Link>
        </section>
      </main>
    </SeoShell>
  )
}

// ─── Группа программ (специальность) ───────────────────────────────────────

export function programMetadata(program: SeoProgram, lang: SeoLang): Metadata {
  const summary = summarize(programSeries(program.code))
  const name = programName(program, lang)
  const lo = summary.minCutoff?.latest.min ?? 0
  const hi = summary.maxCutoff?.latest.min ?? 0
  return pageMetadata({
    lang,
    path: GRANT_ROUTES[lang].program(program.slug),
    alternatePath: GRANT_ROUTES[otherLang(lang)].program(program.slug),
    title: tx(
      lang,
      `Проходной балл на «${name}» (${program.code}) ${LATEST_YEAR} — гранты по вузам`,
      `${name} (${program.code}) өту балы ${LATEST_YEAR} — ЖОО бойынша гранттар`,
    ),
    description: tx(
      lang,
      `Проходной балл ЕНТ на грант по группе «${name}» (${program.code}) в ${LATEST_YEAR} году: ${rangeRu(lo, hi)}, ${grantsRu(summary.grants)}, ${summary.count} ${ru(summary.count, "вуз", "вуза", "вузов")}. Профильные предметы: ${program.subjects.join("; ")}.`,
      `«${name}» (${program.code}) тобына ${LATEST_YEAR} жылғы грантқа ҰБТ өту балы: ${lo}–${hi} балл, ${num(summary.grants)} грант, ${summary.count} ЖОО. Бейіндік пәндер: ${programSubjects(program, lang).join("; ")}.`,
    ),
  })
}

export function ProgramCutoffsPage({ program, lang }: { program: SeoProgram; lang: SeoLang }) {
  const routes = GRANT_ROUTES[lang]
  const list = programSeries(program.code)
  const summary = summarize(list)
  const name = programName(program, lang)
  const highest = summary.maxCutoff
  const lowest = summary.minCutoff
  const highestUni = highest ? getUniversityByCode(highest.universityCode) : null
  const lowestUni = lowest ? getUniversityByCode(lowest.universityCode) : null
  const trend = programTrend(program.code)
  const prevYear = trend.find((t) => t.year === LATEST_YEAR - 1)
  const related = relatedPrograms(program, 12)
  const subjects = programSubjects(program, lang)
  const change = summary.medianChange

  const lead =
    lang === "kk"
      ? `${LATEST_YEAR} жылы «${name}» тобы бойынша ${summary.count} ЖОО-ға ${num(summary.grants)} грант бөлінді. ` +
        (highest && highestUni ? `Ең жоғары өту балы — ${highest.latest.min} (${universityShortName(highestUni, lang)}), ` : "") +
        (lowest && lowestUni ? `ең төменгісі — ${lowest.latest.min} (${universityShortName(lowestUni, lang)}).` : "")
      : `В ${LATEST_YEAR} году по группе «${name}» выделили ${grantsRu(summary.grants)} в ${summary.count} ${ru(summary.count, "вузе", "вузах", "вузах")}. ` +
        (highest && highestUni ? `Самый высокий проходной балл — ${highest.latest.min} (${universityShortName(highestUni, lang)}), ` : "") +
        (lowest && lowestUni ? `самый низкий — ${lowest.latest.min} (${universityShortName(lowestUni, lang)}).` : "")

  const faq = [
    {
      q: tx(lang, `Какой проходной балл на ${name} на грант?`, `${name} мамандығына грантқа өту балы қанша?`),
      a: tx(
        lang,
        `В ${LATEST_YEAR} году — ${lowest && highest ? rangeRu(lowest.latest.min, highest.latest.min) : "—"} ЕНТ в зависимости от вуза. Медианный проходной балл по стране — ${summary.medianMin ?? "—"}.`,
        `${LATEST_YEAR} жылы ЖОО-ға қарай ${lowest?.latest.min ?? "—"}–${highest?.latest.min ?? "—"} ҰБТ балы аралығында. Ел бойынша медианалық өту балы — ${summary.medianMin ?? "—"}.`,
      ),
    },
    {
      q: tx(lang, `Какие предметы сдавать на ${name}?`, `${name} үшін қандай пәндер тапсырылады?`),
      a: tx(
        lang,
        `Профильные предметы ЕНТ: ${subjects.join("; ")}. Плюс обязательные: математическая грамотность, грамотность чтения и история Казахстана.`,
        `ҰБТ бейіндік пәндері: ${subjects.join("; ")}. Сонымен қатар міндетті пәндер: математикалық сауаттылық, оқу сауаттылығы және Қазақстан тарихы.`,
      ),
    },
    {
      q: tx(lang, `Сколько грантов на ${name}?`, `${name} бойынша қанша грант бар?`),
      a: tx(
        lang,
        `${grantsRu(summary.grants)} в общем конкурсе ${LATEST_YEAR} года${prevYear ? `; в ${LATEST_YEAR - 1} году — ${num(prevYear.grants)}` : ""}. Распределение по вузам — в таблице выше.`,
        `${LATEST_YEAR} жылы жалпы конкурста ${num(summary.grants)} грант${prevYear ? ` (${LATEST_YEAR - 1} жылы — ${num(prevYear.grants)})` : ""}. Ең көбі — жоғарыдағы кестедегі ЖОО-ларда.`,
      ),
    },
    {
      q: tx(lang, `Как набрать проходной балл на ${name}?`, `${name} өту балын қалай жинауға болады?`),
      a:
        change == null
          ? tx(
              lang,
              `Узнайте свой текущий балл на пробном ЕНТ и разберите ошибки по профильным предметам — так видно, сколько баллов не хватает до гранта.`,
              `ҰБТ сынағында қазіргі балыңызды біліп, бейіндік пәндер бойынша қателерді талдаңыз — грантқа қанша балл жетпейтіні көрінеді.`,
            )
          : tx(
              lang,
              `За год проходной балл изменился в среднем на ${signed(change)} ${ru(change, "балл", "балла", "баллов")}. Закладывайте запас 3–5 баллов и проверяйте себя на пробном ЕНТ: разбор ошибок по профильным предметам покажет, где добрать баллы.`,
              `Бір жылда өту балы орта есеппен ${signed(change)} балға өзгерді. 3–5 балл қор қалдырып, ҰБТ сынағында өзіңізді тексеріңіз: бейіндік пәндер бойынша қателер талдауы қай жерден балл қосуға болатынын көрсетеді.`,
            ),
    },
  ]

  return (
    <SeoShell
      lang={lang}
      alternate={{ href: GRANT_ROUTES[otherLang(lang)].program(program.slug) }}
      crumbs={[
        { name: tx(lang, "Проходной балл ЕНТ", "ҰБТ өту балдары"), href: routes.hub },
        { name: `${name} (${program.code})`, href: routes.program(program.slug) },
      ]}
    >
      <main>
        <section className="mx-auto max-w-6xl px-4 pb-10 pt-6 sm:px-6">
          <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
            {program.code} · {tx(lang, `гранты ${LATEST_YEAR}`, `гранттар ${LATEST_YEAR}`)}
          </p>
          <h1 className="mt-2 max-w-4xl text-balance text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">
            {tx(lang, `Проходной балл на «${name}» ${LATEST_YEAR}`, `«${name}» өту балы ${LATEST_YEAR}`)}
          </h1>
          <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">{lead}</p>
          <div className="mt-4 flex flex-wrap items-center gap-2 text-sm">
            <span className="text-muted-foreground">{tx(lang, "Профильные предметы:", "Бейіндік пәндер:")}</span>
            {subjects.flatMap((combo) => combo.split(" - ")).filter((s, i, all) => all.indexOf(s) === i).map((subject) => {
              const slug = SUBJECT_SLUG_BY_NAME.get(subject.trim().toLowerCase())
              return slug ? (
                <Link key={subject} href={`/ent/${slug}`} className="rounded-full border border-border bg-card px-3 py-1 hover:bg-secondary">
                  {subject}
                </Link>
              ) : (
                <span key={subject} className="rounded-full border border-border bg-card px-3 py-1">{subject}</span>
              )
            })}
          </div>
          <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label={tx(lang, "Вузов с грантами", "Грант бөлінген ЖОО")} value={String(summary.count)} />
            <Stat label={tx(lang, `Грантов в ${LATEST_YEAR}`, `${LATEST_YEAR} жылғы гранттар`)} value={num(summary.grants)} />
            <Stat
              label={tx(lang, "Проходной балл", "Өту балы")}
              value={lowest && highest ? `${lowest.latest.min}–${highest.latest.min}` : "—"}
            />
            <Stat label={tx(lang, "Медиана по стране", "Ел бойынша медиана")} value={summary.medianMin == null ? "—" : String(summary.medianMin)} />
          </div>
          <Ctas lang={lang} source="seo-program" />
        </section>

        <section className="border-y border-border/60 bg-secondary/30">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {tx(lang, `Проходные баллы на «${name}» по вузам`, `«${name}» өту балдары ЖОО бойынша`)}
            </h2>
            <div className="mt-5 overflow-x-auto rounded-xl border border-border bg-card">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-secondary/40 text-left text-xs text-muted-foreground">
                    <th className="px-3 py-3 font-medium sm:px-4">{tx(lang, "Вуз", "ЖОО")}</th>
                    <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, "Проходной", "Өту балы")}</th>
                    <th className="hidden px-3 py-3 text-right font-medium sm:table-cell">{tx(lang, "Средний", "Орташа")}</th>
                    <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, "Грантов", "Грант")}</th>
                    <th className="px-2 py-3 text-right sm:px-3 font-medium">{tx(lang, `К ${LATEST_YEAR - 1}`, "Өзгеріс")}</th>
                    <th className="hidden px-4 py-3 text-right font-medium md:table-cell">{tx(lang, "Сельская квота", "Ауыл квотасы")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {list.map((s) => {
                    const university = getUniversityByCode(s.universityCode)
                    if (!university) return null
                    return (
                      <tr key={s.universityCode} className="transition-colors hover:bg-secondary/30">
                        <td className="px-3 py-3 sm:px-4">
                          <Link href={routes.university(university.slug)} className="font-medium hover:underline">
                            {universityName(university, lang)}
                          </Link>
                        </td>
                        <td className="px-2 py-3 text-right sm:px-3 font-semibold tabular-nums">{s.latest.min}</td>
                        <td className="hidden px-3 py-3 text-right tabular-nums text-muted-foreground sm:table-cell">{s.latest.avg}</td>
                        <td className="px-2 py-3 text-right sm:px-3 tabular-nums">{s.latest.grants}</td>
                        <td className="px-2 py-3 text-right sm:px-3"><ChangeBadge series={s} lang={lang} /></td>
                        <td className="hidden px-4 py-3 text-right tabular-nums text-muted-foreground md:table-cell">{s.latest.ruralMin ?? "—"}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <SourceNote lang={lang} />
          </div>
        </section>

        {trend.length > 1 && (
          <section className="mx-auto max-w-4xl px-4 pt-12 sm:px-6">
            <h2 className="text-2xl font-semibold tracking-tight">
              {tx(lang, `Динамика проходного балла на «${name}»`, `«${name}» өту балының өзгерісі`)}
            </h2>
            <TrendTable lang={lang} trend={trend} />
          </section>
        )}

        <Faq lang={lang} items={faq} />

        {related.length > 0 && (
          <section className="mx-auto max-w-6xl px-4 pb-12 sm:px-6">
            <h2 className="text-xl font-semibold tracking-tight">
              {tx(lang, "С теми же профильными предметами", "Бейіндік пәндері ұқсас мамандықтар")}
            </h2>
            <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {related.map((p) => (
                <li key={p.code}>
                  <Link href={routes.program(p.slug)} className="block rounded-lg border border-border bg-card px-4 py-3 text-sm hover:bg-secondary/50">
                    <span className="text-muted-foreground">{p.code}</span> {programName(p, lang)}
                  </Link>
                </li>
              ))}
            </ul>
            <Link href={routes.hub} className="mt-4 inline-flex items-center gap-1 text-sm font-medium hover:underline">
              {tx(lang, "Все вузы и специальности", "Барлық ЖОО мен мамандықтар")}
              <ArrowRight className="size-4" />
            </Link>
          </section>
        )}
      </main>
    </SeoShell>
  )
}
