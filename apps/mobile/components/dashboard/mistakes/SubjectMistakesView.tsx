import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useState } from "react"
import { Alert, Pressable, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { PracticeSheet, type FixedPracticeScope } from "@/components/dashboard/mistakes/PracticeSheet"
import { StudyThemes } from "@/components/dashboard/mistakes/StudyThemes"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { LoadState } from "@/components/ui/load-state"
import { Screen } from "@/components/ui/screen"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/api/auth-context"
import { api, ApiError } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import type { AiStoredAnalysisResponse, AiWeakZoneAnalysis, MistakesSubjectDetail } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

/** One subject: what to study next, topics from real questions, and optional AI help. */
export function SubjectMistakesView({ subjectId, examTypeId }: { subjectId: string; examTypeId?: string }) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { locale } = useUiLocale()
  const { user } = useAuth()
  const paid = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const url = `/tests/mistakes/subjects/${subjectId}${examTypeId ? `?examTypeId=${encodeURIComponent(examTypeId)}` : ""}`
  const { data, error, isLoading, isValidating, mutate } = useSWR<MistakesSubjectDetail>([url, locale], ([path]: [string, string]) => api<MistakesSubjectDetail>(path))
  const [practice, setPractice] = useState<FixedPracticeScope | null>(null)
  const [coachOpen, setCoachOpen] = useState(false)
  const name = localize(data?.subjectName, locale, tr("Предмет", "Пән"))
  const topics = [...(data?.topics ?? [])].sort((a, b) => b.activeOpenCount - a.activeOpenCount || b.openCount - a.openCount)
  const recommended = topics.find((t) => t.activeOpenCount > 0)
  const scope = (topic?: (typeof topics)[number]): FixedPracticeScope => ({
    examTypeId: data!.examTypeId,
    subjectId,
    topicId: topic?.topicId,
    title: topic ? localize(topic.topicName, locale) : name,
    available: topic?.activeOpenCount ?? data!.activeOpenTotal,
  })

  return (
    <Screen onRefresh={() => void mutate()} refreshing={false}>
      <Pressable accessibilityRole="link" onPress={() => (router.canGoBack() ? router.back() : router.replace("/dashboard/mistakes" as never))} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={18} color={colors.mutedForeground} />
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Все мои ошибки", "Барлық қателерім")}</Text>
      </Pressable>
      <View>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{localize(data?.examName, locale)}</Text>
        <Text accessibilityRole="header" style={[styles.h1, { color: colors.foreground }]}>
          {name}
        </Text>
        <Text style={[styles.text, { color: colors.mutedForeground }]}>
          {tr(
            "Выберите одну тему, разберите её и проверьте себя. Правильный ответ в завершённой тренировке закроет ошибку.",
            "Бір тақырыпты таңдап, талдаңыз және өзіңізді тексеріңіз. Аяқталған жаттығудағы дұрыс жауап қатені түзетеді.",
          )}
        </Text>
      </View>

      {error ? <LoadState error={new Error(tr("Не удалось загрузить предмет. Проверьте ссылку или повторите попытку.", "Пәнді жүктеу мүмкін болмады. Сілтемені тексеріңіз немесе қайталаңыз."))} retry={() => void mutate().catch(() => {})} /> : null}
      {isLoading ? <Skeleton height={190} radius={12} /> : null}

      {data ? (
        <>
          <Card padded={false}>
            <View style={[styles.metrics, { borderBottomColor: colors.border, backgroundColor: colors.secondary }]}>
              <View style={[styles.metric, { borderRightColor: colors.border }]}>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Ошибок в работе", "Түзетілмеген қателер")}</Text>
                <Text style={[styles.big, { color: colors.foreground }]}>{data.openTotal}</Text>
              </View>
              <View style={styles.metric}>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Доступно для практики", "Жаттығуға қолжетімді")}</Text>
                <Text style={[styles.big, { color: colors.foreground }]}>{data.activeOpenTotal}</Text>
              </View>
            </View>
            <View style={styles.next}>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Следующий шаг", "Келесі қадам")}</Text>
              <Text style={[styles.h2, { color: colors.foreground }]}>
                {recommended
                  ? localize(recommended.topicName, locale)
                  : data.openTotal === 0
                    ? tr("Ошибки по предмету закрыты", "Пән бойынша қателер түзетілген")
                    : tr("Вопросы временно недоступны", "Сұрақтар уақытша қолжетімсіз")}
              </Text>
              <Text style={[styles.text, { color: colors.mutedForeground }]}>
                {recommended
                  ? tr("Начните с темы, где больше доступных ошибок. Короткая практика поможет проверить, что вы поняли решение.", "Қолжетімді қатесі көп тақырыптан бастаңыз. Қысқа жаттығу шешімді түсінгеніңізді тексеруге көмектеседі.")
                  : data.openTotal === 0
                    ? tr("Можно перейти к новому пробному или повторить сохранённые уроки.", "Жаңа сынаққа өтуге немесе сақталған сабақтарды қайталауға болады.")
                    : tr("Ошибки сохранены, но вопросы исключены из активного банка. Они не попадут в тренировку.", "Қателер сақталған, бірақ сұрақтар белсенді қордан алынған. Олар жаттығуға кірмейді.")}
              </Text>
              <View style={styles.row}>
                {paid && recommended ? (
                  <Button disabled={Boolean(error)} onPress={() => setPractice(scope(recommended))} icon={(c) => <MaterialCommunityIcons name="play" size={16} color={c} />}>
                    {tr("Практика по этой теме", "Осы тақырып бойынша жаттығу")}
                  </Button>
                ) : null}
                {paid && data.activeOpenTotal > 0 ? (
                  <Button variant="outline" disabled={Boolean(error)} onPress={() => setPractice(scope())}>
                    {tr("Весь предмет", "Бүкіл пән")}
                  </Button>
                ) : null}
                {data.activeOpenTotal === 0 ? (
                  <Button variant="outline" onPress={() => router.push("/dashboard/exams" as never)}>
                    {tr("Выбрать пробный", "Сынақты таңдау")}
                  </Button>
                ) : null}
              </View>
              {data.openTotal > data.activeOpenTotal ? (
                <Text style={[styles.small, { color: colors.mutedForeground }]}>
                  {tr("Архивных вопросов", "Мұрағаттағы сұрақтар")}: {data.openTotal - data.activeOpenTotal}. {tr("Они учитываются в истории, но не в практике.", "Олар тарихта есепке алынады, бірақ жаттығуда емес.")}
                </Text>
              ) : null}
            </View>
          </Card>

          {!paid && data.openTotal > 0 ? (
            <Card style={styles.panel}>
              <Text style={[styles.h3, { color: colors.foreground }]}>{tr("Практика и AI-уроки с Premium", "Premium арқылы жаттығу және AI сабақтары")}</Text>
              <Text style={[styles.text, { color: colors.mutedForeground }]}>
                {tr(
                  "Список тем виден бесплатно. Платный доступ добавляет тренировку по вашим вопросам и объяснения.",
                  "Тақырыптар тізімі тегін көрінеді. Ақылы қолжетімділік сұрақтарыңыз бойынша жаттығу мен түсіндірмелерді қосады.",
                )}
              </Text>
              <Button variant="outline" size="sm" onPress={() => router.push("/dashboard/billing?reason=mistakes_subject_detail" as never)}>
                {tr("Посмотреть тарифы", "Тарифтерді көру")}
              </Button>
            </Card>
          ) : null}

          <Card style={styles.panel}>
            <Text style={[styles.h3, { color: colors.foreground }]}>{tr("Темы программы", "Бағдарлама тақырыптары")}</Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {tr("По реальным вопросам из ваших завершённых тестов. Не зависит от AI.", "Аяқталған тесттеріңіздегі нақты сұрақтар бойынша. AI-ға тәуелді емес.")}
            </Text>
            {topics.map((topic) => (
              <View key={topic.topicId} style={[styles.topic, { borderTopColor: colors.border }]}>
                <View style={styles.flex}>
                  <Text style={[styles.value, { color: colors.foreground }]}>{localize(topic.topicName, locale)}</Text>
                  <Text style={[styles.small, { color: colors.mutedForeground }]}>
                    {tr("Ошибок", "Қателер")}: {topic.openCount} · {tr("Для практики", "Жаттығуға")}: {topic.activeOpenCount}
                  </Text>
                </View>
                {paid ? (
                  <Button variant="outline" size="sm" disabled={Boolean(error) || topic.activeOpenCount === 0} onPress={() => setPractice(scope(topic))}>
                    {tr("Тренировать", "Жаттығу")}
                  </Button>
                ) : null}
              </View>
            ))}
            {topics.length === 0 ? <Text style={[styles.text, { color: colors.mutedForeground }]}>{tr("Нет тем с открытыми ошибками.", "Ашық қатесі бар тақырыптар жоқ.")}</Text> : null}
          </Card>

          {paid ? <StudyThemes key={locale} subjectId={subjectId} examTypeId={data.examTypeId} onPractice={setPractice} /> : null}

          {paid && data.openTotal > 0 ? (
            <View style={styles.gap}>
              <Button variant="outline" onPress={() => setCoachOpen((v) => !v)}>
                {coachOpen ? tr("Скрыть подробный AI-разбор", "Толық AI талдауын жасыру") : tr("Причины ошибок и персональный разбор", "Қате себептері және жеке талдау")}
              </Button>
              {coachOpen ? <AiAnalysis key={locale} examTypeId={data.examTypeId} subjectId={subjectId} onTrain={() => setPractice(scope())} /> : null}
            </View>
          ) : null}
        </>
      ) : null}

      <PracticeSheet scope={practice} onClose={() => setPractice(null)} />
    </Screen>
  )
}

/** Cached weak-zone analysis; a fresh one is generated only on request. */
function AiAnalysis({ examTypeId, subjectId, onTrain }: { examTypeId: string; subjectId: string; onTrain: () => void }) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { locale } = useUiLocale()
  const key = `/ai/mistakes/analysis?examTypeId=${examTypeId}&subjectId=${subjectId}`
  const { data, isLoading, mutate } = useSWR<AiStoredAnalysisResponse>([key, locale], ([path]: [string, string]) => api<AiStoredAnalysisResponse>(path))
  const [busy, setBusy] = useState(false)
  const analysis = data?.analysis ?? null

  const run = async () => {
    setBusy(true)
    try {
      const result = await api<AiWeakZoneAnalysis>("/ai/mistakes/analyze", {
        method: "POST",
        body: { language: locale === "kk" ? "kk" : "ru", examTypeId, subjectId, force: Boolean(analysis) },
      })
      await mutate({ enabled: true, analysis: result }, { revalidate: false })
    } catch (e) {
      const code = e instanceof ApiError ? e.message : "NETWORK"
      Alert.alert(
        tr("Ошибка", "Қате"),
        code === "AI_DAILY_LIMIT"
          ? tr("Дневной лимит AI исчерпан.", "Бүгінгі AI лимиті аяқталды.")
          : code === "AI_BUSY"
            ? tr("AI перегружен, попробуйте позже.", "AI бос емес, кейінірек қайталаңыз.")
            : tr("Не удалось выполнить AI-разбор.", "AI-талдау жасау мүмкін болмады."),
      )
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card style={styles.panel}>
      <View style={styles.aiHead}>
        <MaterialCommunityIcons name="brain" size={20} color={colors.accent} />
        <Text style={[styles.h3, { color: colors.foreground }]}>{tr("AI-разбор", "AI-талдау")}</Text>
      </View>
      {isLoading ? <Skeleton height={80} /> : null}
      {analysis ? (
        <View style={styles.gap}>
          <Text style={[styles.text, { color: colors.foreground }]}>{analysis.overview}</Text>
          {analysis.weakZones.map((zone, i) => (
            <View key={`${zone.title}:${i}`} style={[styles.zone, { borderColor: colors.border }]}>
              <Text style={[styles.value, { color: colors.foreground }]}>{zone.title}</Text>
              <Text style={[styles.text, { color: colors.mutedForeground }]}>{zone.rootCause}</Text>
              {zone.recommendations.map((r, j) => (
                <Text key={j} style={[styles.text, { color: colors.foreground }]}>
                  • {r}
                </Text>
              ))}
            </View>
          ))}
          <Text style={[styles.text, { color: colors.mutedForeground }]}>{analysis.motivation}</Text>
          {analysis.stale ? (
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {tr("Набор ошибок изменился — обновите разбор.", "Қателер жиынтығы өзгерді — талдауды жаңартыңыз.")}
            </Text>
          ) : null}
        </View>
      ) : !isLoading ? (
        <Text style={[styles.text, { color: colors.mutedForeground }]}>
          {tr("AI определит слабые темы и подготовит конкретный план.", "AI әлсіз тақырыптарды және нақты ұсыныстарды дайындайды.")}
        </Text>
      ) : null}
      <View style={styles.row}>
        <Button variant="outline" size="sm" disabled={busy} onPress={() => void run()}>
          {busy ? "…" : analysis ? tr("Обновить разбор", "Талдауды жаңарту") : tr("Сделать AI-разбор", "AI-талдау жасау")}
        </Button>
        {analysis ? (
          <Button size="sm" onPress={onTrain}>
            {tr("Тренировать предмет", "Пәнді жаттықтыру")}
          </Button>
        ) : null}
      </View>
    </Card>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 4 },
  back: { flexDirection: "row", alignItems: "center", gap: 8, minHeight: 40, alignSelf: "flex-start" },
  h1: { fontSize: 28, lineHeight: 34, letterSpacing: -0.5, fontFamily: fonts.sansSemi, marginTop: 4, marginBottom: 8 },
  h2: { fontSize: 20, lineHeight: 26, fontFamily: fonts.sansSemi },
  h3: { fontSize: 16, fontFamily: fonts.sansSemi },
  text: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 18 },
  value: { fontSize: 14, fontFamily: fonts.sansSemi },
  big: { fontSize: 26, letterSpacing: -0.4, fontFamily: fonts.sansSemi },
  metrics: { flexDirection: "row", borderBottomWidth: StyleSheet.hairlineWidth },
  metric: { flex: 1, padding: 16, gap: 4, borderRightWidth: StyleSheet.hairlineWidth, borderRightColor: "transparent" },
  next: { padding: 18, gap: 10 },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  panel: { padding: 16, gap: 10 },
  gap: { gap: 10 },
  topic: { flexDirection: "row", alignItems: "center", gap: 10, paddingTop: 10, borderTopWidth: StyleSheet.hairlineWidth },
  aiHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  zone: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 6 },
})
