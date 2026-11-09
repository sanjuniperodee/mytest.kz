import type { Metadata } from "next"
import Link from "next/link"
import { headers } from "next/headers"
import type { ReactNode } from "react"
import { ArrowRight, CalendarCheck, Lock, Target, TrendingUp } from "lucide-react"
import type { BillingPlanDto, ParentReportDto, ParentReportLang } from "@bilimland/shared"
import { Logo } from "@/components/landing/logo"
import { ParentReportCtaLink, ParentReportViewBeacon } from "@/components/parent-report/report-tracking"
import { fetchParentReport, fetchPlansForParents } from "@/lib/parent-report-server"
import { cn } from "@/lib/utils"

/**
 * «Отчёт для родителей»: ученик присылает ссылку, родитель видит прогресс без входа.
 * Ссылка сама по себе даёт доступ, поэтому: noindex, no-referrer (токен не уходит
 * в Referer при переходе дальше), без кэша и без имени ученика в превью мессенджеров.
 */

export const dynamic = "force-dynamic"

export const metadata: Metadata = {
  title: "Отчёт о подготовке к ЕНТ",
  description: "Результаты пробных ЕНТ, цель поступления и предметы, где теряются баллы.",
  robots: { index: false, follow: false, nocache: true, googleBot: { index: false, follow: false } },
  referrer: "no-referrer",
  openGraph: {
    type: "website",
    siteName: "mytest",
    title: "Отчёт о подготовке к ЕНТ · ҰБТ-ға дайындық есебі",
    description: "Результаты пробных ЕНТ, цель и слабые предметы — на одной странице.",
  },
}

type Copy = (ru: string, kk: string) => string

const ENT_MAX = 140

function ruPlural(n: number, forms: [string, string, string]) {
  const abs = Math.abs(n) % 100
  const last = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (last === 1) return forms[0]
  if (last >= 2 && last <= 4) return forms[1]
  return forms[2]
}

function formatDate(iso: string, lang: ParentReportLang, withYear = false) {
  return new Intl.DateTimeFormat(lang === "kk" ? "kk-KZ" : "ru-RU", {
    day: "numeric",
    month: withYear ? "long" : "short",
    ...(withYear ? { year: "numeric" } : {}),
    timeZone: "Asia/Almaty",
  }).format(new Date(iso))
}

function formatDateTime(iso: string, lang: ParentReportLang) {
  return new Intl.DateTimeFormat(lang === "kk" ? "kk-KZ" : "ru-RU", {
    day: "numeric",
    month: "long",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Almaty",
  }).format(new Date(iso))
}

function formatKzt(n: number) {
  return `${n.toLocaleString("ru-RU")}\u00a0₸`
}

function signed(n: number) {
  return n > 0 ? `+${n}` : n < 0 ? `−${Math.abs(n)}` : "0"
}

export default async function ParentReportPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>
  searchParams: Promise<{ lang?: string | string[]; preview?: string | string[] }>
}) {
  const [{ token }, query, requestHeaders] = await Promise.all([params, searchParams, headers()])
  const lang: ParentReportLang = query.lang === "kk" ? "kk" : "ru"
  // Ученик смотрит свой отчёт из кабинета — это не открытие родителем.
  const preview = query.preview === "1"
  const t: Copy = (ru, kk) => (lang === "kk" ? kk : ru)
  // IP родителя для лимита запросов в API: x-real-ip / последний адрес, добавленный nginx (первый подделывается).
  const clientIp =
    requestHeaders.get("x-real-ip")?.trim() ||
    requestHeaders.get("x-forwarded-for")?.split(",").pop()?.trim() ||
    null

  const [result, plans] = await Promise.all([
    fetchParentReport(token, lang, clientIp),
    fetchPlansForParents(lang),
  ])

  return (
    <div lang={lang} className="min-h-screen bg-background text-foreground" data-no-translate>
      <header className="mx-auto flex max-w-2xl items-center justify-between gap-3 px-4 pt-5 sm:pt-8">
        <Link href="/" className="inline-flex items-center gap-2 font-semibold tracking-tight" aria-label="mytest">
          <Logo className="size-7" />
          <span>mytest</span>
        </Link>
        <nav aria-label={t("Язык отчёта", "Есеп тілі")} className="inline-flex rounded-full border border-border bg-card p-0.5 text-xs font-medium">
          {(["ru", "kk"] as const).map((code) => (
            <Link
              key={code}
              href={`?lang=${code}${preview ? "&preview=1" : ""}`}
              replace
              scroll={false}
              aria-current={lang === code ? "true" : undefined}
              className={cn(
                "inline-flex min-h-8 min-w-11 items-center justify-center rounded-full px-3 transition-colors",
                lang === code ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {code === "ru" ? "RU" : "ҚАЗ"}
            </Link>
          ))}
        </nav>
      </header>

      <main className="mx-auto flex max-w-2xl flex-col gap-4 px-4 pb-16 pt-6 sm:gap-5 sm:pt-8">
        {result.status === "ok" ? (
          <>
            {!preview && <ParentReportViewBeacon lang={lang} />}
            <Report report={result.report} plans={plans} lang={lang} t={t} />
          </>
        ) : (
          <section className="rounded-2xl border border-border bg-card p-6 text-center sm:p-8">
            <Lock className="mx-auto size-6 text-muted-foreground" aria-hidden />
            <h1 className="mt-3 text-xl font-semibold tracking-tight">
              {result.status === "not_found"
                ? t("Ссылка больше не действует", "Сілтеме енді жарамсыз")
                : t("Отчёт временно недоступен", "Есеп уақытша қолжетімсіз")}
            </h1>
            <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
              {result.status === "not_found"
                ? t(
                    "Скорее всего, ученик отозвал её или отправил новую. Попросите прислать свежую ссылку из личного кабинета mytest.",
                    "Оқушы оны кері қайтарып алған немесе жаңасын жіберген болуы мүмкін. Жеке кабинеттен жаңа сілтеме жіберуін сұраңыз.",
                  )
                : t("Попробуйте обновить страницу через минуту.", "Бір минуттан кейін бетті жаңартып көріңіз.")}
            </p>
          </section>
        )}
      </main>
    </div>
  )
}

function Report({
  report,
  plans,
  lang,
  t,
}: {
  report: ParentReportDto
  plans: BillingPlanDto[]
  lang: ParentReportLang
  t: Copy
}) {
  const name = report.studentFirstName
  const { fullEnt, goal, weakSubjects } = report
  const points = (n: number) => (lang === "kk" ? `${n} балл` : `${n} ${ruPlural(n, ["балл", "балла", "баллов"])}`)
  const topWeak = weakSubjects?.items[0]?.name ?? null

  return (
    <>
      {/* Главное: кто, когда, четыре цифры */}
      <section className="rounded-2xl border border-border bg-card p-5 shadow-sm sm:p-6" aria-labelledby="report-title">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {t("Отчёт о подготовке к ЕНТ", "ҰБТ-ға дайындық есебі")}
        </p>
        <h1 id="report-title" className="mt-1.5 text-2xl font-semibold tracking-tight sm:text-3xl">
          {name
            ? t(`${name}: как идёт подготовка`, `${name}: дайындық қалай жүріп жатыр`)
            : t("Как идёт подготовка к ЕНТ", "ҰБТ-ға дайындық қалай жүріп жатыр")}
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {t(
            `Данные на ${formatDateTime(report.generatedAt, lang)}. Отчёт обновляется сам — ссылку можно сохранить.`,
            `${formatDateTime(report.generatedAt, lang)} жағдайы бойынша. Есеп өздігінен жаңарады — сілтемені сақтап қоюға болады.`,
          )}
        </p>

        <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl border border-border bg-border sm:grid-cols-4">
          <Metric
            label={t("Последний полный ЕНТ", "Соңғы толық ҰБТ")}
            value={fullEnt.latest ? String(fullEnt.latest.score) : "—"}
            suffix={fullEnt.latest ? `/${fullEnt.maxScore}` : undefined}
            hint={fullEnt.latest ? formatDate(fullEnt.latest.date, lang) : undefined}
          />
          <Metric
            label={t("Лучший результат", "Ең жақсы нәтиже")}
            value={fullEnt.best ? String(fullEnt.best.score) : "—"}
            suffix={fullEnt.best ? `/${fullEnt.maxScore}` : undefined}
            hint={fullEnt.best ? formatDate(fullEnt.best.date, lang) : undefined}
          />
          <Metric
            label={t("С первого пробного", "Алғашқы сынақтан бері")}
            value={fullEnt.changeSinceFirst != null ? signed(fullEnt.changeSinceFirst) : "—"}
            tone={fullEnt.changeSinceFirst != null && fullEnt.changeSinceFirst > 0 ? "up" : undefined}
            hint={
              fullEnt.changeSinceFirst != null && fullEnt.first
                ? t(`было ${fullEnt.first.score}`, `басында ${fullEnt.first.score}`)
                : t("нужно 2 пробных", "2 сынақ керек")
            }
          />
          <Metric
            label={t("Тестов за 7 дней", "7 күндегі тест")}
            value={String(report.testsLast7Days)}
            hint={t(`всего полных ЕНТ: ${fullEnt.count}`, `барлық толық ҰБТ: ${fullEnt.count}`)}
          />
        </dl>

        {fullEnt.count === 0 && (
          <p className="mt-4 rounded-lg bg-muted/60 px-3 py-2.5 text-sm leading-relaxed text-muted-foreground">
            {t(
              "Полный пробный ЕНТ (120 заданий, 140 баллов) ещё не сдан — итоговые цифры появятся после него. Короткие тесты показаны ниже, но в общий балл не входят.",
              "Толық ҰБТ сынағы (120 тапсырма, 140 балл) әлі тапсырылмаған — қорытынды сандар содан кейін шығады. Қысқа тесттер төменде көрсетілген, бірақ жалпы балға кірмейді.",
            )}
          </p>
        )}
      </section>

      {fullEnt.series.length > 0 && (
        <Card icon={<TrendingUp className="size-4" />} title={t("Динамика полного ЕНТ", "Толық ҰБТ динамикасы")}>
          <TrendBars series={fullEnt.series} max={fullEnt.maxScore} goal={goal?.requiredScore ?? null} lang={lang} t={t} />
        </Card>
      )}

      <Card icon={<Target className="size-4" />} title={t("Цель поступления", "Түсу мақсаты")}>
        {goal ? (
          <div className="space-y-3">
            <div>
              <p className="font-medium leading-snug">{goal.university}</p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {goal.programCode} · {goal.program}
              </p>
            </div>
            {goal.requiredScore != null ? (
              <>
                <p className="text-sm">
                  {goal.admissionYear
                    ? t(`Проходной балл на грант (ЕНТ ${goal.admissionYear}): `, `Грантқа өту балы (ҰБТ ${goal.admissionYear}): `)
                    : t("Проходной балл на грант: ", "Грантқа өту балы: ")}
                  <span className="font-semibold tabular-nums">{goal.requiredScore}</span>
                </p>
                {goal.currentScore != null && (
                  <div
                    className="h-2 overflow-hidden rounded-full bg-muted"
                    role="progressbar"
                    aria-valuemin={0}
                    aria-valuemax={goal.requiredScore}
                    aria-valuenow={Math.min(goal.currentScore, goal.requiredScore)}
                    aria-label={t("Путь к цели", "Мақсатқа дейінгі жол")}
                  >
                    <div
                      className={cn("h-full rounded-full", goal.gap === 0 ? "bg-emerald-600 dark:bg-emerald-500" : "bg-accent")}
                      style={{ width: `${Math.min(100, Math.round((goal.currentScore / Math.max(1, goal.requiredScore)) * 100))}%` }}
                    />
                  </div>
                )}
                <p className="text-sm leading-relaxed text-muted-foreground">
                  {goal.currentScore == null
                    ? t(
                        "Чтобы сравнить с целью, нужен хотя бы один полный пробный ЕНТ.",
                        "Мақсатпен салыстыру үшін кемінде бір толық ҰБТ сынағы керек.",
                      )
                    : goal.gap && goal.gap > 0
                      ? t(
                          `Лучший результат — ${goal.currentScore}. До цели не хватает ${points(goal.gap)}.`,
                          `Ең жақсы нәтиже — ${goal.currentScore}. Мақсатқа ${points(goal.gap)} жетпейді.`,
                        )
                      : t(
                          `Лучший результат — ${goal.currentScore}: уже на уровне проходного. Важно удержать его на экзамене.`,
                          `Ең жақсы нәтиже — ${goal.currentScore}: өту балы деңгейінде. Емтиханда осы деңгейді сақтау маңызды.`,
                        )}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t("Проходной балл по этой цели пока не опубликован.", "Бұл мақсат бойынша өту балы әлі жарияланбаған.")}
              </p>
            )}
          </div>
        ) : (
          <p className="text-sm leading-relaxed text-muted-foreground">
            {t(
              "Вуз и специальность пока не выбраны. Когда ученик выберет их в кабинете, здесь появится, сколько баллов не хватает до гранта.",
              "ЖОО мен мамандық әлі таңдалмаған. Оқушы оларды кабинетте таңдағанда, мұнда грантқа қанша балл жетпейтіні көрсетіледі.",
            )}
          </p>
        )}
      </Card>

      {weakSubjects && (
        <Card
          title={t("Где теряются баллы", "Балл қай жерде жоғалады")}
          subtitle={
            weakSubjects.scope === "full"
              ? t(`По последнему полному ЕНТ, ${formatDate(weakSubjects.date, lang)}`, `Соңғы толық ҰБТ бойынша, ${formatDate(weakSubjects.date, lang)}`)
              : t(`По последнему тесту, ${formatDate(weakSubjects.date, lang)}`, `Соңғы тест бойынша, ${formatDate(weakSubjects.date, lang)}`)
          }
        >
          {weakSubjects.items.length > 0 ? (
            <ul className="space-y-3.5">
              {weakSubjects.items.map((item) => (
                <li key={item.name}>
                  <div className="flex items-baseline justify-between gap-3 text-sm">
                    <span className="min-w-0 font-medium">{item.name}</span>
                    <span className="shrink-0 tabular-nums text-muted-foreground">
                      {t(`${item.earnedPoints} из ${item.maxPoints}`, `${item.maxPoints}-ден ${item.earnedPoints}`)}
                      <span className="ml-2 font-semibold text-foreground">−{item.lostPoints}</span>
                    </span>
                  </div>
                  <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden>
                    <div
                      className="h-full rounded-full bg-foreground/70"
                      style={{ width: `${Math.round((item.earnedPoints / Math.max(1, item.maxPoints)) * 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">
              {t("В этом тесте баллы не потеряны ни по одному предмету.", "Бұл тестте бірде-бір пән бойынша балл жоғалмаған.")}
            </p>
          )}
        </Card>
      )}

      <Card icon={<CalendarCheck className="size-4" />} title={t("Последние попытки", "Соңғы әрекеттер")}>
        {report.attempts.length > 0 ? (
          <ul className="divide-y divide-border">
            {report.attempts.map((attempt, index) => (
              <li key={`${attempt.date}-${index}`} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className="text-muted-foreground tabular-nums">{formatDate(attempt.date, lang)}</span>
                <span className="flex min-w-0 items-center gap-2">
                  <span
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs",
                      attempt.scope === "full" ? "bg-secondary font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {attempt.scope === "full" ? t("Полный ЕНТ", "Толық ҰБТ") : t("Короткий тест", "Қысқа тест")}
                  </span>
                  <span className="w-16 text-right font-semibold tabular-nums">
                    {attempt.score != null && attempt.maxScore != null ? `${attempt.score}/${attempt.maxScore}` : "—"}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-sm text-muted-foreground">{t("Пока нет завершённых тестов.", "Әзірге аяқталған тест жоқ.")}</p>
        )}
      </Card>

      <WhatYouCanDo report={report} plans={plans} lang={lang} t={t} topWeak={topWeak} />

      <footer className="px-1 pt-2 text-xs leading-relaxed text-muted-foreground">
        <p className="flex gap-2">
          <Lock className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          <span>
            {t(
              "Отчёт видят только те, у кого есть эта ссылка. Ученик может отозвать её в любой момент в личном кабинете. Здесь нет ответов, контактов и переписки — только итоги тестов.",
              "Есепті тек осы сілтемесі барлар ғана көреді. Оқушы оны жеке кабинетте кез келген уақытта кері қайтарып ала алады. Мұнда жауаптар, байланыс деректері мен хат-хабар жоқ — тек тест қорытындылары.",
            )}
          </span>
        </p>
        <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 pl-5.5">
          <Link href="/privacy" className="underline-offset-4 hover:underline">
            {t("Политика конфиденциальности", "Құпиялылық саясаты")}
          </Link>
          <Link href="/" className="underline-offset-4 hover:underline">
            my-test.kz
          </Link>
        </p>
      </footer>
    </>
  )
}

function WhatYouCanDo({
  report,
  plans,
  lang,
  t,
  topWeak,
}: {
  report: ParentReportDto
  plans: BillingPlanDto[]
  lang: ParentReportLang
  t: Copy
  topWeak: string | null
}) {
  const priceLine = plans
    .slice(0, 4)
    .map((plan) => `${plan.name} — ${formatKzt(plan.priceKzt)}`)
    .join(" · ")

  return (
    <section className="rounded-2xl border border-accent/30 bg-accent/5 p-5 sm:p-6" aria-labelledby="what-to-do">
      <h2 id="what-to-do" className="text-lg font-semibold tracking-tight">
        {t("Что можно сделать", "Не істеуге болады")}
      </h2>
      <ul className="mt-3 space-y-2.5 text-sm leading-relaxed">
        {topWeak && (
          <Tip>
            {t(
              `Поговорите о предмете «${topWeak}»: в последнем тесте там потеряно больше всего баллов.`,
              `«${topWeak}» пәні туралы сөйлесіңіз: соңғы тестте балл ең көп сол жерде жоғалған.`,
            )}
          </Tip>
        )}
        <Tip>
          {t(
            "Регулярность важнее рывков: 2–3 полных пробных в неделю и разбор ошибок после каждого.",
            "Тұрақтылық маңызды: аптасына 2–3 толық сынақ және әр сынақтан кейін қателерді талдау.",
          )}
        </Tip>
        {report.plan.active ? (
          <Tip>
            {report.plan.until
              ? t(
                  `Платный доступ уже открыт — до ${formatDate(report.plan.until, lang, true)}: разборы ошибок, тренировка слабых тем и пробные.`,
                  `Ақылы қолжетімділік ашық — ${formatDate(report.plan.until, lang, true)} дейін: қателерді талдау, әлсіз тақырыптарды жаттықтыру және сынақтар.`,
                )
              : t(
                  "Платный доступ уже открыт: разборы ошибок, тренировка слабых тем и пробные.",
                  "Ақылы қолжетімділік ашық: қателерді талдау, әлсіз тақырыптарды жаттықтыру және сынақтар.",
                )}
          </Tip>
        ) : (
          <Tip>
            {t(
              "Платный доступ открывает разбор каждой ошибки, тренировку слабых тем и дополнительные пробные. Без автопродления.",
              "Ақылы қолжетімділік әр қатенің талдауын, әлсіз тақырыптарды жаттықтыруды және қосымша сынақтарды ашады. Автоматты түрде ұзартылмайды.",
            )}
            {priceLine && <span className="mt-1 block font-medium tabular-nums">{priceLine}</span>}
          </Tip>
        )}
        <Tip>
          {t(
            "Оплатить можно с вашего Kaspi: ученик выбирает тариф в кабинете, в поле «Кто платит?» отмечает «Родитель» и вводит ваш номер. Счёт придёт в Kaspi → «Платежи» → «Счета на оплату», доступ откроется сразу после оплаты.",
            "Kaspi арқылы өзіңіз төлей аласыз: оқушы кабинетте тарифті таңдап, «Кім төлейді?» жолында «Ата-ана» деп белгілеп, нөміріңізді енгізеді. Шот Kaspi → «Төлемдер» → «Төлемге арналған шоттар» бөліміне келеді, қолжетімділік төлемнен кейін бірден ашылады.",
          )}
        </Tip>
      </ul>

      <ParentReportCtaLink
        href="/payment"
        placement={report.plan.active ? "support_active" : "support"}
        className="mt-5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-lg bg-primary px-5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 sm:w-auto"
      >
        {t("Поддержать подготовку", "Дайындыққа қолдау көрсету")}
        <ArrowRight className="size-4" aria-hidden />
      </ParentReportCtaLink>
      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
        {t(
          "Ответить ученику через этот отчёт нельзя — мы не знаем ваш номер. Просто скажите ребёнку, что готовы оплатить, и счёт придёт вам в Kaspi.",
          "Бұл есеп арқылы оқушыға жауап беру мүмкін емес — біз сіздің нөміріңізді білмейміз. Балаңызға төлеуге дайын екеніңізді айтыңыз — шот сізге Kaspi-ге келеді.",
        )}
      </p>
    </section>
  )
}

function Tip({ children }: { children: ReactNode }) {
  return (
    <li className="flex gap-2.5">
      <span className="mt-2 size-1.5 shrink-0 rounded-full bg-accent" aria-hidden />
      <span className="min-w-0">{children}</span>
    </li>
  )
}

function Card({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string
  subtitle?: string
  icon?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-border bg-card p-5 sm:p-6">
      <h2 className="flex items-center gap-2 text-base font-semibold tracking-tight">
        {icon && <span className="text-muted-foreground" aria-hidden>{icon}</span>}
        {title}
      </h2>
      {subtitle && <p className="mt-0.5 text-xs text-muted-foreground">{subtitle}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function Metric({
  label,
  value,
  suffix,
  hint,
  tone,
}: {
  label: string
  value: string
  suffix?: string
  hint?: string
  tone?: "up"
}) {
  return (
    <div className="bg-card p-3.5 sm:p-4">
      <dt className="text-xs leading-snug text-muted-foreground">{label}</dt>
      <dd className="mt-1">
        <span className={cn("text-2xl font-semibold tabular-nums", tone === "up" && "text-emerald-700 dark:text-emerald-400")}>
          {value}
        </span>
        {suffix && <span className="text-sm text-muted-foreground tabular-nums">{suffix}</span>}
        {hint && <span className="mt-0.5 block text-xs text-muted-foreground">{hint}</span>}
      </dd>
    </div>
  )
}

/** Столбики без библиотек: высота = балл / 140, пунктир — проходной балл цели. */
function TrendBars({
  series,
  max,
  goal,
  lang,
  t,
}: {
  series: ParentReportDto["fullEnt"]["series"]
  max: number
  goal: number | null
  lang: ParentReportLang
  t: Copy
}) {
  const scale = Math.max(max, ENT_MAX)
  // 85% — запас сверху под подписи над столбиками; линия цели в том же масштабе.
  const pct = (n: number) => `${Math.max(2, Math.min(85, (n / scale) * 85))}%`
  const summary = series.map((p) => `${formatDate(p.date, lang)}: ${p.score}`).join(", ")
  return (
    <figure>
      <div
        className="relative flex h-44 items-end gap-1.5 border-b border-border sm:gap-2"
        role="img"
        aria-label={t(`Баллы полного ЕНТ из ${max}: ${summary}`, `Толық ҰБТ балдары (${max}-ден): ${summary}`)}
      >
        {goal != null && goal > 0 && goal <= scale && (
          <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-accent" style={{ bottom: pct(goal) }}>
            <span className="absolute -top-5 right-0 rounded bg-card px-1 text-[11px] font-medium text-accent">
              {t(`цель ${goal}`, `мақсат ${goal}`)}
            </span>
          </div>
        )}
        {series.map((p, i) => {
          const latest = i === series.length - 1
          return (
            <div key={`${p.date}-${i}`} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              <span className={cn("mb-1 text-[11px] tabular-nums", latest ? "font-semibold" : "text-muted-foreground")}>{p.score}</span>
              <div
                className={cn("w-full max-w-10 rounded-t-md", latest ? "bg-foreground" : "bg-foreground/25")}
                style={{ height: pct(p.score) }}
              />
            </div>
          )
        })}
      </div>
      <div className="mt-1.5 flex gap-1.5 sm:gap-2" aria-hidden>
        {series.map((p, i) => (
          <span key={`${p.date}-${i}`} className="min-w-0 flex-1 truncate text-center text-[10px] text-muted-foreground">
            {formatDate(p.date, lang)}
          </span>
        ))}
      </div>
      <figcaption className="mt-2 text-xs text-muted-foreground">
        {t(`Только полные пробные ЕНТ, максимум ${max} баллов.`, `Тек толық ҰБТ сынақтары, ең көбі ${max} балл.`)}
      </figcaption>
    </figure>
  )
}
