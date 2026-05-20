"use client"

import { use, useCallback, useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Flag,
  ListChecks,
  Calculator,
  ExternalLink,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
import { ExamTimer } from "@/components/exam/timer"
import { Calculator as ExamCalculator } from "@/components/exam/calculator"
import { QuestionMedia } from "@/components/exam/question-media"
import {
  RichText,
  getDetachedImageUrls,
  imageReferenceText,
} from "@/components/exam/rich-text"
import { Logo } from "@/components/landing/logo"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { Locale } from "@/lib/api/i18n"
import { localize } from "@/lib/api/i18n"
import { flattenSessionQuestions, type FlatSessionQuestion } from "@/lib/api/test-session"
import { cn } from "@/lib/utils"
import type {
  QuestionAppeal,
  QuestionAppealReason,
  QuestionAppealStatus,
  TestSession,
} from "@/lib/api/types"

const TELEGRAM_CHANNEL_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL ?? "https://t.me/bilimilimland"

function isChannelSubscriptionError(err: unknown): boolean {
  if (!(err instanceof ApiError) || err.status !== 403) return false
  if (err.code === "TELEGRAM_CHANNEL_REQUIRED") return true
  const m = (err.message || "").toLowerCase()
  return (
    m.includes("channel subscription") ||
    m.includes("telegram channel membership")
  )
}

const SESSION_LOAD_ERR: Record<Locale, { title: string; fallback: string; catalog: string }> = {
  ru: {
    title: "Не удалось загрузить сессию",
    fallback: "Попробуйте обновить страницу.",
    catalog: "К каталогу",
  },
  kk: {
    title: "Сессияны жүктеу мүмкін болмады",
    fallback: "Бетті жаңартып көріңіз.",
    catalog: "Каталогқа",
  },
  en: {
    title: "Could not load session",
    fallback: "Try refreshing the page.",
    catalog: "Back to catalog",
  },
}

const CHANNEL_GATE_ERR: Record<
  Locale,
  { headline: string; hint: string; openChannel: string; recheck: string; catalog: string }
> = {
  ru: {
    headline: "Нужна подписка на канал",
    hint: "Подпишитесь на канал школы в Telegram, затем нажмите «Проверить подписку». Важно пользоваться тем же аккаунтом Telegram, с которым вы вошли в приложение.",
    openChannel: "Открыть канал",
    recheck: "Проверить подписку",
    catalog: "К каталогу",
  },
  kk: {
    headline: "Telegram арнасына жазылу қажет",
    hint: "Мектептің Telegram-арнасына жазылыңыз, содан кейін «Жазылымды тексеру» батырмасын басыңыз. Кірген аккаунтпен қолданылатын Telegram бірдей болуы керек.",
    openChannel: "Арнаны ашу",
    recheck: "Жазылымды тексеру",
    catalog: "Каталогқа",
  },
  en: {
    headline: "Subscribe to our Telegram channel",
    hint: "Join the channel, then tap “Check subscription”. Use the same Telegram account you logged in with.",
    openChannel: "Open channel",
    recheck: "Check subscription",
    catalog: "Back to catalog",
  },
}

interface AnswerResponse {
  id: string
  selectedIds: string[]
  serverTimeRemaining?: number | null
}

export default function ExamSessionPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { user, refresh } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data: session, isLoading, error, mutate: revalidateSession } = useSWR<TestSession>(
    `/tests/sessions/${sessionId}`,
  )

  const [channelRechecking, setChannelRechecking] = useState(false)
  const [answers, setAnswers] = useState<Record<string, string[]>>({})
  const [activeIdx, setActiveIdx] = useState(0)
  const [savingId, setSavingId] = useState<string | null>(null)
  const [remaining, setRemaining] = useState<number | null>(null)
  const [showFinish, setShowFinish] = useState(false)
  const [showNav, setShowNav] = useState(false)
  const [showCalculator, setShowCalculator] = useState(false)
  const [finishing, setFinishing] = useState(false)
  const initRef = useRef(false)
  const timeoutFinishRef = useRef(false)
  /** Wall-clock end for countdown (survives background throttling / Telegram WebView). */
  const timerEndMsRef = useRef<number | null>(null)
  /** Last `timeRemaining` (seconds) we synced from the server into the wall-clock deadline. */
  const syncedServerRemainingRef = useRef<number | null>(null)
  const [timerEpoch, setTimerEpoch] = useState(0)

  const flat = useMemo<FlatSessionQuestion[]>(() => {
    if (!session) return []
    return flattenSessionQuestions(session, locale)
  }, [session, locale])

  const retrySessionAfterChannelSync = useCallback(async () => {
    setChannelRechecking(true)
    try {
      await refresh()
      await revalidateSession()
    } finally {
      setChannelRechecking(false)
    }
  }, [refresh, revalidateSession])

  const armCountdown = useCallback((totalSeconds: number) => {
    const s = Math.max(0, Math.floor(Number(totalSeconds)))
    if (!Number.isFinite(s)) return
    timerEndMsRef.current = Date.now() + s * 1000
    syncedServerRemainingRef.current = s
    setRemaining(s)
    setTimerEpoch((n) => n + 1)
  }, [])

  // New session in URL: reset client state (same route can remount without full remount)
  useEffect(() => {
    initRef.current = false
    timeoutFinishRef.current = false
    timerEndMsRef.current = null
    syncedServerRemainingRef.current = null
    setRemaining(null)
    setAnswers({})
    setActiveIdx(0)
    setTimerEpoch((n) => n + 1)
  }, [sessionId])

  // Initialise local answers once per session load (timer sync is separate — see below)
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

  // Wall-clock deadline from server (runs when SWR gets timeRemaining; skips duplicate snapshots)
  useEffect(() => {
    if (!session || session.id !== sessionId) return
    if (session.status !== "in_progress") return
    if (session.timeRemaining == null || session.timeRemaining === undefined) return
    const tr = Math.max(0, Math.floor(Number(session.timeRemaining)))
    if (!Number.isFinite(tr)) return
    if (
      syncedServerRemainingRef.current === tr &&
      timerEndMsRef.current != null
    ) {
      return
    }
    armCountdown(tr)
  }, [session, sessionId, armCountdown])

  // Redirect already-finished session to review
  useEffect(() => {
    if (session && session.status !== "in_progress") {
      router.replace(`/exam/${sessionId}/review`)
    }
  }, [session, sessionId, router])

  // Отображение относительно wall-clock дедлайна; при возврате на вкладку / из bfcache подтягиваем тик.
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
    const onVis = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVis)
    const onPageShow = () => tick()
    window.addEventListener("pageshow", onPageShow)
    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [sessionId, timerEpoch])

  // Вкладка / мини-приложение: при возврате фокуса синхронизируем время с сервером
  useEffect(() => {
    const syncFromServer = () => {
      if (document.visibilityState !== "visible") return
      void revalidateSession().then((data) => {
        const s = data as TestSession | undefined
        if (s?.status === "in_progress" && s.timeRemaining != null) {
          armCountdown(Number(s.timeRemaining))
        }
      })
    }
    document.addEventListener("visibilitychange", syncFromServer)
    window.addEventListener("focus", syncFromServer)
    return () => {
      document.removeEventListener("visibilitychange", syncFromServer)
      window.removeEventListener("focus", syncFromServer)
    }
  }, [revalidateSession, armCountdown])

  // Auto-finish on timeout
  const finish = useCallback(
    async (reason?: "timeout") => {
      if (finishing) return
      setFinishing(true)
      try {
        await api(`/tests/sessions/${sessionId}/finish`, { method: "POST" })
        if (reason === "timeout") toast.message("Время вышло, тест завершён")
        else toast.success("Тест завершён")
        router.replace(`/exam/${sessionId}/review`)
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Не удалось завершить тест")
        setFinishing(false)
        if (reason === "timeout") timeoutFinishRef.current = false
      }
    },
    [finishing, router, sessionId],
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
        const res = await api<AnswerResponse>(
          `/tests/sessions/${sessionId}/answer`,
          {
            method: "POST",
            body: { questionId, selectedIds },
          },
        )
        if (res.serverTimeRemaining != null && res.serverTimeRemaining !== undefined) {
          armCountdown(Number(res.serverTimeRemaining))
        }
      } catch (err) {
        toast.error(err instanceof ApiError ? err.message : "Ошибка сохранения ответа")
      } finally {
        setSavingId((cur) => (cur === questionId ? null : cur))
      }
    },
    [sessionId, armCountdown],
  )

  const onSelect = (q: FlatSessionQuestion, optionId: string) => {
    const current = answers[q.id] || []
    let next: string[]
    if (q.multiSelect) {
      if (q.maxSelections && !current.includes(optionId) && current.length >= q.maxSelections) {
        return
      }
      next = current.includes(optionId)
        ? current.filter((x) => x !== optionId)
        : [...current, optionId]
    } else {
      next = [optionId]
    }
    setAnswers((a) => ({ ...a, [q.id]: next }))
    submitAnswer(q.id, next)
  }

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-3xl flex-col gap-6 p-6">
        <Skeleton className="h-12 w-1/2" />
        <Skeleton className="h-32 w-full" />
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </div>
    )
  }

  if (error) {
    const errCopy = SESSION_LOAD_ERR[locale] ?? SESSION_LOAD_ERR.ru
    const channelBlocked = isChannelSubscriptionError(error)
    const chCopy = CHANNEL_GATE_ERR[locale] ?? CHANNEL_GATE_ERR.ru
    const apiErr = error as ApiError

    return (
      <div className="mx-auto max-w-md p-6 text-center">
        <Card>
          <CardContent
            data-no-translate
            className="flex flex-col items-center gap-3 py-10 text-balance"
          >
            <AlertTriangle className="size-8 text-rose-500" />
            {channelBlocked ? (
              <>
                <p className="font-semibold">{chCopy.headline}</p>
                <p className="text-muted-foreground text-sm leading-relaxed">{chCopy.hint}</p>
                <div className="flex w-full flex-col gap-2 sm:flex-row sm:justify-center">
                  <Button variant="outline" className="w-full sm:flex-1" asChild>
                    <a href={TELEGRAM_CHANNEL_URL} target="_blank" rel="noreferrer noopener">
                      <ExternalLink className="mr-2 size-4 shrink-0" />
                      {chCopy.openChannel}
                    </a>
                  </Button>
                  <Button
                    className="w-full sm:flex-1"
                    disabled={channelRechecking}
                    onClick={() => void retrySessionAfterChannelSync()}
                  >
                    {channelRechecking ? (
                      <Spinner className="size-4" />
                    ) : (
                      chCopy.recheck
                    )}
                  </Button>
                </div>
              </>
            ) : (
              <>
                <p className="font-semibold">{errCopy.title}</p>
                <p className="text-muted-foreground text-sm">
                  {apiErr.message || errCopy.fallback}
                </p>
              </>
            )}
            <Button asChild className={channelBlocked ? "mt-2" : undefined}>
              <Link href="/dashboard/exams">{channelBlocked ? chCopy.catalog : errCopy.catalog}</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
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
  const currentDetachedImageUrls = getDetachedImageUrls(current.imageUrls, [
    current.display.passage ?? "",
    current.display.topicLine ?? "",
    current.display.stem,
    ...current.answerOptions.map((opt) => localize(opt.content ?? opt.text, locale)),
    imageReferenceText(current.explanation),
  ])

  return (
    <div className="flex min-h-svh flex-col">
      {/* Top bar */}
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-2 min-w-0">
            <Logo />
            <span className="hidden truncate text-sm font-semibold lowercase sm:inline">
              {localize(session.examType?.name, locale) || "Пробник"}
            </span>
          </Link>
          <div className="flex items-center gap-2">
            <ExamTimer remaining={remaining} />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowCalculator(true)}
              aria-label="Калькулятор"
            >
              <Calculator className="size-4" />
            </Button>
            <ExamQuestionAppealBlock
              sessionId={sessionId}
              questionId={current.id}
              appeal={session.appeals?.find((item) => item.questionId === current.id) ?? null}
              compact
              onAppealSaved={(appeal) => {
                void revalidateSession((currentSession) => {
                  if (!currentSession) return currentSession
                  const nextAppeals = upsertAppeal(currentSession.appeals || [], appeal)
                  return {
                    ...currentSession,
                    appeals: nextAppeals,
                  }
                }, false)
              }}
            />
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowNav(true)}
              className="lg:hidden"
            >
              <ListChecks className="size-4" />
              <span data-no-translate className="tabular-nums">
                {answered}/{total}
              </span>
            </Button>
            <Button size="sm" onClick={() => setShowFinish(true)}>
              <Flag className="size-4" />
              <span className="hidden sm:inline">Завершить</span>
            </Button>
          </div>
        </div>
        {/* progress bar */}
        <div className="h-0.5 w-full bg-border">
          <div
            className="h-full bg-foreground transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-7xl flex-1 gap-6 px-4 py-6 lg:py-8">
        {/* Question */}
        <div className="flex-1 min-w-0">
          {current.sectionTitle && (
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {current.sectionTitle}
            </p>
          )}
          <div className="mb-4 flex items-baseline justify-between gap-3">
            <h1 className="text-xl font-semibold tracking-tight">
              Вопрос{" "}
              <span data-no-translate className="tabular-nums">
                {activeIdx + 1}
                <span className="text-muted-foreground font-normal"> / {total}</span>
              </span>
            </h1>
            {savingId === current.id && (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Spinner className="size-3" /> Сохраняем
              </span>
            )}
          </div>

          <Card>
            <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
              {(() => {
                const qSubject = localize(current.subjectName, locale)
                return (
                  <>
                    {current.display.passage && (
                      <RichText
                        as="div"
                        value={current.display.passage}
                        locale={locale}
                        imageUrls={current.imageUrls}
                        className="rounded-md border border-border bg-secondary/40 p-4 text-sm leading-relaxed"
                      />
                    )}
                    {current.display.stem && (
                      <RichText
                        as="div"
                        value={current.display.stem}
                        locale={locale}
                        imageUrls={current.imageUrls}
                        className="text-sm leading-relaxed sm:text-base"
                      />
                    )}
                    {currentDetachedImageUrls.map((url, index) => (
                      <QuestionMedia key={`${current.id}-${index}`} src={url} alt={qSubject} />
                    ))}
                  </>
                )
              })()}

              <div className="flex flex-col gap-2">
                {current.answerOptions.map((opt, i) => {
                  const checked = selected.includes(opt.id)
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => onSelect(current, opt.id)}
                      className={cn(
                        "flex items-start gap-3 rounded-md border px-4 py-3 text-left transition-colors",
                        checked
                          ? "border-foreground bg-foreground text-background"
                          : "border-border bg-card hover:border-foreground/40 hover:bg-secondary/40",
                      )}
                    >
                      <span
                        className={cn(
                          "mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border text-xs font-semibold",
                          checked
                            ? "border-background bg-background text-foreground"
                            : "border-border bg-secondary text-muted-foreground",
                        )}
                      >
                        {String.fromCharCode(65 + i)}
                      </span>
                      <div className="flex flex-col gap-2 min-w-0 flex-1">
                        <RichText
                          value={opt.content ?? opt.text}
                          locale={locale}
                          imageUrls={current.imageUrls}
                          className="text-sm leading-relaxed"
                        />
                        {opt.imageUrl && <QuestionMedia src={opt.imageUrl} />}
                      </div>
                    </button>
                  )
                })}
              </div>
            </CardContent>
          </Card>

          <div className="mt-4 flex items-center justify-between gap-3">
            <Button
              variant="outline"
              onClick={() => setActiveIdx((i) => Math.max(0, i - 1))}
              disabled={activeIdx === 0}
            >
              <ArrowLeft className="size-4" />
              Назад
            </Button>
            {activeIdx < total - 1 ? (
              <Button onClick={() => setActiveIdx((i) => Math.min(total - 1, i + 1))}>
                Далее
                <ArrowRight className="size-4" />
              </Button>
            ) : (
              <Button onClick={() => setShowFinish(true)} variant="default">
                <Flag className="size-4" />
                Завершить
              </Button>
            )}
          </div>
        </div>

        {/* Question grid (desktop) */}
        <aside className="hidden w-72 shrink-0 lg:block">
          <QuestionGrid
            flat={flat}
            answers={answers}
            activeIdx={activeIdx}
            onSelect={(i) => setActiveIdx(i)}
            answered={answered}
            total={total}
          />
        </aside>
      </div>

      {/* Question grid drawer (mobile) */}
      <Dialog open={showNav} onOpenChange={setShowNav}>
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Все вопросы</DialogTitle>
            <DialogDescription className="tabular-nums">
              Отвечено{" "}
              <span data-no-translate>{answered}</span> из{" "}
              <span data-no-translate>{total}</span>
            </DialogDescription>
          </DialogHeader>
          <QuestionGrid
            flat={flat}
            answers={answers}
            activeIdx={activeIdx}
            onSelect={(i) => {
              setActiveIdx(i)
              setShowNav(false)
            }}
            answered={answered}
            total={total}
            compact
          />
        </DialogContent>
      </Dialog>

      {/* Finish confirmation */}
      <Dialog open={showFinish} onOpenChange={setShowFinish}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Завершить тест?</DialogTitle>
            <DialogDescription>
              Вы ответили на <span data-no-translate className="tabular-nums">{answered}</span> из{" "}
              <span data-no-translate className="tabular-nums">{total}</span> вопросов. После
              завершения вернуться к изменениям нельзя.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowFinish(false)} disabled={finishing}>
              Продолжить
            </Button>
            <Button onClick={() => finish()} disabled={finishing}>
              {finishing ? (
                <Spinner className="size-4" />
              ) : (
                <>
                  <CheckCircle2 className="size-4" />
                  Завершить
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ExamCalculator open={showCalculator} onClose={() => setShowCalculator(false)} />
    </div>
  )
}

const APPEAL_REASON_OPTIONS: Array<{
  value: QuestionAppealReason
  label: string
  hint: string
}> = [
  {
    value: "incorrect_answer",
    label: "Неверный ответ",
    hint: "Ключ ответа не совпадает с условием или отмечен неправильно.",
  },
  {
    value: "ambiguous_wording",
    label: "Неясная формулировка",
    hint: "Условие или варианты читаются двусмысленно.",
  },
  {
    value: "outdated_content",
    label: "Устаревший контент",
    hint: "В вопросе устаревший факт, цифра или формулировка.",
  },
  {
    value: "broken_media",
    label: "Проблема с медиа",
    hint: "Картинка, схема или часть контента отображается некорректно.",
  },
  {
    value: "other",
    label: "Другое",
    hint: "Любая другая проблема, которую важно описать вручную.",
  },
]

function appealStatusMeta(status: QuestionAppealStatus): {
  label: string
  className: string
  textClassName: string
} {
  if (status === "resolved") {
    return {
      label: "Решена",
      className: "bg-emerald-600 hover:bg-emerald-600",
      textClassName: "text-emerald-700",
    }
  }
  if (status === "rejected") {
    return {
      label: "Отклонена",
      className: "bg-rose-600 hover:bg-rose-600",
      textClassName: "text-rose-700",
    }
  }
  if (status === "under_review") {
    return {
      label: "На проверке",
      className: "bg-amber-600 hover:bg-amber-600",
      textClassName: "text-amber-700",
    }
  }
  return {
    label: "Отправлена",
    className: "bg-sky-600 hover:bg-sky-600",
    textClassName: "text-sky-700",
  }
}

function appealReasonLabel(reason: QuestionAppealReason) {
  return APPEAL_REASON_OPTIONS.find((item) => item.value === reason)?.label || "Апелляция"
}

function upsertAppeal(appeals: QuestionAppeal[], next: QuestionAppeal) {
  const existingIndex = appeals.findIndex((item) => item.questionId === next.questionId)
  if (existingIndex === -1) return [next, ...appeals]
  const cloned = [...appeals]
  cloned[existingIndex] = next
  return cloned
}

function ExamQuestionAppealBlock({
  sessionId,
  questionId,
  appeal,
  compact,
  onAppealSaved,
}: {
  sessionId: string
  questionId: string
  appeal: QuestionAppeal | null
  compact?: boolean
  onAppealSaved: (appeal: QuestionAppeal) => void
}) {
  const editable = !appeal || appeal.status === "pending"
  const meta = appeal ? appealStatusMeta(appeal.status) : null
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState<QuestionAppealReason>(appeal?.reason || "incorrect_answer")
  const [message, setMessage] = useState(appeal?.message || "")
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    if (!open) return
    setReason(appeal?.reason || "incorrect_answer")
    setMessage(appeal?.message || "")
  }, [appeal, open])

  const submitAppeal = async () => {
    const trimmed = message.trim()
    if (trimmed.length < 12) {
      toast.error("Опишите проблему чуть подробнее")
      return
    }

    setSubmitting(true)
    try {
      const saved = await api<QuestionAppeal>(
        `/tests/sessions/${sessionId}/questions/${questionId}/appeal`,
        {
          method: "POST",
          body: { reason, message: trimmed },
        },
      )
      onAppealSaved(saved)
      toast.success(appeal ? "Апелляция обновлена" : "Апелляция отправлена")
      setOpen(false)
    } catch (e) {
      const apiErr = e as ApiError
      toast.error(apiErr.message || "Не удалось отправить апелляцию")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
      {compact ? (
        <div className="flex items-center gap-1.5">
          {appeal && meta ? (
            <span
              className={cn(
                "hidden rounded-full px-2 py-0.5 text-[10px] font-medium text-white sm:inline-flex",
                meta.className,
              )}
            >
              {meta.label}
            </span>
          ) : null}
          <Button
            size="sm"
            variant="outline"
            className="h-8 gap-1.5 px-2 text-[11px] sm:text-xs"
            onClick={() => setOpen(true)}
          >
            <Flag className="size-3.5" />
            <span className="hidden md:inline">
              {appeal ? "Апелляция" : "Ошибка?"}
            </span>
          </Button>
        </div>
      ) : (
        <div className="rounded-md border border-border bg-secondary/20 p-3">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <Flag className="size-4" />
                  Нашли ошибку в вопросе?
                </span>
                {appeal && meta ? <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white", meta.className)}>{meta.label}</span> : null}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">
                Можно отправить апелляцию прямо во время экзамена и продолжить попытку без потери времени.
              </p>
              {appeal ? (
                <div className="mt-2 flex flex-col gap-1 text-sm">
                  <span className={meta?.textClassName}>
                    Причина: {appealReasonLabel(appeal.reason)}
                  </span>
                  {appeal.adminNote ? (
                    <span className="text-muted-foreground">Комментарий команды: {appeal.adminNote}</span>
                  ) : (
                    <span className="text-muted-foreground">Статус сохранён и будет доступен после проверки.</span>
                  )}
                </div>
              ) : null}
            </div>
            <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
              {appeal ? "Открыть апелляцию" : "Подать апелляцию"}
            </Button>
          </div>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Апелляция по текущему вопросу</DialogTitle>
            <DialogDescription>
              Мы сохраним снимок вопроса и вашего ответа на момент отправки. После этого можно сразу продолжить экзамен.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {appeal && meta ? (
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Текущий статус:</span>
                  <span className={cn("inline-flex rounded-full px-2 py-0.5 text-xs font-medium text-white", meta.className)}>
                    {meta.label}
                  </span>
                </div>
                {appeal.reviewedAt ? (
                  <p className="mt-2 text-muted-foreground">
                    Обновлено: {new Date(appeal.reviewedAt).toLocaleString("ru-RU")}
                  </p>
                ) : null}
                {appeal.adminNote ? (
                  <p className="mt-2 whitespace-pre-wrap text-foreground">{appeal.adminNote}</p>
                ) : null}
              </div>
            ) : null}

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor={`exam-appeal-reason-${questionId}`}>
                Причина
              </label>
              <select
                id={`exam-appeal-reason-${questionId}`}
                value={reason}
                onChange={(event) => setReason(event.target.value as QuestionAppealReason)}
                disabled={!editable || submitting}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                {APPEAL_REASON_OPTIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
              <p className="text-xs text-muted-foreground">
                {APPEAL_REASON_OPTIONS.find((item) => item.value === reason)?.hint}
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <label className="text-sm font-medium" htmlFor={`exam-appeal-message-${questionId}`}>
                Комментарий
              </label>
              <Textarea
                id={`exam-appeal-message-${questionId}`}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={!editable || submitting}
                rows={5}
                placeholder="Опишите ошибку: какой фрагмент вопроса неверный, чего не хватает или что отображается криво."
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
              Закрыть
            </Button>
            {editable ? (
              <Button onClick={submitAppeal} disabled={submitting}>
                {submitting ? <Spinner className="size-4" /> : <Flag className="size-4" />}
                {appeal ? "Сохранить" : "Отправить"}
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

function QuestionGrid({
  flat,
  answers,
  activeIdx,
  onSelect,
  answered,
  total,
  compact,
}: {
  flat: FlatSessionQuestion[]
  answers: Record<string, string[]>
  activeIdx: number
  onSelect: (i: number) => void
  answered: number
  total: number
  compact?: boolean
}) {
  // group by sectionTitle
  const groups: { title: string; items: { idx: number; q: FlatSessionQuestion }[] }[] = []
  flat.forEach((q, idx) => {
    const title = q.sectionTitle || ""
    const last = groups[groups.length - 1]
    if (!last || last.title !== title) groups.push({ title, items: [{ idx, q }] })
    else last.items.push({ idx, q })
  })

  return (
    <div className={cn("flex flex-col gap-4", compact ? "" : "sticky top-20")}>
      <div className="rounded-lg border border-border bg-card p-4">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Прогресс
        </p>
        <p data-no-translate className="mt-1 text-2xl font-semibold tabular-nums">
          {answered}/{total}
        </p>
      </div>
      <div className="rounded-lg border border-border bg-card p-4">
        {groups.map((g, gi) => (
          <div key={gi} className={gi > 0 ? "mt-4" : ""}>
            {g.title && (
              <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                {g.title}
              </p>
            )}
            <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-8 lg:grid-cols-5">
              {g.items.map(({ idx, q }) => {
                const isAnswered = (answers[q.id] || []).length > 0
                const isActive = idx === activeIdx
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => onSelect(idx)}
                    className={cn(
                      "flex h-9 w-full items-center justify-center rounded-md border text-xs font-semibold tabular-nums transition-colors",
                      isActive
                        ? "border-foreground bg-foreground text-background"
                        : isAnswered
                          ? "border-border bg-secondary text-foreground"
                          : "border-border bg-background text-muted-foreground hover:border-foreground/40",
                    )}
                  >
                    {idx + 1}
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
