import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useEffect, useMemo, useState } from "react"
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
  AdmissionHistoryPoint,
  University,
} from "@/lib/api/types"
import { admissionChance } from "@bilimland/shared"
import { ChanceBadge, grantsLabel, ruPlural } from "@/components/admission/chance"
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

/** Target university/specialty compared with the best full mock result. */
export function AdmissionGoalCard({
  currentScore,
  potentialScore = null,
  maxScore = 140,
}: {
  currentScore: number | null
  potentialScore?: number | null
  maxScore?: number
}) {
  const { colors, resolved } = useAppTheme()
  const tr = useTr()
  const palette = accentPalette(resolved)
  const tint = palette.emerald
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

  const required = goal?.requiredScore ?? null
  const gap = required != null && currentScore != null ? currentScore - required : null
  const chance =
    goal && required != null && currentScore != null
      ? admissionChance(currentScore, currentScore >= 50, required, goal.avgScore ?? null)
      : null
  const potentialGap = required != null && potentialScore != null ? potentialScore - required : null
  const year = goal?.admissionYear ?? null
  const statusTint = gap == null ? null : gap >= 0 ? palette.emerald : palette.rose

  const openCalculator = () => {
    if (!goal) return
    router.push({
      pathname: "/dashboard/admission",
      params: {
        ...(goal.profileSubjects ? { profileSubjects: goal.profileSubjects } : {}),
        programId: goal.programId,
        uni: String(goal.universityCode),
        quota: goal.quotaType,
        tab: "universities",
        ...(currentScore != null ? { total: String(currentScore) } : {}),
      },
    } as never)
  }

  return (
    <>
      <Card style={styles.body}>
        <View style={styles.head}>
          <View style={styles.title}>
            <View style={[styles.icon, { backgroundColor: tint.bg }]}>
              <MaterialCommunityIcons name="target" size={17} color={tint.fg} />
            </View>
            <Text style={[styles.h2, { color: colors.foreground }]}>{tr("Цель поступления", "Түсу мақсаты")}</Text>
          </View>
          {goal ? (
            <Button variant="ghost" size="sm" onPress={() => setOpen(true)}>
              {tr("Изменить", "Өзгерту")}
            </Button>
          ) : null}
        </View>

        {goal ? (
          <View style={styles.gap}>
            <View style={{ gap: 2 }}>
              <View style={styles.titleRow}>
                <Text numberOfLines={1} style={[styles.uni, { color: colors.foreground, flexShrink: 1 }]}>
                  {goal.universityShortName || goal.universityName}
                </Text>
                {chance ? <ChanceBadge level={chance} /> : null}
              </View>
              <Text numberOfLines={2} style={[styles.muted, { color: colors.mutedForeground }]}>
                {goal.programCode} · {goal.programName}
              </Text>
              <Text numberOfLines={1} style={[styles.small, { color: colors.mutedForeground }]}>
                {[
                  goal.profileSubjectsLabel ?? goal.profileSubjects,
                  goal.quotaType === "RURAL" ? tr("сельская квота", "ауыл квотасы") : tr("общий конкурс", "жалпы конкурс"),
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>

            <View style={[styles.status, { backgroundColor: statusTint ? statusTint.bg : colors.secondary }]}>
              <Text style={[styles.text, { color: statusTint ? statusTint.fg : colors.foreground }]}>
                {required == null
                  ? tr(
                      "По этой цели в последнем конкурсе грантов не было — выбери другую специальность или вуз.",
                      "Соңғы конкурста бұл мақсат бойынша грант болған жоқ — басқа мамандық не ЖОО таңдаңыз.",
                    )
                  : currentScore == null
                    ? tr(
                        `Нужно от ${required} баллов${year ? ` (проходной ${year} года)` : ""}. Пройди полный пробный ЕНТ — сравним твой результат с целью.`,
                        `${required} балдан бастап қажет${year ? ` (${year} жылғы өту балы)` : ""}. Толық ҰБТ сынағын тапсырыңыз — нәтижеңізді мақсатпен салыстырамыз.`,
                      )
                    : gap! > 0
                      ? tr(
                          `Твой лучший пробный ${currentScore} — на ${gap} ${ruPlural(gap!, "балл", "балла", "баллов")} выше проходного ${required}.`,
                          `Ең жақсы сынағыңыз ${currentScore} — өту балынан (${required}) ${gap} балға жоғары.`,
                        )
                      : gap === 0
                        ? tr(
                            `Твой лучший пробный ${currentScore} — ровно проходной балл. Это на грани: добери запас.`,
                            `Ең жақсы сынағыңыз ${currentScore} — дәл өту балы. Бұл шекарада: қор жинаңыз.`,
                          )
                        : tr(
                            `До проходного балла ${required} не хватает ${-gap!} ${ruPlural(-gap!, "балла", "баллов", "баллов")}. Твой лучший пробный — ${currentScore}.`,
                            `${required} өту балына ${-gap!} балл жетпейді. Ең жақсы сынағыңыз — ${currentScore}.`,
                          )}
              </Text>
              {potentialGap != null && gap != null && gap < 0 && potentialScore! > currentScore! ? (
                <Text style={[styles.small, { color: statusTint?.fg ?? colors.mutedForeground, marginTop: 4 }]}>
                  {potentialGap >= 0
                    ? tr(
                        `Если разобрать открытые ошибки, можно выйти на ${potentialScore} — это уже проходной.`,
                        `Ашық қателерді талдасаңыз, ${potentialScore} балға шығуға болады — бұл өту балы.`,
                      )
                    : tr(
                        `Разбор открытых ошибок даст до ${potentialScore} баллов.`,
                        `Ашық қателерді талдау ${potentialScore} балға дейін береді.`,
                      )}
                </Text>
              ) : null}
            </View>

            <ScoreBar current={currentScore} required={required} max={maxScore} label={tr("проходной", "өту балы")} />
            <View style={styles.metrics}>
              <Metric label={year ? tr(`Проходной ${year}`, `Өту балы ${year}`) : tr("Проходной", "Өту балы")} value={required == null ? "—" : String(required)} />
              <Metric label={tr("Средний балл", "Орташа балл")} value={goal.avgScore != null ? String(Math.round(goal.avgScore)) : "—"} />
              <Metric label={tr("Лучший пробный", "Ең жақсы сынақ")} value={currentScore == null ? "—" : String(currentScore)} />
            </View>

            {goal.history && goal.history.length > 0 ? <GoalHistory history={goal.history} grantCount={goal.grantCount ?? null} /> : null}

            <View style={styles.row}>
              <Button variant="outline" size="sm" onPress={openCalculator}>
                {tr("Все вузы по специальности", "Мамандық бойынша барлық ЖОО")}
              </Button>
              {gap != null && gap < 0 ? (
                <Button variant="ghost" size="sm" onPress={() => router.push("/dashboard/mistakes" as never)}>
                  {tr("Работать над ошибками", "Қателермен жұмыс")}
                </Button>
              ) : null}
            </View>
            <Text style={[styles.small, { color: colors.mutedForeground }]}>
              {tr(
                "Проходной балл — самый низкий балл, с которым дали грант (официальный список МНВО). Каждый год он меняется на несколько баллов — это ориентир, не гарантия.",
                "Өту балы — грант берілген ең төменгі балл (ҒЖБМ ресми тізімі). Ол жыл сайын бірнеше балға өзгереді — бұл кепілдік емес, бағдар.",
              )}
            </Text>
          </View>
        ) : (
          <View style={[styles.empty, { borderColor: colors.border }]}>
            <Text style={[styles.text, { color: colors.foreground, fontFamily: fonts.sansSemi }]}>
              {tr("Куда хочешь поступить?", "Қайда түскіңіз келеді?")}
            </Text>
            <Text style={[styles.muted, { color: colors.mutedForeground }]}>
              {tr(
                "Выбери вуз и специальность — покажем проходной балл на грант за последние годы и сколько тебе не хватает по результатам пробных.",
                "ЖОО мен мамандықты таңдаңыз — соңғы жылдардағы грантқа өту балын және сынақ нәтижелері бойынша қанша жетпейтінін көрсетеміз.",
              )}
            </Text>
            <Button size="sm" onPress={() => setOpen(true)}>
              {tr("Выбрать цель", "Мақсатты таңдау")}
            </Button>
          </View>
        )}
      </Card>
      <GoalPicker open={open} onClose={() => setOpen(false)} hasGoal={!!goal} initialQuota={goal?.quotaType ?? "GRANT"} onChanged={() => mutate()} />
    </>
  )
}

function GoalHistory({ history, grantCount }: { history: AdmissionHistoryPoint[]; grantCount: number | null }) {
  const { colors, resolved } = useAppTheme()
  const tr = useTr()
  const tint = accentPalette(resolved).emerald
  const scores = history.map((h) => h.minScore)
  const lo = Math.min(...scores)
  const hi = Math.max(...scores)
  return (
    <View style={{ gap: 8 }}>
      <View style={styles.historyHead}>
        <Text style={[styles.small, { color: colors.mutedForeground }]}>{tr("Проходной по годам", "Жылдар бойынша өту балы")}</Text>
        {grantCount ? (
          <Text style={[styles.small, { color: colors.mutedForeground }]}>
            {tr("в последнем конкурсе", "соңғы конкурста")}: {grantsLabel(grantCount, tr)}
          </Text>
        ) : null}
      </View>
      <View style={styles.historyRow}>
        {history.map((h, i) => {
          const last = i === history.length - 1
          const heightPct = hi === lo ? 70 : 35 + ((h.minScore - lo) / (hi - lo)) * 65
          return (
            <View key={h.cycleSlug} style={styles.historyCol}>
              <Text style={[styles.small, { color: last ? colors.foreground : colors.mutedForeground, fontFamily: last ? fonts.sansSemi : fonts.sans }]}>
                {h.minScore}
              </Text>
              <View style={styles.historyTrack}>
                <View style={{ height: `${heightPct}%`, borderRadius: 3, backgroundColor: last ? tint.fg : colors.border }} />
              </View>
              <Text style={{ fontSize: 10, color: colors.mutedForeground }}>{h.admissionYear ?? h.cycleSlug}</Text>
            </View>
          )
        })}
      </View>
    </View>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  const { colors } = useAppTheme()
  return (
    <View style={[styles.metric, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text numberOfLines={1} style={[styles.small, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  )
}

function ScoreBar({ current, required, max, label }: { current: number | null; required: number | null; max: number; label: string }) {
  const { colors, resolved } = useAppTheme()
  const tint = accentPalette(resolved).emerald
  const reached = current != null && required != null && current >= required
  return (
    <View style={styles.barWrap}>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max, now: current ?? 0 }}
        style={[styles.bar, { backgroundColor: colors.secondary }]}
      >
        <View style={[styles.barFill, { width: `${scorePct(current, max)}%`, backgroundColor: reached ? tint.fg : colors.foreground }]} />
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

/** Cutoff for a quota: a rural applicant competes in both pools, so the lower one counts. */
function displayedCutoff(rows: AdmissionCutoffRow[], quota: "GRANT" | "RURAL") {
  const grant = rows.find((r) => r.quotaType === "GRANT" && r.minScore != null)
  const rural = rows.find((r) => r.quotaType === "RURAL" && r.minScore != null)
  if (quota === "GRANT") return grant ?? null
  if (rural && (!grant || rural.minScore! <= grant.minScore!)) return rural
  return grant ?? null
}

function GoalPicker({
  open,
  onClose,
  hasGoal,
  initialQuota,
  onChanged,
}: {
  open: boolean
  onClose: () => void
  hasGoal: boolean
  initialQuota: "GRANT" | "RURAL"
  onChanged: () => Promise<unknown>
}) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const [university, setUniversity] = useState<University | null>(null)
  const [search, setSearch] = useState("")
  const [programSearch, setProgramSearch] = useState("")
  const [quota, setQuota] = useState<"GRANT" | "RURAL">(initialQuota)
  useEffect(() => {
    if (open) setQuota(initialQuota)
  }, [open, initialQuota])
  const [saving, setSaving] = useState<string | null>(null)
  const [removing, setRemoving] = useState(false)
  const { data: cycles } = useSWR<AdmissionCycle[]>(open ? "/admission/cycles" : null)
  const cycleSlug = useMemo(() => pickLatestCycle(cycles)?.slug, [cycles])
  const { data: universities, isLoading: loadingUnis } = useSWR<University[]>(
    open && cycleSlug ? `/admission/universities?cycleSlug=${encodeURIComponent(cycleSlug)}` : null,
  )
  const { data: cutoffRows, isLoading: loadingPrograms } = useSWR<AdmissionCutoffRow[]>(
    open && university && cycleSlug ? `/admission/cutoffs:${cycleSlug}:${university.code}:all` : null,
    () => api<AdmissionCutoffRow[]>("/admission/cutoffs", { query: { cycleSlug, universityCode: university?.code } }),
  )
  // one row per program variant with the cutoff for the chosen quota
  const programs = useMemo(() => {
    const byProgram = new Map<string, AdmissionCutoffRow[]>()
    for (const row of cutoffRows ?? []) {
      const list = byProgram.get(row.programId) ?? []
      list.push(row)
      byProgram.set(row.programId, list)
    }
    const q = programSearch.trim().toLowerCase()
    return [...byProgram.values()]
      .map((rows) => ({ base: rows[0], cutoff: displayedCutoff(rows, quota) }))
      .filter((p) => p.cutoff != null)
      .filter(
        (p) =>
          !q ||
          p.base.programName.toLowerCase().includes(q) ||
          p.base.programCode.toLowerCase().includes(q),
      )
      .sort((a, b) => a.base.programCode.localeCompare(b.base.programCode) || a.base.profileVariant - b.base.profileVariant)
  }, [cutoffRows, programSearch, quota])
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    const items = universities ?? []
    if (!q) return items
    return items.filter(
      (u) => u.name.toLowerCase().includes(q) || (u.shortName ?? "").toLowerCase().includes(q) || String(u.code) === q,
    )
  }, [search, universities])

  const close = () => {
    setUniversity(null)
    setSearch("")
    setProgramSearch("")
    onClose()
  }
  const fail = (e: unknown, fallback: string) =>
    Alert.alert(tr("Ошибка", "Қате"), e instanceof ApiError && e.message ? e.message : fallback)

  async function save(row: AdmissionCutoffRow) {
    if (!university || !cycleSlug) return
    setSaving(row.programId)
    try {
      await api("/admission/goal", {
        method: "PUT",
        body: { universityCode: university.code, programId: row.programId, cycleSlug, quotaType: quota },
      })
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
        <View style={[styles.quotaBar, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
          {(["GRANT", "RURAL"] as const).map((q) => (
            <Pressable
              key={q}
              onPress={() => setQuota(q)}
              style={[styles.quotaBtn, quota === q && { backgroundColor: colors.foreground }]}
              accessibilityRole="button"
              accessibilityState={{ selected: quota === q }}
            >
              <Text style={{ fontSize: 12, fontFamily: fonts.sansSemi, color: quota === q ? colors.background : colors.foreground }}>
                {q === "GRANT" ? tr("Общий конкурс", "Жалпы конкурс") : tr("Сельская квота", "Ауыл квотасы")}
              </Text>
            </Pressable>
          ))}
        </View>
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
            <TextInput
              value={programSearch}
              onChangeText={setProgramSearch}
              placeholder={tr("Поиск специальности или кода (B057)", "Мамандықты не кодты іздеу (B057)")}
              placeholderTextColor={colors.mutedForeground}
              style={[styles.input, { borderColor: colors.border, color: colors.foreground, backgroundColor: colors.background }]}
            />
            {loadingPrograms ? (
              <ActivityIndicator style={styles.pad} color={colors.foreground} />
            ) : !cycleSlug ? (
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>{tr("Приёмный цикл пока не найден", "Қабылдау циклі әлі табылмады")}</Text>
            ) : programs.length === 0 ? (
              <Text style={[styles.centerText, { color: colors.mutedForeground }]}>{tr("Для этого вуза нет опубликованных специальностей", "Бұл ЖОО үшін жарияланған мамандықтар жоқ")}</Text>
            ) : (
              <ScrollView style={styles.list} nestedScrollEnabled>
                {programs.map(({ base: row, cutoff }) => (
                  <Pressable
                    key={row.programId}
                    accessibilityRole="button"
                    disabled={saving != null}
                    onPress={() => void save(row)}
                    style={[styles.option, styles.optionRow, { borderBottomColor: colors.border, opacity: saving && saving !== row.programId ? 0.5 : 1 }]}
                  >
                    <View style={styles.flex}>
                      <Text numberOfLines={2} style={[styles.optionTitle, { color: colors.foreground }]}>{row.programCode} {row.programName}</Text>
                      <Text numberOfLines={1} style={[styles.small, { color: colors.mutedForeground }]}>
                        {[row.profileSubjectsLabel ?? row.profileSubjects, cutoff?.grantCount ? grantsLabel(cutoff.grantCount, tr) : null]
                          .filter(Boolean)
                          .join(" · ")}
                      </Text>
                    </View>
                    {saving === row.programId ? (
                      <ActivityIndicator color={colors.foreground} />
                    ) : (
                      <Text style={[styles.optionTitle, { color: colors.foreground }]}>
                        {tr("от", "бастап")} {cutoff?.minScore ?? "—"}
                      </Text>
                    )}
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
  titleRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  status: { borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10 },
  historyHead: { flexDirection: "row", justifyContent: "space-between", gap: 8, flexWrap: "wrap" },
  historyRow: { flexDirection: "row", gap: 8, alignItems: "flex-end" },
  historyCol: { flex: 1, alignItems: "center", gap: 4 },
  historyTrack: { height: 40, width: "100%", justifyContent: "flex-end" },
  quotaBar: { flexDirection: "row", borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, padding: 3, gap: 3 },
  quotaBtn: { flex: 1, alignItems: "center", paddingVertical: 8, borderRadius: 8 },
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
  row: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
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
