import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useRef, useState } from "react"
import { StyleSheet, Text, View } from "react-native"
import { Button } from "@/components/ui/button"
import { SegmentedTabs } from "@/components/ui/segmented-tabs"
import { SelectSheet } from "@/components/ui/select-sheet"
import { Sheet } from "@/components/ui/sheet"
import { StepSlider } from "@/components/ui/step-slider"
import { api, ApiError } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import type { MistakesSummary, TestSession } from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

export type FixedPracticeScope = {
  examTypeId: string
  subjectId: string
  topicId?: string
  themeId?: string
  unclassifiedOnly?: boolean
  title: string
  available: number
}

export type PracticeRequest = { examTypeId: string; subjectId?: string } | FixedPracticeScope

const isFixed = (scope: PracticeRequest): scope is FixedPracticeScope => "title" in scope

/** Short test made of the questions the student got wrong. */
export function PracticeSheet({
  summary,
  scope,
  onClose,
}: {
  summary?: MistakesSummary
  scope: PracticeRequest | null
  onClose: () => void
}) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const { locale } = useUiLocale()
  const fixed = scope && isFixed(scope) ? scope : undefined
  const [examId, setExamId] = useState(scope?.examTypeId ?? "")
  const [subjectId, setSubjectId] = useState(scope?.subjectId ?? "all")
  const [language, setLanguage] = useState<"ru" | "kk">(locale === "kk" ? "kk" : "ru")
  const [limit, setLimit] = useState(15)
  const [duration, setDuration] = useState(25)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState("")
  const inFlight = useRef(false)
  const [seenScope, setSeenScope] = useState<PracticeRequest | null>(null)
  if (scope !== seenScope) {
    setSeenScope(scope)
    if (scope) {
      setExamId(scope.examTypeId)
      setSubjectId(scope.subjectId ?? "all")
      setError("")
    }
  }

  const subjects = summary?.openBySubject.filter((s) => s.examTypeId === examId) ?? []
  const selectedSubject = subjects.find((s) => s.subjectId === subjectId)
  const selectedExam = summary?.openByExam.find((e) => e.examTypeId === examId)
  const validScope = Boolean(fixed || (selectedExam && (subjectId === "all" || selectedSubject)))
  const available = fixed?.available ?? (subjectId === "all" ? (selectedExam?.count ?? 0) : (selectedSubject?.count ?? 0))
  // The API caps practice at 40 and can exclude archived questions from this total.
  const maxQuestions = Math.max(1, Math.min(40, available))
  const questionLimit = Math.min(limit, maxQuestions)

  const launch = async () => {
    if (inFlight.current || !validScope || available === 0) return
    inFlight.current = true
    setStarting(true)
    setError("")
    try {
      const session = await api<TestSession>("/tests/mistakes/practice", {
        method: "POST",
        body: {
          language,
          examTypeId: examId,
          subjectId: subjectId === "all" ? undefined : subjectId,
          topicId: fixed?.topicId,
          themeId: fixed?.themeId,
          unclassifiedOnly: fixed?.unclassifiedOnly,
          limit: questionLimit,
          durationMins: duration,
        },
      })
      onClose()
      router.push(`/exam/${session.id}` as never)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 402 || err.status === 403)) {
        onClose()
        router.push("/dashboard/billing?reason=mistakes_practice" as never)
        return
      }
      setError(
        err instanceof ApiError && err.message.startsWith("NO_OPEN_MISTAKES")
          ? tr("Для этого выбора нет доступных вопросов. Выберите другой предмет или обновите страницу.", "Бұл таңдау үшін қолжетімді сұрақтар жоқ. Басқа пәнді таңдаңыз немесе бетті жаңартыңыз.")
          : tr("Не удалось начать тренировку. Настройки сохранены — попробуйте ещё раз.", "Жаттығуды бастау мүмкін болмады. Баптаулар сақталған — қайталап көріңіз."),
      )
      inFlight.current = false
      setStarting(false)
    }
  }

  return (
    <Sheet
      visible={!!scope}
      onClose={() => {
        if (!inFlight.current) onClose()
      }}
      title={tr("Тренировка по ошибкам", "Қателер бойынша жаттығу")}
      description={tr("Короткий тест из вопросов, в которых вы ошиблись. Один экзамен за тренировку.", "Қате жауап берген сұрақтарыңыздан қысқа тест. Бір жаттығуда бір емтихан.")}
    >
      <View style={styles.body}>
        {fixed ? (
          <View style={[styles.scope, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
            <Text style={[styles.scopeText, { color: colors.foreground }]}>{fixed.title}</Text>
          </View>
        ) : (
          <>
            <SelectSheet
              label={tr("Экзамен", "Емтихан")}
              value={examId}
              options={(summary?.openByExam ?? []).map((e) => ({ value: e.examTypeId, label: `${localize(e.examName, locale)} (${e.count})` }))}
              onChange={(v) => {
                setExamId(v)
                setSubjectId("all")
                setError("")
              }}
            />
            <SelectSheet
              label={tr("Предмет", "Пән")}
              value={subjectId}
              options={[
                { value: "all", label: tr("Все предметы экзамена", "Емтиханның барлық пәндері") },
                ...subjects.map((s) => ({ value: s.subjectId, label: `${localize(s.subjectName, locale)} (${s.count})` })),
              ]}
              onChange={(v) => {
                setSubjectId(v)
                setError("")
              }}
            />
          </>
        )}
        <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Язык вопросов", "Сұрақтар тілі")}</Text>
        <SegmentedTabs value={language} onChange={setLanguage} items={[{ value: "ru", label: "Русский" }, { value: "kk", label: "Қазақша" }]} />
        <SelectSheet
          label={tr("Время, мин", "Уақыт, мин")}
          value={String(duration)}
          options={[10, 15, 25, 30, 45, 60].map((v) => ({ value: String(v), label: String(v) }))}
          onChange={(v) => setDuration(Number(v))}
        />
        <View style={styles.between}>
          <Text style={[styles.label, { color: colors.mutedForeground }]}>{tr("Вопросов в тренировке", "Жаттығудағы сұрақтар")}</Text>
          <Text style={[styles.label, { color: colors.foreground }]}>
            {tr("До", "Ең көбі")} {questionLimit}
          </Text>
        </View>
        {maxQuestions > 1 ? (
          <StepSlider
            minimumValue={1}
            maximumValue={maxQuestions}
            step={1}
            value={questionLimit}
            onValueChange={setLimit}
            minimumTrackTintColor={colors.foreground}
            maximumTrackTintColor={colors.secondary}
            thumbTintColor={colors.foreground}
          />
        ) : null}
        <Text style={[styles.note, { color: colors.mutedForeground, backgroundColor: colors.secondary }]}>
          {tr(
            "Берём только доступные вопросы из ваших ошибок. Их может оказаться меньше выбранного количества. Результат появится после завершения тренировки.",
            "Қателеріңізден тек қолжетімді сұрақтарды аламыз. Олардың саны таңдалған мөлшерден аз болуы мүмкін. Нәтиже жаттығу аяқталған соң пайда болады.",
          )}
        </Text>
        {error ? (
          <Text accessibilityRole="alert" style={[styles.note, { color: colors.destructive }]}>
            {error}
          </Text>
        ) : null}
        <View style={styles.footer}>
          <Button variant="outline" disabled={starting} onPress={onClose}>
            {tr("Отмена", "Бас тарту")}
          </Button>
          <Button
            disabled={starting || !validScope || available === 0}
            onPress={() => void launch()}
            icon={(c) => <MaterialCommunityIcons name="play" size={17} color={c} />}
          >
            {starting ? tr("Запускаем…", "Басталуда…") : tr("Начать", "Бастау")}
          </Button>
        </View>
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  body: { gap: 12, paddingTop: 12 },
  scope: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 12 },
  scopeText: { fontSize: 14, fontFamily: fonts.sansSemi },
  label: { fontSize: 13, fontFamily: fonts.sansSemi },
  between: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  note: { fontSize: 12, lineHeight: 18, borderRadius: 10, padding: 10 },
  footer: { flexDirection: "row", justifyContent: "flex-end", gap: 10, marginTop: 4 },
})
