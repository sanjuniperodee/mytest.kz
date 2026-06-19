"use client"

import { useCallback, useEffect, useState } from "react"
import useSWR from "swr"
import { toast } from "sonner"
import {
  AlertTriangle,
  BarChart3,
  BrainCircuit,
  CalendarRange,
  CheckCircle2,
  ChevronDown,
  ClipboardCheck,
  Lightbulb,
  LineChart as LineChartIcon,
  ListChecks,
  NotepadText,
  PartyPopper,
  RefreshCw,
  Sparkles,
  SquareFunction,
  Target,
  TrendingUp,
  Wand2,
} from "lucide-react"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  XAxis,
  YAxis,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart"
import {
  RichText,
  getDetachedImageUrls,
  imageReferenceText,
} from "@/components/exam/rich-text"
import { QuestionMedia } from "@/components/exam/question-media"
import { api, ApiError } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { cn } from "@/lib/utils"
import type {
  AiMistakeExplanation,
  AiSeverity,
  AiStoredAnalysisResponse,
  AiTopicLesson,
  AiWeakZoneAnalysis,
} from "@/lib/api/types"

interface AiMistakesCoachProps {
  language: "ru" | "kk"
  examTypeId: string // "all" or a concrete id
  totalOpen: number
  onTrainSubject: (subjectId: string) => void
}

const severityStyles: Record<AiSeverity, { label: string; chip: string; bar: string }> = {
  high: { label: "Высокий приоритет", chip: "bg-red-100 text-red-700", bar: "bg-red-500" },
  medium: { label: "Средний приоритет", chip: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  low: { label: "Низкий приоритет", chip: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
}

type ExplainState = {
  loading: boolean
  data: AiMistakeExplanation | null
  error: string | null
  open: boolean
}

type LessonState = {
  loading: boolean
  data: AiTopicLesson | null
  error: string | null
}

export function AiMistakesCoach({
  language,
  examTypeId,
  totalOpen,
  onTrainSubject,
}: AiMistakesCoachProps) {
  // Is AI configured at all? Cheap status check; hides the whole block if disabled.
  const { data: status } = useSWR<{ enabled: boolean }>("/ai/status")
  const enabled = status?.enabled ?? false

  const [analysis, setAnalysis] = useState<AiWeakZoneAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [loadingStored, setLoadingStored] = useState(true)
  const [explanations, setExplanations] = useState<Record<string, ExplainState>>({})
  const [lessons, setLessons] = useState<Record<string, LessonState>>({})
  const [selectedLessonTopicId, setSelectedLessonTopicId] = useState<string | null>(null)

  // Load any previously stored analysis instantly (no model call / cost).
  useEffect(() => {
    if (!enabled) {
      setLoadingStored(false)
      return
    }
    let cancelled = false
    setLoadingStored(true)
    api<AiStoredAnalysisResponse>("/ai/mistakes/analysis", {
      query: { examTypeId: examTypeId === "all" ? undefined : examTypeId },
    })
      .then((res) => {
        if (!cancelled) setAnalysis(res.analysis)
      })
      .catch(() => {
        /* stored analysis is best-effort */
      })
      .finally(() => {
        if (!cancelled) setLoadingStored(false)
      })
    return () => {
      cancelled = true
    }
  }, [enabled, examTypeId])

  const runAnalysis = useCallback(
    async (force: boolean) => {
      setLoading(true)
      void recordFunnelEvent("ai_weakzone_analyze", { force: String(force) })
      try {
        const result = await api<AiWeakZoneAnalysis>("/ai/mistakes/analyze", {
          method: "POST",
          body: {
            language,
            examTypeId: examTypeId === "all" ? undefined : examTypeId,
            force,
          },
        })
        setAnalysis(result)
      } catch (err) {
        let message = "Не удалось выполнить анализ. Попробуйте ещё раз."
        if (err instanceof ApiError) {
          if (err.message === "NO_OPEN_MISTAKES") {
            message = "Нет открытых ошибок для анализа"
          } else if (err.message === "AI_DISABLED") {
            message = "AI-анализ временно недоступен"
          } else if (err.message === "AI_DAILY_LIMIT") {
            message = "Дневной лимит AI на сегодня исчерпан — продолжишь завтра."
          } else if (err.message === "AI_BUSY") {
            message = "AI временно перегружен. Попробуйте чуть позже."
          } else if (err.status === 429) {
            message = "Слишком часто. Подождите минуту и попробуйте снова."
          } else if (err.status === 503) {
            message = "AI-сервис перегружен. Попробуйте чуть позже."
          }
        }
        toast.error(message)
      } finally {
        setLoading(false)
      }
    },
    [language, examTypeId],
  )

  const toggleExplain = useCallback(
    async (questionId: string) => {
      const current = explanations[questionId]
      if (current?.data || current?.loading) {
        setExplanations((prev) => ({
          ...prev,
          [questionId]: { ...prev[questionId], open: !prev[questionId].open },
        }))
        return
      }
      setExplanations((prev) => ({
        ...prev,
        [questionId]: { loading: true, data: null, error: null, open: true },
      }))
      try {
        const data = await api<AiMistakeExplanation>("/ai/mistakes/explain", {
          method: "POST",
          body: { questionId, language },
        })
        setExplanations((prev) => ({
          ...prev,
          [questionId]: { loading: false, data, error: null, open: true },
        }))
      } catch (err) {
        const message =
          err instanceof ApiError && err.message === "AI_DAILY_LIMIT"
            ? "Дневной лимит AI исчерпан — продолжишь завтра"
            : err instanceof ApiError && err.status === 429
              ? "Слишком часто, подождите минуту"
              : "Не удалось получить объяснение"
        setExplanations((prev) => ({
          ...prev,
          [questionId]: { loading: false, data: null, error: message, open: true },
        }))
      }
    },
    [explanations, language],
  )

  const openLesson = useCallback(
    async (topicId: string, force = false) => {
      const current = lessons[topicId]
      setSelectedLessonTopicId(topicId)
      if (current?.data && !force) return

      setLessons((prev) => ({
        ...prev,
        [topicId]: { loading: true, data: prev[topicId]?.data ?? null, error: null },
      }))
      void recordFunnelEvent("ai_topic_lesson_open", { force: String(force) })
      try {
        const data = await api<AiTopicLesson>("/ai/mistakes/topic-lesson", {
          method: "POST",
          body: { topicId, language, force },
        })
        setLessons((prev) => ({
          ...prev,
          [topicId]: { loading: false, data, error: null },
        }))
      } catch (err) {
        let message = "Не удалось подготовить урок. Попробуйте ещё раз."
        if (err instanceof ApiError) {
          if (err.message === "NO_OPEN_MISTAKES_FOR_TOPIC") {
            message = "Эта тема уже не числится среди открытых ошибок"
          } else if (err.message === "AI_DAILY_LIMIT") {
            message = "Дневной лимит AI на сегодня исчерпан — продолжишь завтра."
          } else if (err.message === "AI_BUSY") {
            message = "AI временно перегружен. Попробуйте чуть позже."
          } else if (err.status === 429) {
            message = "Слишком часто. Подождите минуту и попробуйте снова."
          } else if (err.status === 503) {
            message = "AI-сервис перегружен. Попробуйте чуть позже."
          }
        }
        setLessons((prev) => ({
          ...prev,
          [topicId]: { loading: false, data: prev[topicId]?.data ?? null, error: message },
        }))
        toast.error(message)
      }
    },
    [language, lessons],
  )

  if (!enabled) return null

  const hasAnalysis = analysis != null
  const disabledRun = loading || totalOpen === 0

  const selectedLesson = selectedLessonTopicId ? lessons[selectedLessonTopicId] : null

  return (
    <>
    <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50/80 to-background">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-white">
            <BrainCircuit className="size-4" />
          </span>
          AI-разбор слабых мест
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[11px] font-semibold text-violet-700">
            DeepSeek
          </span>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-5">
        {/* Intro / action row */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <p className="max-w-2xl text-sm leading-relaxed text-muted-foreground">
            AI разберёт твои реальные ошибки, найдёт корневые пробелы и составит
            персональный план подготовки — конкретно по тому, что стоит подтянуть.
          </p>
          <Button
            onClick={() => runAnalysis(hasAnalysis)}
            disabled={disabledRun}
            className="h-10 shrink-0 bg-violet-600 hover:bg-violet-700"
          >
            {loading ? (
              <Spinner className="size-4" />
            ) : (
              <Wand2 className="size-4" />
            )}
            {hasAnalysis ? "Обновить анализ" : "Анализировать с AI"}
          </Button>
        </div>

        {totalOpen === 0 && !hasAnalysis && (
          <p className="text-sm text-muted-foreground">
            Сначала пройди хотя бы один пробник — после него здесь появится разбор.
          </p>
        )}

        {/* Loading skeleton (first generation) */}
        {loading && !hasAnalysis && (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-24 w-full" />
            <Skeleton className="h-24 w-full" />
            <p className="text-xs text-muted-foreground">
              AI анализирует твои ошибки — это занимает несколько секунд…
            </p>
          </div>
        )}

        {loadingStored && !hasAnalysis && !loading && (
          <Skeleton className="h-4 w-40" />
        )}

        {hasAnalysis && analysis!.totalOpen === 0 && analysis!.weakZones.length === 0 ? (
          <ClearedState resolvedCount={analysis!.resolvedCount} />
        ) : hasAnalysis ? (
          <>
            {analysis!.stale && (
              <StaleBanner
                resolvedCount={analysis!.resolvedCount}
                loading={loading}
                onRefresh={() => runAnalysis(true)}
              />
            )}
            <AnalysisView
              analysis={analysis!}
              language={language}
              lessonStates={lessons}
              explanations={explanations}
              onExplain={toggleExplain}
              onOpenLesson={openLesson}
              onTrainSubject={onTrainSubject}
            />
          </>
        ) : null}
      </CardContent>
    </Card>
      <TopicLessonDialog
        language={language}
        state={selectedLesson ?? null}
        open={selectedLessonTopicId != null}
        onOpenChange={(open) => {
          if (!open) setSelectedLessonTopicId(null)
        }}
        onRegenerate={() => {
          if (selectedLessonTopicId) void openLesson(selectedLessonTopicId, true)
        }}
      />
    </>
  )
}

function StaleBanner({
  resolvedCount,
  loading,
  onRefresh,
}: {
  resolvedCount: number
  loading: boolean
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2 text-sm text-amber-900">
        <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-amber-600" />
        <p className="leading-relaxed">
          {resolvedCount > 0
            ? `Ты закрыл ${resolvedCount} ${pluralMistakes(resolvedCount)} с момента анализа. Разбор обновлён, а для свежей картины пересобери его.`
            : "Список ошибок изменился с момента анализа. Пересобери разбор, чтобы он был актуальным."}
        </p>
      </div>
      <Button
        variant="outline"
        size="sm"
        onClick={onRefresh}
        disabled={loading}
        className="shrink-0 border-amber-300 bg-white text-amber-800 hover:bg-amber-100"
      >
        {loading ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
        Пересобрать
      </Button>
    </div>
  )
}

function ClearedState({ resolvedCount }: { resolvedCount: number }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border border-emerald-200 bg-emerald-50 p-8 text-center">
      <span className="flex size-12 items-center justify-center rounded-full bg-emerald-600 text-white">
        <PartyPopper className="size-6" />
      </span>
      <div>
        <p className="text-lg font-semibold text-emerald-950">Все ошибки закрыты!</p>
        <p className="mt-1 text-sm text-emerald-900">
          {resolvedCount > 0
            ? `Ты проработал ${resolvedCount} ${pluralMistakes(resolvedCount)} из прошлого разбора. Отличная работа — слабых зон не осталось.`
            : "Открытых ошибок нет. Пройди новый пробник, чтобы продолжить тренировку."}
        </p>
      </div>
    </div>
  )
}

function pluralMistakes(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "ошибку"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ошибки"
  return "ошибок"
}

function pluralPoints(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "балл"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "балла"
  return "баллов"
}

function AnalysisView({
  analysis,
  language,
  lessonStates,
  explanations,
  onExplain,
  onOpenLesson,
  onTrainSubject,
}: {
  analysis: AiWeakZoneAnalysis
  language: "ru" | "kk"
  lessonStates: Record<string, LessonState>
  explanations: Record<string, ExplainState>
  onExplain: (questionId: string) => void
  onOpenLesson: (topicId: string) => void
  onTrainSubject: (subjectId: string) => void
}) {
  return (
    <div className="flex flex-col gap-5">
      {analysis.overview && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm leading-relaxed">
          {analysis.overview}
        </div>
      )}

      {/* Weak zones */}
      {analysis.weakZones.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <Target className="size-4 text-violet-600" />
            Слабые зоны
          </h3>
          {analysis.weakZones.map((zone, i) => {
            const sev = severityStyles[zone.severity]
            const lessonState = zone.topicId ? lessonStates[zone.topicId] : undefined
            return (
              <div key={i} className="overflow-hidden rounded-xl border border-border bg-card">
                <div className={cn("h-1 w-full", sev.bar)} />
                <div className="flex flex-col gap-3 p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-semibold leading-tight">{zone.title}</p>
                      {zone.subjectName && (
                        <p className="text-xs text-muted-foreground">{zone.subjectName}</p>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", sev.chip)}>
                        {sev.label}
                      </span>
                      {zone.pointsAtStake > 0 && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                          <TrendingUp className="size-3" />
                          ≈ +{zone.pointsAtStake} {pluralPoints(zone.pointsAtStake)}
                        </span>
                      )}
                    </div>
                  </div>

                  {zone.rootCause && (
                    <div className="flex gap-2 rounded-lg bg-secondary/60 p-3 text-sm">
                      <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                      <p className="leading-relaxed">{zone.rootCause}</p>
                    </div>
                  )}

                  {zone.recommendations.length > 0 && (
                    <ul className="flex flex-col gap-1.5">
                      {zone.recommendations.map((rec, ri) => (
                        <li key={ri} className="flex items-start gap-2 text-sm">
                          <Lightbulb className="mt-0.5 size-3.5 shrink-0 text-violet-600" />
                          <span className="leading-relaxed">{rec}</span>
                        </li>
                      ))}
                    </ul>
                  )}

                  {/* Example mistakes with on-demand AI explanation */}
                  {zone.examples.length > 0 && (
                    <div className="flex flex-col gap-2 border-t border-border pt-3">
                      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                        Примеры твоих ошибок
                      </p>
                      {zone.examples.map((ex) => {
                        const state = explanations[ex.questionId]
                        const detachedImageUrls = getDetachedImageUrls(ex.imageUrls, [
                          ex.passage ?? "",
                          ex.question ?? "",
                          imageReferenceText(ex.question),
                        ])
                        return (
                          <div key={ex.questionId} className="rounded-lg border border-border/70 bg-background">
                            <button
                              type="button"
                              onClick={() => onExplain(ex.questionId)}
                              className="flex w-full items-center gap-2 p-3 text-left text-sm transition-colors hover:bg-secondary/50"
                            >
                              <ChevronDown
                                className={cn(
                                  "size-4 shrink-0 text-muted-foreground transition-transform",
                                  state?.open && "rotate-180",
                                )}
                              />
                              <span className="min-w-0 flex-1 font-medium">
                                Открыть разбор
                                {ex.topic && (
                                  <span className="ml-2 rounded bg-secondary px-1.5 py-0.5 text-[11px] font-normal text-muted-foreground">
                                    {ex.topic}
                                  </span>
                                )}
                              </span>
                              <span className="shrink-0 text-xs font-medium text-violet-600">
                                Почему?
                              </span>
                            </button>
                            <div className="flex flex-col gap-2 border-t border-border/50 p-3 text-sm">
                              {ex.passage && (
                                <RichText
                                  as="div"
                                  value={ex.passage}
                                  locale={language}
                                  imageUrls={ex.imageUrls}
                                  className="rounded-md border border-border bg-secondary/40 p-3 leading-relaxed text-muted-foreground"
                                />
                              )}
                              {ex.question && (
                                <RichText
                                  as="div"
                                  value={ex.question}
                                  locale={language}
                                  imageUrls={ex.imageUrls}
                                  className="leading-relaxed text-foreground"
                                />
                              )}
                              {detachedImageUrls.map((url, index) => (
                                <QuestionMedia key={`${ex.questionId}-${index}`} src={url} />
                              ))}
                            </div>
                            {state?.open && (
                              <div className="border-t border-border/70 p-3 text-sm">
                                {state.loading && (
                                  <div className="flex items-center gap-2 text-muted-foreground">
                                    <Spinner className="size-4" /> AI разбирает ошибку…
                                  </div>
                                )}
                                {state.error && <p className="text-destructive">{state.error}</p>}
                                {state.data && <ExplanationView data={state.data} />}
                              </div>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}

                  {(zone.topicId || zone.subjectId) && (
                    <div className="flex flex-wrap gap-2">
                      {zone.topicId && (
                        <Button
                          variant="default"
                          size="sm"
                          onClick={() => onOpenLesson(zone.topicId!)}
                          disabled={lessonState?.loading}
                          className="bg-emerald-600 hover:bg-emerald-700"
                        >
                          {lessonState?.loading ? (
                            <Spinner className="size-4" />
                          ) : (
                            <NotepadText className="size-4" />
                          )}
                          Урок по теме
                        </Button>
                      )}
                      {zone.subjectId && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onTrainSubject(zone.subjectId!)}
                      >
                        <Target className="size-4" />
                        Тренировать предмет
                      </Button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* Study plan */}
      {analysis.studyPlan.length > 0 && (
        <div className="flex flex-col gap-3">
          <h3 className="flex items-center gap-2 text-sm font-semibold">
            <CalendarRange className="size-4 text-violet-600" />
            Персональный план подготовки
          </h3>
          <ol className="flex flex-col gap-2">
            {analysis.studyPlan.map((step) => (
              <li key={step.order} className="flex gap-3 rounded-xl border border-border bg-card p-3">
                <span className="flex size-7 shrink-0 items-center justify-center rounded-full bg-violet-600 text-sm font-semibold text-white">
                  {step.order}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center justify-between gap-1">
                    <p className="font-medium">{step.focus}</p>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                      ~{step.days} дн.
                    </span>
                  </div>
                  {step.why && <p className="mt-0.5 text-sm text-muted-foreground">{step.why}</p>}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {analysis.motivation && (
        <div className="flex items-start gap-2 rounded-xl border border-violet-200 bg-violet-50 p-4 text-sm text-violet-900">
          <Sparkles className="mt-0.5 size-4 shrink-0 text-violet-600" />
          <p className="leading-relaxed">{analysis.motivation}</p>
        </div>
      )}

      <p className="text-[11px] text-muted-foreground">
        Сгенерировано AI на основе твоих ошибок · {analysis.cached ? "сохранённый анализ" : "обновлено только что"}
      </p>
    </div>
  )
}

function ExplanationView({ data }: { data: AiMistakeExplanation }) {
  const rows: { label: string; value: string; icon: React.ReactNode }[] = [
    { label: "Почему ты ошибся", value: data.diagnosis, icon: <AlertTriangle className="size-3.5 text-amber-600" /> },
    { label: "Как решать правильно", value: data.correctApproach, icon: <Target className="size-3.5 text-emerald-600" /> },
    { label: "Ключевое правило", value: data.keyConcept, icon: <BrainCircuit className="size-3.5 text-violet-600" /> },
    { label: "Совет на будущее", value: data.tip, icon: <Lightbulb className="size-3.5 text-violet-600" /> },
  ].filter((r) => r.value)

  return (
    <div className="flex flex-col gap-3">
      {rows.map((r) => (
        <div key={r.label} className="flex flex-col gap-1">
          <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {r.icon}
            {r.label}
          </p>
          <p className="leading-relaxed">{r.value}</p>
        </div>
      ))}
    </div>
  )
}

function TopicLessonDialog({
  language,
  state,
  open,
  onOpenChange,
  onRegenerate,
}: {
  language: "ru" | "kk"
  state: LessonState | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onRegenerate: () => void
}) {
  const lesson = state?.data ?? null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <NotepadText className="size-5 text-emerald-600" />
            {lesson?.title ?? "Урок по теме"}
          </DialogTitle>
          <DialogDescription>
            {lesson ? `${lesson.subjectName} · ${lesson.topicName}` : "AI готовит материал для закрепления"}
          </DialogDescription>
        </DialogHeader>

        {state?.loading && !lesson && (
          <div className="flex min-h-48 items-center justify-center gap-3 text-sm text-muted-foreground">
            <Spinner className="size-5" />
            Формируем урок с формулами, примерами и практикой…
          </div>
        )}

        {state?.error && !state.loading && !lesson && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {state.error}
          </div>
        )}

        {lesson && (
          <div className="flex flex-col gap-5">
            <div className="grid gap-3 md:grid-cols-2">
              {lesson.studentGoal && (
                <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">
                    Цель
                  </p>
                  <RichText
                    value={lesson.studentGoal}
                    locale={language}
                    as="div"
                    className="text-sm leading-relaxed text-emerald-950"
                  />
                </div>
              )}
              {lesson.whyItMatters && (
                <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
                  <p className="mb-1 text-xs font-semibold uppercase text-amber-700">
                    Зачем это на ЕНТ
                  </p>
                  <RichText
                    value={lesson.whyItMatters}
                    locale={language}
                    as="div"
                    className="text-sm leading-relaxed text-amber-950"
                  />
                </div>
              )}
            </div>

            {lesson.sections.length > 0 && (
              <LessonSectionBlock icon={<BrainCircuit className="size-4" />} title="Теория">
                <div className="flex flex-col gap-3">
                  {lesson.sections.map((section, index) => (
                    <div key={`${section.title}-${index}`} className="rounded-lg border border-border p-4">
                      {section.title && <h4 className="mb-2 font-semibold">{section.title}</h4>}
                      <RichText
                        value={section.content}
                        locale={language}
                        as="div"
                        className="text-sm leading-relaxed"
                      />
                    </div>
                  ))}
                </div>
              </LessonSectionBlock>
            )}

            {lesson.formulas.length > 0 && (
              <LessonSectionBlock icon={<SquareFunction className="size-4" />} title="Формулы и правила">
                <div className="grid gap-3 md:grid-cols-2">
                  {lesson.formulas.map((formula, index) => (
                    <div key={`${formula.latex}-${index}`} className="rounded-lg border border-border bg-secondary/40 p-4">
                      {formula.latex && (
                        <RichText
                          value={`$$${formula.latex}$$`}
                          locale={language}
                          as="div"
                          className="text-sm"
                        />
                      )}
                      {formula.note && (
                        <RichText
                          value={formula.note}
                          locale={language}
                          as="div"
                          className="mt-2 text-sm leading-relaxed text-muted-foreground"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </LessonSectionBlock>
            )}

            {lesson.visualizations.length > 0 && (
              <LessonSectionBlock icon={<BarChart3 className="size-4" />} title="Визуализации">
                <div className="grid gap-3 lg:grid-cols-2">
                  {lesson.visualizations.map((visual, index) => (
                    <LessonVisualizationView key={`${visual.title}-${index}`} visual={visual} />
                  ))}
                </div>
              </LessonSectionBlock>
            )}

            {lesson.workedExamples.length > 0 && (
              <LessonSectionBlock icon={<Lightbulb className="size-4" />} title="Разбор примеров">
                <div className="flex flex-col gap-3">
                  {lesson.workedExamples.map((example, index) => (
                    <div key={`${example.title}-${index}`} className="rounded-lg border border-border p-4">
                      <div className="mb-2 flex items-center gap-2">
                        <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-600 text-xs font-semibold text-white">
                          {index + 1}
                        </span>
                        <h4 className="font-semibold">{example.title || "Пример"}</h4>
                      </div>
                      <RichText value={example.question} locale={language} as="div" className="text-sm leading-relaxed" />
                      {example.steps.length > 0 && (
                        <ol className="mt-3 flex flex-col gap-1.5">
                          {example.steps.map((step, stepIndex) => (
                            <li key={stepIndex} className="flex gap-2 text-sm">
                              <span className="text-muted-foreground">{stepIndex + 1}.</span>
                              <RichText value={step} locale={language} as="div" className="min-w-0 flex-1 leading-relaxed" />
                            </li>
                          ))}
                        </ol>
                      )}
                      {example.answer && (
                        <div className="mt-3 rounded-md bg-emerald-50 p-3 text-sm text-emerald-950">
                          <RichText value={example.answer} locale={language} as="div" />
                        </div>
                      )}
                      {example.trap && (
                        <div className="mt-2 flex gap-2 rounded-md bg-amber-50 p-3 text-sm text-amber-950">
                          <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                          <RichText value={example.trap} locale={language} as="div" className="leading-relaxed" />
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </LessonSectionBlock>
            )}

            {lesson.practice.length > 0 && (
              <LessonSectionBlock icon={<ClipboardCheck className="size-4" />} title="Закрепление">
                <PracticeList tasks={lesson.practice} language={language} />
              </LessonSectionBlock>
            )}

            <div className="grid gap-3 md:grid-cols-2">
              {lesson.commonTraps.length > 0 && (
                <LessonSectionBlock icon={<AlertTriangle className="size-4" />} title="Типичные ловушки">
                  <SimpleList items={lesson.commonTraps} language={language} tone="amber" />
                </LessonSectionBlock>
              )}
              {lesson.checklist.length > 0 && (
                <LessonSectionBlock icon={<ListChecks className="size-4" />} title="Чеклист готовности">
                  <SimpleList items={lesson.checklist} language={language} tone="emerald" />
                </LessonSectionBlock>
              )}
            </div>

            {lesson.miniTest.length > 0 && (
              <LessonSectionBlock icon={<Target className="size-4" />} title="Мини-тест">
                <PracticeList tasks={lesson.miniTest} language={language} />
              </LessonSectionBlock>
            )}

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
              <p className="text-[11px] text-muted-foreground">
                {lesson.cached ? "Сохранённый урок из базы" : "Сгенерировано сейчас"} · {lesson.model}
              </p>
              <Button variant="outline" size="sm" onClick={onRegenerate} disabled={state?.loading}>
                {state?.loading ? <Spinner className="size-4" /> : <Wand2 className="size-4" />}
                Обновить урок
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}

function LessonSectionBlock({
  icon,
  title,
  children,
}: {
  icon: React.ReactNode
  title: string
  children: React.ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-sm font-semibold">
        <span className="text-emerald-600">{icon}</span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function LessonVisualizationView({
  visual,
}: {
  visual: AiTopicLesson["visualizations"][number]
}) {
  if (visual.type === "table") {
    return (
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="border-b border-border bg-secondary/50 p-3">
          <p className="text-sm font-semibold">{visual.title}</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-secondary/40 text-muted-foreground">
              <tr>
                <th className="px-3 py-2 text-left font-medium">{visual.xLabel || "Пункт"}</th>
                <th className="px-3 py-2 text-left font-medium">{visual.yLabel || "Значение"}</th>
              </tr>
            </thead>
            <tbody>
              {visual.data.map((point, index) => (
                <tr key={`${point.label}-${index}`} className="border-t border-border">
                  <td className="px-3 py-2">{point.label}</td>
                  <td className="px-3 py-2">{point.value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-border p-4">
      <div className="mb-3 flex items-center gap-2">
        {visual.type === "line" ? (
          <LineChartIcon className="size-4 text-emerald-600" />
        ) : (
          <BarChart3 className="size-4 text-emerald-600" />
        )}
        <p className="text-sm font-semibold">{visual.title}</p>
      </div>
      <ChartContainer
        config={{
          value: { label: visual.yLabel || "Значение", color: "var(--chart-4)" },
          secondValue: { label: "Доп.", color: "var(--chart-2)" },
        }}
        className="h-56 w-full"
      >
        {visual.type === "line" ? (
          <LineChart data={visual.data} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Line type="monotone" dataKey="value" stroke="var(--color-value)" strokeWidth={2} dot />
          </LineChart>
        ) : (
          <BarChart data={visual.data} margin={{ left: 8, right: 12, top: 12, bottom: 8 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} interval={0} />
            <YAxis tickLine={false} axisLine={false} width={32} />
            <ChartTooltip content={<ChartTooltipContent />} />
            <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
          </BarChart>
        )}
      </ChartContainer>
    </div>
  )
}

function PracticeList({
  tasks,
  language,
}: {
  tasks: AiTopicLesson["practice"]
  language: "ru" | "kk"
}) {
  return (
    <div className="flex flex-col gap-3">
      {tasks.map((task, index) => (
        <div key={`${task.prompt}-${index}`} className="rounded-lg border border-border p-4">
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
              {index + 1}
            </span>
            <RichText value={task.prompt} locale={language} as="div" className="text-sm font-medium leading-relaxed" />
          </div>
          {task.options.length > 0 && (
            <div className="mb-3 grid gap-2 sm:grid-cols-2">
              {task.options.map((option, optionIndex) => (
                <div key={`${option}-${optionIndex}`} className="rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm">
                  <RichText value={option} locale={language} as="div" />
                </div>
              ))}
            </div>
          )}
          {task.answer && (
            <div className="rounded-md bg-emerald-50 p-3 text-sm text-emerald-950">
              <p className="mb-1 text-xs font-semibold uppercase text-emerald-700">Ответ</p>
              <RichText value={task.answer} locale={language} as="div" />
            </div>
          )}
          {task.explanation && (
            <RichText
              value={task.explanation}
              locale={language}
              as="div"
              className="mt-2 text-sm leading-relaxed text-muted-foreground"
            />
          )}
        </div>
      ))}
    </div>
  )
}

function SimpleList({
  items,
  language,
  tone,
}: {
  items: string[]
  language: "ru" | "kk"
  tone: "amber" | "emerald"
}) {
  const bullet = tone === "amber" ? "bg-amber-500" : "bg-emerald-600"
  return (
    <ul className="flex flex-col gap-2 rounded-lg border border-border p-4">
      {items.map((item, index) => (
        <li key={`${item}-${index}`} className="flex gap-2 text-sm">
          <span className={cn("mt-2 size-1.5 shrink-0 rounded-full", bullet)} />
          <RichText value={item} locale={language} as="div" className="min-w-0 flex-1 leading-relaxed" />
        </li>
      ))}
    </ul>
  )
}
