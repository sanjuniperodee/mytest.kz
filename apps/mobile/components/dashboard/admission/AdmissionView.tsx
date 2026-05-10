import { MaterialCommunityIcons } from "@expo/vector-icons"
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
  { key: "mathLit", labelKey: "admScoreMathLit", short: "МатГр", max: 10 },
  { key: "readingLit", labelKey: "admScoreReadingLit", short: "ЧитГр", max: 10 },
  { key: "history", labelKey: "admScoreHistory", short: "ИстКЗ", max: 20 },
  { key: "profile1", labelKey: "admScoreProf1", short: "Проф 1", max: 50 },
  { key: "profile2", labelKey: "admScoreProf2", short: "Проф 2", max: 50 },
]

const LG = 1024

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

  const scoreFields = useMemo(
    () =>
      SCORE_FIELD_DEFS.map((row) => ({
        ...row,
        label: t(row.labelKey, ui),
      })),
    [ui],
  )

  const total =
    scores.mathLit + scores.readingLit + scores.history + scores.profile1 + scores.profile2

  const { data: cycles } = useSWR<AdmissionCycle[]>("/admission/cycles")
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
  const { data: programs, isLoading: progLoading } = useSWR<ChanceProgram[]>(programsKey)

  const filteredPrograms = useMemo(() => {
    if (!programs) return []
    const q = search.trim().toLowerCase()
    let list = programs
    if (q) {
      list = programs.filter(
        (p) =>
          p.programName.toLowerCase().includes(q) || p.programCode.toLowerCase().includes(q),
      )
    }
    return [...list].sort((a, b) => {
      if (a.isPass !== b.isPass) return a.isPass ? -1 : 1
      const ga = a.gapToCutoff ?? Number.NEGATIVE_INFINITY
      const gb = b.gapToCutoff ?? Number.NEGATIVE_INFINITY
      return gb - ga
    })
  }, [programs, search])

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
              <Text style={chipText(cycleSlug === c.slug, colors)}>{c.slug}</Text>
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
              {profileSubjects}
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
                {total}/140
              </Text>
            </View>
          </View>
          <View style={styles.scoreGrid}>
            {scoreFields.map((field) => (
              <View key={field.key} style={{ gap: 6 }}>
                <Text style={[styles.inputLbl, { color: colors.mutedForeground }]}>
                  {field.short} ({field.max})
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
            onPress={() => setTab("programs")}
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
            onPress={() => setTab("universities")}
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
            placeholder={t("admSearchPh", ui)}
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
          loading={progLoading}
          programs={filteredPrograms}
          total={total}
          hasParams={Boolean(programsKey)}
          colors={colors}
        />
      ) : (
        <UniversitiesPanel cycleSlug={cycleSlug} quotaType={quotaType} scores={scores} search={search} colors={colors} />
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

function ProgramsPanel({
  loading,
  programs,
  total,
  hasParams,
  colors,
}: {
  loading: boolean
  programs: ChanceProgram[]
  total: number
  hasParams: boolean
  colors: ThemeColors
}) {
  const { locale: ui } = useUiLocale()
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

  const passing = programs.filter((p) => p.isPass).length

  return (
    <View style={{ gap: 12 }}>
      <Card style={{ paddingVertical: 12 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
          <View style={[styles.passIcon, { backgroundColor: colors.foreground }]}>
            <MaterialCommunityIcons name="check-circle-outline" size={22} color={colors.background} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.passTitle, { color: colors.foreground }]}>
              {passing}
              {t("admPassingOf", ui)}
              {programs.length}
              {t("admPassingSummary", ui)}
            </Text>
            <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 4 }]}>
              {t("admYourScore", ui)}{" "}
              <Text style={{ fontFamily: fonts.sansSemi, color: colors.foreground }}>{total}</Text>
              {" · "}
              {t("admCompareCutoffs", ui)}
            </Text>
          </View>
        </View>
      </Card>
      {programs.map((p) => (
        <ProgramRow key={`${p.programId}-${p.profileSubjects}`} program={p} colors={colors} />
      ))}
    </View>
  )
}

function ProgramRow({ program: p, colors }: { program: ChanceProgram; colors: ThemeColors }) {
  const { locale: ui } = useUiLocale()
  const isPass = p.isPass
  const gap = p.gapToCutoff
  return (
    <Card
      style={{
        borderColor: isPass ? "#A7F3D0" : colors.border,
      }}
    >
      <View style={{ gap: 12 }}>
        <View style={{ flexDirection: "row", gap: 12, alignItems: "flex-start" }}>
          <View
            style={[
              styles.rowIcon,
              { backgroundColor: isPass ? "#D1FAE5" : "#FFE4E6" },
            ]}
          >
            <MaterialCommunityIcons
              name={isPass ? "check-circle" : "close-circle"}
              size={22}
              color={isPass ? "#065F46" : "#BE123C"}
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Badge variant="outline">
                <Text
                  style={{
                    fontSize: 11,
                    fontFamily: Platform.select({
                      ios: "Menlo",
                      android: "monospace",
                      default: "monospace",
                    }),
                  }}
                >
                  {p.programCode}
                </Text>
              </Badge>
              <Text style={[styles.progName, { color: colors.foreground }]}>{p.programName}</Text>
            </View>
            <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 6 }]}>
              {t("admProfileLabel", ui)}
              {p.profileSubjects}
              {p.universityCount > 0 ? ` · ${p.universityCount}${t("admUniCount", ui)}` : ""}
            </Text>
          </View>
        </View>
        <View style={[styles.progMetrics, { borderTopColor: colors.border }]}>
          <View style={{ alignItems: "flex-start" }}>
            <Text style={[styles.metricLbl, { color: colors.mutedForeground }]}>{t("admThreshold", ui)}</Text>
            <Text style={[styles.metricNum, { color: colors.foreground }]}>
              {p.displayedMinScore ?? "—"}
            </Text>
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <Text style={[styles.metricLbl, { color: colors.mutedForeground }]}>
              {isPass ? t("admSurplus", ui) : t("admShortage", ui)}
            </Text>
            <Text
              style={[
                styles.metricNum,
                { color: isPass ? "#047857" : "#BE123C" },
              ]}
            >
              {gap == null ? "—" : `${isPass ? "+" : ""}${gap}`}
            </Text>
          </View>
        </View>
      </View>
    </Card>
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
  quotaType,
  scores,
  search,
  colors,
}: {
  cycleSlug: string
  quotaType: QuotaType
  scores: Scores
  search: string
  colors: ThemeColors
}) {
  const { locale: ui } = useUiLocale()
  const [programId, setProgramId] = useState("")
  const [programPickerOpen, setProgramPickerOpen] = useState(false)

  const { data: catalogPrograms, isLoading: progLoading } = useSWR<
    { id: string; code: string; name: string }[]
  >(`/admission/programs?take=200`)

  const filteredPrograms = useMemo(() => {
    if (!catalogPrograms) return []
    const q = search.trim().toLowerCase()
    if (!q) return catalogPrograms.slice(0, 200)
    return catalogPrograms.filter(
      (p) => p.name.toLowerCase().includes(q) || p.code.toLowerCase().includes(q),
    )
  }, [catalogPrograms, search])

  useEffect(() => {
    if (filteredPrograms.length === 0) {
      setProgramId("")
      return
    }
    if (!programId || !filteredPrograms.some((p) => p.id === programId)) {
      setProgramId(filteredPrograms[0].id)
    }
  }, [filteredPrograms, programId])

  const selectedProgram =
    programId && catalogPrograms
      ? catalogPrograms.find((p) => p.id === programId) ??
        filteredPrograms.find((p) => p.id === programId)
      : undefined

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

  const { data: unis, isLoading: uniLoading } = useSWR<ChanceUniversity[]>(uniKey)

  const sortedUnis = useMemo(() => {
    if (!unis) return []
    return [...unis].sort((a, b) => {
      if (a.isPass !== b.isPass) return a.isPass ? -1 : 1
      return (a.displayedMinScore ?? 0) - (b.displayedMinScore ?? 0)
    })
  }, [unis])

  return (
    <>
      <View style={{ gap: 12 }}>
      <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{t("admSpecialty", ui)}</Text>
      {progLoading ? (
        <Spinner />
      ) : (
        <>
          <Pressable
            onPress={() => filteredPrograms.length > 0 && setProgramPickerOpen(true)}
            disabled={filteredPrograms.length === 0}
            style={[
              styles.programSelectTrigger,
              {
                borderColor: colors.border,
                backgroundColor: colors.card,
                opacity: filteredPrograms.length === 0 ? 0.45 : 1,
              },
            ]}
          >
            <Text
              style={[styles.programSelectValue, { color: colors.foreground }]}
              numberOfLines={2}
            >
              {selectedProgram
                ? `${selectedProgram.code} · ${selectedProgram.name}`
                : t("admPickSpecialty", ui)}
            </Text>
            <MaterialCommunityIcons name="chevron-down" size={22} color={colors.mutedForeground} />
          </Pressable>
          <ProgramPickerModal
            visible={programPickerOpen}
            programs={filteredPrograms}
            selectedId={programId}
            onSelect={setProgramId}
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
      ) : uniLoading ? (
        <View style={{ gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <View key={i} style={[styles.skelLine, { backgroundColor: colors.secondary }]} />
          ))}
        </View>
      ) : sortedUnis.length === 0 ? (
        <Card>
          <Text style={[styles.emptyTxt, { color: colors.mutedForeground }]}>
            {t("admEmptyUniData", ui)}
          </Text>
        </Card>
      ) : (
        sortedUnis.map((u) => (
          <Card key={String(u.universityCode)} style={{ borderColor: u.isPass ? "#A7F3D0" : colors.border }}>
            <View style={{ flexDirection: "row", gap: 12, alignItems: "center" }}>
              <View
                style={[
                  styles.rowIcon,
                  { backgroundColor: u.isPass ? "#D1FAE5" : "#FFE4E6" },
                ]}
              >
                <MaterialCommunityIcons
                  name={u.isPass ? "check-circle" : "close-circle"}
                  size={22}
                  color={u.isPass ? "#065F46" : "#BE123C"}
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.progName, { color: colors.foreground }]} numberOfLines={2}>
                  {u.universityName}
                </Text>
                <Text style={[styles.hint, { color: colors.mutedForeground, marginTop: 4 }]}>
                  {t("admCodePrefix", ui)}
                  {u.universityCode} · {t("admThresholdLabel", ui)}
                  {u.displayedMinScore ?? "—"}
                </Text>
              </View>
              <View style={{ alignItems: "flex-end" }}>
                <Text style={[styles.metricLbl, { color: colors.mutedForeground }]}>
                  {u.isPass ? t("admSurplus", ui) : t("admShortage", ui)}
                </Text>
                <Text
                  style={[
                    styles.metricNum,
                    { color: u.isPass ? "#047857" : "#BE123C" },
                  ]}
                >
                  {u.gapToCutoff == null ? "—" : `${u.isPass ? "+" : ""}${u.gapToCutoff}`}
                </Text>
              </View>
            </View>
          </Card>
        ))
      )}
      </View>
    </>
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
