"use client"

import { Suspense, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useSearchParams } from "next/navigation"
import useSWR from "swr"
import { ArrowRight, ArrowUpRight, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import { useUiI18n } from "@/lib/i18n/ui"
import type {
  StatisticsAttempt,
  StatisticsReport,
} from "@/lib/api/statistics-types"

const StatisticsChart = dynamic(
  () =>
    import("@/components/dashboard/statistics-chart").then(
      (m) => m.StatisticsChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full" />,
  },
)
const selectClass =
  "mt-2 min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
const panel = "rounded-xl border border-border bg-card p-5 sm:p-6"

export default function StatsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <StatisticsRoute />
    </Suspense>
  )
}

function StatisticsRoute() {
  const search = useSearchParams()
  const { locale } = useUiI18n()
  const period = ["30", "90", "all"].includes(search.get("period") ?? "")
    ? search.get("period")!
    : "90"
  const format = search.get("format") === "practice" ? "practice" : "exam"
  const candidate = search.get("examTypeId") ?? ""
  const examTypeId =
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      candidate,
    )
      ? candidate
      : ""
  return (
    <StatisticsContent
      key={`${period}:${format}:${examTypeId}:${locale}`}
      {...{ period, format, examTypeId }}
      language={locale === "kk" ? "kk" : "ru"}
    />
  )
}

function Loading() {
  return (
    <div role="status" aria-label="Loading statistics" className="space-y-6">
      <Skeleton className="h-10 w-48" />
      <Skeleton className="h-28" />
      <Skeleton className="h-72" />
    </div>
  )
}

function StatisticsContent({
  period,
  format,
  examTypeId,
  language,
}: {
  period: string
  format: "exam" | "practice"
  examTypeId: string
  language: "ru" | "kk"
}) {
  const [page, setPage] = useState(1)
  const [showAllSubjects, setShowAllSubjects] = useState(false)
  const t = (ru: string, kk: string) => (language === "kk" ? kk : ru)
  const params = new URLSearchParams({
    period,
    format,
    page: String(page),
    ...(examTypeId ? { examTypeId } : {}),
  })
  const { data, error, isLoading, isValidating, mutate } =
    useSWR<StatisticsReport>(
      [`/users/me/statistics?${params}`, language],
      ([url]: [string, string]) => api<StatisticsReport>(url),
      { keepPreviousData: true },
    )
  const changeFilter = (key: string, value: string) => {
    const next = new URLSearchParams({
      period,
      format,
      ...(examTypeId ? { examTypeId } : {}),
    })
    if (value) next.set(key, value)
    else next.delete(key)
    // These filters only change client API data; no server navigation is needed.
    // Next's native-history integration updates useSearchParams as well.
    window.history.replaceState(null, "", `/dashboard/stats?${next}`)
  }
  const name = (value: StatisticsAttempt["examName"]) =>
    localize(value, language, t("Экзамен", "Емтихан"))
  const number = (value: number) =>
    new Intl.NumberFormat(language === "kk" ? "kk-KZ" : "ru-RU", {
      maximumFractionDigits: 1,
    }).format(value)
  const percent = (value: number | null | undefined) =>
    value == null ? "—" : `${number(value)}%`
  const date = (value: string) =>
    new Date(value).toLocaleDateString(language === "kk" ? "kk-KZ" : "ru-RU", {
      day: "numeric",
      month: "short",
      year: "numeric",
      timeZone: "Asia/Almaty",
    })
  const points = (attempt: StatisticsAttempt | null) =>
    attempt &&
    attempt.rawScore != null &&
    attempt.maxScore != null &&
    attempt.maxScore > 0
      ? `${attempt.rawScore} / ${attempt.maxScore}`
      : percent(attempt?.percent)
  const summary = data?.summary
  const subjects = data?.subjects ?? []
  const focus = subjects.find(
    (subject) => subject.total >= 10 && subject.accuracy < 80,
  )
  const focusHref = focus
    ? `/dashboard/mistakes/subjects/${focus.subjectId}?examTypeId=${focus.examTypeId}`
    : "/dashboard/mistakes"

  return (
    <div className="space-y-6" data-no-translate data-testid="statistics-page">
      <header className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {t("Ваш прогресс", "Сіздің ілгерілеуіңіз")}
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight">
            {t("Статистика", "Статистика")}
          </h1>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
            {t(
              "Как меняются результаты и каким предметам стоит уделить внимание.",
              "Нәтижелер қалай өзгереді және қай пәндерге көңіл бөлу керек.",
            )}
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/dashboard/exams">
            {t("Пройти пробный", "Сынақ тапсыру")}
            <ArrowUpRight className="size-4" />
          </Link>
        </Button>
      </header>

      <section
        aria-label={t("Фильтры статистики", "Статистика сүзгілері")}
        className={`${panel} grid gap-4 sm:grid-cols-3`}
      >
        <label className="text-sm font-medium">
          {t("Экзамен", "Емтихан")}
          <select
            aria-label={t("Экзамен", "Емтихан")}
            className={selectClass}
            value={examTypeId}
            onChange={(e) => changeFilter("examTypeId", e.target.value)}
          >
            <option value="">{t("Все экзамены", "Барлық емтихандар")}</option>
            {examTypeId &&
              !data?.exams.some((exam) => exam.id === examTypeId) && (
                <option value={examTypeId}>
                  {t("Выбранный экзамен", "Таңдалған емтихан")}
                </option>
              )}
            {data?.exams.map((exam) => (
              <option key={exam.id} value={exam.id}>
                {name(exam.name)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm font-medium">
          {t("Период", "Кезең")}
          <select
            aria-label={t("Период", "Кезең")}
            className={selectClass}
            value={period}
            onChange={(e) => changeFilter("period", e.target.value)}
          >
            <option value="30">{t("Последние 30 дней", "Соңғы 30 күн")}</option>
            <option value="90">{t("Последние 90 дней", "Соңғы 90 күн")}</option>
            <option value="all">{t("За всё время", "Барлық уақыт")}</option>
          </select>
        </label>
        <label className="text-sm font-medium">
          {t("Формат", "Формат")}
          <select
            aria-label="Формат"
            className={selectClass}
            value={format}
            onChange={(e) => changeFilter("format", e.target.value)}
          >
            <option value="exam">
              {t("Полные пробники", "Толық сынақтар")}
            </option>
            <option value="practice">
              {t("Тренировки и блоки", "Жаттығулар мен бөлімдер")}
            </option>
          </select>
        </label>
      </section>

      {error && (
        <section role="alert" className={panel}>
          <h2 className="font-semibold">
            {t(
              "Не удалось обновить статистику",
              "Статистиканы жаңарту мүмкін болмады",
            )}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {data
              ? t(
                  "Ниже сохранённые данные. Повторите загрузку.",
                  "Төменде сақталған деректер. Қайта жүктеңіз.",
                )
              : t(
                  "Это ошибка загрузки, а не отсутствие результатов.",
                  "Бұл нәтиженің жоқтығы емес, жүктеу қатесі.",
                )}
          </p>
          <Button
            className="mt-4"
            variant="outline"
            disabled={isValidating}
            onClick={() => {
              void mutate().catch(() => {})
            }}
          >
            <RotateCcw className="size-4" />
            {t("Повторить", "Қайталау")}
          </Button>
        </section>
      )}
      {isLoading && !data && <Loading />}
      {data && summary && (
        <>
          <p className="text-xs leading-relaxed text-muted-foreground">
            {t(
              "Только завершённые попытки, включая истёкшее время. Полные пробники и тренировки считаются отдельно.",
              "Уақыты аяқталған сынақтарды қоса алғанда, тек аяқталған әрекеттер. Толық сынақтар мен жаттығулар бөлек есептеледі.",
            )}
          </p>
          {summary.total === 0 ? (
            <section
              className={`${panel} py-12 text-center`}
              data-testid="statistics-empty"
            >
              <h2 className="text-xl font-semibold">
                {t("Здесь пока нет результатов", "Әзірге нәтиже жоқ")}
              </h2>
              <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">
                {t(
                  "Попробуйте другой период или формат. Незавершённые тесты появятся здесь после окончания.",
                  "Басқа кезеңді немесе форматты таңдаңыз. Аяқталмаған сынақтар аяқталғаннан кейін көрсетіледі.",
                )}
              </p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                <Button
                  variant="outline"
                  onClick={() => changeFilter("period", "all")}
                >
                  {t("За всё время", "Барлық уақыт")}
                </Button>
                <Button asChild>
                  <Link href="/dashboard/exams">
                    {t("К экзаменам", "Емтихандарға")}
                  </Link>
                </Button>
              </div>
            </section>
          ) : (
            <>
              <section
                className={`${panel} !p-0 overflow-hidden`}
                data-testid="statistics-summary"
              >
                <div className="grid grid-cols-2 lg:grid-cols-4">
                  {[
                    {
                      label: t("Последний результат", "Соңғы нәтиже"),
                      value: points(summary.latest),
                      note: summary.latest
                        ? `${name(summary.latest.examName)} · ${date(summary.latest.date)}`
                        : "—",
                    },
                    {
                      label: t("Лучший результат", "Үздік нәтиже"),
                      value: points(summary.best),
                      note: t(
                        "Попытка с наибольшим процентом",
                        "Ең жоғары пайызды әрекет",
                      ),
                    },
                    {
                      label: t("Средний результат", "Орташа нәтиже"),
                      value: percent(summary.averagePercent),
                      note: t(
                        `По ${summary.scored} попыткам с оценкой`,
                        `${summary.scored} бағаланған әрекет бойынша`,
                      ),
                    },
                    {
                      label: t("Завершено", "Аяқталды"),
                      value: String(summary.total),
                      note: t(
                        `По времени завершено: ${summary.timedOutCount}`,
                        `Уақыты аяқталған: ${summary.timedOutCount}`,
                      ),
                    },
                  ].map((metric) => (
                    <div
                      key={metric.label}
                      className="min-w-0 p-5 sm:border-r sm:border-border last:border-r-0"
                    >
                      <p className="text-xs text-muted-foreground">
                        {metric.label}
                      </p>
                      <p className="mt-2 text-3xl font-semibold tabular-nums tracking-tight">
                        {metric.value}
                      </p>
                      <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
                        {metric.note}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border bg-muted/30 px-5 py-4">
                  <p className="text-sm">
                    {summary.deltaPercentPoints == null ? (
                      t(
                        "Для сравнения нужны две последовательные попытки одинакового состава.",
                        "Салыстыру үшін құрамы бірдей қатарынан екі әрекет қажет.",
                      )
                    ) : (
                      <>
                        <span className="font-semibold tabular-nums">
                          {summary.deltaPercentPoints > 0 ? "+" : ""}
                          {number(summary.deltaPercentPoints)}{" "}
                          {t("п.п.", "п.т.")}
                        </span>
                        <span className="text-muted-foreground">
                          {" "}
                          {t(
                            "к предыдущей попытке",
                            "алдыңғы әрекетке қатысты",
                          )}
                        </span>
                      </>
                    )}
                  </p>
                  {summary.latest && (
                    <Link
                      className="inline-flex min-h-10 items-center gap-2 text-sm font-medium hover:underline"
                      href={`/exam/${summary.latest.sessionId}/review`}
                    >
                      {t("Разобрать последний", "Соңғысын талдау")}
                      <ArrowRight className="size-4" />
                    </Link>
                  )}
                </div>
              </section>

              <section
                className={panel}
                aria-labelledby="statistics-chart-title"
              >
                <h2
                  id="statistics-chart-title"
                  className="text-lg font-semibold"
                >
                  {t("Динамика результатов", "Нәтижелер динамикасы")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(
                    `Последние ${data.chart.length} оценённых попыток, от ранних к новым. Шкала — процент от максимального балла.`,
                    `Соңғы ${data.chart.length} бағаланған әрекет, ескіден жаңаға қарай. Шкала — ең жоғары балдың пайызы.`,
                  )}
                </p>
                {data.chart.length ? (
                  <StatisticsChart attempts={data.chart} language={language} />
                ) : (
                  <p className="py-8 text-sm text-muted-foreground">
                    {t(
                      "Для этих попыток оценка ещё недоступна.",
                      "Бұл әрекеттердің бағасы әлі қолжетімсіз.",
                    )}
                  </p>
                )}
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t(
                    "Разная сложность и набор предметов влияют на результат. Это не прогноз балла на экзамене.",
                    "Әртүрлі күрделілік пен пәндер құрамы нәтижеге әсер етеді. Бұл емтихан балының болжамы емес.",
                  )}
                </p>
                {summary.unscored > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    {t(
                      `Без оценки: ${summary.unscored}. Они не входят в среднее и график.`,
                      `Бағасыз: ${summary.unscored}. Олар орташа мән мен графикке кірмейді.`,
                    )}
                  </p>
                )}
              </section>

              <section className={panel} data-testid="statistics-subjects">
                <h2 className="text-lg font-semibold">
                  {t("По предметам", "Пәндер бойынша")}
                </h2>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {t(
                    "Доля полностью верных ответов среди проверенных вопросов выбранных попыток. Частичные баллы сюда не входят; это не балл ЕНТ.",
                    "Таңдалған әрекеттердің тексерілген сұрақтарындағы толық дұрыс жауаптар үлесі. Ішінара балдар кірмейді; бұл ҰБТ балы емес.",
                  )}
                </p>
                {subjects.length === 0 ? (
                  <p className="mt-5 text-sm text-muted-foreground">
                    {t(
                      "Нет проверенных ответов для разбивки по предметам.",
                      "Пәндерге бөлу үшін тексерілген жауаптар жоқ.",
                    )}
                  </p>
                ) : (
                  <ul className="mt-4 divide-y divide-border">
                    {(showAllSubjects ? subjects : subjects.slice(0, 6)).map(
                      (subject) => (
                        <li
                          key={subject.subjectId}
                          className="grid gap-3 py-4 sm:grid-cols-[minmax(0,1fr)_180px_auto] sm:items-center"
                        >
                          <div className="min-w-0">
                            <p className="break-words font-medium">
                              {name(subject.subjectName)}
                            </p>
                            <p className="mt-1 text-xs text-muted-foreground">
                              {t(
                                `${subject.correct} из ${subject.total} полностью верно`,
                                `${subject.total} сұрақтың ${subject.correct} толық дұрыс`,
                              )}
                              {subject.total < 10 &&
                                ` · ${t("мало данных", "дерек аз")}`}
                            </p>
                          </div>
                          <div>
                            <div className="mb-2 text-sm font-medium tabular-nums">
                              {percent(subject.accuracy)}
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-foreground/70"
                                style={{
                                  width: `${Math.max(0, Math.min(100, subject.accuracy))}%`,
                                }}
                              />
                            </div>
                          </div>
                          <Link
                            href={`/dashboard/mistakes/subjects/${subject.subjectId}?examTypeId=${subject.examTypeId}`}
                            className="inline-flex min-h-11 items-center gap-2 text-sm hover:underline sm:ml-4"
                          >
                            {t("Мои ошибки", "Менің қателерім")}
                            <ArrowRight className="size-4" />
                          </Link>
                        </li>
                      ),
                    )}
                  </ul>
                )}
                {subjects.length > 6 && (
                  <Button
                    variant="outline"
                    className="mt-3"
                    onClick={() => setShowAllSubjects((v) => !v)}
                  >
                    {showAllSubjects
                      ? t("Свернуть", "Жасыру")
                      : t(
                          `Все предметы (${subjects.length})`,
                          `Барлық пәндер (${subjects.length})`,
                        )}
                  </Button>
                )}
              </section>

              <section
                className={`${panel} flex flex-wrap items-center justify-between gap-4`}
              >
                <div className="max-w-2xl">
                  <h2 className="font-semibold">
                    {focus
                      ? t(
                          `Фокус: ${name(focus.subjectName)}`,
                          `Назарда: ${name(focus.subjectName)}`,
                        )
                      : t("Следующий шаг", "Келесі қадам")}
                  </h2>
                  <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                    {focus
                      ? t(
                          "Среди предметов с 10 и более проверенными вопросами здесь самая низкая точность. Проверьте, какие ошибки ещё остались.",
                          "10 және одан көп тексерілген сұрағы бар пәндердің ішінде дәлдік ең төмен. Қандай қателер қалғанын тексеріңіз.",
                        )
                      : t(
                          "Посмотрите актуальные ошибки или пройдите следующий пробный. Исправление вопроса не меняет прошлые результаты.",
                          "Ағымдағы қателерді қараңыз немесе келесі сынақты тапсырыңыз. Сұрақты түзету бұрынғы нәтижелерді өзгертпейді.",
                        )}
                  </p>
                </div>
                <Button asChild variant="outline">
                  <Link href={focusHref}>
                    {t("К работе над ошибками", "Қателермен жұмысқа")}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </section>

              <section className={panel} data-testid="statistics-history">
                <h2 className="text-lg font-semibold">
                  {t("История результатов", "Нәтижелер тарихы")}
                </h2>
                <ul className="mt-4 divide-y divide-border">
                  {data.history.map((attempt) => (
                    <li key={attempt.sessionId}>
                      <Link
                        className="flex min-h-20 items-center gap-3 rounded-md py-4 hover:bg-muted/40 focus-visible:outline-2 focus-visible:outline-ring"
                        href={`/exam/${attempt.sessionId}/review`}
                      >
                        <div className="min-w-0 flex-1">
                          <p className="break-words text-sm font-medium">
                            {name(attempt.examName)}
                          </p>
                          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                            {date(attempt.date)} ·{" "}
                            {attempt.language === "kk" ? "ҚАЗ" : "РУС"}
                            {attempt.status === "timed_out" &&
                              ` · ${t("время истекло", "уақыт аяқталды")}`}
                          </p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="font-semibold tabular-nums">
                            {points(attempt)}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {percent(attempt.percent)}
                          </p>
                        </div>
                        <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
                      </Link>
                    </li>
                  ))}
                </ul>
                {data.pageCount > 1 && (
                  <nav
                    aria-label={t("Страницы результатов", "Нәтиже беттері")}
                    className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4"
                  >
                    <p
                      aria-live="polite"
                      className="text-sm text-muted-foreground"
                    >
                      {t(
                        `Страница ${data.page} из ${data.pageCount}`,
                        `${data.pageCount} беттің ${data.page}-беті`,
                      )}
                    </p>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        disabled={data.page <= 1 || isValidating}
                        onClick={() => setPage(data.page - 1)}
                      >
                        {t("Назад", "Артқа")}
                      </Button>
                      <Button
                        variant="outline"
                        disabled={data.page >= data.pageCount || isValidating}
                        onClick={() => setPage(data.page + 1)}
                      >
                        {t("Вперёд", "Алға")}
                      </Button>
                    </div>
                  </nav>
                )}
              </section>
              <details className="text-sm text-muted-foreground">
                <summary className="min-h-10 cursor-pointer py-2">
                  {t(
                    "Как считаются показатели",
                    "Көрсеткіштер қалай есептеледі",
                  )}
                </summary>
                <p className="mt-2 max-w-3xl leading-relaxed">
                  {t(
                    "Среднее — среднее арифметическое процентов отдельных попыток. Динамика — разница в процентных пунктах между двумя последними попытками одинакового состава внутри фильтра. Повторный вопрос учитывается каждый раз. Даты — по времени Алматы; период отсчитывается от текущего момента.",
                    "Орташа мән — жеке әрекеттер пайыздарының арифметикалық ортасы. Динамика — сүзгі ішіндегі құрамы бірдей соңғы екі әрекеттің пайыздық тармақтардағы айырмасы. Қайталанған сұрақ әр жолы есептеледі. Күндер Алматы уақытымен; кезең ағымдағы сәттен есептеледі.",
                  )}
                </p>
              </details>
            </>
          )}
        </>
      )}
    </div>
  )
}
