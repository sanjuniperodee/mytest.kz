import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { useEffect, useMemo, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { router } from "expo-router"
import { Badge } from "@/components/ui/badge"
import { Card } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { ExamType, Subject, TestSession, TestTemplate } from "@/lib/api/types"
import {
  buildEntProfilePairOptions,
  getSelectedEntProfilePairKey,
  isEntProfileSubjectAvailable,
} from "@/lib/ent-profile-pairs"
import { useAppTheme } from "@/lib/theme/provider"
import type { ThemeColors } from "@/lib/theme/colors"
import { fonts } from "@/lib/theme/fonts"
import { t as tr, useUiLocale, type UiLocale } from "@/lib/i18n/ui"

function entModePreview(
  mode: "mandatory" | "profile" | "full",
  template: TestTemplate | undefined,
  profileQuestionCount: number,
) {
  if (!template) return { totalQ: 0, displayMins: 0 }
  const templateQ =
    template.sections?.reduce((sum, section) => sum + section.questionCount, 0) ??
    template.totalQuestions ??
    0
  const profileQ = 2 * profileQuestionCount
  const fullQ = templateQ + profileQ
  const totalQ = mode === "mandatory" ? templateQ : mode === "profile" ? profileQ : fullQ
  const displayMins =
    mode !== "full" && fullQ > 0 && totalQ > 0
      ? Math.max(5, Math.round(template.durationMins * (totalQ / fullQ)))
      : template.durationMins
  return { totalQ, displayMins }
}

function SkeletonLine({ w, h, colors }: { w: number | `${number}%`; h: number; colors: ThemeColors }) {
  return (
    <View
      style={{
        width: w as number,
        height: h,
        borderRadius: 8,
        backgroundColor: colors.secondary,
      }}
    />
  )
}

function RadioOuter({
  selected,
  colors,
}: {
  selected: boolean
  colors: ThemeColors
}) {
  return (
    <View
      style={[
        styles.radioOuter,
        {
          borderColor: colors.foreground,
        },
      ]}
    >
      {selected ? (
        <View style={[styles.radioInner, { backgroundColor: colors.foreground }]} />
      ) : null}
    </View>
  )
}

function SubjectPill({
  subject,
  locale,
  isClosed,
  colors,
  ui,
}: {
  subject: Subject
  locale: Locale
  isClosed: boolean
  colors: ThemeColors
  ui: UiLocale
}) {
  const label = localize(subject.name, locale, tr("examSubjectFallback", ui))
  if (subject.isMandatory) {
    return (
      <View style={[styles.subjPill, { backgroundColor: colors.foreground }]}>
        <Text style={[styles.subjPillText, { color: colors.background }]}>{label}</Text>
      </View>
    )
  }
  if (isClosed) {
    return (
      <View
        style={[
          styles.subjPillMuted,
          {
            borderColor: colors.border,
            borderStyle: "dashed",
          },
        ]}
      >
        <Text style={[styles.subjPillText, { color: colors.mutedForeground }]}>{label}</Text>
        <Text style={[styles.subjSoon, { color: colors.mutedForeground }]}>{tr("examSubjectSoon", ui)}</Text>
      </View>
    )
  }
  return (
    <View style={[styles.subjPillSec, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
      <Text style={[styles.subjPillText, { color: colors.foreground }]}>{label}</Text>
    </View>
  )
}

export function ExamTypeDetailView({ examTypeId }: { examTypeId: string }) {
  const { colors } = useAppTheme()
  const { width: winW } = useWindowDimensions()
  const { user } = useAuth()
  const { locale: ui } = useUiLocale()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale

  const [selectedTemplate, setSelectedTemplate] = useState<TestTemplate | null>(null)
  const [language, setLanguage] = useState<"ru" | "kk">(
    user?.preferredLanguage === "kk" ? "kk" : "ru",
  )
  const [entScope, setEntScope] = useState<"mandatory" | "profile" | "full">("full")
  const [profileSubjectIds, setProfileSubjectIds] = useState<string[]>([])
  const [starting, setStarting] = useState(false)

  const { data: types } = useSWR<ExamType[]>("/exams/types")
  const examType = (types || []).find((ex) => ex.id === examTypeId)
  const examName = localize(examType?.name, locale, tr("examFallbackName", ui))
  const examDescription = localize(examType?.description, locale)
  const isENT = examType?.slug === "ent"

  const { data: entInProgressResp, isLoading: entInProgressLoading, error: entInProgressError } =
    useSWR<{ items: TestSession[] }>(
      isENT && examTypeId
        ? `/tests/sessions?page=1&limit=1&examTypeId=${encodeURIComponent(examTypeId)}&status=in_progress`
        : null,
    )
  const entActiveSessionId = entInProgressResp?.items?.[0]?.id

  useEffect(() => {
    if (!entActiveSessionId || entInProgressError) return
    router.replace(`/exam/${entActiveSessionId}` as never)
  }, [entActiveSessionId, entInProgressError])

  const entResumeBlocking =
    isENT &&
    Boolean(examTypeId) &&
    (entInProgressLoading || (!!entActiveSessionId && !entInProgressError))

  const { data: subjects, isLoading: subjLoading } = useSWR<Subject[]>(
    examTypeId ? `/exams/types/${examTypeId}/subjects` : null,
  )
  const { data: templates, isLoading: tplLoading } = useSWR<TestTemplate[]>(
    examTypeId ? `/exams/types/${examTypeId}/templates` : null,
  )

  const profileSubjects = useMemo(
    () => (subjects || []).filter((subject) => !subject.isMandatory),
    [subjects],
  )
  const mandatorySubjects = useMemo(
    () => (subjects || []).filter((subject) => subject.isMandatory),
    [subjects],
  )
  const entProfilePairs = useMemo(
    () => buildEntProfilePairOptions(profileSubjects),
    [profileSubjects],
  )
  const selectedProfilePairKey = useMemo(
    () => getSelectedEntProfilePairKey(profileSubjectIds, profileSubjects),
    [profileSubjectIds, profileSubjects],
  )
  const entTemplatesSorted = useMemo(
    () => [...(templates || [])].sort((a, b) => b.durationMins - a.durationMins),
    [templates],
  )
  const activeEntTemplate = isENT ? entTemplatesSorted[0] : undefined
  const profileQuestionCount = isENT ? 40 : 10
  const requiresProfiles = isENT && (entScope === "profile" || entScope === "full")

  const pad = 16
  const gap = 16
  const usable = Math.max(0, winW - pad * 2)
  const tplCols = winW >= 640 ? 2 : 1
  const tplTileW = tplCols > 1 ? (usable - gap * (tplCols - 1)) / tplCols : usable
  const entSideBySide = winW >= 900

  const selectProfilePair = (key: string) => {
    const pair = entProfilePairs.find((option) => option.key === key)
    setProfileSubjectIds(pair ? pair.subjects.map((subject) => subject.id) : [])
  }

  const startTest = async () => {
    const templateForStart = isENT ? activeEntTemplate : selectedTemplate
    if (!templateForStart) {
      Alert.alert(tr("examAlertUnavailableTitle", ui), tr("examAlertUnavailableBody", ui))
      return
    }
    if (requiresProfiles && !selectedProfilePairKey) {
      Alert.alert(tr("examAlertProfileTitle", ui), tr("examAlertProfileBody", ui))
      return
    }
    setStarting(true)
    try {
      const shouldSendProfileSubjects = isENT && requiresProfiles
      const session = await api<TestSession>("/tests/start", {
        method: "POST",
        body: {
          templateId: templateForStart.id,
          language,
          profileSubjectIds: shouldSendProfileSubjects ? profileSubjectIds : undefined,
          entScope: isENT ? entScope : undefined,
        },
      })
      setSelectedTemplate(null)
      router.push(`/exam/${session.id}`)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : ""
      if (message === "TRIAL_LIMIT_EXCEEDED" || message === "TOTAL_LIMIT_EXHAUSTED" || message === "NO_ENTITLEMENT") {
        router.push("/dashboard/billing?reason=limit_exhausted")
        return
      }
      if (message === "DAILY_LIMIT_REACHED") {
        router.push("/dashboard/billing?reason=daily_limit")
        return
      }
      Alert.alert(tr("examAlertErrorTitle", ui), message || tr("examAlertStartFail", ui))
    } finally {
      setStarting(false)
    }
  }

  const scopeOptions = useMemo(
    () =>
      [
        {
          v: "mandatory" as const,
          l: tr("examScopeMandatory", ui),
          s: tr("examScopeMandatorySub", ui),
        },
        {
          v: "profile" as const,
          l: tr("examScopeProfile", ui),
          s: tr("examScopeProfileSub", ui),
        },
        {
          v: "full" as const,
          l: tr("examScopeFull", ui),
          s: tr("examScopeFullSub", ui),
        },
      ] as const,
    [ui],
  )

  const entStartDisabled =
    starting ||
    !activeEntTemplate ||
    tplLoading ||
    (requiresProfiles && !selectedProfilePairKey)

  if (entResumeBlocking) {
    return (
      <View style={[styles.entResumeGate, { backgroundColor: colors.secondary }]}>
        <ActivityIndicator size="large" color={colors.foreground} />
      </View>
    )
  }

  return (
    <ScrollView contentContainerStyle={[styles.scroll, { backgroundColor: colors.secondary }]}>
      <Pressable onPress={() => router.back()} style={styles.backRow}>
        <MaterialCommunityIcons name="arrow-left" size={16} color={colors.mutedForeground} />
        <Text style={[styles.backText, { color: colors.mutedForeground }]}>{tr("examBackToCatalog", ui)}</Text>
      </Pressable>

      <Text style={[styles.h1, { color: colors.foreground }]}>{examName}</Text>
      {examDescription ? (
        <Text style={[styles.desc, { color: colors.mutedForeground }]}>{examDescription}</Text>
      ) : null}

      <View style={styles.section}>
        <Text style={[styles.h2, { color: colors.foreground }]}>{tr("examSubjects", ui)}</Text>
        {subjLoading ? (
          <View style={styles.subjSkeletonRow}>
            {Array.from({ length: 6 }).map((_, i) => (
              <SkeletonLine key={i} w={96} h={32} colors={colors} />
            ))}
          </View>
        ) : (subjects || []).length === 0 ? (
          <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
            {tr("examSubjUnavailable", ui)}
          </Text>
        ) : (
          <View style={styles.subjWrap}>
            {(subjects || []).map((s) => {
              const closed = isENT && !isEntProfileSubjectAvailable(s)
              return (
                <SubjectPill
                  key={s.id}
                  subject={s}
                  locale={locale}
                  isClosed={closed}
                  colors={colors}
                  ui={ui}
                />
              )
            })}
          </View>
        )}
      </View>

      {isENT && (
        <View style={entSideBySide ? styles.entSplit : styles.entStack}>
          <Card style={entSideBySide ? styles.entCardHalf : undefined}>
            <Text style={[styles.cardHdr, { color: colors.foreground }]}>{tr("examQuickStartEnt", ui)}</Text>
            <View style={{ gap: 20 }}>
              <View>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr("examTaskLanguage", ui)}</Text>
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
                      <Text style={[styles.radioCardText, { color: colors.foreground }]}>
                        {lng === "ru" ? tr("langRussian", ui) : tr("langKazakh", ui)}
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>

              <View>
                <Text style={[styles.fieldLabel, { color: colors.foreground }]}>{tr("examEntVolume", ui)}</Text>
                <View style={{ gap: 8 }}>
                  {scopeOptions.map((option) => {
                    const preview = entModePreview(option.v, activeEntTemplate, profileQuestionCount)
                    const sel = entScope === option.v
                    return (
                      <Pressable
                        key={option.v}
                        onPress={() => setEntScope(option.v)}
                        style={[
                          styles.scopeRow,
                          {
                            borderColor: sel ? colors.foreground : colors.border,
                            backgroundColor: sel ? `${colors.secondary}88` : colors.card,
                          },
                        ]}
                      >
                        <RadioOuter selected={sel} colors={colors} />
                        <View style={styles.scopeMid}>
                          <Text style={[styles.scopeTitle, { color: colors.foreground }]}>
                            {option.l}
                          </Text>
                          <Text style={[styles.scopeSub, { color: colors.mutedForeground }]}>
                            {option.s}
                          </Text>
                        </View>
                        {activeEntTemplate ? (
                          <Text style={[styles.scopeMeta, { color: colors.mutedForeground }]}>
                            {preview.totalQ} {tr("examQAbbr", ui)}
                            {"\n"}
                            {preview.displayMins}
                            {tr("minutesShort", ui)}
                          </Text>
                        ) : null}
                      </Pressable>
                    )
                  })}
                </View>
              </View>

              {requiresProfiles ? (
                <View>
                  <View style={styles.pairHead}>
                    <Text style={[styles.fieldLabel, { color: colors.foreground, marginBottom: 0 }]}>
                      {tr("examProfilePairTitle", ui)}
                    </Text>
                    <Badge variant="secondary">
                      {selectedProfilePairKey ? tr("examPairSelected", ui) : tr("examPairNotSelected", ui)}
                    </Badge>
                  </View>
                  {entProfilePairs.length > 0 ? (
                    <>
                      <View style={[styles.pairGrid, winW >= 640 && styles.pairGridWide]}>
                        {entProfilePairs.map((pair) => {
                          const sel = selectedProfilePairKey === pair.key
                          return (
                            <Pressable
                              key={pair.key}
                              onPress={() => selectProfilePair(pair.key)}
                              style={[
                                styles.pairRow,
                                {
                                  borderColor: sel ? colors.foreground : colors.border,
                                  backgroundColor: sel ? `${colors.secondary}88` : colors.card,
                                },
                              ]}
                            >
                              <RadioOuter selected={sel} colors={colors} />
                              <Text style={[styles.pairLabel, { color: colors.foreground }]}>
                                {pair.subjects.map((s) => localize(s.name, language, tr("examSubjectFallback", ui))).join(" + ")}
                              </Text>
                            </Pressable>
                          )
                        })}
                      </View>
                      <Text style={[styles.hint, { color: colors.mutedForeground }]}>
                        {tr("examProfileSubjectsHint", ui)}
                      </Text>
                    </>
                  ) : (
                    <Text style={[styles.mutedSmall, { color: colors.mutedForeground, marginTop: 8 }]}>
                      {tr("examProfilePairsEmpty", ui)}
                    </Text>
                  )}
                </View>
              ) : null}

              <Pressable
                onPress={() => void startTest()}
                disabled={entStartDisabled}
                style={({ pressed }) => [
                  styles.startBtn,
                  {
                    backgroundColor: colors.foreground,
                    opacity:
                      starting ? 1 : entStartDisabled ? 0.45 : pressed ? 0.88 : 1,
                  },
                ]}
              >
                {starting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="play" size={18} color={colors.background} />
                    <Text style={[styles.startBtnText, { color: colors.background }]}>
                      {tr("examStartEnt", ui)}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </Card>

          <Card style={entSideBySide ? styles.entCardHalf : undefined}>
            <Text style={[styles.cardHdr, { color: colors.foreground }]}>{tr("examWhatsInTest", ui)}</Text>
            <View style={{ gap: 12 }}>
              {(entScope === "mandatory" || entScope === "full") && (
                <View>
                  <Text style={[styles.subHdr, { color: colors.foreground }]}>{tr("examMandatoryBlock", ui)}</Text>
                  <View style={styles.subjWrap}>
                    {mandatorySubjects.map((s) => (
                      <View
                        key={s.id}
                        style={[styles.subjPill, { backgroundColor: colors.foreground }]}
                      >
                        <Text style={[styles.subjPillText, { color: colors.background }]}>
                          {localize(s.name, language, tr("examSubjectFallback", ui))}
                        </Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
              {requiresProfiles ? (
                <View>
                  <Text style={[styles.subHdr, { color: colors.foreground }]}>{tr("examProfileBlock", ui)}</Text>
                  <View style={styles.subjWrap}>
                    {profileSubjectIds.length > 0 ? (
                      profileSubjects
                        .filter((s) => profileSubjectIds.includes(s.id))
                        .map((s) => (
                          <View
                            key={s.id}
                            style={[styles.subjPillSec, { backgroundColor: colors.secondary, borderColor: colors.border }]}
                          >
                            <Text style={[styles.subjPillText, { color: colors.foreground }]}>
                              {localize(s.name, language, tr("examSubjectFallback", ui))}
                            </Text>
                          </View>
                        ))
                    ) : (
                      <Text style={[styles.mutedSmall, { color: colors.mutedForeground }]}>
                        {tr("examPickPairBeforeStart", ui)}
                      </Text>
                    )}
                  </View>
                </View>
              ) : null}
              {!activeEntTemplate && !tplLoading ? (
                <Text style={[styles.errText, { color: colors.destructive }]}>
                  {tr("examTplUnavailableShort", ui)}
                </Text>
              ) : null}
            </View>
          </Card>
        </View>
      )}

      {!isENT && (
        <View style={styles.section}>
          <Text style={[styles.h2, { color: colors.foreground }]}>{tr("examTemplatesSection", ui)}</Text>
          {tplLoading ? (
            <View style={[styles.tplGrid, { gap }]}>
              {Array.from({ length: 4 }).map((_, i) => (
                <View
                  key={i}
                  style={[
                    styles.tplSkel,
                    { width: tplTileW, height: 128, backgroundColor: colors.secondary },
                  ]}
                />
              ))}
            </View>
          ) : (templates || []).length === 0 ? (
            <Card>
              <Text style={[styles.emptyTpl, { color: colors.mutedForeground }]}>
                {tr("examNoTemplates", ui)}
              </Text>
            </Card>
          ) : (
            <View style={[styles.tplGrid, { gap }]}>
              {(templates || []).map((tpl) => {
                const tName = localize(tpl.name, locale, tr("examTemplateFallback", ui))
                const tDesc = localize(tpl.description, locale)
                const qCount =
                  tpl.totalQuestions ??
                  tpl.sections?.reduce((sum, section) => sum + section.questionCount, 0) ??
                  0
                return (
                  <Card key={tpl.id} padded={false} style={{ width: tplTileW, overflow: "hidden" }}>
                    {tpl.isPremium ? (
                      <View style={styles.premiumBadge}>
                        <MaterialCommunityIcons name="crown" size={12} color="#1e1c1a" />
                        <Text style={styles.premiumText}>Premium</Text>
                      </View>
                    ) : null}
                    <View style={{ padding: 16 }}>
                      <View style={[styles.iconBox, { backgroundColor: colors.foreground }]}>
                        <MaterialCommunityIcons name="book-open-page-variant" size={22} color={colors.background} />
                      </View>
                      <Text style={[styles.tplTitle, { color: colors.foreground }]}>{tName}</Text>
                      {tDesc ? (
                        <Text
                          style={[styles.tplDesc, { color: colors.mutedForeground }]}
                          numberOfLines={2}
                        >
                          {tDesc}
                        </Text>
                      ) : null}
                      <View style={styles.tplMeta}>
                        {tpl.durationMins ? (
                          <View style={styles.metaItem}>
                            <MaterialCommunityIcons name="clock-outline" size={14} color={colors.mutedForeground} />
                            <Text style={[styles.metaTxt, { color: colors.mutedForeground }]}>
                              {tpl.durationMins}
                              {tr("minutesShort", ui)}
                            </Text>
                          </View>
                        ) : null}
                        <Text style={[styles.metaTxt, { color: colors.mutedForeground }]}>
                          {qCount} {tr("examQuestionsWord", ui)}
                        </Text>
                      </View>
                      <Pressable
                        onPress={() => setSelectedTemplate(tpl)}
                        style={[styles.tplStart, { backgroundColor: colors.foreground }]}
                      >
                        <MaterialCommunityIcons name="play" size={18} color={colors.background} />
                        <Text style={[styles.tplStartTxt, { color: colors.background }]}>{tr("examStart", ui)}</Text>
                      </Pressable>
                    </View>
                  </Card>
                )
              })}
            </View>
          )}
        </View>
      )}

      <Modal visible={!isENT && !!selectedTemplate} transparent animationType="slide">
        <Pressable style={styles.modalBackdrop} onPress={() => setSelectedTemplate(null)} />
        <View style={[styles.modalSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>
            {localize(selectedTemplate?.name, locale, tr("examTemplateFallback", ui))}
          </Text>
          <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
            {tr("examModalLead", ui)}
          </Text>

          <Text style={[styles.fieldLabel, { color: colors.foreground, marginTop: 8 }]}>
            {tr("statsColLang", ui)}
          </Text>
          <View style={styles.langRow}>
            {(["ru", "kk"] as const).map((lng) => (
              <Pressable
                key={lng}
                onPress={() => setLanguage(lng)}
                style={[
                  styles.radioCard,
                  {
                    flex: 1,
                    borderColor: language === lng ? colors.foreground : colors.border,
                    backgroundColor: language === lng ? colors.secondary : colors.card,
                  },
                ]}
              >
                <RadioOuter selected={language === lng} colors={colors} />
                <Text style={[styles.radioCardText, { color: colors.foreground }]}>
                  {lng === "ru" ? tr("langRussian", ui) : tr("langKazakh", ui)}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.modalFooter}>
            <View style={{ flex: 1 }}>
              <Button variant="outline" onPress={() => setSelectedTemplate(null)}>
                {tr("examCancel", ui)}
              </Button>
            </View>
            <View style={{ flex: 1 }}>
              <Pressable
                onPress={() => void startTest()}
                disabled={starting}
                style={[
                  styles.modalPrimary,
                  {
                    backgroundColor: colors.foreground,
                    opacity: starting ? 0.5 : 1,
                  },
                ]}
              >
                {starting ? (
                  <ActivityIndicator color={colors.background} />
                ) : (
                  <>
                    <MaterialCommunityIcons name="play" size={18} color={colors.background} />
                    <Text style={[styles.startBtnText, { color: colors.background }]}>
                      {tr("examStartTemplate", ui)}
                    </Text>
                  </>
                )}
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  scroll: { padding: 16, gap: 24, paddingBottom: 120 },
  entResumeGate: { flex: 1, justifyContent: "center", alignItems: "center", minHeight: 240 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 4, marginBottom: 4 },
  backText: { fontSize: 14 },
  h1: {
    fontSize: 30,
    fontFamily: fonts.sansSemi,
    letterSpacing: -0.5,
    marginTop: 8,
  },
  desc: { fontSize: 15, lineHeight: 22, marginTop: 6 },
  section: { gap: 12 },
  h2: { fontSize: 17, fontFamily: fonts.sansSemi },
  mutedSmall: { fontSize: 13 },
  cardHdr: { fontSize: 17, fontFamily: fonts.sansSemi, marginBottom: 16 },
  fieldLabel: { fontSize: 13, fontFamily: fonts.sansSemi, marginBottom: 8 },
  subHdr: { fontSize: 13, fontFamily: fonts.sansSemi, marginBottom: 8 },
  subjSkeletonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  subjPill: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999 },
  subjPillSec: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: StyleSheet.hairlineWidth },
  subjPillMuted: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
  },
  subjPillText: { fontSize: 14, fontWeight: "400" },
  subjSoon: { fontSize: 10, marginLeft: 6, textTransform: "uppercase", fontWeight: "600" },
  entSplit: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  entStack: { gap: 16 },
  entCardHalf: { flex: 1, minWidth: 280 },
  langRow: { flexDirection: "row", gap: 8, flexWrap: "wrap" },
  radioCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minWidth: 140,
    flex: 1,
  },
  radioCardText: { fontSize: 14, fontFamily: fonts.sansSemi },
  radioOuter: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioInner: { width: 10, height: 10, borderRadius: 5 },
  scopeRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  scopeMid: { flex: 1, minWidth: 0 },
  scopeTitle: { fontSize: 14, fontFamily: fonts.sansSemi },
  scopeSub: { fontSize: 12, marginTop: 4, lineHeight: 16 },
  scopeMeta: { fontSize: 11, textAlign: "right", lineHeight: 14 },
  pairHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 8,
  },
  pairGrid: { gap: 8 },
  pairGridWide: { flexDirection: "row", flexWrap: "wrap" },
  pairRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flex: 1,
    minWidth: 200,
  },
  pairLabel: { fontSize: 14, fontFamily: fonts.sansSemi, flex: 1 },
  hint: { fontSize: 11, lineHeight: 16, marginTop: 8 },
  startBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    borderRadius: 10,
    marginTop: 4,
  },
  startBtnText: { fontSize: 15, fontFamily: fonts.sansSemi },
  errText: { fontSize: 13 },
  tplGrid: { flexDirection: "row", flexWrap: "wrap" },
  tplSkel: { borderRadius: 12 },
  emptyTpl: { textAlign: "center", paddingVertical: 36, fontSize: 15 },
  iconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 12,
  },
  tplTitle: { fontSize: 17, fontFamily: fonts.sansSemi, lineHeight: 22 },
  tplDesc: { fontSize: 13, lineHeight: 18, marginTop: 8 },
  tplMeta: { flexDirection: "row", alignItems: "center", gap: 16, marginTop: 10 },
  metaItem: { flexDirection: "row", alignItems: "center", gap: 4 },
  metaTxt: { fontSize: 12 },
  tplStart: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 14,
    paddingVertical: 12,
    borderRadius: 10,
  },
  tplStartTxt: { fontSize: 15, fontFamily: fonts.sansSemi },
  premiumBadge: {
    position: "absolute",
    right: 12,
    top: 12,
    zIndex: 2,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#F59E0B",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  premiumText: { fontSize: 11, fontWeight: "700", color: "#1e1c1a" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalSheet: {
    position: "absolute",
    left: 16,
    right: 16,
    bottom: 28,
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 19, fontFamily: fonts.sansSemi },
  modalDesc: { fontSize: 14, marginTop: 6, lineHeight: 20 },
  modalFooter: { flexDirection: "row", gap: 12, marginTop: 22 },
  modalPrimary: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minHeight: 44,
    borderRadius: 10,
  },
})
