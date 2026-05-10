import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Card } from "@/components/ui/card"
import { QuestionMedia } from "@/components/exam/QuestionMedia"
import { ExamAnswerOptionsWebView } from "@/components/exam/ExamAnswerOptionsWebView"
import { RichHtml } from "@/components/exam/RichHtml"
import { RichHtmlLayoutGateContext } from "@/lib/exam/rich-html-layout-gate"
import { examRichColumnWidth } from "@/lib/exam/layout"
import { getDetachedImageUrls, imageReferenceText } from "@/lib/exam/rich-html"
import { localize, type Locale } from "@/lib/api/i18n"
import type { FlatSessionQuestion } from "@/lib/api/test-session"
import { fonts } from "@/lib/theme/fonts"

type ThemeColors = {
  foreground: string
  background: string
  card: string
  border: string
  mutedForeground: string
  secondary: string
}

function selectedSig(ids: string[]): string {
  return [...ids].sort().join("\0")
}

type Props = {
  activeIdx: number
  total: number
  question: FlatSessionQuestion
  selectedIds: string[]
  saving: boolean
  locale: Locale
  colors: ThemeColors
  onOptionPress: (optionId: string) => void
}

/** Ізольований від таймера сесії блок питання — уникає перезавантаження WebView кожні 250 ms. */
export const ExamQuestionContent = memo(
  function ExamQuestionContent({
    activeIdx,
    total,
    question,
    selectedIds,
    saving,
    locale,
    colors,
    onOptionPress,
  }: Props) {
    const { width: winW, height: winH } = useWindowDimensions()
    const richColW = useMemo(() => examRichColumnWidth(winW), [winW])
    /** Пока WebView замеряют высоту, ограничиваем карточку — иначе ScrollView дёргается на каждом шаге. */
    const questionLoadClampH = Math.min(460, Math.max(280, Math.floor(winH * 0.44)))

    const richSlotCount = useMemo(() => {
      let n = 0
      const hasPassage = Boolean(question.display.passage)
      const hasStem = Boolean(question.display.stem)
      if (hasPassage && hasStem) n += 1
      else {
        if (hasPassage) n += 1
        if (hasStem) n += 1
      }
      if (question.answerOptions.length > 0) n += 1
      return n
    }, [question.display.passage, question.display.stem, question.answerOptions.length])

    const reportedSlotsRef = useRef(new Set<string>())
    const [cardContentVisible, setCardContentVisible] = useState(richSlotCount === 0)

    const reportRichSlotReady = useCallback(
      (slotId: string) => {
        if (!slotId || reportedSlotsRef.current.has(slotId)) return
        reportedSlotsRef.current.add(slotId)
        if (reportedSlotsRef.current.size >= richSlotCount) {
          setCardContentVisible(true)
        }
      },
      [richSlotCount],
    )

    const layoutGateValue = useMemo(
      () => ({ reportSlotReady: reportRichSlotReady }),
      [reportRichSlotReady],
    )

    useEffect(() => {
      reportedSlotsRef.current.clear()
      if (richSlotCount === 0) setCardContentVisible(true)
      else setCardContentVisible(false)
    }, [question.id, richSlotCount])

    useEffect(() => {
      const t = setTimeout(() => setCardContentVisible(true), 900)
      return () => clearTimeout(t)
    }, [question.id])

    const detached = useMemo(
      () =>
        getDetachedImageUrls(question.imageUrls, [
          question.display.passage ?? "",
          question.display.topicLine ?? "",
          question.display.stem,
          ...question.answerOptions.map((opt) => localize(opt.content ?? opt.text, locale)),
          imageReferenceText(question.explanation),
        ]),
      [question, locale],
    )

    const optionsMinH = useMemo(
      () => Math.max(72, 36 * Math.max(1, question.answerOptions.length)),
      [question.answerOptions.length],
    )

    return (
      <>
        {question.sectionTitle ? (
          <Text style={[styles.section, { color: colors.mutedForeground }]}>{question.sectionTitle}</Text>
        ) : null}

        <View style={styles.titleRow}>
          <Text style={[styles.qTitle, { color: colors.foreground }]}>
            Вопрос{" "}
            <Text style={styles.qTitleNum}>
              {activeIdx + 1}
              <Text style={[styles.qTitleSlash, { color: colors.mutedForeground }]}> / {total}</Text>
            </Text>
          </Text>
          {saving ? (
            <View style={styles.savingRow}>
              <ActivityIndicator size="small" color={colors.mutedForeground} />
              <Text style={[styles.savingTxt, { color: colors.mutedForeground }]}>Сохраняем</Text>
            </View>
          ) : null}
        </View>

        <Card padded={false} style={styles.cardOuter}>
          <RichHtmlLayoutGateContext.Provider value={layoutGateValue}>
            <View
              style={[
                styles.cardBodyWrap,
                richSlotCount > 0 &&
                  !cardContentVisible && {
                    minHeight: 268,
                    maxHeight: questionLoadClampH,
                    overflow: "hidden",
                  },
              ]}
            >
              {richSlotCount > 0 && !cardContentVisible ? (
                <View
                  style={[styles.cardLoadingOverlay, { backgroundColor: colors.card }]}
                  pointerEvents="none"
                >
                  <ActivityIndicator color={colors.mutedForeground} />
                </View>
              ) : null}
              <View
                style={styles.cardInner}
                pointerEvents={richSlotCount === 0 || cardContentVisible ? "auto" : "none"}
              >
                {question.display.passage && question.display.stem ? (
                  <RichHtml
                    layoutSlotId={`${question.id}-qbody`}
                    passageStemSplit={{
                      passage: question.display.passage,
                      stem: question.display.stem,
                    }}
                    locale={locale}
                    imageUrls={question.imageUrls}
                    minHeight={48}
                    fixedContentWidth={richColW}
                  />
                ) : null}
                {question.display.passage && !question.display.stem ? (
                  <View
                    style={[
                      styles.passageBox,
                      { borderColor: colors.border, backgroundColor: `${colors.secondary}99` },
                    ]}
                  >
                    <RichHtml
                      layoutSlotId={`${question.id}-passage`}
                      value={question.display.passage}
                      locale={locale}
                      imageUrls={question.imageUrls}
                      minHeight={48}
                      fixedContentWidth={Math.max(120, richColW - 32)}
                    />
                  </View>
                ) : null}
                {!question.display.passage && question.display.stem ? (
                  <RichHtml
                    layoutSlotId={`${question.id}-stem`}
                    value={question.display.stem}
                    locale={locale}
                    imageUrls={question.imageUrls}
                    minHeight={48}
                    fixedContentWidth={richColW}
                  />
                ) : null}
                {detached.map((url, index) => (
                  <QuestionMedia key={`${question.id}-det-${index}`} src={url} />
                ))}

                {question.answerOptions.length > 0 ? (
                  <ExamAnswerOptionsWebView
                    questionId={question.id}
                    layoutSlotId={`${question.id}-options`}
                    options={question.answerOptions}
                    locale={locale}
                    imageUrls={question.imageUrls}
                    fixedContentWidth={richColW}
                    colors={colors}
                    selectedIds={selectedIds}
                    minHeight={optionsMinH}
                    onOptionPress={onOptionPress}
                  />
                ) : null}

                {question.multiSelect ? (
                  <Text style={[styles.multiHint, { color: colors.mutedForeground }]}>
                    Можно выбрать несколько вариантов
                  </Text>
                ) : null}
              </View>
            </View>
          </RichHtmlLayoutGateContext.Provider>
        </Card>
      </>
    )
  },
  (prev, next) =>
    prev.question.id === next.question.id &&
    prev.activeIdx === next.activeIdx &&
    prev.total === next.total &&
    prev.saving === next.saving &&
    prev.locale === next.locale &&
    selectedSig(prev.selectedIds) === selectedSig(next.selectedIds) &&
    prev.colors.foreground === next.colors.foreground &&
    prev.colors.background === next.colors.background &&
    prev.colors.card === next.colors.card &&
    prev.colors.border === next.colors.border &&
    prev.colors.mutedForeground === next.colors.mutedForeground &&
    prev.colors.secondary === next.colors.secondary &&
    prev.onOptionPress === next.onOptionPress,
)

const styles = StyleSheet.create({
  section: {
    fontSize: 11,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: 12,
    marginBottom: 16,
  },
  qTitle: {
    flex: 1,
    fontSize: 20,
    fontFamily: fonts.sansSemi,
    letterSpacing: -0.3,
  },
  qTitleNum: { fontVariant: ["tabular-nums"] },
  qTitleSlash: { fontFamily: fonts.sansSemi, fontWeight: "400" },
  savingRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  savingTxt: { fontSize: 11 },
  cardOuter: { overflow: "hidden" },
  cardBodyWrap: { position: "relative" },
  cardLoadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 48,
    zIndex: 2,
  },
  cardInner: { gap: 20, padding: 20 },
  passageBox: {
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    padding: 16,
  },
  multiHint: { fontSize: 11, marginTop: 4 },
})
