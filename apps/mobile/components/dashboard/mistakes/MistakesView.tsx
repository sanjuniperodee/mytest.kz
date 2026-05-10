import { MaterialCommunityIcons } from "@expo/vector-icons"
import { StepSlider } from "@/components/ui/step-slider"
import useSWR from "swr"
import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { router } from "expo-router"
import { Card } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { ExamType, MistakesSummary, TestSession } from "@/lib/api/types"
import { t, useUiLocale } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

function snapStep(value: number, step: number, min: number, max: number): number {
  const n = Math.round(value / step) * step
  return Math.max(min, Math.min(max, n))
}

function RadioOuter({ selected, colors }: { selected: boolean; colors: { foreground: string } }) {
  return (
    <View style={[styles.radioOuter, { borderColor: colors.foreground }]}>
      {selected ? <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} /> : null}
    </View>
  )
}

function ModalPicker({
  visible,
  title,
  options,
  value,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean
  title: string
  options: { value: string; label: string }[]
  value: string
  onSelect: (v: string) => void
  onClose: () => void
  colors: {
    card: string
    foreground: string
    mutedForeground: string
    border: string
    secondary: string
  }
}) {
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.modalWrap}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>{title}</Text>
          <FlatList
            data={options}
            keyExtractor={(item, index) => `${item.value}:${index}`}
            style={{ maxHeight: 360 }}
            renderItem={({ item }) => {
            const sel = item.value === value
            return (
              <Pressable
                onPress={() => {
                  onSelect(item.value)
                  onClose()
                }}
                style={[
                  styles.pickerRow,
                  {
                    backgroundColor: sel ? colors.secondary : "transparent",
                    borderBottomColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.pickerRowText, { color: colors.foreground }]} numberOfLines={2}>
                  {item.label}
                </Text>
                {sel ? (
                  <MaterialCommunityIcons name="check" size={20} color={colors.foreground} />
                ) : null}
              </Pressable>
            )
          }}
          />
        </View>
      </View>
    </Modal>
  )
}

export function MistakesView() {
  const { locale: ui } = useUiLocale()
  const { colors } = useAppTheme()
  const { width: winW } = useWindowDimensions()
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data: summary, isLoading } = useSWR<MistakesSummary>("/tests/mistakes/summary")
  const { data: examTypes } = useSWR<ExamType[]>("/exams/types")

  const [examTypeId, setExamTypeId] = useState<string>("all")
  const [subjectId, setSubjectId] = useState<string>("all")
  const [language, setLanguage] = useState<"ru" | "kk">("ru")
  const [limit, setLimit] = useState(20)
  const [duration, setDuration] = useState(30)
  const [starting, setStarting] = useState(false)
  const [examPickerOpen, setExamPickerOpen] = useState(false)
  const [subjectPickerOpen, setSubjectPickerOpen] = useState(false)

  const total = summary?.openTotal ?? 0
  const byExam = summary?.openByExam ?? []
  const bySubject = summary?.openBySubject ?? []
  const examsById = useMemo(
    () => new Map<string, ExamType>((examTypes || []).map((exam) => [exam.id, exam])),
    [examTypes],
  )
  const examOptions = useMemo(
    () =>
      byExam.map((row) => {
        const exam = examsById.get(row.examTypeId)
        return {
          id: row.examTypeId,
          name: localize(exam?.name ?? row.examName, locale, t("examFallbackName", ui)),
          count: row.count,
        }
      }),
    [byExam, examsById, locale, ui],
  )
  const subjectOptions = useMemo(
    () =>
      bySubject
        .filter((row) => examTypeId === "all" || row.examTypeId === examTypeId)
        .map((row) => {
          const exam = examsById.get(row.examTypeId)
          const examName = localize(exam?.name ?? row.examName, locale, t("examFallbackName", ui))
          const subjectName = localize(row.subjectName, locale, t("examSubjectFallback", ui))
          return {
            id: row.subjectId,
            examTypeId: row.examTypeId,
            label: examTypeId === "all" ? `${subjectName} · ${examName}` : subjectName,
            count: row.count,
          }
        }),
    [bySubject, examTypeId, examsById, locale, ui],
  )

  useEffect(() => {
    if (subjectId === "all") return
    if (!subjectOptions.some((subject) => subject.id === subjectId)) {
      setSubjectId("all")
    }
  }, [subjectId, subjectOptions])

  useEffect(() => {
    setLanguage(locale === "kk" ? "kk" : "ru")
  }, [locale])

  const examSelectLabel =
    examTypeId === "all"
      ? t("mistakesAllExams", ui)
      : examOptions.find((e) => e.id === examTypeId)?.name ?? t("mistakesExam", ui)

  const subjectSelectLabel =
    subjectId === "all"
      ? t("mistakesAllSubjects", ui)
      : subjectOptions.find((s) => s.id === subjectId)?.label ?? t("mistakesSubject", ui)

  const examPickerOptions = useMemo(
    () => [
      { value: "all", label: t("mistakesAllExams", ui) },
      ...examOptions.map((e) => ({ value: e.id, label: `${e.name} (${e.count})` })),
    ],
    [examOptions, ui],
  )

  const subjectPickerOptions = useMemo(
    () => [
      { value: "all", label: t("mistakesAllSubjects", ui) },
      ...subjectOptions.map((s) => ({
        value: s.id,
        label: `${s.label} (${s.count})`,
      })),
    ],
    [subjectOptions, ui],
  )

  const summaryWide = winW >= 1024
  const formTwoCol = winW >= 640

  const start = async () => {
    setStarting(true)
    try {
      const session = await api<TestSession>("/tests/mistakes/practice", {
        method: "POST",
        body: {
          language,
          examTypeId: examTypeId === "all" ? undefined : examTypeId,
          subjectId: subjectId === "all" ? undefined : subjectId,
          limit,
          durationMins: duration,
        },
      })
      router.push(`/exam/${session.id}`)
    } catch (err) {
      let message = t("mistakesErrStart", ui)
      if (err instanceof ApiError) {
        if (err.message === "EXAM_TYPE_REQUIRED") message = t("mistakesErrPickExam", ui)
        else if (err.message === "NO_OPEN_MISTAKES_FOR_SUBJECT")
          message = t("mistakesErrNoSubjectMistakes", ui)
        else if (err.message === "NO_OPEN_MISTAKES") message = t("mistakesErrNoMistakes", ui)
        else message = err.message
      }
      Alert.alert(t("alertError", ui), message)
      setStarting(false)
    }
  }

  return (
    <>
      <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.secondary }]}>
        <View style={styles.hero}>
          <Text style={[styles.h1, { color: colors.foreground }]}>{t("mistakesTitle", ui)}</Text>
          <Text style={[styles.heroSub, { color: colors.mutedForeground }]}>
            {t("mistakesLead", ui)}
          </Text>
        </View>

        <View style={summaryWide ? styles.summaryRow : styles.summaryStack}>
          <Card style={summaryWide ? styles.summaryTotal : undefined}>
            <View style={styles.totalHead}>
              <MaterialCommunityIcons name="target" size={18} color={colors.mutedForeground} />
              <Text style={[styles.totalHeadLabel, { color: colors.mutedForeground }]}>
                {t("mistakesTotalErrors", ui)}
              </Text>
            </View>
            {isLoading ? (
              <View style={[styles.skBig, { backgroundColor: colors.secondary }]} />
            ) : (
              <Text style={[styles.totalNum, { color: colors.foreground }]}>{total}</Text>
            )}
            <Text style={[styles.totalHint, { color: colors.mutedForeground }]}>
              {t("mistakesTotalHint", ui)}
            </Text>
          </Card>

          <Card style={summaryWide ? styles.summaryByExam : undefined}>
            <Text style={[styles.cardTitle, { color: colors.foreground }]}>{t("mistakesByExam", ui)}</Text>
            <View style={{ marginTop: 12 }}>
              {isLoading ? (
                <View style={styles.examSkelGrid}>
                  {Array.from({ length: 6 }).map((_, i) => (
                    <View key={i} style={[styles.skLine, { backgroundColor: colors.secondary }]} />
                  ))}
                </View>
              ) : examOptions.length === 0 ? (
                <Text style={[styles.mutedLine, { color: colors.mutedForeground }]}>
                  {t("mistakesNoErrors", ui)}
                </Text>
              ) : (
                <View style={styles.examList}>
                  {examOptions.map((exam) => (
                    <View
                      key={exam.id}
                      style={[
                        styles.examRow,
                        {
                          borderColor: colors.border,
                          backgroundColor: colors.card,
                        },
                      ]}
                    >
                      <Text style={[styles.examName, { color: colors.foreground }]} numberOfLines={1}>
                        {exam.name}
                      </Text>
                      <View style={[styles.countPill, { backgroundColor: colors.secondary }]}>
                        <Text style={[styles.countPillText, { color: colors.foreground }]}>
                          {exam.count}
                        </Text>
                      </View>
                    </View>
                  ))}
                </View>
              )}
            </View>
          </Card>
        </View>

        <Card>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}>
            {t("mistakesStartTraining", ui)}
          </Text>

          <View style={[styles.formGrid, formTwoCol && styles.formGridWide]}>
            <View style={[styles.field, formTwoCol && styles.fieldHalf]}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t("mistakesExam", ui)}</Text>
              <Pressable
                onPress={() => setExamPickerOpen(true)}
                style={[styles.selectTrigger, { borderColor: colors.border, backgroundColor: colors.card }]}
              >
                <Text style={[styles.selectValue, { color: colors.foreground }]} numberOfLines={1}>
                  {examSelectLabel}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={22} color={colors.mutedForeground} />
              </Pressable>
              {examTypeId === "all" && byExam.length > 0 ? (
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                  {t("mistakesHelperAllExams", ui)}
                </Text>
              ) : null}
            </View>

            <View style={[styles.field, formTwoCol && styles.fieldHalf]}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t("mistakesSubject", ui)}</Text>
              <Pressable
                onPress={() => subjectOptions.length > 0 && setSubjectPickerOpen(true)}
                disabled={subjectOptions.length === 0}
                style={[
                  styles.selectTrigger,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    opacity: subjectOptions.length === 0 ? 0.45 : 1,
                  },
                ]}
              >
                <Text style={[styles.selectValue, { color: colors.foreground }]} numberOfLines={1}>
                  {subjectSelectLabel}
                </Text>
                <MaterialCommunityIcons name="chevron-down" size={22} color={colors.mutedForeground} />
              </Pressable>
              {subjectId === "all" && subjectOptions.length > 0 ? (
                <Text style={[styles.helper, { color: colors.mutedForeground }]}>
                  {t("mistakesHelperAllSubjects", ui)}
                </Text>
              ) : null}
            </View>

            <View style={[styles.field, formTwoCol && styles.fieldHalf]}>
              <Text style={[styles.label, { color: colors.foreground }]}>{t("statsColLang", ui)}</Text>
              <View style={styles.langRow}>
                {(["ru", "kk"] as const).map((lng) => (
                  <Pressable
                    key={lng}
                    onPress={() => setLanguage(lng)}
                    style={[
                      styles.radioCard,
                      {
                        borderColor: language === lng ? colors.foreground : colors.border,
                        backgroundColor: language === lng ? colors.secondary : colors.card,
                      },
                    ]}
                  >
                    <RadioOuter selected={language === lng} colors={colors} />
                    <Text style={[styles.radioLabel, { color: colors.foreground }]}>
                      {lng === "ru" ? t("langRussian", ui) : t("langKazakh", ui)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <View style={[styles.field, formTwoCol && styles.fieldHalf]}>
              <View style={styles.sliderHead}>
                <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>
                  {t("mistakesQuestions", ui)}
                </Text>
                <Text style={[styles.sliderVal, { color: colors.foreground }]}>{limit}</Text>
              </View>
              <StepSlider
                style={styles.slider}
                minimumValue={5}
                maximumValue={50}
                step={5}
                value={limit}
                minimumTrackTintColor={colors.foreground}
                maximumTrackTintColor={colors.secondary}
                thumbTintColor={colors.foreground}
                onSlidingComplete={(v) => setLimit(snapStep(v, 5, 5, 50))}
                onValueChange={(v) => setLimit(snapStep(v, 5, 5, 50))}
              />
            </View>

            <View style={[styles.field, formTwoCol && styles.fieldHalf]}>
              <View style={styles.sliderHead}>
                <Text style={[styles.label, { color: colors.foreground, marginBottom: 0 }]}>
                  {t("mistakesDurationMin", ui)}
                </Text>
                <Text style={[styles.sliderVal, { color: colors.foreground }]}>{duration}</Text>
              </View>
              <StepSlider
                style={styles.slider}
                minimumValue={5}
                maximumValue={120}
                step={5}
                value={duration}
                minimumTrackTintColor={colors.foreground}
                maximumTrackTintColor={colors.secondary}
                thumbTintColor={colors.foreground}
                onSlidingComplete={(v) => setDuration(snapStep(v, 5, 5, 120))}
                onValueChange={(v) => setDuration(snapStep(v, 5, 5, 120))}
              />
            </View>
          </View>

          <View
            style={[
              styles.ctaBox,
              formTwoCol && styles.ctaBoxRow,
              {
                borderColor: colors.border,
                backgroundColor: `${colors.secondary}66`,
              },
            ]}
          >
            <View style={[styles.ctaLeft, formTwoCol && styles.ctaLeftShrink]}>
              <MaterialCommunityIcons name="star-four-points-small" size={22} color={colors.foreground} />
              <View style={{ flex: 1 }}>
                <Text style={[styles.ctaTitle, { color: colors.foreground }]}>
                  {t("mistakesCtaTitle", ui)}
                </Text>
                <Text style={[styles.ctaSub, { color: colors.mutedForeground }]}>
                  {t("mistakesCtaBodyPrefix", ui)}
                  {limit}
                  {t("mistakesCtaBodySuffix", ui)}
                </Text>
              </View>
            </View>
            <Pressable
              onPress={() => void start()}
              disabled={starting || total === 0}
              style={({ pressed }) => [
                styles.ctaBtn,
                formTwoCol && styles.ctaBtnInline,
                {
                  backgroundColor: colors.foreground,
                  opacity: starting || total === 0 ? 0.45 : pressed ? 0.88 : 1,
                },
              ]}
            >
              {starting ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <MaterialCommunityIcons name="play" size={18} color={colors.background} />
                  <Text style={[styles.ctaBtnText, { color: colors.background }]}>
                    {t("mistakesStartBtn", ui)}
                  </Text>
                </>
              )}
            </Pressable>
          </View>

          {total === 0 && !isLoading ? (
            <View style={[styles.emptyHint, { borderColor: colors.border, backgroundColor: colors.card }]}>
              <MaterialCommunityIcons name="book-open-page-variant" size={18} color={colors.mutedForeground} />
              <Text style={[styles.emptyHintText, { color: colors.mutedForeground }]}>
                {t("mistakesEmptyHint", ui)}
              </Text>
            </View>
          ) : null}
        </Card>
      </ScrollView>

      <ModalPicker
        visible={examPickerOpen}
        title={t("mistakesExam", ui)}
        options={examPickerOptions}
        value={examTypeId}
        onSelect={(v) => {
          setExamTypeId(v)
          setSubjectId("all")
        }}
        onClose={() => setExamPickerOpen(false)}
        colors={colors}
      />
      <ModalPicker
        visible={subjectPickerOpen}
        title={t("mistakesSubject", ui)}
        options={subjectPickerOptions}
        value={subjectId}
        onSelect={setSubjectId}
        onClose={() => setSubjectPickerOpen(false)}
        colors={colors}
      />
    </>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 24, paddingBottom: 120 },
  hero: { gap: 8 },
  h1: { fontSize: 30, fontFamily: fonts.sansSemi, letterSpacing: -0.5 },
  heroSub: { fontSize: 15, lineHeight: 22 },
  summaryRow: { flexDirection: "row", gap: 16, alignItems: "stretch" },
  summaryStack: { gap: 16 },
  summaryTotal: { flex: 1, minWidth: 200 },
  summaryByExam: { flex: 2, minWidth: 280 },
  totalHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 8 },
  totalHeadLabel: { fontSize: 11, fontWeight: "600", textTransform: "uppercase", letterSpacing: 0.6 },
  skBig: { height: 36, width: 72, borderRadius: 8, marginVertical: 4 },
  totalNum: { fontSize: 36, fontFamily: fonts.sansSemi },
  totalHint: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  cardTitle: { fontSize: 16, fontFamily: fonts.sansSemi },
  examSkelGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  skLine: { height: 36, flexGrow: 1, minWidth: "42%", borderRadius: 8 },
  mutedLine: { fontSize: 13 },
  examList: { gap: 8 },
  examRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  examName: { fontSize: 14, fontFamily: fonts.sansSemi, flex: 1 },
  countPill: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 999 },
  countPillText: { fontSize: 11, fontFamily: fonts.sansSemi },
  formGrid: { marginTop: 16, gap: 20 },
  formGridWide: { flexDirection: "row", flexWrap: "wrap" },
  field: { gap: 8, width: "100%" },
  fieldHalf: { flexBasis: "47%", flexGrow: 1, maxWidth: "100%", minWidth: 160 },
  label: { fontSize: 13, fontFamily: fonts.sansSemi, marginBottom: 4 },
  selectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  selectValue: { fontSize: 15, flex: 1 },
  helper: { fontSize: 11, lineHeight: 16 },
  langRow: { flexDirection: "row", gap: 8 },
  radioCard: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 44,
  },
  radioLabel: { fontSize: 14, fontFamily: fonts.sansSemi },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  sliderHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 4,
  },
  sliderVal: { fontSize: 14, fontFamily: fonts.sansSemi },
  slider: { width: "100%", height: 40 },
  ctaBox: {
    marginTop: 24,
    padding: 16,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
    gap: 16,
  },
  ctaBoxRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 16,
  },
  ctaLeft: { flexDirection: "row", alignItems: "flex-start", gap: 12 },
  ctaLeftShrink: { flex: 1, minWidth: 0 },
  ctaTitle: { fontSize: 14, fontFamily: fonts.sansSemi },
  ctaSub: { fontSize: 12, lineHeight: 17, marginTop: 4 },
  ctaBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    borderRadius: 10,
    paddingHorizontal: 16,
    alignSelf: "stretch",
  },
  ctaBtnInline: { alignSelf: "center", minWidth: 200 },
  ctaBtnText: { fontSize: 15, fontFamily: fonts.sansSemi },
  emptyHint: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    marginTop: 16,
    padding: 14,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  emptyHintText: { fontSize: 13, lineHeight: 18, flex: 1 },
  modalWrap: { flex: 1, justifyContent: "flex-end", backgroundColor: "rgba(0,0,0,0.45)" },
  modalSheet: {
    maxHeight: "70%",
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    paddingTop: 16,
    paddingBottom: 28,
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
  },
  modalTitle: {
    fontSize: 17,
    fontFamily: fonts.sansSemi,
    paddingHorizontal: 20,
    marginBottom: 8,
  },
  pickerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: 12,
  },
  pickerRowText: { fontSize: 15, flex: 1 },
})
