import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { useMemo, useState } from "react"
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { QuestionMedia } from "@/components/exam/QuestionMedia"
import { RichHtml } from "@/components/exam/RichHtml"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { getDetachedImageUrls, imageReferenceText } from "@/lib/exam/rich-html"
import { localize, type Locale, type LocalizedText } from "@/lib/api/i18n"
import {
  buildReviewSections,
  type FlatSessionQuestion,
  type ReviewSectionModel,
} from "@/lib/api/test-session"
import type { ReviewResponse } from "@/lib/api/types"
import { useAppTheme } from "@/lib/theme/provider"
import type { ThemeColors } from "@/lib/theme/colors"
import { fonts } from "@/lib/theme/fonts"
import { reviewContentColumnWidth } from "@/lib/exam/layout"

/** Tailwind emerald / rose / amber — match apps/web review borders & badges */
const EM = { 50: "#ECFDF5", 200: "#A7F3D0", 300: "#6EE7B7", 600: "#059669" }
const RO = { 50: "#FFF1F2", 200: "#FECDD3", 300: "#FDA4AF", 600: "#E11D48", 700: "#BE123C" }
const AM = { 50: "#FFFBEB", 200: "#FDE68A", 600: "#D97706", 800: "#92400E", 900: "#78350F" }

const CONTENT_MAX_W = 896
const MD = 768
const SM = 640
const LG = 1024
/** Горизонтальные отступы accBody (16+16) + exPanel (16+16) — ширина HTML под фактическую колонку. */
const REVIEW_EXPLANATION_WIDTH_INSET = 64

interface ExplanationData {
  questionId: string
  explanation: unknown
  imageUrls?: string[]
}

function ExamLogoMark({ colors }: { colors: ThemeColors }) {
  return (
    <View style={[styles.logoMark, { backgroundColor: colors.foreground }]}>
      <MaterialCommunityIcons name="chart-timeline-variant" size={16} color={colors.background} />
    </View>
  )
}

function ProgressBar({ value }: { value: number }) {
  const { colors } = useAppTheme()
  const pct = Math.min(100, Math.max(0, Math.round(value)))
  return (
    <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
      <View style={[styles.progressFill, { width: `${pct}%`, backgroundColor: colors.foreground }]} />
    </View>
  )
}

function ReviewSkeleton() {
  const { colors } = useAppTheme()
  const bone = { backgroundColor: colors.border, borderRadius: 8 }
  return (
    <View style={{ gap: 16 }}>
      <View style={{ height: 128, ...bone }} />
      <View style={{ height: 288, ...bone }} />
    </View>
  )
}

function questionPreview(q: FlatSessionQuestion, locale: Locale): string {
  const stem = q.display.stem?.trim()
  const topic = q.display.topicLine?.trim()
  if (stem) return stem.replace(/\s+/g, " ")
  if (topic) return topic.replace(/\s+/g, " ")
  return localize(q.subjectName, locale) || "Вопрос"
}

export default function ExamReviewScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { colors } = useAppTheme()
  const { width: winW } = useWindowDimensions()
  const isWide = winW >= MD
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale

  const [expanded, setExpanded] = useState<Record<string, boolean>>({})

  const { data, isLoading, error } = useSWR<ReviewResponse>(
    sessionId ? `/tests/sessions/${sessionId}/review` : null,
  )

  const sections: ReviewSectionModel[] = useMemo(() => {
    if (!data) return []
    return buildReviewSections(data, locale)
  }, [data, locale])

  const overallCorrect =
    data?.correctCount ?? sections.reduce((sum, sec) => sum + sec.correctCount, 0)
  const overallTotal =
    data?.totalQuestions ?? sections.reduce((sum, sec) => sum + sec.totalCount, 0)
  const displayScore = data?.rawScore ?? data?.score ?? overallCorrect
  const displayMax = data?.maxScore ?? overallTotal
  const accuracy = overallTotal ? Math.round((overallCorrect / overallTotal) * 100) : 0

  const innerCol = useMemo(() => reviewContentColumnWidth(winW, CONTENT_MAX_W), [winW])

  const secCols = winW >= LG ? 3 : winW >= SM ? 2 : 1
  const secGap = 12
  const secCardW =
    sections.length <= 1 || secCols === 1
      ? innerCol
      : (innerCol - secGap * (secCols - 1)) / secCols

  const passageHtmlW = Math.max(120, innerCol - 32)
  /** Review row has letter + badges column — reserve ~140px so HTML viewport matches optMid. */
  const optionHtmlW = Math.max(100, innerCol - 140)

  const toggleQ = (id: string) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }))
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={[
          styles.header,
          {
            borderBottomColor: colors.border,
            backgroundColor: colors.background,
          },
        ]}
      >
        <View style={styles.headerInner}>
          <Pressable
            style={styles.headerLeft}
            onPress={() => router.replace("/dashboard")}
            accessibilityRole="button"
          >
            <ExamLogoMark colors={colors} />
            <Text style={[styles.brandTxt, { color: colors.foreground }]}>mytest</Text>
          </Pressable>
          <Pressable
            onPress={() => router.replace("/dashboard")}
            style={[
              styles.headerOutlineBtn,
              { borderColor: colors.border, backgroundColor: colors.card },
            ]}
            accessibilityRole="button"
          >
            <MaterialCommunityIcons name="arrow-left" size={18} color={colors.foreground} />
            <Text style={[styles.headerOutlineLbl, { color: colors.foreground }]}>К панели</Text>
          </Pressable>
        </View>
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingBottom: 40,
          },
        ]}
      >
        <View style={[styles.contentWrap, { maxWidth: CONTENT_MAX_W }]}>
          {isLoading ? (
            <ReviewSkeleton />
          ) : error ? (
            <Card>
              <View style={styles.errorBox}>
                <Text style={[styles.errorTitle, { color: colors.foreground }]}>
                  Не удалось загрузить разбор
                </Text>
                <Text style={[styles.errorSub, { color: colors.mutedForeground }]}>
                  {(error as ApiError).message || "Попробуйте позже"}
                </Text>
              </View>
            </Card>
          ) : data ? (
            <>
              <Card padded={false} style={styles.scoreCard}>
                <View
                  style={[
                    styles.scoreCardInner,
                    isWide && styles.scoreCardInnerWide,
                  ]}
                >
                  <View style={styles.scoreCol}>
                    <Text style={[styles.resultLbl, { color: colors.mutedForeground }]}>
                      Результат
                    </Text>
                    <View style={styles.scoreNums}>
                      <Text style={[styles.scoreBig, { color: colors.foreground }]}>
                        {displayScore}
                      </Text>
                      <Text style={[styles.scoreSlash, { color: colors.mutedForeground }]}>
                        / {displayMax}
                      </Text>
                    </View>
                    <View style={styles.accuracyRow}>
                      <View style={styles.progressWrap}>
                        <ProgressBar value={accuracy} />
                      </View>
                      <Text style={[styles.accuracyPct, { color: colors.foreground }]}>
                        {accuracy}%
                      </Text>
                    </View>
                    <Text style={[styles.correctLine, { color: colors.mutedForeground }]}>
                      Правильных ответов: {overallCorrect} из {overallTotal}
                    </Text>
                  </View>
                  <View
                    style={[
                      styles.trophyCircle,
                      { backgroundColor: colors.foreground },
                    ]}
                  >
                    <MaterialCommunityIcons name="trophy" size={40} color={colors.background} />
                  </View>
                </View>
              </Card>

              {sections.length > 1 ? (
                <View style={[styles.secGrid, { gap: secGap }]}>
                  {sections.map((sec) => {
                    const total = sec.totalCount
                    const correct = sec.correctCount
                    const pct = total ? Math.round((correct / total) * 100) : 0
                    return (
                      <Card
                        key={sec.id}
                        padded={false}
                        style={[styles.secCard, { width: secCardW }]}
                      >
                        <Text style={[styles.secCardTitle, { color: colors.foreground }]}>
                          {sec.title}
                        </Text>
                        <View style={styles.secCardNums}>
                          <Text style={[styles.secCardFrac, { color: colors.foreground }]}>
                            {correct}/{total}
                          </Text>
                          <Text style={[styles.secCardPct, { color: colors.mutedForeground }]}>
                            {pct}%
                          </Text>
                        </View>
                        <ProgressBar value={pct} />
                      </Card>
                    )
                  })}
                </View>
              ) : null}

              {sections.map((sec) => (
                <View key={sec.id} style={styles.sectionBlock}>
                  <Text style={[styles.sectionH2, { color: colors.foreground }]}>{sec.title}</Text>
                  <View style={styles.accordionCol}>
                    {sec.questions.map((q, idx) => {
                      const qSubject = localize(q.subjectName, locale)
                      const detachedImageUrls = getDetachedImageUrls(q.imageUrls, [
                        q.display.passage ?? "",
                        q.display.topicLine ?? "",
                        q.display.stem,
                        ...q.answerOptions.map((opt) => localize(opt.content ?? opt.text, locale)),
                        imageReferenceText(q.explanation),
                      ])
                      const open = !!expanded[q.id]
                      const borderQ =
                        q.isCorrect === true
                          ? EM[200]
                          : q.isCorrect === false
                            ? RO[200]
                            : colors.border

                      return (
                        <View
                          key={q.id}
                          style={[
                            styles.accItem,
                            {
                              borderColor: borderQ,
                              backgroundColor: colors.card,
                            },
                          ]}
                        >
                          <Pressable
                            onPress={() => toggleQ(q.id)}
                            style={styles.accTrigger}
                            accessibilityRole="button"
                            accessibilityState={{ expanded: open }}
                          >
                            <View style={styles.accTriggerInner}>
                              {q.isCorrect === true ? (
                                <MaterialCommunityIcons
                                  name="check-circle"
                                  size={22}
                                  color={EM[600]}
                                  style={styles.accIcon}
                                />
                              ) : (
                                <MaterialCommunityIcons
                                  name="close-circle"
                                  size={22}
                                  color={RO[600]}
                                  style={styles.accIcon}
                                />
                              )}
                              <Text
                                style={[styles.accNum, { color: colors.mutedForeground }]}
                              >
                                №{idx + 1}
                              </Text>
                              <Text
                                style={[styles.accPreview, { color: colors.foreground }]}
                                numberOfLines={1}
                              >
                                {questionPreview(q, locale)}
                              </Text>
                              <MaterialCommunityIcons
                                name="chevron-down"
                                size={20}
                                color={colors.mutedForeground}
                                style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
                              />
                            </View>
                          </Pressable>

                          {open ? (
                            <View
                              style={[styles.accBody, { borderTopColor: colors.border }]}
                            >
                              <View style={styles.accBodyInner}>
                                {q.display.passage ? (
                                  <View
                                    style={[
                                      styles.passageBox,
                                      {
                                        borderColor: colors.border,
                                        backgroundColor: `${colors.secondary}99`,
                                      },
                                    ]}
                                  >
                                    <RichHtml
                                      value={q.display.passage}
                                      locale={locale}
                                      imageUrls={q.imageUrls}
                                      minHeight={40}
                                      fixedContentWidth={passageHtmlW}
                                    />
                                  </View>
                                ) : null}
                                {q.display.topicLine ? (
                                  <View style={styles.topicLineWrap}>
                                    <RichHtml
                                      value={q.display.topicLine}
                                      locale={locale}
                                      imageUrls={q.imageUrls}
                                      minHeight={24}
                                      fixedContentWidth={innerCol}
                                    />
                                  </View>
                                ) : null}
                                {q.display.stem ? (
                                  <RichHtml
                                    value={q.display.stem}
                                    locale={locale}
                                    imageUrls={q.imageUrls}
                                    minHeight={40}
                                    fixedContentWidth={innerCol}
                                  />
                                ) : null}
                                {detachedImageUrls.map((url, imageIndex) => (
                                  <QuestionMedia
                                    key={`${q.id}-det-${imageIndex}`}
                                    src={url}
                                  />
                                ))}
                                <View style={styles.optsCol}>
                                  {q.answerOptions.map((opt, i) => {
                                    const isSelected = q.selectedIds.includes(opt.id)
                                    const stateBg = opt.isCorrect
                                      ? EM[50]
                                      : isSelected
                                        ? RO[50]
                                        : colors.card
                                    const stateBd = opt.isCorrect
                                      ? EM[300]
                                      : isSelected
                                        ? RO[300]
                                        : colors.border

                                    return (
                                      <View
                                        key={opt.id}
                                        style={[
                                          styles.optRow,
                                          {
                                            borderColor: stateBd,
                                            backgroundColor: stateBg,
                                          },
                                        ]}
                                      >
                                        <View
                                          style={[
                                            styles.optLetter,
                                            {
                                              borderColor: colors.border,
                                              backgroundColor: colors.background,
                                            },
                                          ]}
                                        >
                                          <Text
                                            style={[
                                              styles.optLetterTxt,
                                              { color: colors.foreground },
                                            ]}
                                          >
                                            {String.fromCharCode(65 + i)}
                                          </Text>
                                        </View>
                                        <View style={styles.optMid}>
                                          <RichHtml
                                            value={opt.content ?? opt.text}
                                            locale={locale}
                                            imageUrls={q.imageUrls}
                                            minHeight={32}
                                            fixedContentWidth={optionHtmlW}
                                          />
                                          {opt.imageUrl ? (
                                            <QuestionMedia src={opt.imageUrl} />
                                          ) : null}
                                        </View>
                                        <View style={styles.optBadges}>
                                          {opt.isCorrect ? (
                                            <View
                                              style={[styles.badgeOk, { backgroundColor: EM[600] }]}
                                            >
                                              <Text style={styles.badgeOkTxt}>Верно</Text>
                                            </View>
                                          ) : null}
                                          {isSelected && !opt.isCorrect ? (
                                            <View
                                              style={[
                                                styles.badgeBad,
                                                { backgroundColor: RO[600] },
                                              ]}
                                            >
                                              <Text style={styles.badgeBadTxt}>Ваш ответ</Text>
                                            </View>
                                          ) : null}
                                        </View>
                                      </View>
                                    )
                                  })}
                                </View>

                                {q.hasExplanation && sessionId ? (
                                  <ExplanationBlock
                                    sessionId={sessionId}
                                    questionId={q.id}
                                    locale={locale}
                                    innerCol={innerCol}
                                  />
                                ) : null}
                              </View>
                            </View>
                          ) : null}
                        </View>
                      )
                    })}
                  </View>
                </View>
              ))}
            </>
          ) : null}
        </View>
      </ScrollView>
    </View>
  )
}

function ExplanationBlock({
  sessionId,
  questionId,
  locale,
  innerCol,
}: {
  sessionId: string
  questionId: string
  locale: Locale
  innerCol: number
}) {
  const { colors } = useAppTheme()
  const [open, setOpen] = useState(false)
  const [payload, setPayload] = useState<ExplanationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    if (payload || loading) return
    setLoading(true)
    setErr(null)
    try {
      const res = await api<ExplanationData>(
        `/tests/sessions/${sessionId}/review/${questionId}/explanation`,
      )
      setPayload(res)
    } catch (e) {
      const apiErr = e as ApiError
      if (apiErr.status === 402 || apiErr.status === 403) {
        setErr("premium")
      } else {
        setErr(apiErr.message || "Не удалось загрузить объяснение")
      }
    } finally {
      setLoading(false)
    }
  }

  if (err === "premium") {
    return (
      <View style={[styles.premiumBox, { borderColor: AM[200], backgroundColor: AM[50] }]}>
        <MaterialCommunityIcons name="crown" size={18} color={AM[600]} style={{ marginTop: 2 }} />
        <View style={{ flex: 1, gap: 8 }}>
          <Text style={[styles.premiumTitle, { color: AM[900] }]}>
            Объяснение доступно в Premium
          </Text>
          <Text style={[styles.premiumBody, { color: AM[800] }]}>
            Получите подробные разборы каждой ошибки, чтобы быстрее закрывать пробелы.
          </Text>
          <Button onPress={() => router.push("/dashboard/billing")}>Подключить Premium</Button>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.exRoot}>
      <Pressable
        onPress={() => {
          const next = !open
          setOpen(next)
          if (next) void load()
        }}
        style={({ pressed }) => [
          styles.exToggle,
          {
            borderColor: colors.border,
            backgroundColor: pressed ? colors.secondary : colors.card,
          },
        ]}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
      >
        <View style={[styles.exToggleIconCircle, { backgroundColor: `${colors.foreground}18` }]}>
          <MaterialCommunityIcons name="lightbulb-on-outline" size={20} color={colors.foreground} />
        </View>
        <View style={styles.exToggleTextCol}>
          <Text style={[styles.exToggleLbl, { color: colors.foreground }]}>Объяснение</Text>
          <Text style={[styles.exToggleHint, { color: colors.mutedForeground }]}>
            Разбор задания и формулы
          </Text>
        </View>
        <MaterialCommunityIcons
          name="chevron-down"
          size={22}
          color={colors.mutedForeground}
          style={{ transform: [{ rotate: open ? "180deg" : "0deg" }] }}
        />
      </Pressable>
      {open ? (
        <View
          style={[
            styles.exPanel,
            {
              borderColor: colors.border,
              backgroundColor: colors.secondary,
            },
          ]}
        >
          {loading ? (
            <View style={styles.exLoading}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <Text style={[styles.exLoadingTxt, { color: colors.mutedForeground }]}>
                Загружаем объяснение
              </Text>
            </View>
          ) : err ? (
            <Text style={[styles.exErrTxt, { color: RO[700] }]}>{err}</Text>
          ) : payload ? (
            <ExplanationBody data={payload} locale={locale} innerCol={innerCol} />
          ) : null}
        </View>
      ) : null}
    </View>
  )
}

function formatExplanation(explanation: unknown, locale: Locale): string {
  if (typeof explanation === "string") return explanation.trim()
  const localized = localize(explanation as LocalizedText, locale)?.trim()
  if (localized) return localized
  if (explanation && typeof explanation === "object") {
    const o = explanation as Record<string, unknown>
    const ru = typeof o.ru === "string" ? o.ru.trim() : ""
    const kk = typeof o.kk === "string" ? o.kk.trim() : ""
    const en = typeof o.en === "string" ? o.en.trim() : ""
    if (locale === "kk" && kk) return kk
    if (locale === "en" && en) return en
    if (ru) return ru
    if (kk) return kk
    if (en) return en
  }
  return ""
}

function ExplanationBody({
  data,
  locale,
  innerCol,
}: {
  data: ExplanationData
  locale: Locale
  innerCol: number
}) {
  const { colors } = useAppTheme()
  const explanationText = formatExplanation(data.explanation, locale)
  const detachedImageUrls = getDetachedImageUrls(data.imageUrls, [explanationText])
  const explanationHtmlW = Math.max(120, Math.floor(innerCol - REVIEW_EXPLANATION_WIDTH_INSET))

  if (!explanationText && detachedImageUrls.length === 0) {
    return (
      <Text style={{ fontSize: 15, lineHeight: 22, color: colors.mutedForeground, fontStyle: "italic" }}>
        Текст объяснения недоступен.
      </Text>
    )
  }

  return (
    <View style={{ gap: 14 }}>
      {explanationText ? (
        <RichHtml
          value={explanationText}
          locale={locale}
          imageUrls={data.imageUrls}
          minHeight={48}
          fixedContentWidth={explanationHtmlW}
          readingComfort
        />
      ) : null}
      {detachedImageUrls.length > 0 ? (
        <View style={styles.exImgStack}>
          {detachedImageUrls.map((u, i) => (
            <View key={i} style={styles.exImgItem}>
              <QuestionMedia src={u} />
            </View>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    minHeight: 56,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    paddingHorizontal: 16,
    paddingVertical: 10,
    maxWidth: CONTENT_MAX_W,
    width: "100%",
    alignSelf: "center",
  },
  headerLeft: { flexDirection: "row", alignItems: "center", gap: 8 },
  brandTxt: {
    fontSize: 14,
    fontFamily: fonts.sansSemi,
    textTransform: "lowercase",
  },
  headerOutlineBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    minHeight: 40,
  },
  headerOutlineLbl: { fontSize: 14, fontWeight: "600" },
  scrollContent: {
    paddingHorizontal: 16,
    paddingTop: 24,
    flexGrow: 1,
  },
  contentWrap: {
    width: "100%",
    alignSelf: "center",
    gap: 24,
  },
  errorBox: { paddingVertical: 40, paddingHorizontal: 16, alignItems: "center" },
  errorTitle: { fontSize: 16, fontFamily: fonts.sansSemi, textAlign: "center" },
  errorSub: { marginTop: 6, fontSize: 14, textAlign: "center", lineHeight: 20 },
  scoreCard: { overflow: "hidden" },
  scoreCardInner: {
    padding: 24,
    gap: 20,
  },
  scoreCardInnerWide: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreCol: { flex: 1, gap: 8 },
  resultLbl: {
    fontSize: 14,
    fontWeight: "500",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scoreNums: { flexDirection: "row", alignItems: "baseline", gap: 12 },
  scoreBig: {
    fontSize: 48,
    fontFamily: fonts.sansSemi,
    fontVariant: ["tabular-nums"],
  },
  scoreSlash: {
    fontSize: 22,
    fontVariant: ["tabular-nums"],
  },
  accuracyRow: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  progressWrap: { flex: 1, maxWidth: 320 },
  progressTrack: {
    height: 8,
    borderRadius: 4,
    overflow: "hidden",
  },
  progressFill: { height: "100%", borderRadius: 4 },
  accuracyPct: { fontSize: 14, fontWeight: "600", fontVariant: ["tabular-nums"] },
  correctLine: { fontSize: 14, marginTop: 4 },
  trophyCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
  },
  secGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
  },
  secCard: {
    padding: 16,
    gap: 8,
  },
  secCardTitle: { fontSize: 14, fontWeight: "500" },
  secCardNums: { flexDirection: "row", alignItems: "baseline", gap: 8 },
  secCardFrac: {
    fontSize: 24,
    fontFamily: fonts.sansSemi,
    fontVariant: ["tabular-nums"],
  },
  secCardPct: { fontSize: 12 },
  sectionBlock: { gap: 12 },
  sectionH2: {
    fontSize: 18,
    fontFamily: fonts.sansSemi,
    marginBottom: 4,
  },
  accordionCol: { gap: 8 },
  accItem: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  accTrigger: {
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  accTriggerInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingRight: 8,
  },
  accIcon: { marginTop: 0 },
  accNum: {
    fontSize: 14,
    fontWeight: "500",
    fontVariant: ["tabular-nums"],
  },
  accPreview: {
    flex: 1,
    fontSize: 14,
    fontWeight: "400",
    minWidth: 0,
  },
  accBody: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  accBodyInner: { gap: 16 },
  topicLineWrap: { opacity: 0.85 },
  passageBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  optsCol: { gap: 8 },
  optRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingVertical: 12,
    overflow: "hidden",
    maxWidth: "100%",
  },
  optLetter: {
    marginTop: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  optLetterTxt: { fontSize: 12, fontWeight: "700" },
  optMid: {
    flex: 1,
    minWidth: 0,
    gap: 8,
    flexShrink: 1,
  },
  optBadges: {
    alignItems: "flex-end",
    gap: 4,
    flexShrink: 0,
    paddingTop: 2,
  },
  badgeOk: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeOkTxt: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  badgeBad: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  badgeBadTxt: { fontSize: 12, fontWeight: "600", color: "#FFFFFF" },
  premiumBox: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 16,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  premiumTitle: { fontSize: 15, fontFamily: fonts.sansSemi },
  premiumBody: { fontSize: 14, lineHeight: 20 },
  exRoot: { marginTop: 4, gap: 10 },
  exToggle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
  },
  exToggleIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  exToggleTextCol: { flex: 1, minWidth: 0, gap: 2 },
  exToggleLbl: { fontSize: 16, fontFamily: fonts.sansSemi },
  exToggleHint: { fontSize: 13, lineHeight: 18 },
  exPanel: {
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 18,
  },
  exLoading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  exLoadingTxt: { fontSize: 15 },
  exErrTxt: { fontSize: 15, lineHeight: 22 },
  exImgStack: {
    gap: 12,
    width: "100%",
  },
  exImgItem: {
    width: "100%",
    borderRadius: 10,
    overflow: "hidden",
  },
})
