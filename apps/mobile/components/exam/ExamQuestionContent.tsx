import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react"
import { ActivityIndicator, Pressable, StyleSheet, Text, View, useWindowDimensions } from "react-native"
import { Card } from "@/components/ui/card"
import { QuestionMedia } from "@/components/exam/QuestionMedia"
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
    const { width: winW } = useWindowDimensions()
    const richColW = useMemo(() => examRichColumnWidth(winW), [winW])

    const richSlotCount = useMemo(() => {
      let n = 0
      if (question.display.passage) n++
      if (question.display.stem) n++
      n += question.answerOptions.length
      return n
    }, [question.display.passage, question.display.stem, question.answerOptions.length])

    const richSlotsNeedRef = useRef(richSlotCount)
    richSlotsNeedRef.current = richSlotCount
    const richSlotsReadyRef = useRef(0)
    const [cardContentVisible, setCardContentVisible] = useState(richSlotCount === 0)

    const reportRichSlotReady = useCallback(() => {
      if (richSlotsReadyRef.current >= richSlotsNeedRef.current) return
      richSlotsReadyRef.current++
      if (richSlotsReadyRef.current >= richSlotsNeedRef.current) {
        setCardContentVisible(true)
      }
    }, [])

    const layoutGateValue = useMemo(
      () => ({ reportSlotReady: reportRichSlotReady }),
      [reportRichSlotReady],
    )

    useEffect(() => {
      richSlotsReadyRef.current = 0
      if (richSlotCount === 0) setCardContentVisible(true)
      else setCardContentVisible(false)
    }, [question.id, richSlotCount])

    useEffect(() => {
      const t = setTimeout(() => setCardContentVisible(true), 3200)
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
            <View style={styles.cardBodyWrap}>
              {richSlotCount > 0 && !cardContentVisible ? (
                <View
                  style={[styles.cardLoadingOverlay, { backgroundColor: colors.card }]}
                  pointerEvents="none"
                >
                  <ActivityIndicator color={colors.mutedForeground} />
                </View>
              ) : null}
              <View
                style={[
                  styles.cardInner,
                  {
                    opacity: richSlotCount === 0 || cardContentVisible ? 1 : 0,
                    pointerEvents: richSlotCount === 0 || cardContentVisible ? "auto" : "none",
                  },
                ]}
              >
                {question.display.passage ? (
                  <View
                    style={[
                      styles.passageBox,
                      { borderColor: colors.border, backgroundColor: `${colors.secondary}99` },
                    ]}
                  >
                    <RichHtml
                      value={question.display.passage}
                      locale={locale}
                      imageUrls={question.imageUrls}
                      minHeight={48}
                      fixedContentWidth={Math.max(120, richColW - 32)}
                    />
                  </View>
                ) : null}
                {question.display.stem ? (
                  <RichHtml
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

                <View style={styles.optionsCol}>
                  {question.answerOptions.map((opt, i) => {
                    const checked = selectedIds.includes(opt.id)
                    const rowBg = checked ? colors.foreground : colors.card
                    const rowBorder = checked ? colors.foreground : colors.border
                    const letterBg = checked ? colors.background : colors.secondary
                    const letterBorder = checked ? colors.background : colors.border
                    const letterFg = checked ? colors.foreground : colors.mutedForeground
                    const htmlColor = checked ? colors.background : colors.foreground

                    return (
                      <Pressable
                        key={opt.id}
                        onPress={() => onOptionPress(opt.id)}
                        style={[styles.option, { borderColor: rowBorder, backgroundColor: rowBg }]}
                      >
                        <View
                          style={[
                            styles.letterCircle,
                            {
                              borderColor: letterBorder,
                              backgroundColor: letterBg,
                            },
                          ]}
                        >
                          <Text style={[styles.letterTxt, { color: letterFg }]}>
                            {String.fromCharCode(65 + i)}
                          </Text>
                        </View>
                        <View style={styles.optionBody}>
                          <RichHtml
                            value={opt.content ?? opt.text}
                            locale={locale}
                            imageUrls={question.imageUrls}
                            minHeight={36}
                            bodyColor={htmlColor}
                            fixedContentWidth={Math.max(160, richColW - 68)}
                          />
                          {opt.imageUrl ? <QuestionMedia src={opt.imageUrl} /> : null}
                        </View>
                      </Pressable>
                    )
                  })}
                </View>

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
  optionsCol: { gap: 8, width: "100%", alignSelf: "stretch" },
  option: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    paddingVertical: 12,
    paddingHorizontal: 16,
    maxWidth: "100%",
    alignSelf: "stretch",
    flexShrink: 1,
    overflow: "hidden",
  },
  letterCircle: {
    marginTop: 2,
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
  letterTxt: {
    fontSize: 11,
    fontWeight: "700",
    fontVariant: ["tabular-nums"],
  },
  optionBody: {
    flex: 1,
    flexShrink: 1,
    minWidth: 0,
    maxWidth: "100%",
    overflow: "hidden",
    alignSelf: "stretch",
  },
  multiHint: { fontSize: 11, marginTop: 4 },
})
