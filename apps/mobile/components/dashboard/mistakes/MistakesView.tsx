import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { PracticeSheet, type PracticeRequest } from "@/components/dashboard/mistakes/PracticeSheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { PageHeader } from "@/components/ui/page-header"
import { Screen } from "@/components/ui/screen"
import { SelectSheet } from "@/components/ui/select-sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { useAuth } from "@/lib/api/auth-context"
import { localize } from "@/lib/api/i18n"
import type { MistakesSummary } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { accentPalette } from "@/lib/theme/accents"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

const subjectHref = (s: MistakesSummary["openBySubject"][number]) =>
  `/dashboard/mistakes/subjects/${s.subjectId}?examTypeId=${encodeURIComponent(s.examTypeId)}`

/** One recommended subject to start with, then the full list of subjects with open mistakes. */
export function MistakesView() {
  const { colors, resolved } = useAppTheme()
  const tr = useTr()
  const { locale } = useUiLocale()
  const { user, refresh } = useAuth()
  const { data, error, isLoading, isValidating, mutate } = useSWR<MistakesSummary>("/tests/mistakes/summary")
  const [examFilter, setExamFilter] = useState("all")
  const [practice, setPractice] = useState<PracticeRequest | null>(null)
  const paid = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const exams = data?.openByExam ?? []
  const subjects = [...(data?.openBySubject ?? [])].sort((a, b) => b.count - a.count)
  const selectedExam = exams.some((e) => e.examTypeId === examFilter) ? examFilter : "all"
  const visible = subjects.filter((s) => selectedExam === "all" || s.examTypeId === selectedExam)
  const recommended = subjects[0]
  const total = data?.openTotal ?? 0
  const recoveries = data?.recentRecoveries?.slice(0, 3) ?? []
  const green = accentPalette(resolved).emerald

  useEffect(() => {
    void refresh()
    // Access can change while the app is open (a purchase, a granted plan).
  }, [refresh])

  return (
    <Screen onRefresh={() => void mutate()} refreshing={false}>
      <PageHeader
        eyebrow={tr("Работа над ошибками", "Қателермен жұмыс")}
        title={tr("Мои ошибки", "Менің қателерім")}
        description={tr("Разберите сложные вопросы и закрепите то, что пока не получилось.", "Қиын сұрақтарды талдап, әлі меңгермеген тақырыптарды бекітіңіз.")}
        actions={
          <Pressable accessibilityRole="link" onPress={() => router.push("/dashboard/history" as never)} style={styles.linkRow}>
            <Text style={[styles.link, { color: colors.foreground }]}>{tr("История пробных", "Сынақтар тарихы")}</Text>
            <MaterialCommunityIcons name="arrow-right" size={15} color={colors.foreground} />
          </Pressable>
        }
      />

      {error ? (
        <Card style={styles.alert}>
          <Text accessibilityRole="alert" style={[styles.text, { color: colors.foreground }]}>
            {tr("Не удалось обновить ошибки. Попробуйте загрузить их ещё раз.", "Қателерді жаңарту мүмкін болмады. Қайта жүктеп көріңіз.")}
          </Text>
          <Button variant="outline" size="sm" disabled={isValidating} onPress={() => void mutate().catch(() => {})}>
            {tr("Повторить загрузку", "Қайта жүктеу")}
          </Button>
        </Card>
      ) : null}

      {isLoading ? (
        <Card style={styles.panel}>
          <Skeleton height={26} width="66%" />
          <Skeleton height={44} />
          <Skeleton height={44} width={170} radius={10} />
          <Skeleton height={120} radius={10} />
        </Card>
      ) : data && total === 0 ? (
        <Card style={styles.panel}>
          <View style={[styles.round, { backgroundColor: colors.secondary }]}>
            <MaterialCommunityIcons name="check-all" size={22} color={colors.mutedForeground} />
          </View>
          <Text style={[styles.h2, { color: colors.foreground }]}>{tr("Сейчас нет открытых ошибок", "Қазір ашық қателер жоқ")}</Text>
          <Text style={[styles.text, { color: colors.mutedForeground }]}>
            {tr(
              "После завершённого пробного здесь появятся вопросы, на которые вы ответили неверно. Если ошибки уже исправлены — можно проверить себя снова.",
              "Аяқталған сынақтан кейін қате жауап берген сұрақтар осында пайда болады. Қателер түзетілсе, өзіңізді қайта тексере аласыз.",
            )}
          </Text>
          <Button onPress={() => router.push("/dashboard/exams" as never)}>{tr("Выбрать пробный", "Сынақты таңдау")}</Button>
        </Card>
      ) : data ? (
        <>
          <Card padded={false}>
            <View style={styles.panel}>
              <View style={styles.eyebrowRow}>
                <MaterialCommunityIcons name="target" size={16} color={colors.mutedForeground} />
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("С чего начать", "Неден бастау керек")}</Text>
              </View>
              <Text style={[styles.h2, { color: colors.foreground }]}>
                {recommended
                  ? localize(recommended.subjectName, locale, tr("Разберите один предмет", "Бір пәнді талдаңыз"))
                  : tr("Вернитесь к сложным вопросам", "Қиын сұрақтарға оралыңыз")}
              </Text>
              <Text style={[styles.text, { color: colors.mutedForeground }]}>
                {recommended
                  ? tr(
                      `Здесь больше всего открытых ошибок: ${recommended.count}. Начните с разбора тем, затем проверьте себя в короткой тренировке.`,
                      `Ашық қателер ең көп осы пәнде: ${recommended.count}. Тақырыптарды талдап, қысқа жаттығуда өзіңізді тексеріңіз.`,
                    )
                  : tr("Выберите экзамен и повторите вопросы из прошлых попыток.", "Емтиханды таңдап, өткен әрекеттердегі сұрақтарды қайталаңыз.")}
              </Text>
              {recommended ? <Text style={[styles.small, { color: colors.mutedForeground }]}>{localize(recommended.examName, locale)}</Text> : null}
              <View style={styles.row}>
                {recommended ? (
                  <Button onPress={() => router.push(subjectHref(recommended) as never)} icon={(c) => <MaterialCommunityIcons name="arrow-right" size={17} color={c} />}>
                    {tr("Разобрать предмет", "Пәнді талдау")}
                  </Button>
                ) : null}
                {paid && exams[0] ? (
                  <Button
                    variant="outline"
                    disabled={Boolean(error)}
                    onPress={() => setPractice({ examTypeId: recommended?.examTypeId ?? exams[0].examTypeId, subjectId: recommended?.subjectId })}
                    icon={(c) => <MaterialCommunityIcons name="play" size={16} color={c} />}
                  >
                    {tr("Настроить тренировку", "Жаттығуды баптау")}
                  </Button>
                ) : null}
              </View>
            </View>
            <View style={[styles.stats, { borderTopColor: colors.border, backgroundColor: colors.secondary }]}>
              <View style={styles.stat}>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Ошибок в работе", "Түзетілмеген қателер")}</Text>
                <Text style={[styles.big, { color: colors.foreground }]}>{total}</Text>
              </View>
              <View style={styles.stat}>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Предметов с ошибками", "Қате бар пәндер")}</Text>
                <Text style={[styles.big, { color: colors.foreground }]}>{subjects.length}</Text>
              </View>
            </View>
          </Card>

          {!paid ? (
            <Card style={styles.premium}>
              <MaterialCommunityIcons name="crown-outline" size={18} color={colors.mutedForeground} style={styles.crown} />
              <View style={styles.flex}>
                <Text style={[styles.value, { color: colors.foreground }]}>{tr("Тренировки и AI-разбор — с Premium", "Жаттығулар мен AI талдауы — Premium арқылы")}</Text>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>
                  {tr(
                    "Карта ошибок доступна уже сейчас. Premium добавляет разбор причин, уроки и практику по вашим вопросам.",
                    "Қателер картасы қазір қолжетімді. Premium қате себептерін талдауды, сабақтар мен сұрақтарыңыз бойынша жаттығуды қосады.",
                  )}
                </Text>
                <Button variant="outline" size="sm" onPress={() => router.push("/dashboard/billing?reason=mistakes_practice" as never)}>
                  {tr("Посмотреть тарифы", "Тарифтерді көру")}
                </Button>
              </View>
            </Card>
          ) : null}

          <Card padded={false}>
            <View style={styles.listHead}>
              <Text style={[styles.h3, { color: colors.foreground }]}>{tr("Ошибки по предметам", "Пәндер бойынша қателер")}</Text>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Сначала — предметы с наибольшим количеством ошибок", "Алдымен — қатесі ең көп пәндер")}</Text>
              {exams.length > 1 ? (
                <SelectSheet
                  label={tr("Экзамен", "Емтихан")}
                  value={selectedExam}
                  options={[{ value: "all", label: tr("Все экзамены", "Барлық емтихандар") }, ...exams.map((e) => ({ value: e.examTypeId, label: localize(e.examName, locale, tr("Экзамен", "Емтихан")) }))]}
                  onChange={setExamFilter}
                />
              ) : null}
            </View>
            {visible.map((s) => {
              const name = localize(s.subjectName, locale, tr("Предмет", "Пән"))
              return (
                <View key={`${s.examTypeId}:${s.subjectId}`} style={[styles.subject, { borderTopColor: colors.border }]}>
                  <Pressable accessibilityRole="button" onPress={() => router.push(subjectHref(s) as never)} style={styles.subjectMain}>
                    <MaterialCommunityIcons name="book-open-page-variant-outline" size={17} color={colors.mutedForeground} />
                    <View style={styles.flex}>
                      <Text style={[styles.value, { color: colors.foreground }]}>{name}</Text>
                      <Text style={[styles.small, { color: colors.mutedForeground }]}>
                        {localize(s.examName, locale)} · {tr("Ошибок", "Қателер")}: <Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{s.count}</Text>
                      </Text>
                    </View>
                    <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground} />
                  </Pressable>
                  {paid ? (
                    <Button variant="outline" size="sm" disabled={Boolean(error)} onPress={() => setPractice({ examTypeId: s.examTypeId, subjectId: s.subjectId })}>
                      {tr("Тренировать", "Жаттығу")}
                    </Button>
                  ) : null}
                </View>
              )
            })}
            <Text style={[styles.small, styles.footnote, { color: colors.mutedForeground, borderTopColor: colors.border }]}>
              {tr(
                "Здесь вопросы, на которые вы в последний раз ответили неверно. После правильного ответа в завершённом тесте ошибка исчезнет из списка.",
                "Мұнда соңғы рет қате жауап берген сұрақтар көрсетілген. Аяқталған тестте дұрыс жауап бергеннен кейін қате тізімнен жойылады.",
              )}
            </Text>
          </Card>
        </>
      ) : null}

      {data && recoveries.length > 0 ? (
        <Card style={styles.panel}>
          <View style={styles.eyebrowRow}>
            <MaterialCommunityIcons name="check-all" size={17} color={green.fg} />
            <Text style={[styles.h3, { color: colors.foreground }]}>{tr("Недавно исправлены", "Жақында түзетілген")}</Text>
          </View>
          <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("В этих вопросах неверный ответ сменился правильным.", "Бұл сұрақтарда қате жауап дұрыс жауапқа ауысты.")}</Text>
          {recoveries.map((item, index) => (
            <Pressable
              key={`${item.sessionId}:${item.questionId}:${index}`}
              accessibilityRole="button"
              onPress={() => router.push(`/exam/${item.sessionId}/review` as never)}
              style={[styles.recovery, { borderTopColor: colors.border }]}
            >
              <View style={styles.flex}>
                <Text style={[styles.value, { color: colors.foreground }]}>{localize(item.subjectName, locale, tr("Предмет", "Пән"))}</Text>
                <Text style={[styles.small, { color: colors.mutedForeground }]}>
                  {localize(item.examName, locale)} · {new Date(item.recoveredAt).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU", { day: "2-digit", month: "2-digit", year: "numeric" })}
                </Text>
              </View>
              <MaterialCommunityIcons name="chevron-right" size={18} color={colors.mutedForeground} />
            </Pressable>
          ))}
        </Card>
      ) : null}

      <PracticeSheet summary={data} scope={practice} onClose={() => setPractice(null)} />
    </Screen>
  )
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 6 },
  panel: { padding: 18, gap: 12 },
  alert: { padding: 14, gap: 10, alignItems: "flex-start" },
  eyebrowRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  h2: { fontSize: 21, lineHeight: 27, letterSpacing: -0.3, fontFamily: fonts.sansSemi },
  h3: { fontSize: 16, fontFamily: fonts.sansSemi },
  text: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 18 },
  value: { fontSize: 14, fontFamily: fonts.sansSemi },
  big: { fontSize: 30, letterSpacing: -0.5, fontFamily: fonts.sansSemi },
  link: { fontSize: 13, fontFamily: fonts.sansSemi },
  linkRow: { flexDirection: "row", alignItems: "center", gap: 4, minHeight: 40 },
  round: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  stats: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, padding: 18, gap: 16 },
  stat: { flex: 1, gap: 4 },
  premium: { flexDirection: "row", gap: 12, padding: 16 },
  crown: { marginTop: 2 },
  listHead: { padding: 16, gap: 6 },
  subject: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 10, gap: 8, alignItems: "flex-start" },
  subjectMain: { flexDirection: "row", alignItems: "center", gap: 12, minHeight: 52, alignSelf: "stretch" },
  footnote: { borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 16, paddingVertical: 12 },
  recovery: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 56, borderTopWidth: StyleSheet.hairlineWidth },
})
