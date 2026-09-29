import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useMemo, useState } from "react"
import { Alert, ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native"
import useSWR from "swr"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Sheet } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api/client"
import type {
  AdmissionCutoffRow,
  AdmissionCycle,
  AdmissionGoal,
  AdmissionGoalResponse,
  University,
} from "@/lib/api/types"
import { useTr } from "@/lib/i18n/use-tr"
import { accentPalette } from "@/lib/theme/accents"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

const scorePct = (score: number | null, max: number) =>
  score == null || max <= 0 ? 0 : Math.max(0, Math.min(100, (score / max) * 100))

function pickLatestCycle(cycles?: AdmissionCycle[]): AdmissionCycle | null {
  if (!cycles?.length) return null
  return cycles.reduce((latest, cycle) => {
    const a = latest.sortOrder ?? Number.NEGATIVE_INFINITY
    const b = cycle.sortOrder ?? Number.NEGATIVE_INFINITY
    if (b > a) return cycle
    if (b === a && cycle.slug.localeCompare(latest.slug) > 0) return cycle
    return latest
  })
}

/** Target university/specialty compared with the latest full mock result. */
export function AdmissionGoalCard({ currentScore, maxScore = 140 }: { currentScore: number | null; maxScore?: number }) {
  const { colors, resolved } = useAppTheme()
  const tr = useTr()
  const tint = accentPalette(resolved).emerald
  const { data, error, isLoading, mutate } = useSWR<AdmissionGoalResponse>("/admission/goal")
  const [open, setOpen] = useState(false)
  const goal = data?.goal ?? null

  if (isLoading) return <Skeleton height={224} radius={12} />
  if (error && !data) {
    return (
      <Card style={styles.body}>
        <Text accessibilityRole="alert" style={[styles.muted, { color: colors.mutedForeground }]}>
          {tr("Не удалось загрузить цель поступления.", "Оқуға түсу мақсаты жүктелмеді.")}
        </Text>
        <Button variant="outline" size="sm" onPress={() => void mutate()}>
          {tr("Повторить", "Қайталау")}
        </Button>
      </Card>
    )
  }

  const missing =
    goal?.requiredScore != null && currentScore != null ? Math.max(0, goal.requiredScore - currentScore) : null

  return (
    <>
      <Card style={styles.body}>
        <View style={styles.head}>
          <View style={styles.title}>
            <View style={[styles.icon, { backgroundColor: tint.bg }]}>
              <MaterialCommunityIcons name="target" size={17} color={tint.fg} />
            </View>
            <Text style={[styles.h2, { color: colors.foreground }]}>{tr("Цель поступления", "Оқуға түсу мақсаты")}</Text>
          </View>
          {goal ? (
            <Button variant="ghost" size="sm" onPress={() => setOpen(true)}>
              {tr("Изменить", "Өзгерту")}
            </Button>
          ) : null}
        </View>

        {goal ? (
          <View style={styles.gap}>
            <View>
              <Text numberOfLines={1} style={[styles.uni, { color: colors.foreground }]}>
                {goal.universityShortName || goal.universityName}
              </Text>
              <Text numberOfLines={1} style={[styles.muted, { color: colors.mutedForeground }]}>
                {goal.programCode} · {goal.programName}
              </Text>
              {goal.profileSubjects ? (
                <Text numberOfLines={1} style={[styles.small, { color: colors.mutedForeground }]}>
                  {goal.profileSubjects}
                </Text>
              ) : null}
            </View>
            <ScoreBar current={currentScore} required={goal.requiredScore} max={maxScore} label={tr("грант", "грант")} />
            <View style={styles.metrics}>
              <Metric label={tr("Проходной балл", "Өту балы")} value={goal.requiredScore == null ? "—" : String(goal.requiredScore)} />
              <Metric label={tr("Ваш пробный", "Сіздің сынағыңыз")} value={currentScore == null ? "—" : String(currentScore)} />
            </View>
            <Text style={[styles.text, { color: colors.foreground }]}>
              {missing == null
                ? tr(
                    "Пройдите полный пробный и сравните результат с целью, когда оба балла будут доступны.",
                    "Толық сынақтан өтіп, екі балл да қолжетімді болғанда нәтижені мақсатпен салыстырыңыз.",
                  )
                : missing > 0
                  ? tr(`До ориентира: ${missing} баллов.`, `Бағдарға дейін: ${missing} балл.`)
                  : tr("Результат пробного не ниже указанного ориентира.", "Сынақ нәтижесі көрсетілген бағдардан төмен емес.")}
            </Text>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {tr(
                "Проходной балл — ориентир по опубликованным данным, не гарантия получения гранта.",
                "Өту балы — жарияланған деректер бойынша бағдар, грант алуға кепілдік емес.",
              )}
            </Text>
            <View style={styles.row}>
              <Button variant="outline" size="sm" onPress={() => router.push("/dashboard/admission" as never)}>
                {tr("Шанс на грант", "Грант мүмкіндігі")}
              </Button>
            </View>
          </View>
        ) : (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>
              {tr(
                "Выберите вуз и специальность, чтобы сравнивать свой результат с опубликованным проходным баллом.",
                "Нәтижеңізді жарияланған өту балымен салыстыру үшін ЖОО мен мамандықты таңдаңыз.",
              )}
            </Text>
            <Button variant="outline" size="sm" onPress={() => setOpen(true)}>
              {tr("Выбрать цель", "Мақсатты таңдау")}
            </Button>
          </View>
        )}
      </Card>
      <GoalPicker open={open} onClose={() => setOpen(false)} hasGoal={!!goal} onChanged={() => mutate()} />
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme()
  return (
    <View style={[styles.metric, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text style={[styles.small, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  )
}

function ScoreBar({ current, required, max, label }: { current: number | null; required: number | null; max: number; label: string }) {
  const { colors, resolved } = useAppTheme()
  const tint = accentPalette(resolved).emerald
  return (
    <View style={styles.barWrap}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max, now: current ?? 0 }}
        style={[styles.bar, { backgroundColor: colors.secondary }]}
      >
        <View style={[styles.barFill, { width: `${scorePct(current, max)}%`, backgroundColor: colors.foreground }]} />
        {required != null ? (
          <View style={[styles.marker, { left: `${scorePct(required, max)}%`, backgroundColor: tint.fg }]}>
            <Text style={[styles.markerLabel, { backgroundColor: tint.bg, color: tint.fg }]}>
              {label} {required}
            </Text>
          </View>
        ) : null}
      </View>
      <View style={styles.scale}>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>0</Text>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{max}</Text>
      </View>
    </View>
  )
}

function GoalPicker({ open, onClose, hasGoal, onChanged }: { open: boolean; onClose: () => void; hasGoal: boolean; onChanged: () => Promise<unknown> }) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const [university, setUniversity] = useState<University | null>(null)
  const [search, setSearch] = useState("")
  const [saving, setSaving] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const { data: universities, isLoading: loadingUnis } = useSWR<University[]>(open ? "/admission/universities" : null)
  const { data: cycles } = useSWR<AdmissionCycle[]>(open ? "/admission/cycles" : null)
  const cycleSlug = useMemo(() => pickLatestCycle(cycles)?.slug, [cycles])
  const { data: programs, isLoading: loadingPrograms } = useSWR<AdmissionCutoffRow[]>(
    open && university && cycleSlug ? `/admission/cutoffs:${cycleSlug}:${university.code}` : null,
    () => api<AdmissionCutoffRow[]>("/admission/cutoffs", { query: { cycleSlug, universityCode: university?.code, quotaType: "GRANT" } }),
  )
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const items = universities ?? []
    if (!q) return items
    return items.filter((u) => u.name.toLowerCase().includes(q) || (u.shortName ?? "").toLowerCase().includes(q))
  }, [search, universities])

  const close = () => {
    setUniversity(null)
    setSearch("")
    onClose()
  }
  const fail = (e: unknown, fallback: string) =>
    Alert.alert(tr("Ошибка", "Қате"), e instanceof ApiError && e.message ? e.message : fallback)

  async function save(row: AdmissionCutoffRow) {
    if (!university || !cycleSlug) return
    setSaving(row.programId)
    try {
      await api("/admission/goal", { method: "PUT", body: { universityCode: university.code, programId: row.programId, cycleSlug } })
      await onChanged()
      close()
    } catch (e) {
      fail(e, tr("Не удалось сохранить цель", "Мақсатты сақтау мүмкін болмады"))
    } finally {
      setSaving(null)
    }
  }
  async function remove() {
    setRemoving(true)
    try {
      await api("/admission/goal", { method: "DELETE" })
      await onChanged()
      close()
    } catch (e) {
      fail(e, tr("Не удалось снять цель", "Мақсатты алып тастау мүмкін болмады"))
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Sheet
      visible={open}
      onClose={close}
      title={tr("Выбрать цель поступления", "Оқуға түсу мақсатын таңдау")}
      description={university ? tr("Теперь выберите специальность с проходным баллом гранта.", "Енді грант өту балы бар мамандықты таңдаңыз.") : tr("Сначала выберите вуз.", "Алдымен ЖОО таңдаңыз.")}
    >
      <View style={styles.pickerBody}>
        {!university ? (
          <>
            <TextInput
              value={search}
              onChangeText={setSearch}
              placeholder={tr("Поиск по вузу", "ЖОО бойынша іздеу")}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            />
            {loadingUnis ? (
              <ActivityIndicator style={styles.pad} color={colors.foreground} />
            ) : filtered.length === 0 ? (
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>{tr("Вузы не найдены", "ЖОО табылмады")}</Text>
            ) : (
              <ScrollView style={styles.list} nestedScrollEnabled>
                {filtered.map((u) => (
                  <Pressable key={u.code} accessibilityRole="button" onPress={() => setUniversity(u)} style={[styles.option, { borderBottomColor: colors.border }]}>
                    <Text style={[styles.optionTitle, { color: colors.foreground }]}>{u.shortName || u.name}</Text>
                    {u.shortName ? <Text numberOfLines={1} style={[styles.small, { color: colors.mutedForeground }]}>{u.name}</Text> : null}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        ) : (
          <>
            <Button variant="ghost" size="sm" onPress={() => setUniversity(null)} icon={(c) => <MaterialCommunityIcons name="arrow-left" size={16} color={c} />}>
              {tr("Назад", "Артқа")}
            </Button>
            <Text style={[styles.optionTitle, { color: colors.foreground }]}>{university.shortName || university.name}</Text>
            {loadingPrograms ? (
              <ActivityIndicator style={styles.pad} color={colors.foreground} />
            ) : !cycleSlug ? (
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>{tr("Приёмный цикл пока не найден", "Қабылдау циклі әлі табылмады")}</Text>
            ) : (programs ?? []).length === 0 ? (
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>{tr("Для этого вуза нет опубликованных специальностей", "Бұл ЖОО үшін жарияланған мамандықтар жоқ")}</Text>
            ) : (
              <ScrollView style={styles.list} nestedScrollEnabled>
                {(programs ?? []).map((row) => (
                  <Pressable
                    key={`${row.programId}-${row.profileVariant}-${row.quotaType}`}
                    accessibilityRole="button"
                    disabled={saving != null}
                    onPress={() => void save(row)}
                    style={[styles.option, styles.optionRow, { borderBottomColor: colors.border, opacity: saving && saving !== row.programId ? 0.5 : 1 }]}
                  >
                    <View style={styles.flex}>
                      <Text numberOfLines={2} style={[styles.optionTitle, { color: colors.foreground }]}>{row.programCode} {row.programName}</Text>
                      {row.profileSubjects ? <Text numberOfLines={1} style={[styles.small, { color: colors.mutedForeground }]}>{row.profileSubjects}</Text> : null}
                    </View>
                    {saving === row.programId ? <ActivityIndicator color={colors.foreground} /> : <Text style={[styles.optionTitle, { color: colors.foreground }]}>{row.minScore ?? "—"}</Text>}
                  </Pressable>
                ))}
              </ScrollView>
            )}
          </>
        )}
        {hasGoal ? (
          <Button variant="outline" disabled={removing} onPress={() => void remove()}>
            {tr("Снять цель", "Мақсатты алып тастау")}
          </Button>
        ) : null}
      </View>
    </Sheet>
  )
}

const styles = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  head: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: 8 },
  title: { flexDirection: "row", alignItems: "center", gap: 10, flexShrink: 1 },
  icon: { width: 32, height: 32, borderRadius: 8, alignItems: "center", justifyContent: "center" },
  h2: { fontSize: 16, fontFamily: fonts.sansSemi },
  gap: { gap: 14 },
  uni: { fontSize: 18, fontFamily: fonts.sansSemi },
  muted: { fontSize: 14, lineHeight: 20 },
  small: { fontSize: 12, lineHeight: 17 },
  text: { fontSize: 14, lineHeight: 20 },
  metrics: { flexDirection: "row", gap: 8 },
  metric: { flex: 1, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 8 },
  metricValue: { fontSize: 18, fontFamily: fonts.sansSemi, marginTop: 2 },
  row: { flexDirection: "row", gap: 8 },
  empty: { borderWidth: 1, borderStyle: "dashed", borderRadius: 10, padding: 14, gap: 12, alignItems: "flex-start" },
  barWrap: { paddingTop: 22 },
  bar: { height: 12, borderRadius: 6 },
  barFill: { position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6 },
  marker: { position: "absolute", top: -20, bottom: -4, width: 1.5 },
  markerLabel: { position: "absolute", top: -2, left: -34, minWidth: 68, textAlign: "center", fontSize: 10, fontFamily: fonts.sansSemi, borderRadius: 9, overflow: "hidden", paddingVertical: 2 },
  scale: { flexDirection: "row", justifyContent: "space-between", marginTop: 8 },
  pickerBody: { gap: 12, paddingTop: 12 },
  input: { minHeight: 44, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, fontSize: 15, fontFamily: fonts.sans },
  list: { maxHeight: 320 },
  option: { paddingVertical: 12, paddingHorizontal: 4, borderBottomWidth: StyleSheet.hairlineWidth, gap: 2 },
  optionRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  optionTitle: { fontSize: 14, fontFamily: fonts.sansSemi },
  flex: { flex: 1 },
  pad: { paddingVertical: 24 },
  centerText: { textAlign: "center", paddingVertical: 24, fontSize: 14 },
})
