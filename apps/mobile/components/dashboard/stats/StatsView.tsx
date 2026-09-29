import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { EntProgressLineChart } from "@/components/dashboard/EntProgressLineChart"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Screen } from "@/components/ui/screen"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { SelectSheet } from "@/components/ui/select-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import type { StatisticsAttempt, StatisticsReport } from "@/lib/api/statistics-types"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Period = "30" | "90" | "all"
type Format = "exam" | "practice"

/** Student progress report: same data and wording as the website's statistics page. */
export function StatsView() {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { locale } = useUiLocale()
  const [period, setPeriod] = useState<Period>("90")
  const [format, setFormat] = useState<Format>("exam")
  const [examTypeId, setExamTypeId] = useState("")
  const [page, setPage] = useState(1)
  const [allSubjects, setAllSubjects] = useState(false)
  const [howOpen, setHowOpen] = useState(false)

  const params = new URLSearchParams({ period, format, page: String(page), ...(examTypeId ? { examTypeId } : {}) })
  const { data, error, isLoading, isValidating, mutate } = useSWR<StatisticsReport>(
    [`/users/me/statistics?${params}`, locale],
    ([url]: [string, string]) => api<StatisticsReport>(url),
    { keepPreviousData: true },
  )
  const setFilter = (apply: () => void) => {
    apply()
    setPage(1)
  }

  const bcp = locale === "kk" ? "kk-KZ" : "ru-RU"
  const name = (v: StatisticsAttempt["examName"]) => localize(v, locale, tr("Экзамен", "Емтихан"))
  const number = (v: number) => new Intl.NumberFormat(bcp, { maximumFractionDigits: 1 }).format(v)
  const percent = (v: number | null | undefined) => (v == null ? "—" : `${number(v)}%`)
  const date = (v: string) =>
    new Date(v).toLocaleDateString(bcp, { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Almaty" })
  const points = (a: StatisticsAttempt | null) =>
    a && a.rawScore != null && a.maxScore != null && a.maxScore > 0 ? `${a.rawScore} / ${a.maxScore}` : percent(a?.percent)

  const summary = data?.summary
  const subjects = data?.subjects ?? []
  const focus = subjects.find((s) => s.total >= 10 && s.accuracy < 80)
  const openMistakes = (examType: string, subject?: string) =>
    router.push(
      (subject ? `/dashboard/mistakes/subjects/${subject}?examTypeId=${examType}` : "/dashboard/mistakes") as never,
    )
  const chartPoints = (data?.chart ?? [])
    .filter((a) => a.percent != null)
    .map((a, i) => ({ attempt: i + 1, score: a.percent as number }))

  const examOptions = [
    { value: "", label: tr("Все экзамены", "Барлық емтихандар") },
    ...(examTypeId && !data?.exams.some((e) => e.id === examTypeId)
      ? [{ value: examTypeId, label: tr("Выбранный экзамен", "Таңдалған емтихан") }]
      : []),
    ...(data?.exams ?? []).map((e) => ({ value: e.id, label: name(e.name) })),
  ]

  const metrics = summary
    ? [
        {
          label: tr("Последний результат", "Соңғы нәтиже"),
          value: points(summary.latest),
          note: summary.latest ? `${name(summary.latest.examName)} · ${date(summary.latest.date)}` : "—",
        },
        {
          label: tr("Лучший результат", "Үздік нәтиже"),
          value: points(summary.best),
          note: tr("Попытка с наибольшим процентом", "Ең жоғары пайызды әрекет"),
        },
        {
          label: tr("Средний результат", "Орташа нәтиже"),
          value: percent(summary.averagePercent),
          note: tr(`По ${summary.scored} попыткам с оценкой`, `${summary.scored} бағаланған әрекет бойынша`),
        },
        {
          label: tr("Завершено", "Аяқталды"),
          value: String(summary.total),
          note: tr(`По времени завершено: ${summary.timedOutCount}`, `Уақыты аяқталған: ${summary.timedOutCount}`),
        },
      ]
    : []

  return (
    <Screen onRefresh={() => void mutate()} refreshing={false}>
      <PageHeader
        eyebrow={tr("Ваш прогресс", "Сіздің ілгерілеуіңіз")}
        title={tr("Статистика", "Статистика")}
        description={tr("Как меняются результаты и каким предметам стоит уделить внимание.", "Нәтижелер қалай өзгереді және қай пәндерге көңіл бөлу керек.")}
        actions={
          <Button variant="outline" size="sm" onPress={() => router.push("/dashboard/exams" as never)}>
            {tr("Пройти пробный", "Сынақ тапсыру")}
          </Button>
        }
      />

      <Card style={styles.panel}>
        <SelectSheet
          label={tr("Экзамен", "Емтихан")}
          value={examTypeId}
          options={examOptions}
          onChange={(v) => setFilter(() => setExamTypeId(v))}
        />
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Период", "Кезең")}</Text>
          <SegmentedTabs
            value={period}
            onChange={(v) => setFilter(() => setPeriod(v))}
            items={[
              { value: "30", label: tr("30 дней", "30 күн") },
              { value: "90", label: tr("90 дней", "90 күн") },
              { value: "all", label: tr("Всё время", "Барлығы") },
            ]}
          />
        </View>
        <View style={styles.field}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Формат", "Формат")}</Text>
          <SegmentedTabs
            value={format}
            onChange={(v) => setFilter(() => setFormat(v))}
            items={[
              { value: "exam", label: tr("Полные пробники", "Толық сынақтар") },
              { value: "practice", label: tr("Тренировки", "Жаттығулар") },
            ]}
          />
        </View>
      </Card>

      {error ? (
        <Card style={styles.panel}>
          <Text accessibilityRole="alert" style={[styles.h2, { color: colors.foreground }]}>
            {tr("Не удалось обновить статистику", "Статистиканы жаңарту мүмкін болмады")}
          </Text>
          <Text style={[styles.text, { color: colors.mutedForeground }]}>
            {data
              ? tr("Ниже сохранённые данные. Повторите загрузку.", "Төменде сақталған деректер. Қайта жүктеңіз.")
              : tr("Это ошибка загрузки, а не отсутствие результатов.", "Бұл нәтиженің жоқтығы емес, жүктеу қатесі.")}
          </Text>
          <Button variant="outline" size="sm" disabled={isValidating} onPress={() => void mutate()}>
            {tr("Повторить", "Қайталау")}
          </Button>
        </Card>
      ) : null}

      {isLoading && !data ? (
        <View style={styles.gap}>
          <Skeleton height={120} radius={12} />
          <Skeleton height={220} radius={12} />
        </View>
      ) : null}

      {data && summary ? (
        <>
          <Text style={[styles.small, { color: colors.mutedForeground }]}>
            {tr(
              "Только завершённые попытки, включая истёкшее время. Полные пробники и тренировки считаются отдельно.",
              "Уақыты аяқталған сынақтарды қоса алғанда, тек аяқталған әрекеттер. Толық сынақтар мен жаттығулар бөлек есептеледі.",
            )}
          </Text>

          {summary.total === 0 ? (
            <Card style={[styles.panel, styles.center]}>
              <Text style={[styles.h2, { color: colors.foreground }]}>{tr("Здесь пока нет результатов", "Әзірге нәтиже жоқ")}</Text>
              <Text style={[styles.text, styles.centerText, { color: colors.mutedForeground }]}>
                {tr(
                  "Попробуйте другой период или формат. Незавершённые тесты появятся здесь после окончания.",
                  "Басқа кезеңді немесе форматты таңдаңыз. Аяқталмаған сынақтар аяқталғаннан кейін көрсетіледі.",
                )}
              </Text>
              <View style={styles.row}>
                <Button variant="outline" size="sm" onPress={() => setFilter(() => setPeriod("all"))}>
                  {tr("За всё время", "Барлық уақыт")}
                </Button>
                <Button size="sm" onPress={() => router.push("/dashboard/exams" as never)}>
                  {tr("К экзаменам", "Емтихандарға")}
                </Button>
              </View>
            </Card>
          ) : (
            <>
              <Card padded={false}>
                <View style={styles.metricGrid}>
                  {metrics.map((m, i) => (
                    <View
                      key={m.label}
                      style={[
                        styles.metric,
                        { borderColor: colors.border },
                        i % 2 === 0 && { borderRightWidth: StyleSheet.hairlineWidth },
                        i < 2 && { borderBottomWidth: StyleSheet.hairlineWidth },
                      ]}
                    >
                      <Text style={[styles.small, { color: colors.mutedForeground }]}>{m.label}</Text>
                      <Text style={[styles.metricValue, { color: colors.foreground }]}>{m.value}</Text>
                      <Text numberOfLines={2} style={[styles.small, { color: colors.mutedForeground }]}>
                        {m.note}
                      </Text>
                    </View>
                  ))}
                </View>
                <View style={[styles.delta, { borderTopColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Text style={[styles.text, { color: colors.foreground }]}>
                    {summary.deltaPercentPoints == null
                      ? tr("Для сравнения нужны две последовательные попытки одинакового состава.", "Салыстыру үшін құрамы бірдей қатарынан екі әрекет қажет.")
                      : `${summary.deltaPercentPoints > 0 ? "+" : ""}${number(summary.deltaPercentPoints)} ${tr("п.п. к предыдущей попытке", "п.т. алдыңғы әрекетке қатысты")}`}
                  </Text>
                  {summary.latest ? (
                    <Pressable
                      accessibilityRole="link"
                      onPress={() => router.push(`/exam/${summary.latest!.sessionId}/review` as never)}
                      style={styles.linkRow}
                    >
                      <Text style={[styles.link, { color: colors.foreground }]}>{tr("Разобрать последний", "Соңғысын талдау")}</Text>
                      <MaterialCommunityIcons name="arrow-right" size={15} color={colors.foreground} />
                    </Pressable>
                  ) : null}
                </View>
              </Card>

              <Card style={styles.panel}>
                <Text style={[styles.h2, { color: colors.foreground }]}>{tr("Динамика результатов", "Нәтижелер динамикасы")}</Text>
                <Text style={[styles.text, { color: colors.mutedForeground }]}>
                  {tr(
                    `Последние ${data.chart.length} оценённых попыток, от ранних к новым. Шкала — процент от максимального балла.`,
                    `Соңғы ${data.chart.length} бағаланған әрекет, ескіден жаңаға қарай. Шкала — ең жоғары балдың пайызы.`,
                  )}
                </Text>
                {chartPoints.length ? (
                  <EntProgressLineChart
                    data={chartPoints}
                    height={200}
                    strokeColor={colors.foreground}
                    gridColor={colors.border}
                    labelColor={colors.mutedForeground}
                    dotFill={colors.card}
                  />
                ) : (
                  <Text style={[styles.text, { color: colors.mutedForeground }]}>
                    {tr("Для этих попыток оценка ещё недоступна.", "Бұл әрекеттердің бағасы әлі қолжетімсіз.")}
                  </Text>
                )}
                <Text style={[styles.small, { color: colors.mutedForeground }]}>
                  {tr(
                    "Разная сложность и набор предметов влияют на результат. Это не прогноз балла на экзамене.",
                    "Әртүрлі күрделілік пен пәндер құрамы нәтижеге әсер етеді. Бұл емтихан балының болжамы емес.",
                  )}
                </Text>
                {summary.unscored > 0 ? (
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>
                    {tr(`Без оценки: ${summary.unscored}. Они не входят в среднее и график.`, `Бағасыз: ${summary.unscored}. Олар орташа мән мен графикке кірмейді.`)}
                  </Text>
                ) : null}
              </Card>

              <Card style={styles.panel}>
                <Text style={[styles.h2, { color: colors.foreground }]}>{tr("По предметам", "Пәндер бойынша")}</Text>
                <Text style={[styles.text, { color: colors.mutedForeground }]}>
                  {tr(
                    "Доля полностью верных ответов среди проверенных вопросов выбранных попыток. Частичные баллы сюда не входят; это не балл ЕНТ.",
                    "Таңдалған әрекеттердің тексерілген сұрақтарындағы толық дұрыс жауаптар үлесі. Ішінара балдар кірмейді; бұл ҰБТ балы емес.",
                  )}
                </Text>
                {subjects.length === 0 ? (
                  <Text style={[styles.text, { color: colors.mutedForeground }]}>
                    {tr("Нет проверенных ответов для разбивки по предметам.", "Пәндерге бөлу үшін тексерілген жауаптар жоқ.")}
                  </Text>
                ) : (
                  (allSubjects ? subjects : subjects.slice(0, 6)).map((s) => (
                    <View key={s.subjectId} style={[styles.subject, { borderTopColor: colors.border }]}>
                      <View style={styles.between}>
                        <Text style={[styles.value, styles.flex, { color: colors.foreground }]}>{name(s.subjectName)}</Text>
                        <Text style={[styles.value, { color: colors.foreground }]}>{percent(s.accuracy)}</Text>
                      </View>
                      <Text style={[styles.small, { color: colors.mutedForeground }]}>
                        {tr(`${s.correct} из ${s.total} полностью верно`, `${s.total} сұрақтың ${s.correct} толық дұрыс`)}
                        {s.total < 10 ? ` · ${tr("мало данных", "дерек аз")}` : ""}
                      </Text>
                      <View style={[styles.track, { backgroundColor: colors.secondary }]}>
                        <View style={[styles.fill, { width: `${Math.max(0, Math.min(100, s.accuracy))}%`, backgroundColor: colors.foreground }]} />
                      </View>
                      <Pressable accessibilityRole="link" onPress={() => openMistakes(s.examTypeId, s.subjectId)} style={styles.linkRow}>
                        <Text style={[styles.link, { color: colors.foreground }]}>{tr("Мои ошибки", "Менің қателерім")}</Text>
                        <MaterialCommunityIcons name="arrow-right" size={15} color={colors.foreground} />
                      </Pressable>
                    </View>
                  ))
                )}
                {subjects.length > 6 ? (
                  <Button variant="outline" size="sm" onPress={() => setAllSubjects((v) => !v)}>
                    {allSubjects ? tr("Свернуть", "Жасыру") : tr(`Все предметы (${subjects.length})`, `Барлық пәндер (${subjects.length})`)}
                  </Button>
                ) : null}
              </Card>

              <Card style={styles.panel}>
                <Text style={[styles.h2, { color: colors.foreground }]}>
                  {focus ? tr(`Фокус: ${name(focus.subjectName)}`, `Назарда: ${name(focus.subjectName)}`) : tr("Следующий шаг", "Келесі қадам")}
                </Text>
                <Text style={[styles.text, { color: colors.mutedForeground }]}>
                  {focus
                    ? tr(
                        "Среди предметов с 10 и более проверенными вопросами здесь самая низкая точность. Проверьте, какие ошибки ещё остались.",
                        "10 және одан көп тексерілген сұрағы бар пәндердің ішінде дәлдік ең төмен. Қандай қателер қалғанын тексеріңіз.",
                      )
                    : tr(
                        "Посмотрите актуальные ошибки или пройдите следующий пробный. Исправление вопроса не меняет прошлые результаты.",
                        "Ағымдағы қателерді қараңыз немесе келесі сынақты тапсырыңыз. Сұрақты түзету бұрынғы нәтижелерді өзгертпейді.",
                      )}
                </Text>
                <Button variant="outline" size="sm" onPress={() => (focus ? openMistakes(focus.examTypeId, focus.subjectId) : openMistakes(""))}>
                  {tr("К работе над ошибками", "Қателермен жұмысқа")}
                </Button>
              </Card>

              <Card padded={false}>
                <Text style={[styles.h2, styles.historyTitle, { color: colors.foreground }]}>{tr("История результатов", "Нәтижелер тарихы")}</Text>
                {data.history.map((a) => (
                  <Pressable
                    key={a.sessionId}
                    accessibilityRole="button"
                    onPress={() => router.push(`/exam/${a.sessionId}/review` as never)}
                    style={[styles.attempt, { borderTopColor: colors.border }]}
                  >
                    <View style={styles.flex}>
                      <Text style={[styles.value, { color: colors.foreground }]}>{name(a.examName)}</Text>
                      <Text style={[styles.small, { color: colors.mutedForeground }]}>
                        {date(a.date)} · {a.language === "kk" ? "ҚАЗ" : "РУС"}
                        {a.status === "timed_out" ? ` · ${tr("время истекло", "уақыт аяқталды")}` : ""}
                      </Text>
                    </View>
                    <View style={styles.right}>
                      <Text style={[styles.value, { color: colors.foreground }]}>{points(a)}</Text>
                      <Text style={[styles.small, { color: colors.mutedForeground }]}>{percent(a.percent)}</Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                ))}
                {data.pageCount > 1 ? (
                  <View style={[styles.pager, { borderTopColor: colors.border }]}>
                    <Text style={[styles.small, { color: colors.mutedForeground }]}>
                      {tr(`Страница ${data.page} из ${data.pageCount}`, `${data.pageCount} беттің ${data.page}-беті`)}
                    </Text>
                    <View style={styles.row}>
                      <Button variant="outline" size="sm" disabled={data.page <= 1 || isValidating} onPress={() => setPage(data.page - 1)}>
                        {tr("Назад", "Артқа")}
                      </Button>
                      <Button variant="outline" size="sm" disabled={data.page >= data.pageCount || isValidating} onPress={() => setPage(data.page + 1)}>
                        {tr("Вперёд", "Алға")}
                      </Button>
                    </View>
                  </View>
                ) : null}
              </Card>

              <Pressable accessibilityRole="button" onPress={() => setHowOpen((v) => !v)} style={styles.linkRow}>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Как считаются показатели", "Көрсеткіштер қалай есептеледі")}</Text>
                <MaterialCommunityIcons name={howOpen ? "chevron-up" : "chevron-down"} size={16} color={colors.mutedForeground} />
              </Pressable>
              {howOpen ? (
                <Text style={[styles.small, { color: colors.mutedForeground }]}>
                  {tr(
                    "Среднее — среднее арифметическое процентов отдельных попыток. Динамика — разница в процентных пунктах между двумя последними попытками одинакового состава внутри фильтра. Повторный вопрос учитывается каждый раз. Даты — по времени Алматы; период отсчитывается от текущего момента.",
                    "Орташа мән — жеке әрекеттер пайыздарының арифметикалық ортасы. Динамика — сүзгі ішіндегі құрамы бірдей соңғы екі әрекеттің пайыздық тармақтардағы айырмасы. Қайталанған сұрақ әр жолы есептеледі. Күндер Алматы уақытымен; кезең ағымдағы сәттен есептеледі.",
                  )}
                </Text>
              ) : null}
            </>
          )}
        </>
      ) : null}
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0 },
  gap: { gap: 12 },
  panel: { padding: 16, gap: 12 },
  field: { gap: 6 },
  label: { fontSize: 13, fontFamily: fonts.sansSemi },
  h2: { fontSize: 17, fontFamily: fonts.sansSemi },
  text: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 18 },
  value: { fontSize: 14, fontFamily: fonts.sansSemi },
  center: { alignItems: "center" },
  centerText: { textAlign: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" },
  between: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  metricGrid: { flexDirection: "row", flexWrap: "wrap" },
  metric: { width: "50%", padding: 14, gap: 4 },
  metricValue: { fontSize: 24, letterSpacing: -0.4, fontFamily: fonts.sansSemi },
  delta: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 6 },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40, alignSelf: "flex-start" },
  link: { fontSize: 13, fontFamily: fonts.sansSemi },
  subject: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 6 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  fill: { height: 6, borderRadius: 3 },
  historyTitle: { padding: 16, paddingBottom: 10 },
  attempt: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 68, paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: StyleSheet.hairlineWidth },
  right: { alignItems: "flex-end" },
  pager: { borderTopWidth: StyleSheet.hairlineWidth, padding: 14, gap: 10 },
})
