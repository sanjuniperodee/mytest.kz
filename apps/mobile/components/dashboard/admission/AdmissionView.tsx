import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useLocalSearchParams } from "expo-router"
import useSWR from "swr"
import { useEffect, useMemo, useState } from "react"
import {
  FlatList,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  useWindowDimensions,
  View,
} from "react-native"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import type {
  AdmissionCycle,
  ChanceProgram,
  ChanceUniversity,
} from "@/lib/api/types"
import { useAppTheme } from "@/lib/theme/provider"
import type { ThemeColors } from "@/lib/theme/colors"
import { fonts } from "@/lib/theme/fonts"
import { t, useUiLocale } from "@/lib/i18n/ui"
import { useTr } from "@/lib/i18n/use-tr"
import { accentPalette } from "@/lib/theme/accents"
import { ENT_MAX, ENT_TOTAL_MAX, totalEntScore } from "@bilimland/shared"
import { ChanceBadge, ChanceLegend, CutoffTrend, grantsLabel } from "@/components/admission/chance"

type QuotaType = "GRANT" | "RURAL"
type Tab = "programs" | "universities"
type Step = 1 | 2

interface ProfileSubjectOption {
  value: string
  label: string
}

interface Scores {
  mathLit: number
  readingLit: number
  history: number
  profile1: number
  profile2: number
}

const SCORE_FIELD_DEFS: {
  key: keyof Scores
  labelKey: string
  short: string
  max: number
}[] = [
  { key: "mathLit", labelKey: "admScoreMathLit", short: "МатГр", max: ENT_MAX.mathLit },
  { key: "readingLit", labelKey: "admScoreReadingLit", short: "ЧитГр", max: ENT_MAX.readingLit },
  { key: "history", labelKey: "admScoreHistory", short: "ИстКЗ", max: ENT_MAX.history },
  { key: "profile1", labelKey: "admScoreProf1", short: "Проф 1", max: ENT_MAX.profile1 },
  { key: "profile2", labelKey: "admScoreProf2", short: "Проф 2", max: ENT_MAX.profile2 },
]

const LG = 1024
const MONO = Platform.select({ ios: "Menlo", android: "monospace", default: "monospace" })

/** "Математика - Физика" -> ["Математика", "Физика"]; creative exams get numbered. */
function profileSubjectNames(label: string): [string, string] | null {
  const parts = label.split(/\s+-\s+/).map((p) => p.trim()).filter(Boolean)
  if (parts.length !== 2) return null
  if (parts[0] === parts[1]) return [`${parts[0]} 1`, `${parts[1]} 2`]
  return [parts[0], parts[1]]
}

function firstParam(v: string | string[] | undefined) {
  return Array.isArray(v) ? v[0] : v
}

export function AdmissionView() {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { width } = useWindowDimensions()
  const isWide = width >= LG

  const [cycleSlug, setCycleSlug] = useState("")
  const [quotaType, setQuotaType] = useState<QuotaType>("GRANT")
  const [profileSubjects, setProfileSubjects] = useState("")
  const [step, setStep] = useState<Step>(1)
  const [scores, setScores] = useState<Scores>({
    mathLit: 8,
    readingLit: 8,
    history: 15,
    profile1: 35,
    profile2: 35,
  })
  const [tab, setTab] = useState<Tab>("programs")
  const [search, setSearch] = useState("")
  const [programId, setProgramId] = useState("")
  const [highlightUniversity, setHighlightUniversity] = useState<number | null>(null)
  const tr = useTr()

  // Deep link from the dashboard goal: ?profileSubjects&programId&uni&quota&tab&total
  const params = useLocalSearchParams<{
    profileSubjects?: string
    programId?: string
    uni?: string
    quota?: string
    tab?: string
    total?: string
  }>()
  useEffect(() => {
    const subjects = firstParam(params.profileSubjects)
    if (subjects) {
      setProfileSubjects(subjects)
      setStep(2)
    }
    const program = firstParam(params.programId)
    if (program) setProgramId(program)
    if (firstParam(params.quota) === "RURAL") setQuotaType("RURAL")
    if (firstParam(params.tab) === "universities") setTab("universities")
    const uni = Number(firstParam(params.uni))
    if (Number.isFinite(uni) && uni > 0) setHighlightUniversity(uni)
    const known = Number(firstParam(params.total))
    if (Number.isFinite(known) && known > 0) {
      const target = Math.min(ENT_TOTAL_MAX, Math.round(known))
      const ratio = target / ENT_TOTAL_MAX
      const next: Scores = {
        mathLit: Math.round(ENT_MAX.mathLit * ratio),
        readingLit: Math.round(ENT_MAX.readingLit * ratio),
        history: Math.round(ENT_MAX.history * ratio),
        profile1: Math.round(ENT_MAX.profile1 * ratio),
        profile2: 0,
      }
      next.profile2 = Math.max(
        0,
        Math.min(ENT_MAX.profile2, target - next.mathLit - next.readingLit - next.history - next.profile1),
      )
      setScores(next)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.profileSubjects, params.programId, params.uni, params.quota, params.tab, params.total])

  const scoreFields = useMemo(
    () =>
      SCORE_FIELD_DEFS.map((row) => ({
        ...row,
        label: t(row.labelKey, ui),
      })),
    [ui],
  )

  const total = totalEntScore(scores)

  const { data: cycles } = useSWR<AdmissionCycle[]>("/admission/cycles")
  const cycleYear = cycles?.find((c) => c.slug === cycleSlug)?.admissionYear ?? null
  useEffect(() => {
    if (!cycleSlug && cycles && cycles.length > 0) {
      const sorted = [...cycles].sort((a, b) => b.sortOrder - a.sortOrder)
      setCycleSlug(sorted[0].slug)
    }
  }, [cycles, cycleSlug])

  const profileOptionsKey =
    cycleSlug && quotaType
      ? `/admission/chance/profile-subjects?cycleSlug=${encodeURIComponent(
          cycleSlug,
        )}&quotaType=${quotaType}`
      : null
  const { data: profileOpts, isLoading: profileLoading } = useSWR<ProfileSubjectOption[]>(
    profileOptionsKey,
  )

  const chanceQuery = useMemo(() => {
    if (!cycleSlug || !profileSubjects) return null
    const params = new URLSearchParams({
      cycleSlug,
      quotaType,
      profileSubjects,
      mathLit: String(scores.mathLit),
      readingLit: String(scores.readingLit),
      history: String(scores.history),
      profile1: String(scores.profile1),
      profile2: String(scores.profile2),
    })
    return params.toString()
  }, [cycleSlug, quotaType, profileSubjects, scores])

  const programsKey = chanceQuery ? `/admission/chance/programs?${chanceQuery}` : null
  const { data: programs, isLoading: progLoading } = useSWR<ChanceProgram[]>(programsKey, {
    keepPreviousData: true,
  })

  // server order = best chance first; the search box filters programs on this tab only
  const filteredPrograms = useMemo(() => {
    if (!programs) return []
    const q = search.trim().toLowerCase()
    if (!q || tab !== "programs") return programs
    return programs.filter(
      (p) => p.programName.toLowerCase().includes(q) || p.programCode.toLowerCase().includes(q),
    )
  }, [programs, search, tab])

  const subjectsLabel = profileOpts?.find((o) => o.value === profileSubjects)?.label ?? profileSubjects
  const subjectNames = profileSubjectNames(subjectsLabel)

  const openProgram = (id: string) => {
    setProgramId(id)
    setSearch("")
    setTab("universities")
  }

  const hero = (
    <View style={{ marginBottom: 16 }}>
      <Badge variant="outline" style={{ marginBottom: 10, backgroundColor: colors.secondary }}>
        <Text style={{ fontSize: 11, fontWeight: "600", color: colors.foreground }}>
          {t("admBadge2026", ui)}
        </Text>
      </Badge>
      <Text style={[styles.heroTitle, { color: colors.foreground }]}>
        {t("admHeroTitle", ui)}
      </Text>
      <Text style={[styles.heroLead, { color: colors.mutedForeground }]}>
        {t("admHeroLead", ui)}
      </Text>
    </View>
  )

  const formCard = (
    <Card>
      <View style={styles.formHead}>
        <MaterialCommunityIcons name="calculator-variant" size={18} color={colors.foreground} />
        <Text style={[styles.formTitle, { color: colors.foreground }]}>{t("admParams", ui)}</Text>
      </View>

      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("admCycle", ui)}</Text>
      <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        {(cycles || [])
          .slice()
          .sort((a, b) => b.sortOrder - a.sortOrder)
          .map((c) => (
            <Pressable key={c.id} onPress={() => setCycleSlug(c.slug)} style={chipStyle(cycleSlug === c.slug, colors)}>
              <Text style={chipText(cycleSlug === c.slug, colors)}>{c.admissionYear ?? c.slug}</Text>
            </Pressable>
          ))}
      </View>

      <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 14 }]}>{t("admQuotaType", ui)}</Text>
      <View style={[styles.quotaBar, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
        {(["GRANT", "RURAL"] as const).map((q) => (
          <Pressable
            key={q}
            onPress={() => setQuotaType(q)}
            style={{
              flex: 1,
              paddingVertical: 10,
              borderRadius: 8,
              alignItems: "center",
              backgroundColor: quotaType === q ? colors.foreground : "transparent",
            }}
          >
            <Text
              style={{
                fontFamily: fonts.sansSemi,
                fontSize: 13,
                color: quotaType === q ? colors.background : colors.foreground,
              }}
            >
              {q === "GRANT" ? t("admQuotaGrant", ui) : t("admQuotaRural", ui)}
            </Text>
          </Pressable>
        ))}
      </View>
      <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 6 }]}>
        {quotaType === "RURAL"
          ? tr(
              "Для выпускников сельских школ. Ты участвуешь и в общем конкурсе, поэтому показываем меньший из двух проходных баллов.",
              "Ауыл мектептерінің түлектері үшін. Жалпы конкурсқа да қатысасыз, сондықтан екі өту балының төменін көрсетеміз.",
            )
          : tr(
              "Общий конкурс — для всех. Если ты окончил сельскую школу, выбери «Сельская»: шансы обычно выше.",
              "Жалпы конкурс — барлығына. Ауыл мектебін бітірсеңіз, «Ауыл» таңдаңыз: мүмкіндік әдетте жоғары.",
            )}
      </Text>

      <View style={{ marginTop: 16 }}>
        <View style={styles.stepRow}>
          <View style={[styles.stepNum, { backgroundColor: colors.foreground }]}>
            <Text style={[styles.stepNumTxt, { color: colors.background }]}>1</Text>
          </View>
          <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>{t("admProfileSubjects", ui)}</Text>
        </View>
        <Text style={[styles.hint, { color: colors.mutedForeground }]}>
          {t("admProfileHint", ui)}
        </Text>
        {profileLoading ? (
          <Spinner />
        ) : (
          <View style={{ gap: 8, marginTop: 8 }}>
            {(profileOpts || []).map((o) => (
              <Pressable
                key={o.value}
                onPress={() => {
                  setProfileSubjects(o.value)
                  setProgramId("")
                  setStep(2)
                }}
                style={[
                  styles.selectOpt,
                  {
                    borderColor: profileSubjects === o.value ? colors.foreground : colors.border,
                    backgroundColor: profileSubjects === o.value ? colors.secondary : colors.card,
                  },
                ]}
              >
                <Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{o.label}</Text>
              </Pressable>
            ))}
          </View>
        )}
      </View>

      {step === 2 ? (
        <View style={[styles.step2, { borderTopColor: colors.border }]}>
          <View style={styles.stepRow}>
            <View style={[styles.stepNum, { backgroundColor: colors.foreground }]}>
              <Text style={[styles.stepNumTxt, { color: colors.background }]}>2</Text>
            </View>
            <Text style={[styles.fieldLabel, { marginBottom: 0 }]}>{t("admEntScores", ui)}</Text>
            <Pressable style={{ marginLeft: "auto" }} onPress={() => setStep(1)}>
              <Text style={{ color: colors.mutedForeground, fontSize: 12, fontFamily: fonts.sansSemi }}>
                {t("admEdit", ui)}
              </Text>
            </Pressable>
          </View>
          <View style={styles.scoreMeta}>
            <Text style={[styles.hint, { color: colors.mutedForeground, flex: 1 }]}>
              {t("admSelectedPrefix", ui)}
              {subjectsLabel}
            </Text>
            <View
              style={[
                styles.totalPill,
                {
                  backgroundColor:
                    total >= 100 ? "#D1FAE5" : total >= 70 ? "#FEF3C7" : colors.secondary,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontFamily: fonts.sansSemi,
                  color: total >= 100 ? "#065F46" : total >= 70 ? "#92400E" : colors.mutedForeground,
                }}
              >
                {total}/{ENT_TOTAL_MAX}
              </Text>
            </View>
          </View>
          <View style={styles.scoreGrid}>
            {scoreFields.map((field) => (
              <View key={field.key} style={{ gap: 6 }}>
                <Text style={[styles.inputLbl, { color: colors.mutedForeground }]}>
                  {field.key === "profile1" && subjectNames
                    ? subjectNames[0]
                    : field.key === "profile2" && subjectNames
                      ? subjectNames[1]
                      : field.short}{" "}
                  ({field.max})
                </Text>
                <TextInput
                  keyboardType="number-pad"
                  value={String(scores[field.key])}
                  onChangeText={(raw) => {
                    const n = Number(raw.replace(/\D/g, ""))
                    if (!Number.isFinite(n)) return
                    setScores((s) => ({
                      ...s,
                      [field.key]: Math.min(field.max, Math.max(0, n)),
                    }))
                  }}
                  style={[styles.input, { borderColor: colors.border, color: colors.foreground }]}
                />
              </View>
            ))}
          </View>
        </View>
      ) : (
        <View
          style={[
            styles.sparkleBox,
            { borderColor: colors.border, backgroundColor: `${colors.secondary}66` },
          ]}
        >
          <MaterialCommunityIcons name="star-four-points-small" size={16} color={colors.accent} />
          <Text style={[styles.hint, { color: colors.mutedForeground, flex: 1 }]}>
            {t("admStep1Box", ui)}
          </Text>
        </View>
      )}
    </Card>
  )

  const results = (
    <View style={{ flex: 1, gap: 12 }}>
      <View style={[styles.resultsToolbar, !isWide && styles.resultsToolbarCol]}>
        <View style={[styles.tabBar, { borderColor: colors.border, backgroundColor: colors.card }]}>
          <Pressable
            onPress={() => {
              setTab("programs")
              setSearch("")
            }}
            style={[
              styles.tabBtn,
              tab === "programs" && { backgroundColor: colors.foreground },
            ]}
          >
            <MaterialCommunityIcons
              name="school"
              size={18}
              color={tab === "programs" ? colors.background : colors.foreground}
            />
            <Text
              style={{
                marginLeft: 6,
                fontFamily: fonts.sansSemi,
                fontSize: 13,
                color: tab === "programs" ? colors.background : colors.foreground,
              }}
            >
              {t("admProgramsTab", ui)}
            </Text>
          </Pressable>
          <Pressable
            onPress={() => {
              setTab("universities")
              setSearch("")
            }}
            style={[
              styles.tabBtn,
              tab === "universities" && { backgroundColor: colors.foreground },
            ]}
          >
            <MaterialCommunityIcons
              name="office-building"
              size={18}
              color={tab === "universities" ? colors.background : colors.foreground}
            />
            <Text
              style={{
                marginLeft: 6,
                fontFamily: fonts.sansSemi,
                fontSize: 13,
                color: tab === "universities" ? colors.background : colors.foreground,
              }}
            >
              {t("admUnisTab", ui)}
            </Text>
          </Pressable>
        </View>

        <View style={[styles.searchWrap, { borderColor: colors.border }]}>
          <MaterialCommunityIcons name="magnify" size={18} color={colors.mutedForeground} />
          <TextInput
            placeholder={
              tab === "programs" ? tr("Поиск специальности…", "Мамандықты іздеу…") : tr("Поиск вуза…", "ЖОО іздеу…")
            }
            placeholderTextColor={colors.mutedForeground}
            value={search}
            onChangeText={setSearch}
            style={[styles.searchInput, { color: colors.foreground }]}
          />
        </View>
      </View>

      {step === 1 ? (
        <Card>
          <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
            {t("admEmptyStep1", ui)}
          </Text>
        </Card>
      ) : tab === "programs" ? (
        <ProgramsPanel
          loading={progLoading && !programs}
          programs={filteredPrograms}
          total={total}
          hasParams={Boolean(programsKey)}
          cycleYear={cycleYear}
          onOpen={openProgram}
          colors={colors}
        />
      ) : (
        <UniversitiesPanel
          cycleSlug={cycleSlug}
          cycleYear={cycleYear}
          quotaType={quotaType}
          scores={scores}
          total={total}
          search={search}
          programs={programs ?? []}
          programsLoading={progLoading && !programs}
          programId={programId}
          onProgramChange={setProgramId}
          onBack={() => setTab("programs")}
          highlightUniversity={highlightUniversity}
          colors={colors}
        />
      )}
    </View>
  )

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: colors.secondary }]}>
      {hero}
      {isWide ? (
        <View style={{ flexDirection: "row", gap: 20, alignItems: "flex-start" }}>
          <View style={{ width: 380, flexShrink: 0 }}>{formCard}</View>
          <View style={{ flex: 1, minWidth: 0 }}>{results}</View>
        </View>
      ) : (
        <View style={{ gap: 16 }}>
          {formCard}
          {results}
        </View>
      )}
    </ScrollView>
  )
}

function ResultsSummary({ total, cycleYear, title }: { total: number; cycleYear: number | null; title: string }) {
  const { colors } = useAppTheme()
  const tr = useTr()
  const [showLegend, setShowLegend] = useState(false)
  return (
    <Card style={{ paddingVertical: 12, gap: 8 }}>
      <View style={{ flexDirection: "row", gap: 8, alignItems: "flex-start" }}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.passTitle, { color: colors.foreground }]}>{title}</Text>
          <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 4 }]}>
            {tr("Твой балл", "Сіздің балыңыз")}:{" "}
            <Text style={{ fontFamily: fonts.sansSemi, color: colors.foreground }}>{total}</Text>
            {" · "}
            {cycleYear
              ? tr(`проходные баллы конкурса ${cycleYear} года`, `${cycleYear} жылғы конкурстың өту балдары`)
              : tr("проходные баллы прошлых лет", "өткен жылдардың өту балдары")}
          </Text>
        </View>
        <Pressable onPress={() => setShowLegend((v) => !v)} hitSlop={8} accessibilityRole="button">
          <MaterialCommunityIcons name="information-outline" size={20} color={colors.mutedForeground} />
        </Pressable>
      </View>
      {showLegend ? (
        <View style={{ borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border, paddingTop: 10 }}>
          <ChanceLegend />
        </View>
      ) : null}
    </Card>
  )
}

function ProgramsPanel({
  loading,
  programs,
  total,
  hasParams,
  cycleYear,
  onOpen,
  colors,
}: {
  loading: boolean
  programs: ChanceProgram[]
  total: number
  hasParams: boolean
  cycleYear: number | null
  onOpen: (programId: string) => void
  colors: ThemeColors
}) {
  const { locale: ui } = useUiLocale()
  const tr = useTr()
  if (!hasParams) {
    return (
      <Card>
        <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
          {t("admEmptyParams", ui)}
        </Text>
      </Card>
    )
  }
  if (loading) {
    return (
      <View style={{ gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={i} style={[styles.skelLine, { backgroundColor: colors.secondary }]} />
        ))}
      </View>
    )
  }
  if (programs.length === 0) {
    return (
      <Card>
        <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
          {t("admEmptyNoPrograms", ui)}
        </Text>
      </Card>
    )
  }

  const reachable = programs.filter((p) => (p.passingUniversityCount ?? (p.isPass ? 1 : 0)) > 0).length

  return (
    <View style={{ gap: 12 }}>
      <ResultsSummary
        total={total}
        cycleYear={cycleYear}
        title={tr(
          `Проходишь хотя бы в один вуз по ${reachable} из ${programs.length} специальностей`,
          `${programs.length} мамандықтың ${reachable}-і бойынша кем дегенде бір ЖОО-ға өтесіз`,
        )}
      />
      {programs.map((p) => (
        <ProgramRow key={`${p.programId}-${p.profileSubjects}`} program={p} colors={colors} onOpen={onOpen} />
      ))}
    </View>
  )
}

function ProgramRow({
  program: p,
  colors,
  onOpen,
}: {
  program: ChanceProgram
  colors: ThemeColors
  onOpen: (programId: string) => void
}) {
  const tr = useTr()
  const passing = p.passingUniversityCount ?? (p.isPass ? 1 : 0)
  const min = p.displayedMinScore
  const max = p.maxDisplayedMinScore ?? min
  return (
    <Pressable accessibilityRole="button" onPress={() => onOpen(p.programId)}>
      {({ pressed }) => (
        <Card style={{ opacity: pressed ? 0.85 : 1 }}>
          <View style={{ flexDirection: "row", gap: 10, alignItems: "center" }}>
            <View style={{ flex: 1, minWidth: 0, gap: 6 }}>
              <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
                <Badge variant="outline">
                  <Text style={{ fontSize: 11, fontFamily: MONO }}>{p.programCode}</Text>
                </Badge>
                <Text style={[styles.progName, { color: colors.foreground }]}>{p.programName}</Text>
              </View>
              {p.chance ? <ChanceBadge level={p.chance} passesEntThresholds={p.passesEntThresholds} /> : null}
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                <Text style={{ fontFamily: fonts.sansSemi, color: passing > 0 ? colors.foreground : colors.mutedForeground }}>
                  {tr(
                    `Проходишь в ${passing} из ${p.universityCount} вузов`,
                    `${p.universityCount} ЖОО-ның ${passing}-іне өтесіз`,
                  )}
                </Text>
                {" · "}
                {tr("проходной", "өту балы")} {min != null && max != null && max !== min ? `${min}–${max}` : (min ?? "—")}
                {p.totalGrantCount ? ` · ${grantsLabel(p.totalGrantCount, tr)}` : ""}
              </Text>
            </View>
            <MaterialCommunityIcons name="chevron-right" size={22} color={colors.mutedForeground} />
          </View>
        </Card>
      )}
    </Pressable>
  )
}

function ProgramPickerModal({
  visible,
  programs,
  selectedId,
  onSelect,
  onClose,
  colors,
}: {
  visible: boolean
  programs: { id: string; code: string; name: string }[]
  selectedId: string
  onSelect: (id: string) => void
  onClose: () => void
  colors: ThemeColors
}) {
  const { locale: ui } = useUiLocale()
  const mono = Platform.select({
    ios: "Menlo",
    android: "monospace",
    default: "monospace",
  })
  return (
    <Modal visible={visible} transparent animationType="slide">
      <View style={styles.progModalWrap}>
        <Pressable style={StyleSheet.absoluteFillObject} onPress={onClose} />
        <View
          style={[
            styles.progModalSheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.progModalTitle, { color: colors.foreground }]}>{t("admSpecialty", ui)}</Text>
          <FlatList
            data={programs}
            keyExtractor={(item) => item.id}
            style={{ maxHeight: 420 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const sel = item.id === selectedId
              return (
                <Pressable
                  onPress={() => {
                    onSelect(item.id)
                    onClose()
                  }}
                  style={[
                    styles.progModalRow,
                    {
                      borderBottomColor: colors.border,
                      backgroundColor: sel ? colors.secondary : "transparent",
                    },
                  ]}
                >
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={{ fontSize: 11, fontFamily: mono, color: colors.mutedForeground }}>
                      {item.code}
                    </Text>
                    <Text
                      style={[styles.progModalRowName, { color: colors.foreground }]}
                      numberOfLines={3}
                    >
                      {item.name}
                    </Text>
                  </View>
                  {sel ? (
                    <MaterialCommunityIcons name="check" size={22} color={colors.foreground} />
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

function UniversitiesPanel({
  cycleSlug,
  cycleYear,
  quotaType,
  scores,
  total,
  search,
  programs,
  programsLoading,
  programId,
  onProgramChange,
  onBack,
  highlightUniversity,
  colors,
}: {
  cycleSlug: string
  cycleYear: number | null
  quotaType: QuotaType
  scores: Scores
  total: number
  search: string
  programs: ChanceProgram[]
  programsLoading: boolean
  programId: string
  onProgramChange: (programId: string) => void
  onBack: () => void
  highlightUniversity: number | null
  colors: ThemeColors
}) {
  const { locale: ui } = useUiLocale()
  const tr = useTr()
  const [programPickerOpen, setProgramPickerOpen] = useState(false)

  // Only the programs reachable with the chosen profile subjects (from /chance/programs).
  useEffect(() => {
    if (programsLoading || programs.length === 0) return
    if (!programId || !programs.some((p) => p.programId === programId)) onProgramChange(programs[0].programId)
  }, [programs, programId, programsLoading, onProgramChange])

  const pickerItems = useMemo(
    () => programs.map((p) => ({ id: p.programId, code: p.programCode, name: p.programName })),
    [programs],
  )
  const selectedProgram = programs.find((p) => p.programId === programId)

  const uniKey =
    cycleSlug && programId
      ? `/admission/chance/universities?${new URLSearchParams({
          cycleSlug,
          quotaType,
          programId,
          mathLit: String(scores.mathLit),
          readingLit: String(scores.readingLit),
          history: String(scores.history),
          profile1: String(scores.profile1),
          profile2: String(scores.profile2),
        }).toString()}`
      : null

  const { data: unis, isLoading: uniLoading } = useSWR<ChanceUniversity[]>(uniKey, { keepPreviousData: true })

  // server order (best chance first); the goal university is pinned on top; search filters universities
  const shownUnis = useMemo(() => {
    if (!unis) return []
    const q = search.trim().toLowerCase()
    if (q) {
      return unis.filter(
        (u) =>
          u.universityName.toLowerCase().includes(q) ||
          (u.universityShortName ?? "").toLowerCase().includes(q) ||
          String(u.universityCode) === q,
      )
    }
    const goal = unis.find((u) => u.universityCode === highlightUniversity)
    return goal ? [goal, ...unis.filter((u) => u !== goal)] : unis
  }, [unis, search, highlightUniversity])

  const passing = (unis ?? []).filter((u) => u.isPass).length

  return (
    <View style={{ gap: 12 }}>
      <Pressable onPress={onBack} style={{ flexDirection: "row", alignItems: "center", gap: 4 }} hitSlop={6}>
        <MaterialCommunityIcons name="arrow-left" size={16} color={colors.mutedForeground} />
        <Text style={{ color: colors.mutedForeground, fontSize: 13, fontFamily: fonts.sansSemi }}>
          {tr("Все специальности", "Барлық мамандықтар")}
        </Text>
      </Pressable>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("admSpecialty", ui)}</Text>
      {programsLoading ? (
        <Spinner />
      ) : (
        <>
          <Pressable
            onPress={() => pickerItems.length > 0 && setProgramPickerOpen(true)}
            disabled={pickerItems.length === 0}
            style={[
              styles.programSelectTrigger,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: pickerItems.length === 0 ? 0.45 : 1,
              },
            ]}
          >
            <Text style={[styles.programSelectValue, { color: colors.foreground }]} numberOfLines={2}>
              {selectedProgram
                ? `${selectedProgram.programCode} · ${selectedProgram.programName}`
                : t("admPickSpecialty", ui)}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color={colors.mutedForeground} />
          </Pressable>
          <ProgramPickerModal
            visible={programPickerOpen}
            programs={pickerItems}
            selectedId={programId}
            onSelect={onProgramChange}
            onClose={() => setProgramPickerOpen(false)}
            colors={colors}
          />
        </>
      )}

      {!programId ? (
        <Card>
          <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
            {t("admEmptyPickProgram", ui)}
          </Text>
        </Card>
      ) : uniLoading && !unis ? (
        <View style={{ gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[styles.skelLine, { backgroundColor: colors.secondary }]} />
          ))}
        </View>
      ) : (unis ?? []).length === 0 ? (
        <Card>
          <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
            {t("admEmptyUniData", ui)}
          </Text>
        </Card>
      ) : (
        <>
          <ResultsSummary
            total={total}
            cycleYear={cycleYear}
            title={tr(
              `Проходишь в ${passing} из ${(unis ?? []).length} вузов`,
              `${(unis ?? []).length} ЖОО-ның ${passing}-іне өтесіз`,
            )}
          />
          {shownUnis.length === 0 ? (
            <Card>
              <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>{tr("Вуз не найден", "ЖОО табылмады")}</Text>
            </Card>
          ) : (
            shownUnis.map((u) => (
              <UniversityRow
                key={String(u.universityCode)}
                university={u}
                cycleYear={cycleYear}
                isGoal={u.universityCode === highlightUniversity}
                colors={colors}
              />
            ))
          )}
        </>
      )}
    </View>
  )
}

function UniversityRow({
  university: u,
  cycleYear,
  isGoal,
  colors,
}: {
  university: ChanceUniversity
  cycleYear: number | null
  isGoal: boolean
  colors: ThemeColors
}) {
  const tr = useTr()
  const { resolved } = useAppTheme()
  const palette = accentPalette(resolved)
  const gap = u.gapToCutoff
  return (
    <Card style={isGoal ? { borderColor: palette.emerald.fg, borderWidth: 1.5 } : undefined}>
      <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
        <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
          <Text style={[styles.progName, { color: colors.foreground }]} numberOfLines={2}>
            {u.universityShortName || u.universityName}
          </Text>
          {u.universityShortName ? (
            <Text style={[styles.hint, { color: colors.mutedForeground }]} numberOfLines={2}>
              {u.universityName}
            </Text>
          ) : null}
          <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
            {u.chance ? <ChanceBadge level={u.chance} passesEntThresholds={u.passesEntThresholds} /> : null}
            {isGoal ? (
              <View style={[styles.goalTag, { borderColor: colors.border }]}>
                <Text style={{ fontSize: 11, color: colors.foreground, fontFamily: fonts.sansSemi }}>
                  {tr("Твоя цель", "Сіздің мақсатыңыз")}
                </Text>
              </View>
            ) : null}
          </View>
          <View style={{ flexDirection: "row", flexWrap: "wrap", columnGap: 10, rowGap: 2, alignItems: "center" }}>
            <Text style={[styles.hint, { color: colors.mutedForeground }]}>
              {tr("Проходной", "Өту балы")}
              {cycleYear ? ` ${cycleYear}` : ""}:{" "}
              <Text style={{ fontFamily: fonts.sansSemi, color: colors.foreground }}>{u.displayedMinScore ?? "—"}</Text>
            </Text>
            {u.displayedMinScore != null ? (
              <CutoffTrend current={u.displayedMinScore} previous={u.previousMinScore} previousYear={u.previousAdmissionYear} />
            ) : null}
            {u.avgScore != null ? (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                {tr("средний", "орташа")} {Math.round(u.avgScore)}
              </Text>
            ) : null}
            {u.grantCount ? (
              <Text style={[styles.hint, { color: colors.mutedForeground }]}>{grantsLabel(u.grantCount, tr)}</Text>
            ) : null}
          </View>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={[styles.metricLbl, { color: colors.mutedForeground }]}>
            {gap != null && gap >= 0 ? tr("Запас", "Қор") : tr("Не хватает", "Жетпейді")}
          </Text>
          <Text
            style={[
              styles.metricNum,
              { color: gap == null ? colors.foreground : gap >= 0 ? palette.emerald.fg : palette.rose.fg },
            ]}
          >
            {gap == null ? "—" : gap > 0 ? `+${gap}` : gap}
          </Text>
        </View>
      </View>
    </Card>
  )
}

function chipStyle(active: boolean, colors: ThemeColors) {
  return {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: active ? colors.foreground : colors.border,
    backgroundColor: active ? colors.foreground : colors.card,
  }
}

function chipText(active: boolean, colors: ThemeColors) {
  return {
    color: active ? colors.background : colors.foreground,
    fontFamily: fonts.sansSemi,
    fontSize: 13,
  }
}

const styles = StyleSheet.create({
  goalTag: { borderWidth: StyleSheet.hairlineWidth, borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2 },
  pad: { padding: 16, paddingBottom: 120 },
  heroTitle: { fontSize: 30, fontFamily: fonts.sansSemi, letterSpacing: -0.45, marginBottom: 10 },
  heroLead: { fontSize: 15, lineHeight: 22 },
  formHead: { flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 14 },
  formTitle: { fontSize: 16, fontFamily: fonts.sansSemi },
  fieldLabel: { fontSize: 13, fontFamily: fonts.sansSemi, marginBottom: 8 },
  quotaBar: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 3,
    gap: 4,
  },
  stepRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  stepNum: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumTxt: { fontSize: 11, fontFamily: fonts.sansSemi },
  hint: { fontSize: 12, lineHeight: 17 },
  selectOpt: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
  },
  step2: {
    marginTop: 18,
    paddingTop: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  scoreMeta: { flexDirection: "row", alignItems: "center", marginTop: 10, gap: 10 },
  totalPill: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999 },
  scoreGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    marginTop: 12,
  },
  inputLbl: { fontSize: 11 },
  input: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    fontSize: 15,
    fontVariant: ["tabular-nums"],
    minWidth: "46%",
    flexGrow: 1,
  },
  sparkleBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderStyle: "dashed",
  },
  programSelectTrigger: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  programSelectValue: { flex: 1, fontSize: 15 },
  progModalWrap: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  progModalSheet: {
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderWidth: StyleSheet.hairlineWidth,
    paddingBottom: 28,
    maxHeight: "78%",
  },
  progModalTitle: {
    paddingHorizontal: 16,
    paddingTop: 16,
    paddingBottom: 8,
    fontSize: 16,
    fontFamily: fonts.sansSemi,
  },
  progModalRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  progModalRowName: { fontSize: 15, marginTop: 4, fontFamily: fonts.sansSemi },
  resultsToolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
  },
  resultsToolbarCol: { flexDirection: "column", alignItems: "stretch" },
  tabBar: {
    flexDirection: "row",
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 4,
    gap: 4,
    flexShrink: 0,
  },
  tabBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    flex: 1,
    justifyContent: "center",
  },
  searchWrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    flex: 1,
    minWidth: 160,
    maxHeight: 44,
  },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15 },
  emptyTxt: { textAlign: "center", paddingVertical: 36, fontSize: 14, lineHeight: 20 },
  skelLine: { height: 64, borderRadius: 12 },
  passIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  passTitle: { fontSize: 14, fontFamily: fonts.sansSemi },
  rowIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  progName: { fontSize: 15, fontFamily: fonts.sansSemi, flexShrink: 1 },
  progMetrics: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  metricLbl: { fontSize: 11 },
  metricNum: { fontSize: 15, fontFamily: fonts.sansSemi, fontVariant: ["tabular-nums"], marginTop: 4 },
})
