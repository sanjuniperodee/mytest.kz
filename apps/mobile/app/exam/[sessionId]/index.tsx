import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import {
  ActivityIndicator,
  Alert,
  AppState,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Calculator } from "@/components/exam/Calculator"
import { ExamQuestionContent } from "@/components/exam/ExamQuestionContent"
import { ExamQuestionGrid } from "@/components/exam/ExamQuestionGrid"
import { ExamTimer } from "@/components/exam/ExamTimer"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { Locale } from "@/lib/api/i18n"
import { flattenSessionQuestions, type FlatSessionQuestion } from "@/lib/api/test-session"
import type { TestSession } from "@/lib/api/types"
import {
  EXAM_SIDEBAR_WIDTH,
  EXAM_WIDE_BREAKPOINT,
  EXAM_SIDEBAR_GRID_INNER,
} from "@/lib/exam/layout"
import {
  clearLastQuestionIndex,
  readLastQuestionIndex,
  writeLastQuestionIndex,
} from "@/lib/exam/session-question-index"
import { useAppTheme } from "@/lib/theme/provider"
import type { ThemeColors } from "@/lib/theme/colors"
import { fonts } from "@/lib/theme/fonts"

const LG = EXAM_WIDE_BREAKPOINT
const SIDEBAR_W = EXAM_SIDEBAR_WIDTH

interface AnswerResponse {
  id: string
  selectedIds: string[]
  serverTimeRemaining?: number | null
}

function ExamLogoMark({ colors }: { colors: ThemeColors }) {
  return (
    <View
      style={[
        styles.logoMark,
        { backgroundColor: colors.foreground },
      ]}
    >
      <MaterialCommunityIcons name="chart-timeline-variant" size={16} color={colors.background} />
    </View>
  )
}

export default function ExamSessionScreen() {
  const { sessionId } = useLocalSearchParams<{ sessionId: string }>()
  const { colors } = useAppTheme()
  const { width: winW, height: winH } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const isWide = winW >= LG
  const navGridInner = Math.max(240, winW - 80)

  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale

  const {
    data: session,
    isLoading,
    error,
    mutate: revalidateSession,
  } = useSWR<TestSession>(sessionId ? `/tests/sessions/${sessionId}` : null)

  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [activeIdx, setActiveIdx] = useState(0)
  /** Після async-відновлення індексу з AsyncStorage дозволяємо записувати зміни (щоб не затерти збережене «0» до read). */
  const [questionIdxHydrated, setQuestionIdxHydrated] = useState(false)
  const restoreQuestionIdxGenRef = useRef(0)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [showFinish, setShowFinish] = useState(false)
  const [showNav, setShowNav] = useState(false)
  /** Bottom sheet “Все вопросы”: measured header + scroll content height — avoid ScrollView % height white gap */
  const [navSheetHdrH, setNavSheetHdrH] = useState(0)
  const [navScrollContentH, setNavScrollContentH] = useState(0)
  const [showCalculator, setShowCalculator] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const initRef = useRef(false)
  const timeoutFinishRef = useRef(false)
  const timerEndMsRef = useRef<number | null>(null)
  const syncedServerRemainingRef = useRef<number | null>(null)
  const [timerEpoch, setTimerEpoch] = useState(0)

  const flat = useMemo<FlatSessionQuestion[]>(() => {
    if (!session) return []
    return flattenSessionQuestions(session, locale)
  }, [session, locale])

  useEffect(() => {
    if (!showNav) {
      setNavSheetHdrH(0)
      setNavScrollContentH(0)
    }
  }, [showNav])

  const armCountdown = useCallback((totalSeconds: number) => {
    const s = Math.max(0, Math.floor(Number(totalSeconds)))
    if (!Number.isFinite(s)) return
    timerEndMsRef.current = Date.now() + s * 1000
    syncedServerRemainingRef.current = s
    setRemaining(s)
    setTimerEpoch((n) => n + 1)
  }, [])

  useEffect(() => {
    restoreQuestionIdxGenRef.current += 1
    initRef.current = false
    timeoutFinishRef.current = false
    timerEndMsRef.current = null
    syncedServerRemainingRef.current = null
    setRemaining(null)
    setAnswers({})
    setQuestionIdxHydrated(false)
    setActiveIdx(0)
    setTimerEpoch((n) => n + 1)
  }, [sessionId])

  useEffect(() => {
    if (!sessionId || !session || session.id !== sessionId) return
    if (session.status !== "in_progress") return
    if (flat.length === 0) return
    const gen = restoreQuestionIdxGenRef.current
    void readLastQuestionIndex(user?.id, sessionId, flat.length).then((idx) => {
      if (gen !== restoreQuestionIdxGenRef.current) return
      setActiveIdx(idx)
      setQuestionIdxHydrated(true)
    })
  }, [sessionId, session?.id, session?.status, flat.length, user?.id])

  useEffect(() => {
    if (!session || session.id !== sessionId || initRef.current) return
    initRef.current = true
    const initial: Record<string, string[]> = {}
    for (const q of flat) {
      if (q.selectedIds && q.selectedIds.length > 0) {
        initial[q.id] = q.selectedIds
      }
    }
    setAnswers(initial)
  }, [session, sessionId, flat])

  useEffect(() => {
    if (!session || session.id !== sessionId) return
    if (session.status !== "in_progress") return
    if (session.timeRemaining == null || session.timeRemaining === undefined) return
    const tr = Math.max(0, Math.floor(Number(session.timeRemaining)))
    if (!Number.isFinite(tr)) return
    if (syncedServerRemainingRef.current === tr && timerEndMsRef.current != null) {
      return
    }
    armCountdown(tr)
  }, [session, sessionId, armCountdown])

  useEffect(() => {
    if (!questionIdxHydrated) return
    if (!sessionId || !session || session.status !== "in_progress") return
    void writeLastQuestionIndex(user?.id, sessionId, activeIdx)
  }, [questionIdxHydrated, sessionId, session?.status, activeIdx, user?.id])

  useEffect(() => {
    if (!sessionId || !session || session.id !== sessionId) return
    if (session.status === "in_progress") return
    void clearLastQuestionIndex(user?.id, sessionId)
    router.replace(`/exam/${sessionId}/review`)
  }, [sessionId, session?.id, session?.status, user?.id])

  useEffect(() => {
    if (timerEndMsRef.current == null) return

    const tick = () => {
      const end = timerEndMsRef.current
      if (end == null) return
      const next = Math.max(0, Math.ceil((end - Date.now()) / 1000))
      setRemaining(next)
      if (next <= 0) timerEndMsRef.current = null
    }
    tick()
    const id = setInterval(tick, 250)
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") tick()
    })
    return () => {
      clearInterval(id)
      sub.remove()
    }
  }, [sessionId, timerEpoch])

  useEffect(() => {
    const syncFromServer = () => {
      void revalidateSession().then((data) => {
        const s = data as TestSession | undefined
        if (s?.status === "in_progress" && s.timeRemaining != null) {
          armCountdown(Number(s.timeRemaining))
        }
      })
    }
    const sub = AppState.addEventListener("change", (state) => {
      if (state === "active") syncFromServer()
    })
    return () => sub.remove()
  }, [revalidateSession, armCountdown])

  const finish = useCallback(
    async (reason?: "timeout") => {
      if (finishing) return
      setFinishing(true)
      try {
        await api(`/tests/sessions/${sessionId}/finish`, { method: "POST" })
        void clearLastQuestionIndex(user?.id, sessionId)
        setShowFinish(false)
        if (reason === "timeout") {
          Alert.alert("Время вышло", "Тест завершён")
        }
        router.replace(`/exam/${sessionId}/review`)
      } catch (err) {
        Alert.alert("Ошибка", err instanceof ApiError ? err.message : "Не удалось завершить тест")
        setFinishing(false)
        if (reason === "timeout") timeoutFinishRef.current = false
      }
    },
    [finishing, sessionId, user?.id],
  )

  useEffect(() => {
    if (remaining !== 0 || session?.status !== "in_progress") return
    if (timeoutFinishRef.current) return
    timeoutFinishRef.current = true
    void finish("timeout")
  }, [remaining, session?.status, finish])

  const submitAnswer = useCallback(
    async (questionId: string, selectedIds: string[]) => {
      setSavingId(questionId)
      try {
        const res = await api<AnswerResponse>(`/tests/sessions/${sessionId}/answer`, {
          method: "POST",
          body: { questionId, selectedIds },
        })
        if (res.serverTimeRemaining != null && res.serverTimeRemaining !== undefined) {
          armCountdown(Number(res.serverTimeRemaining))
        }
      } catch (err) {
        Alert.alert("Ошибка", err instanceof ApiError ? err.message : "Ошибка сохранения ответа")
      } finally {
        setSavingId((cur) => (cur === questionId ? null : cur))
      }
    },
    [sessionId, armCountdown],
  )

  const examThemeColors = useMemo(
    () => ({
      foreground: colors.foreground,
      background: colors.background,
      card: colors.card,
      border: colors.border,
      mutedForeground: colors.mutedForeground,
      secondary: colors.secondary,
    }),
    [colors.foreground, colors.background, colors.card, colors.border, colors.mutedForeground, colors.secondary],
  )

  const onSelect = useCallback(
    (q: FlatSessionQuestion, optionId: string) => {
      const current = answers[q.id] || []
      let next: string[]
      if (q.multiSelect) {
        if (q.maxSelections && !current.includes(optionId) && current.length >= q.maxSelections) {
          return
        }
        next = current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId]
      } else {
        next = [optionId]
      }
      setAnswers((a) => ({ ...a, [q.id]: next }))
      submitAnswer(q.id, next)
    },
    [answers, submitAnswer],
  )

  const activeCtxRef = useRef({ flat, activeIdx })
  activeCtxRef.current = { flat, activeIdx }

  const onOptionPress = useCallback(
    (optionId: string) => {
      const { flat: fl, activeIdx: idx } = activeCtxRef.current
      const q = fl[idx]
      if (q) onSelect(q, optionId)
    },
    [onSelect],
  )

  if (isLoading) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: colors.background }]}>
        <View style={[styles.skelLine, { width: "50%", backgroundColor: colors.secondary }]} />
        <View style={[styles.skelBlock, { backgroundColor: colors.secondary }]} />
        <View style={[styles.skelLine, { width: "100%", backgroundColor: colors.secondary }]} />
        <View style={[styles.skelLine, { width: "100%", backgroundColor: colors.secondary }]} />
      </View>
    )
  }

  if (error) {
    return (
      <View style={[styles.loaderWrap, { backgroundColor: colors.background, padding: 24 }]}>
        <Card style={{ padding: 28, width: "100%", maxWidth: 400 }}>
          <View style={{ alignItems: "center", gap: 12 }}>
            <MaterialCommunityIcons name="alert-circle-outline" size={36} color="#F43F5E" />
            <Text style={[styles.errTitle, { color: colors.foreground }]}>Не удалось загрузить сессию</Text>
            <Text style={[styles.errSub, { color: colors.mutedForeground }]}>
              {(error as ApiError).message || "Попробуйте обновить страницу"}
            </Text>
            <Button onPress={() => router.replace("/dashboard/exams")}>К каталогу</Button>
          </View>
        </Card>
      </View>
    )
  }

  if (!session || flat.length === 0) {
    return null
  }

  const current = flat[activeIdx]
  const total = flat.length
  const answered = Object.keys(answers).filter((id) => (answers[id] || []).length > 0).length
  const progress = Math.round((answered / total) * 100)
  const selected = answers[current.id] || []

  const outlineBtnStyle = [styles.headerOutlineBtn, { borderColor: colors.border, backgroundColor: colors.card }]
  const primaryBtnStyle = [styles.headerPrimaryBtn, { backgroundColor: colors.foreground }]

  const navSheetMaxH = winH * 0.88
  const navHdrFallback = 88
  const hdrForNavScroll = navSheetHdrH > 0 ? navSheetHdrH : navHdrFallback
  const navScrollMax = Math.max(160, navSheetMaxH - hdrForNavScroll - 40)
  const navScrollNeedsCap = navScrollContentH > navScrollMax

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.background }]}>
        <Pressable
          onPress={() => router.replace("/dashboard")}
          style={styles.headerLeft}
          accessibilityRole="button"
          accessibilityLabel="Кабинет"
        >
          <ExamLogoMark colors={colors} />
        </Pressable>
        <View style={styles.headerRight}>
          <ExamTimer remaining={remaining} />
          <Pressable
            onPress={() => setShowCalculator(true)}
            style={outlineBtnStyle}
            accessibilityLabel="Калькулятор"
          >
            <MaterialCommunityIcons name="calculator-variant" size={18} color={colors.foreground} />
          </Pressable>
          {!isWide ? (
            <Pressable onPress={() => setShowNav(true)} style={[outlineBtnStyle, styles.headerNavCombo]}>
              <MaterialCommunityIcons name="format-list-checks" size={18} color={colors.foreground} />
              <Text style={[styles.headerNavNums, { color: colors.foreground }]}>
                {answered}/{total}
              </Text>
            </Pressable>
          ) : null}
          <Pressable
            onPress={() => setShowFinish(true)}
            style={primaryBtnStyle}
            accessibilityLabel="Завершить"
          >
            <MaterialCommunityIcons name="flag-outline" size={18} color={colors.background} />
            {winW >= 640 ? (
              <Text style={[styles.headerFinishTxt, { color: colors.background }]}>Завершить</Text>
            ) : null}
          </Pressable>
        </View>
      </View>

      <View style={[styles.progressTrack, { backgroundColor: colors.border }]}>
        <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: colors.foreground }]} />
      </View>

      <View style={styles.mainRow}>
        <View style={styles.mainCol}>
          <ScrollView
            style={styles.mainScroll}
            contentContainerStyle={{
              paddingHorizontal: 16,
              paddingTop: 24,
              paddingBottom: 24,
              maxWidth: isWide ? undefined : 896,
              alignSelf: "center",
              width: "100%",
            }}
            keyboardShouldPersistTaps="handled"
          >
            <ExamQuestionContent
              activeIdx={activeIdx}
              total={total}
              question={current}
              selectedIds={selected}
              saving={savingId === current.id}
              locale={locale}
              colors={examThemeColors}
              onOptionPress={onOptionPress}
            />
          </ScrollView>

          <View
            style={[
              styles.bottomNavBar,
              {
                borderTopColor: colors.border,
                backgroundColor: colors.background,
                paddingBottom: Math.max(insets.bottom, 10),
              },
            ]}
          >
            <View style={styles.bottomNavInner}>
              <Pressable
                onPress={() => setActiveIdx((i) => Math.max(0, i - 1))}
                disabled={activeIdx === 0}
                style={[
                  styles.bottomBtn,
                  styles.bottomBtnOutline,
                  {
                    borderColor: colors.border,
                    backgroundColor: colors.card,
                    opacity: activeIdx === 0 ? 0.45 : 1,
                  },
                ]}
              >
                <MaterialCommunityIcons name="arrow-left" size={18} color={colors.foreground} />
                <Text style={[styles.bottomBtnTxt, { color: colors.foreground }]}>Назад</Text>
              </Pressable>
              {activeIdx < total - 1 ? (
                <Pressable
                  onPress={() => setActiveIdx((i) => Math.min(total - 1, i + 1))}
                  style={[styles.bottomBtn, { backgroundColor: colors.foreground }]}
                >
                  <Text style={[styles.bottomBtnTxt, { color: colors.background }]}>Далее</Text>
                  <MaterialCommunityIcons name="arrow-right" size={18} color={colors.background} />
                </Pressable>
              ) : (
                <Pressable
                  onPress={() => setShowFinish(true)}
                  style={[styles.bottomBtn, { backgroundColor: colors.foreground }]}
                >
                  <MaterialCommunityIcons name="flag-outline" size={18} color={colors.background} />
                  <Text style={[styles.bottomBtnTxt, { color: colors.background }]}>Завершить</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>

        {isWide ? (
          <View style={[styles.sidebar, { borderLeftColor: colors.border }]}>
            <ExamQuestionGrid
              flat={flat}
              answers={answers}
              activeIdx={activeIdx}
              onSelect={setActiveIdx}
              answered={answered}
              total={total}
              colors={colors}
              gridInnerWidth={EXAM_SIDEBAR_GRID_INNER}
            />
          </View>
        ) : null}
      </View>

      <Calculator open={showCalculator} onClose={() => setShowCalculator(false)} />

      <Modal visible={showNav} transparent animationType="slide">
        <View style={styles.modalRoot}>
          <Pressable style={styles.modalBackdrop} onPress={() => setShowNav(false)} />
          <View style={styles.modalBottomWrap} pointerEvents="box-none">
            <View style={[styles.navSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View
                onLayout={(e) => {
                  const h = Math.ceil(e.nativeEvent.layout.height)
                  if (h <= 0) return
                  setNavSheetHdrH((prev) => (Math.abs(h - prev) > 1 ? h : prev))
                }}
              >
                <Text style={[styles.modalTitle, { color: colors.foreground }]}>Все вопросы</Text>
                <Text style={[styles.modalDesc, { color: colors.mutedForeground }]}>
                  Отвечено <Text style={styles.tabNums}>{answered}</Text> из{" "}
                  <Text style={styles.tabNums}>{total}</Text>
                </Text>
              </View>
              <ScrollView
                nestedScrollEnabled
                keyboardShouldPersistTaps="handled"
                style={navScrollNeedsCap ? { maxHeight: navScrollMax } : undefined}
                contentContainerStyle={styles.navSheetScrollContent}
                onContentSizeChange={(_, h) => {
                  const rounded = Math.ceil(h)
                  if (rounded <= 0) return
                  setNavScrollContentH((prev) => (Math.abs(rounded - prev) > 1 ? rounded : prev))
                }}
              >
                <ExamQuestionGrid
                  flat={flat}
                  answers={answers}
                  activeIdx={activeIdx}
                  onSelect={(i) => {
                    setActiveIdx(i)
                    setShowNav(false)
                  }}
                  answered={answered}
                  total={total}
                  colors={colors}
                  gridInnerWidth={navGridInner}
                />
              </ScrollView>
            </View>
          </View>
        </View>
      </Modal>

      <Modal visible={showFinish} transparent animationType="fade">
        <View style={styles.finishOverlay}>
          <Pressable style={StyleSheet.absoluteFillObject} onPress={() => !finishing && setShowFinish(false)} />
          <View style={[styles.finishSheet, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.modalTitle, { color: colors.foreground }]}>Завершить тест?</Text>
          <Text style={[styles.finishDesc, { color: colors.mutedForeground }]}>
            Вы ответили на <Text style={styles.tabNums}>{answered}</Text> из{" "}
            <Text style={styles.tabNums}>{total}</Text> вопросов. После завершения вернуться к изменениям нельзя.
          </Text>
          <View style={styles.finishActions}>
            <Pressable
              onPress={() => setShowFinish(false)}
              disabled={finishing}
              style={[
                styles.bottomBtn,
                styles.bottomBtnOutline,
                { flex: 1, borderColor: colors.border, backgroundColor: colors.card, opacity: finishing ? 0.45 : 1 },
              ]}
            >
              <Text style={[styles.bottomBtnTxt, { color: colors.foreground }]}>Продолжить</Text>
            </Pressable>
            <Pressable
              onPress={() => void finish()}
              disabled={finishing}
              style={[
                styles.bottomBtn,
                { flex: 1, backgroundColor: colors.foreground, opacity: finishing ? 0.6 : 1 },
              ]}
            >
              {finishing ? (
                <ActivityIndicator color={colors.background} />
              ) : (
                <>
                  <MaterialCommunityIcons name="check-circle-outline" size={18} color={colors.background} />
                  <Text style={[styles.bottomBtnTxt, { color: colors.background }]}>Завершить</Text>
                </>
              )}
            </Pressable>
          </View>
        </View>
        </View>
      </Modal>
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
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
    paddingHorizontal: 16,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  headerLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  headerRight: { flexDirection: "row", alignItems: "center", gap: 8 },
  headerOutlineBtn: {
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 40,
  },
  headerNavCombo: { flexDirection: "row", gap: 6 },
  headerNavNums: { fontSize: 12, fontWeight: "600", fontVariant: ["tabular-nums"] },
  headerPrimaryBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    minHeight: 40,
  },
  headerFinishTxt: { fontSize: 14, fontWeight: "600" },
  progressTrack: { height: 2, width: "100%" },
  progressFill: { height: 2 },
  mainRow: { flex: 1, flexDirection: "row" },
  mainCol: { flex: 1, minWidth: 0 },
  mainScroll: { flex: 1 },
  bottomNavBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: 12,
    paddingHorizontal: 16,
  },
  bottomNavInner: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    alignItems: "center",
    maxWidth: 896,
    width: "100%",
    alignSelf: "center",
  },
  sidebar: {
    width: SIDEBAR_W,
    borderLeftWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  bottomBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    minHeight: 44,
    flexShrink: 0,
  },
  bottomBtnOutline: {
    borderWidth: StyleSheet.hairlineWidth,
  },
  bottomBtnTxt: { fontSize: 15, fontWeight: "600" },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0,0,0,0.45)",
  },
  modalRoot: {
    flex: 1,
  },
  modalBottomWrap: {
    flex: 1,
    justifyContent: "flex-end",
    paddingHorizontal: 16,
    paddingBottom: 24,
  },
  navSheet: {
    width: "100%",
    borderRadius: 16,
    padding: 20,
    borderWidth: StyleSheet.hairlineWidth,
    maxHeight: "88%",
  },
  navSheetScrollContent: {
    flexGrow: 0,
    paddingBottom: 4,
  },
  finishOverlay: {
    flex: 1,
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.45)",
    paddingHorizontal: 24,
  },
  finishSheet: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 400,
    borderRadius: 16,
    padding: 22,
    borderWidth: StyleSheet.hairlineWidth,
  },
  modalTitle: { fontSize: 18, fontFamily: fonts.sansSemi },
  modalDesc: { fontSize: 14, marginTop: 8, lineHeight: 20 },
  finishDesc: { fontSize: 14, marginTop: 10, lineHeight: 22 },
  tabNums: { fontWeight: "700", fontVariant: ["tabular-nums"] },
  finishActions: { flexDirection: "row", gap: 12, marginTop: 22 },
  loaderWrap: {
    flex: 1,
    padding: 24,
    gap: 16,
    maxWidth: 768,
    alignSelf: "center",
    width: "100%",
  },
  skelLine: { height: 14, borderRadius: 8 },
  skelBlock: { height: 128, borderRadius: 12, width: "100%" },
  errTitle: { fontSize: 17, fontFamily: fonts.sansSemi, textAlign: "center" },
  errSub: { fontSize: 14, textAlign: "center", lineHeight: 20 },
})
