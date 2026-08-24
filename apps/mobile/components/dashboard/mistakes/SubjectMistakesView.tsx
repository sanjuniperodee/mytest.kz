import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import { StepSlider } from "@/components/ui/step-slider"
import { Card } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { MistakesSubjectDetail, StudyMap, TestSession } from "@/lib/api/types"
import { useUiLocale } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

type WeakZoneAnalysis = {
  overview: string
  motivation: string
  weakZones: { title: string; rootCause: string; recommendations: string[]; pointsAtStake: number }[]
}

export function SubjectMistakesView({ subjectId }: { subjectId: string }) {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { user, refresh } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || ui) as Locale
  const language: "ru" | "kk" = locale === "kk" ? "kk" : "ru"
  const hasPremium = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const [limit, setLimit] = useState(15)
  const [duration, setDuration] = useState(25)
  const [starting, setStarting] = useState<string | null>(null)
  const [analysis, setAnalysis] = useState<WeakZoneAnalysis | null>(null)
  const [analyzing, setAnalyzing] = useState(false)
  const detailKey = subjectId ? `/tests/mistakes/subjects/${encodeURIComponent(subjectId)}` : null
  const { data: detail, isLoading, error } = useSWR<MistakesSubjectDetail>(detailKey)
  const studyMapKey = hasPremium && detail
    ? `/ai/mistakes/subjects/${encodeURIComponent(detail.subjectId)}/study-map?examTypeId=${encodeURIComponent(detail.examTypeId)}`
    : null
  const { data: studyMap, isLoading: mapLoading, error: mapError, mutate: refreshMap } = useSWR<StudyMap>(studyMapKey, {
    refreshInterval: (latest) => latest?.pending ? 5000 : 0,
  })

  useEffect(() => { void refresh() }, [refresh])
  useEffect(() => {
    if (!hasPremium || !detail) return
    void api<{ analysis: WeakZoneAnalysis | null }>("/ai/mistakes/analysis", {
      query: { examTypeId: detail.examTypeId, subjectId: detail.subjectId },
    }).then((result) => setAnalysis(result.analysis)).catch(() => undefined)
  }, [detail, hasPremium])

  const subjectName = localize(detail?.subjectName, locale, ui === "kk" ? "Пән" : "Предмет")
  const examName = localize(detail?.examName, locale, ui === "kk" ? "Емтихан" : "Экзамен")
  const maxThemeCount = useMemo(() => Math.max(1, ...(studyMap?.themes ?? []).map((item) => item.openCount)), [studyMap])

  const launch = async (themeId?: string) => {
    if (!detail) return
    if (!hasPremium) {
      router.push("/dashboard/billing?reason=mistakes_subject_detail" as never)
      return
    }
    const key = themeId ?? "subject"
    setStarting(key)
    try {
      const session = await api<TestSession>("/tests/mistakes/practice", {
        method: "POST",
        body: { language, examTypeId: detail.examTypeId, subjectId: detail.subjectId, themeId, limit, durationMins: duration },
      })
      router.push(`/exam/${session.id}` as never)
    } catch (launchError) {
      const code = launchError instanceof ApiError ? launchError.message : "NETWORK"
      Alert.alert(ui === "kk" ? "Қате" : "Ошибка", practiceMessage(code, ui))
    } finally {
      setStarting(null)
    }
  }

  const runAnalysis = async () => {
    if (!detail) return
    setAnalyzing(true)
    try {
      const result = await api<WeakZoneAnalysis>("/ai/mistakes/analyze", {
        method: "POST",
        body: { language, examTypeId: detail.examTypeId, subjectId: detail.subjectId, force: Boolean(analysis) },
      })
      setAnalysis(result)
      await refreshMap()
    } catch (analysisError) {
      const code = analysisError instanceof ApiError ? analysisError.message : "NETWORK"
      Alert.alert(ui === "kk" ? "Қате" : "Ошибка", aiMessage(code, ui))
    } finally {
      setAnalyzing(false)
    }
  }

  if (isLoading) return <View style={styles.center}><ActivityIndicator color={colors.foreground} /></View>

  if (error || !detail) return (
    <View style={[styles.center, { backgroundColor: colors.secondary }]}>
      <Text style={{ color: colors.mutedForeground }}>{ui === "kk" ? "Пәнді ашу мүмкін болмады." : "Не удалось открыть предмет."}</Text>
      <Action label={ui === "kk" ? "Артқа" : "Назад"} onPress={() => router.back()} />
    </View>
  )

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.secondary }]}>
      <Pressable onPress={() => router.push("/dashboard/mistakes")} style={styles.back}>
        <MaterialCommunityIcons name="arrow-left" size={18} color={colors.foreground} />
        <Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{ui === "kk" ? "Қателермен жұмыс" : "Работа над ошибками"}</Text>
      </Pressable>
      <View>
        <Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{examName}</Text>
        <Text style={[styles.h1, { color: colors.foreground }]}>{subjectName}</Text>
      </View>

      <View style={styles.metrics}>
        <Metric label={ui === "kk" ? "Ашық қателер" : "Открытых ошибок"} value={detail.openTotal} />
        <Metric label={ui === "kk" ? "Жаттығуға болады" : "Можно тренировать"} value={detail.activeOpenTotal} />
      </View>

      {!hasPremium ? (
        <Card style={{ backgroundColor: "#fffbeb", borderColor: "#fde68a" }}>
          <Text style={styles.premiumTitle}>{ui === "kk" ? "AI-тақырыптар Premium-де қолжетімді" : "AI-темы доступны в Premium"}</Text>
          <Text style={styles.premiumText}>{ui === "kk" ? "Premium қателерді тақырыптарға бөледі және жеке сабақтар дайындайды." : "Premium сгруппирует ошибки по темам и подготовит персональные уроки."}</Text>
          <Action label={ui === "kk" ? "Premium ашу" : "Открыть Premium"} onPress={() => router.push("/dashboard/billing?reason=study_themes" as never)} />
        </Card>
      ) : (
        <Card>
          <View style={styles.sectionHead}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? "Оқуға арналған тақырыптар" : "Темы для изучения"}</Text><Text style={styles.aiBadge}>AI</Text></View>
          {mapLoading ? <ActivityIndicator color={colors.foreground} /> : mapError ? <Text style={{ color: colors.mutedForeground }}>{ui === "kk" ? "Тақырыптар жүктелмеді." : "Не удалось загрузить темы."}</Text> : studyMap?.openTotal === 0 ? <Text style={{ color: colors.mutedForeground }}>{ui === "kk" ? "Бұл пән бойынша ашық қателер жоқ." : "Открытых ошибок по предмету нет."}</Text> : (
            <View style={styles.themeList}>
              {studyMap?.pending ? <Text style={{ color: colors.mutedForeground }}>{ui === "kk" ? `AI қателерді бөледі: ${studyMap.classifiedCount}/${studyMap.openTotal}` : `AI распределяет ошибки: ${studyMap.classifiedCount}/${studyMap.openTotal}`}</Text> : null}
              {(studyMap?.themes ?? []).map((theme) => (
                <View key={theme.themeId} style={[styles.theme, { borderColor: colors.border }]}>
                  <View style={styles.themeTop}><Text numberOfLines={2} style={[styles.themeName, { color: colors.foreground }]}>{theme.name}</Text><Text style={[styles.count, { backgroundColor: colors.secondary, color: colors.foreground }]}>{theme.openCount}</Text></View>
                  <View style={[styles.track, { backgroundColor: colors.secondary }]}><View style={[styles.progress, { backgroundColor: "#7c3aed", width: `${Math.round(theme.openCount / maxThemeCount * 100)}%` }]} /></View>
                  <View style={styles.actions}>
                    <Action label={ui === "kk" ? "Тақырыпты оқу" : "Изучить тему"} onPress={() => router.push(`/dashboard/mistakes/themes/${theme.themeId}` as never)} />
                    <Action outline label={starting === theme.themeId ? "…" : (ui === "kk" ? "Жаттығу" : "Тренировать")} disabled={starting != null || theme.activeOpenCount === 0} onPress={() => void launch(theme.themeId)} />
                  </View>
                </View>
              ))}
            </View>
          )}
        </Card>
      )}

      <Card>
        <Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? "Жаттығу баптаулары" : "Настройки тренировки"}</Text>
        <Slider label={ui === "kk" ? "Сұрақтар" : "Вопросов"} value={limit} min={5} max={40} colors={colors} onChange={setLimit} />
        <Slider label={ui === "kk" ? "Минут" : "Минут"} value={duration} min={5} max={120} colors={colors} onChange={setDuration} />
        <Action disabled={starting != null || detail.activeOpenTotal === 0} label={starting === "subject" ? "…" : (ui === "kk" ? "Пәнді жаттықтыру" : "Тренировать предмет")} onPress={() => void launch()} />
      </Card>

      {hasPremium ? (
        <Card>
          <View style={styles.sectionHead}><Text style={[styles.sectionTitle, { color: colors.foreground }]}>{ui === "kk" ? `AI-талдау: ${subjectName}` : `AI-разбор: ${subjectName}`}</Text><MaterialCommunityIcons name="brain" size={22} color="#7c3aed" /></View>
          {analysis ? <View style={styles.analysis}><Text style={[styles.body, { color: colors.foreground }]}>{analysis.overview}</Text>{analysis.weakZones.map((zone, index) => <View key={`${zone.title}:${index}`} style={[styles.zone, { borderColor: colors.border }]}><Text style={[styles.themeName, { color: colors.foreground }]}>{zone.title}</Text><Text style={[styles.body, { color: colors.mutedForeground }]}>{zone.rootCause}</Text>{zone.recommendations.map((item, itemIndex) => <Text key={itemIndex} style={[styles.body, { color: colors.foreground }]}>• {item}</Text>)}</View>)}<Text style={[styles.body, { color: colors.mutedForeground }]}>{analysis.motivation}</Text></View> : <Text style={[styles.body, { color: colors.mutedForeground }]}>{ui === "kk" ? "AI әлсіз тақырыптарды және нақты ұсыныстарды дайындайды." : "AI определит слабые темы и подготовит конкретный план."}</Text>}
          <Action disabled={analyzing} label={analyzing ? "…" : analysis ? (ui === "kk" ? "Талдауды жаңарту" : "Обновить разбор") : (ui === "kk" ? "AI-талдау жасау" : "Сделать AI-разбор")} onPress={() => void runAnalysis()} />
        </Card>
      ) : null}
    </ScrollView>
  )
}

function Metric({ label, value }: { label: string; value: number }) {
  const { colors } = useAppTheme()
  return <Card style={styles.metric}><Text style={[styles.eyebrow, { color: colors.mutedForeground }]}>{label}</Text><Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text></Card>
}

function Action({ label, onPress, disabled, outline }: { label: string; onPress: () => void; disabled?: boolean; outline?: boolean }) {
  const { colors } = useAppTheme()
  return <Pressable disabled={disabled} onPress={onPress} style={({ pressed }) => [styles.action, { backgroundColor: outline ? colors.card : colors.foreground, borderColor: outline ? colors.border : colors.foreground, opacity: disabled ? .45 : pressed ? .84 : 1 }]}><Text style={{ color: outline ? colors.foreground : colors.background, fontFamily: fonts.sansSemi, textAlign: "center" }}>{label}</Text></Pressable>
}

function Slider({ label, value, min, max, colors, onChange }: { label: string; value: number; min: number; max: number; colors: { foreground: string; secondary: string }; onChange: (value: number) => void }) {
  return <View style={styles.sliderWrap}><View style={styles.sliderLabel}><Text style={{ color: colors.foreground }}>{label}</Text><Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{value}</Text></View><StepSlider minimumValue={min} maximumValue={max} step={5} value={value} onValueChange={(next) => onChange(Math.round(next / 5) * 5)} minimumTrackTintColor={colors.foreground} maximumTrackTintColor={colors.secondary} thumbTintColor={colors.foreground} /></View>
}

function practiceMessage(code: string, ui: "ru" | "kk") {
  if (ui === "kk") return code === "NO_OPEN_MISTAKES_FOR_THEME" ? "Бұл тақырып бойынша ашық қателер жоқ." : "Жаттығуды бастау мүмкін болмады."
  if (code === "NO_OPEN_MISTAKES_FOR_THEME") return "По этой теме нет открытых ошибок."
  if (code === "NO_OPEN_MISTAKES_FOR_SUBJECT") return "По этому предмету нет открытых ошибок."
  return code === "NETWORK" ? "Проверьте интернет и повторите попытку." : "Не удалось запустить тренировку."
}

function aiMessage(code: string, ui: "ru" | "kk") {
  if (ui === "kk") return code === "AI_DAILY_LIMIT" ? "Бүгінгі AI лимиті аяқталды." : "AI-талдау жасау мүмкін болмады."
  if (code === "AI_DAILY_LIMIT") return "Дневной лимит AI исчерпан."
  if (code === "AI_BUSY") return "AI перегружен, попробуйте позже."
  return "Не удалось выполнить AI-разбор."
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 120, gap: 16 },
  center: { flex: 1, minHeight: 320, alignItems: "center", justifyContent: "center", gap: 14, padding: 20 },
  back: { flexDirection: "row", alignItems: "center", gap: 7, alignSelf: "flex-start", minHeight: 40 },
  eyebrow: { fontSize: 12, textTransform: "uppercase", letterSpacing: .5, fontFamily: fonts.sansSemi },
  h1: { fontSize: 29, fontFamily: fonts.sansSemi, marginTop: 4 },
  metrics: { flexDirection: "row", gap: 10 },
  metric: { flex: 1 },
  metricValue: { fontSize: 30, fontFamily: fonts.sansSemi, marginTop: 8 },
  sectionHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 10 },
  sectionTitle: { fontSize: 17, fontFamily: fonts.sansSemi },
  aiBadge: { color: "#6d28d9", backgroundColor: "#ede9fe", paddingHorizontal: 9, paddingVertical: 4, borderRadius: 999, fontFamily: fonts.sansSemi },
  themeList: { gap: 10, marginTop: 14 },
  theme: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, padding: 13, gap: 10 },
  themeTop: { flexDirection: "row", alignItems: "center", gap: 8 },
  themeName: { flex: 1, fontSize: 14, fontFamily: fonts.sansSemi },
  count: { overflow: "hidden", borderRadius: 999, paddingHorizontal: 8, paddingVertical: 4, fontSize: 11 },
  track: { height: 6, borderRadius: 3, overflow: "hidden" },
  progress: { height: "100%", borderRadius: 3 },
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 42, borderRadius: 10, paddingHorizontal: 14, justifyContent: "center", borderWidth: StyleSheet.hairlineWidth, marginTop: 12 },
  sliderWrap: { marginTop: 14 },
  sliderLabel: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  premiumTitle: { color: "#78350f", fontSize: 16, fontFamily: fonts.sansSemi },
  premiumText: { color: "#92400e", fontSize: 13, lineHeight: 20, marginTop: 6 },
  analysis: { gap: 10, marginTop: 12 },
  zone: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 12, padding: 12, gap: 6 },
  body: { fontSize: 13, lineHeight: 20 },
})
