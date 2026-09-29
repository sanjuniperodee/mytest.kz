import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useRef, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native"
import useSWR from "swr"
import type { FixedPracticeScope } from "@/components/dashboard/mistakes/PracticeSheet"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import type { StudyMap } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

/** AI grouping of the student's mistakes; preparing themes runs only when the student asks. */
export function StudyThemes({
  subjectId,
  examTypeId,
  onPractice,
}: {
  subjectId: string
  examTypeId: string
  onPractice: (scope: FixedPracticeScope) => void
}) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { locale } = useUiLocale()
  const key = `/ai/mistakes/subjects/${subjectId}/study-map/overview?examTypeId=${examTypeId}`
  const { data, error, isLoading, mutate } = useSWR<StudyMap>([key, locale], ([url]: [string, string]) => api<StudyMap>(url))
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState("")
  const inFlight = useRef(false)

  const prepare = async () => {
    if (inFlight.current) return
    inFlight.current = true
    setBusy(true)
    setFailure("")
    try {
      const next = await api<StudyMap>(`/ai/mistakes/subjects/${subjectId}/study-map/prepare`, { method: "POST" })
      await mutate(next, { revalidate: false })
    } catch (err) {
      setFailure(
        err instanceof ApiError && err.message === "AI_DAILY_LIMIT"
          ? tr("Лимит AI на сегодня исчерпан. Обычная тренировка остаётся доступной.", "Бүгінгі AI лимиті таусылды. Әдеттегі жаттығу қолжетімді.")
          : tr("Не удалось подготовить темы. Можно тренироваться по темам программы выше.", "Тақырыптарды дайындау мүмкін болмады. Жоғарыдағы бағдарлама тақырыптары бойынша жаттығуға болады."),
      )
    } finally {
      inFlight.current = false
      setBusy(false)
    }
  }
  const openTheme = (id: string) => router.push(`/dashboard/mistakes/themes/${id}` as never)

  return (
    <Card style={styles.card}>
      <Text style={[styles.h2, { color: colors.foreground }]}>{tr("Темы для изучения с AI", "AI арқылы оқуға арналған тақырыптар")}</Text>
      <Text style={[styles.text, { color: colors.mutedForeground }]}>
        {tr(
          "Дополнительная группировка ошибок с уроками. Подготовка запускается только по вашей кнопке и использует лимит AI.",
          "Сабақтары бар қосымша қателер топтамасы. Дайындау тек батырманы басқанда басталады және AI лимитін пайдаланады.",
        )}
      </Text>
      {isLoading ? <ActivityIndicator color={colors.foreground} /> : null}
      {error ? (
        <View style={styles.gap}>
          <Text accessibilityRole="alert" style={[styles.text, { color: colors.foreground }]}>
            {tr("Список тем не загрузился.", "Тақырыптар тізімі жүктелмеді.")}
          </Text>
          <Button variant="outline" size="sm" onPress={() => void mutate().catch(() => {})}>
            {tr("Повторить", "Қайталау")}
          </Button>
        </View>
      ) : null}
      {data ? (
        <>
          {data.themes.map((theme) => {
            const name = localize(theme.name, locale, theme.key)
            return (
              <View key={theme.themeId} style={[styles.theme, { borderTopColor: colors.border }]}>
                <Pressable accessibilityRole="link" onPress={() => openTheme(theme.themeId)} style={styles.themeLink}>
                  <View style={styles.flex}>
                    <Text style={[styles.value, { color: colors.foreground }]}>{name}</Text>
                    <Text style={[styles.small, { color: colors.mutedForeground }]}>
                      {tr("Ошибок", "Қателер")}: {theme.openCount} · {tr("Для практики", "Жаттығуға")}: {theme.activeOpenCount}
                    </Text>
                  </View>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={colors.foreground} />
                </Pressable>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={theme.activeOpenCount === 0}
                  onPress={() => onPractice({ examTypeId, subjectId, themeId: theme.themeId, title: name, available: theme.activeOpenCount })}
                >
                  {tr("Тренировать", "Жаттығу")}
                </Button>
              </View>
            )
          })}
          {(data.reviewThemes?.length ?? 0) > 0 ? (
            <View style={[styles.section, { borderTopColor: colors.border }]}>
              <Text style={[styles.value, { color: colors.foreground }]}>{tr("Исправлены — можно повторить", "Түзетілген — қайталауға болады")}</Text>
              {data.reviewThemes.map((theme) => (
                <Pressable key={theme.themeId} accessibilityRole="link" onPress={() => openTheme(theme.themeId)} style={styles.themeLink}>
                  <Text style={[styles.text, styles.flex, { color: colors.foreground }]}>{localize(theme.name, locale, theme.key)}</Text>
                  <MaterialCommunityIcons name="arrow-right" size={16} color={colors.foreground} />
                </Pressable>
              ))}
            </View>
          ) : null}
          {data.otherOpenCount > 0 ? (
            <View style={[styles.other, { borderColor: colors.border }]}>
              <Text style={[styles.value, { color: colors.foreground }]}>
                {tr("Без AI-темы", "AI тақырыбы жоқ")}: {data.otherOpenCount}
              </Text>
              <Text style={[styles.small, { color: colors.mutedForeground }]}>
                {tr("Вопросы, ещё не привязанные к активной AI-теме. Тренировка включает только их.", "Белсенді AI тақырыбына әлі байланыстырылмаған сұрақтар. Жаттығуға тек солар кіреді.")}
              </Text>
              <Button
                variant="outline"
                size="sm"
                disabled={data.otherActiveOpenCount === 0}
                onPress={() =>
                  onPractice({
                    examTypeId,
                    subjectId,
                    unclassifiedOnly: true,
                    title: tr("Ошибки без AI-темы", "AI тақырыбы жоқ қателер"),
                    available: data.otherActiveOpenCount,
                  })
                }
              >
                {tr("Тренировать эти вопросы", "Осы сұрақтармен жаттығу")}
              </Button>
            </View>
          ) : null}
          {data.generationAvailable && data.unclassifiedCount > 0 ? (
            <Button variant="outline" disabled={busy} onPress={() => void prepare()}>
              {busy ? tr("Готовим темы…", "Тақырыптар дайындалуда…") : tr("Подготовить темы с AI", "AI арқылы тақырыптарды дайындау")}
            </Button>
          ) : null}
          {data.unclassifiedCount > 0 ? (
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {tr("Ещё не обработано", "Әлі өңделмеген")}: {data.unclassifiedCount}. {tr("Большой список обрабатывается частями.", "Үлкен тізім бөліктермен өңделеді.")}
            </Text>
          ) : null}
          {!data.generationAvailable ? (
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {tr("AI временно недоступен. Сохранённые материалы и тренировки продолжают работать.", "AI уақытша қолжетімсіз. Сақталған материалдар мен жаттығулар жұмыс істейді.")}
            </Text>
          ) : null}
          {data.openTotal === 0 ? (
            <Text style={[styles.text, { color: colors.mutedForeground }]}>
              {tr("Открытых ошибок нет. Повторить сохранённый урок можно по его ссылке.", "Ашық қателер жоқ. Сақталған сабақты сілтемесі арқылы қайталауға болады.")}
            </Text>
          ) : null}
        </>
      ) : null}
      {failure ? (
        <Text accessibilityRole="alert" style={[styles.text, { color: colors.destructive }]}>
          {failure}
        </Text>
      ) : null}
    </Card>
  )
}

const styles = StyleSheet.create({
  card: { padding: 16, gap: 12 },
  gap: { gap: 8, alignItems: "flex-start" },
  flex: { flex: 1, minWidth: 0 },
  h2: { fontSize: 17, fontFamily: fonts.sansSemi },
  text: { fontSize: 14, lineHeight: 21 },
  small: { fontSize: 12, lineHeight: 18 },
  value: { fontSize: 14, fontFamily: fonts.sansSemi },
  theme: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 10, gap: 8, alignItems: "flex-start" },
  themeLink: { flexDirection: "row", alignItems: "center", gap: 10, minHeight: 44, alignSelf: "stretch" },
  section: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 12, gap: 4 },
  other: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 12, gap: 8, alignItems: "flex-start" },
})
