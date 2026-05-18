"use client"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import {
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  Crown,
  Lightbulb,
  RefreshCw,
  Target,
  TrendingUp,
  Trophy,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import { Logo } from "@/components/landing/logo"
import { QuestionMedia } from "@/components/exam/question-media"
import {
  RichText,
  getDetachedImageUrls,
  imageReferenceText,
} from "@/components/exam/rich-text"
import { api, ApiError } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale, type LocalizedText } from "@/lib/api/i18n"
import { buildReviewSections, type ReviewSectionModel } from "@/lib/api/test-session"
import { cn } from "@/lib/utils"
import type { ReviewResponse, TestSession } from "@/lib/api/types"

interface ExplanationData {
  questionId: string
  explanation: unknown
  imageUrls?: string[]
}

type ScoreSegment = {
  key: "threshold" | "grant" | "top"
  title: string
  text: string
}

export default function ReviewPage({
  params,
}: {
  params: Promise<{ sessionId: string }>
}) {
  const { sessionId } = use(params)
  const router = useRouter()
  const { user, refresh } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data, isLoading, error } = useSWR<ReviewResponse>(
    `/tests/sessions/${sessionId}/review`,
  )
  const [retaking, setRetaking] = useState(false)

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
  const canRetakeEnt =
    data?.examType?.slug === "ent" && data.metadata?.kind !== "remediation"
  const hasPremium = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const scoreSegment = useMemo(
    () => getScoreSegment(displayScore, displayMax),
    [displayMax, displayScore],
  )
  const weakSections = useMemo(() => {
    return sections
      .map((sec) => {
        const pct = sec.totalCount ? Math.round((sec.correctCount / sec.totalCount) * 100) : 0
        return {
          title: sec.title,
          pct,
          lost: Math.max(0, sec.totalCount - sec.correctCount),
        }
      })
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3)
  }, [sections])

  useEffect(() => {
    void refresh({ silent: true })
  }, [refresh])

  useEffect(() => {
    if (!data) return
    void recordFunnelEvent(
      "review_opened",
      {
        examSlug: data.examType?.slug,
        rawScore: data.rawScore,
        score: data.score,
        maxScore: data.maxScore,
        accuracy,
        scoreSegment: scoreSegment.key,
      },
      sessionId,
    )
  }, [accuracy, data, scoreSegment.key, sessionId])

  const startRetake = async () => {
    if (!data || retaking) return
    setRetaking(true)
    try {
      const session = await api<TestSession>(`/tests/sessions/${sessionId}/retake`, {
        method: "POST",
      })
      toast.success("Повтор ЕНТ создан")
      router.push(`/exam/${session.id}`)
    } catch (e) {
      if (e instanceof ApiError && (e.status === 402 || e.status === 403)) {
        void recordFunnelEvent("premium_gate", { feature: "retake" }, sessionId)
        router.push(`/dashboard/billing?reason=retake&sessionId=${encodeURIComponent(sessionId)}`)
        return
      }
      toast.error(e instanceof ApiError ? e.message : "Не удалось создать повтор")
    } finally {
      setRetaking(false)
    }
  }

  return (
    <div className="flex min-h-svh flex-col">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between gap-3 px-4">
          <Link href="/dashboard" className="flex items-center gap-2">
            <Logo />
            <span className="text-sm font-semibold lowercase">mytest</span>
          </Link>
          <Button asChild variant="outline" size="sm">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />К панели
            </Link>
          </Button>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 px-4 py-6 lg:py-8">
        {isLoading ? (
          <div className="flex flex-col gap-4">
            <Skeleton className="h-32 w-full" />
            <Skeleton className="h-72 w-full" />
          </div>
        ) : error ? (
          <Card>
            <CardContent className="py-10 text-center">
              <p className="font-semibold">Не удалось загрузить разбор</p>
              <p className="mt-1 text-sm text-muted-foreground">
                {(error as ApiError).message || "Попробуйте позже"}
              </p>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Score summary */}
            <Card className="overflow-hidden">
              <CardContent className="grid gap-6 p-6 md:grid-cols-[1fr_auto] md:items-center">
                <div className="flex flex-col gap-2">
                  <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground">
                    Результат
                  </p>
                  <div className="flex items-baseline gap-3">
                    <span className="text-5xl font-semibold tabular-nums">
                      {displayScore}
                    </span>
                    <span className="text-xl text-muted-foreground tabular-nums">
                      / {displayMax}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={accuracy} className="max-w-xs" />
                    <span className="text-sm font-medium tabular-nums">{accuracy}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Правильных ответов: {overallCorrect} из {overallTotal}
                  </p>
                  {canRetakeEnt && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {hasPremium ? (
                        <Button onClick={startRetake} disabled={retaking}>
                          {retaking ? (
                            <Spinner className="size-4" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                          Повторить этот ЕНТ
                        </Button>
                      ) : (
                        <Button asChild>
                          <Link
                            href={`/dashboard/billing?reason=retake&sessionId=${encodeURIComponent(sessionId)}`}
                            onClick={() => void recordFunnelEvent("premium_gate", { feature: "retake" }, sessionId)}
                          >
                            <RefreshCw className="size-4" />
                            Повторить в Premium
                          </Link>
                        </Button>
                      )}
                      <span className="text-sm text-muted-foreground">
                        {hasPremium
                          ? "Повторите этот же ЕНТ после разбора, чтобы увидеть рост"
                          : "Пересдача доступна в Premium и помогает проверить рост после разбора"}
                      </span>
                    </div>
                  )}
                </div>
                <div className="flex size-24 items-center justify-center rounded-full bg-foreground text-background">
                  <Trophy className="size-10" />
                </div>
              </CardContent>
            </Card>

            {/* Section breakdown */}
            {sections.length > 1 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((sec) => {
                  const total = sec.totalCount
                  const correct = sec.correctCount
                  const pct = total ? Math.round((correct / total) * 100) : 0
                  return (
                    <Card key={sec.id}>
                      <CardContent className="flex flex-col gap-2 p-4">
                        <p className="text-sm font-medium">{sec.title}</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-semibold tabular-nums">
                            {correct}/{total}
                          </span>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        <Progress value={pct} />
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            )}

            <ReviewSalesCard
              sessionId={sessionId}
              score={displayScore}
              maxScore={displayMax}
              accuracy={accuracy}
              scoreSegment={scoreSegment}
              weakSections={weakSections}
              hasPremium={hasPremium}
            />

            {/* Sections + questions */}
            {sections.map((sec) => {
              return (
                <section key={sec.id}>
                  <h2 className="mb-3 text-lg font-semibold">{sec.title}</h2>
                  <Accordion type="multiple" className="flex flex-col gap-2">
                    {sec.questions.map((q, idx) => {
                      const qSubject = localize(q.subjectName, locale)
                      const detachedImageUrls = getDetachedImageUrls(q.imageUrls, [
                        q.display.passage ?? "",
                        q.display.topicLine ?? "",
                        q.display.stem,
                        ...q.answerOptions.map((opt) =>
                          localize(opt.content ?? opt.text, locale),
                        ),
                        imageReferenceText(q.explanation),
                      ])
                      return (
                        <AccordionItem
                          key={q.id}
                          value={q.id}
                          className={cn(
                            "rounded-lg border bg-card",
                            q.isCorrect === true
                              ? "border-emerald-200"
                              : q.isCorrect === false
                                ? "border-rose-200"
                                : "border-border",
                          )}
                        >
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex w-full items-center gap-3 pr-2 text-left">
                              {q.isCorrect === true ? (
                                <CheckCircle2 className="size-5 shrink-0 text-emerald-600" />
                              ) : (
                                <XCircle className="size-5 shrink-0 text-rose-600" />
                              )}
                              <span className="text-sm font-medium tabular-nums text-muted-foreground">
                                №{idx + 1}
                              </span>
                              <span className="line-clamp-1 flex-1 text-sm font-normal">
                                {q.display.stem || q.display.topicLine || qSubject || "Вопрос"}
                              </span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="border-t border-border px-4 py-4">
                            <div className="flex flex-col gap-4">
                              {q.display.passage && (
                                <RichText
                                  as="div"
                                  value={q.display.passage}
                                  locale={locale}
                                  imageUrls={q.imageUrls}
                                  className="rounded-md border border-border bg-secondary/40 p-4 text-sm leading-relaxed"
                                />
                              )}
                              {q.display.topicLine && (
                                <RichText
                                  as="div"
                                  value={q.display.topicLine}
                                  locale={locale}
                                  imageUrls={q.imageUrls}
                                  className="text-xs font-medium text-muted-foreground"
                                />
                              )}
                              {q.display.stem && (
                                <RichText
                                  as="div"
                                  value={q.display.stem}
                                  locale={locale}
                                  imageUrls={q.imageUrls}
                                  className="text-sm leading-relaxed"
                                />
                              )}
                              {detachedImageUrls.map((url, imageIndex) => (
                                <QuestionMedia
                                  key={`${q.id}-${imageIndex}`}
                                  src={url}
                                  alt={qSubject}
                                />
                              ))}
                              <div className="flex flex-col gap-2">
                                {q.answerOptions.map((opt, i) => {
                                  const isSelected = q.selectedIds.includes(opt.id)
                                  const stateClass = opt.isCorrect
                                    ? "border-emerald-300 bg-emerald-50"
                                    : isSelected
                                      ? "border-rose-300 bg-rose-50"
                                      : "border-border bg-card"
                                  return (
                                    <div
                                      key={opt.id}
                                      className={cn(
                                        "flex items-start gap-3 rounded-md border px-4 py-3",
                                        stateClass,
                                      )}
                                    >
                                      <span className="mt-0.5 inline-flex size-6 shrink-0 items-center justify-center rounded-full border border-border bg-background text-xs font-semibold">
                                        {String.fromCharCode(65 + i)}
                                      </span>
                                      <div className="flex-1 min-w-0 flex flex-col gap-2">
                                        <RichText
                                          value={opt.content ?? opt.text}
                                          locale={locale}
                                          imageUrls={q.imageUrls}
                                          className="text-sm leading-relaxed"
                                        />
                                        {opt.imageUrl && <QuestionMedia src={opt.imageUrl} />}
                                      </div>
                                      <div className="flex flex-col items-end gap-1">
                                        {opt.isCorrect && (
                                          <Badge className="bg-emerald-600 hover:bg-emerald-600">
                                            Верно
                                          </Badge>
                                        )}
                                        {isSelected && !opt.isCorrect && (
                                          <Badge variant="destructive">Ваш ответ</Badge>
                                        )}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              {q.hasExplanation && (
                                <ExplanationBlock
                                  sessionId={sessionId}
                                  questionId={q.id}
                                  locale={locale}
                                />
                              )}
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      )
                    })}
                  </Accordion>
                </section>
              )
            })}
          </>
        ) : null}
      </div>
    </div>
  )
}

function getScoreSegment(score: number, maxScore: number): ScoreSegment {
  const pct = maxScore > 0 ? score / maxScore : 0
  if (score >= 110 || pct >= 0.8) {
    return {
      key: "top",
      title: "Стабилизируй 120+ и не теряй лёгкие баллы",
      text: "У тебя уже сильная база, теперь важнее убрать случайные ошибки и закрепить высокий результат.",
    }
  }
  if (score >= 70 || pct >= 0.5) {
    return {
      key: "grant",
      title: "Добери баллы до гранта через слабые зоны",
      text: "Ты уже близко к рабочей траектории, но часть баллов уходит в повторяющихся темах.",
    }
  }
  return {
    key: "threshold",
    title: "Сначала догоняем порог и базовые темы",
    text: "Сейчас важнее быстро найти базовые провалы и закрыть самые дорогие ошибки.",
  }
}

function ReviewSalesCard({
  sessionId,
  score,
  maxScore,
  accuracy,
  scoreSegment,
  weakSections,
  hasPremium,
}: {
  sessionId: string
  score: number
  maxScore: number
  accuracy: number
  scoreSegment: ScoreSegment
  weakSections: Array<{ title: string; pct: number; lost: number }>
  hasPremium: boolean
}) {
  const potentialGain = Math.max(6, Math.min(18, Math.round((100 - accuracy) / 4)))
  const primaryWeak = weakSections[0]

  return (
    <Card className="overflow-hidden border-amber-200 bg-amber-50">
      <CardContent className="grid gap-5 p-5 text-amber-950 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
        <div className="flex flex-col gap-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-600 text-white hover:bg-amber-600">
              {hasPremium ? "Premium активен" : "Персональный план"}
            </Badge>
            <span className="text-sm font-medium">
              Результат: <span className="tabular-nums">{score}/{maxScore}</span>
            </span>
          </div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight">
              {scoreSegment.title}
            </h2>
            <p className="mt-1 max-w-2xl text-sm leading-6 text-amber-900">
              {hasPremium
                ? `${scoreSegment.text} Объяснения, тренировки по ошибкам и повтор этого пробника уже открыты. Начните с ошибок, чтобы добрать ориентировочно +${potentialGain} баллов.`
                : `${scoreSegment.text} Premium откроет объяснения, тренировки по ошибкам и следующий пробник, чтобы добрать ориентировочно +${potentialGain} баллов.`}
            </p>
          </div>
          <div className="grid gap-2 text-sm sm:grid-cols-3">
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <Target className="mb-2 size-4 text-amber-700" />
              <p className="font-medium">Слабая зона</p>
              <p className="mt-1 text-amber-800">{primaryWeak?.title ?? "Ошибки по предметам"}</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <TrendingUp className="mb-2 size-4 text-amber-700" />
              <p className="font-medium">Потенциал роста</p>
              <p className="mt-1 text-amber-800">+{potentialGain} баллов при разборе ошибок</p>
            </div>
            <div className="rounded-lg border border-amber-200 bg-white/70 p-3">
              <Lightbulb className="mb-2 size-4 text-amber-700" />
              <p className="font-medium">{hasPremium ? "Уже открыто" : "Что откроется"}</p>
              <p className="mt-1 text-amber-800">Объяснения и тренировка ошибок</p>
            </div>
          </div>
        </div>
        <Button asChild size="lg" className="h-11 bg-amber-700 text-white hover:bg-amber-800">
          <Link
            href={
              hasPremium
                ? "/dashboard/mistakes"
                : `/dashboard/billing?reason=review_recovery&sessionId=${encodeURIComponent(sessionId)}`
            }
            onClick={() => {
              if (!hasPremium) {
                void recordFunnelEvent("premium_gate", { feature: "review_recovery" }, sessionId)
              }
            }}
          >
            {hasPremium ? "Работать над ошибками" : "Открыть план роста"}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function ExplanationBlock({
  sessionId,
  questionId,
  locale,
}: {
  sessionId: string
  questionId: string
  locale: Locale
}) {
  const [open, setOpen] = useState(false)
  const [data, setData] = useState<ExplanationData | null>(null)
  const [loading, setLoading] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const load = async () => {
    if (data || loading) return
    void recordFunnelEvent("explain_click", { questionId }, sessionId)
    setLoading(true)
    setErr(null)
    try {
      const res = await api<ExplanationData>(
        `/tests/sessions/${sessionId}/review/${questionId}/explanation`,
      )
      setData(res)
    } catch (e) {
      const apiErr = e as ApiError
      if (apiErr.status === 402 || apiErr.status === 403) {
        void recordFunnelEvent("premium_gate", { questionId, feature: "explanation" }, sessionId)
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
      <div className="rounded-md border border-amber-200 bg-amber-50 p-4 text-sm">
        <div className="flex items-start gap-2">
          <Crown className="size-4 shrink-0 text-amber-600 mt-0.5" />
          <div className="flex flex-col gap-2">
            <p className="font-medium text-amber-900">Объяснение доступно в Premium</p>
            <p className="text-amber-800">
              Получите подробные разборы каждой ошибки, чтобы быстрее закрывать пробелы.
            </p>
            <Button size="sm" asChild className="self-start">
              <Link href={`/dashboard/billing?reason=premium_explanation&sessionId=${encodeURIComponent(sessionId)}`}>
                Подключить Premium
              </Link>
            </Button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => {
          setOpen((v) => !v)
          if (!open) load()
        }}
        className="inline-flex items-center gap-2 text-sm font-medium text-foreground hover:underline"
      >
        <Lightbulb className="size-4" />
        Объяснение
        <ChevronDown
          className={cn("size-3.5 transition-transform", open && "rotate-180")}
        />
      </button>
      {open && (
        <div className="mt-3 rounded-md border border-border bg-secondary/40 p-4">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              Загружаем объяснение
            </div>
          ) : err ? (
            <p className="text-sm text-rose-700">{err}</p>
          ) : data ? (
            (() => {
              const explanationText = formatExplanation(data.explanation, locale)
              const detachedImageUrls = getDetachedImageUrls(data.imageUrls, [
                explanationText,
              ])
              return (
                <div className="flex flex-col gap-3">
                  <RichText
                    as="div"
                    value={explanationText}
                    locale={locale}
                    imageUrls={data.imageUrls}
                    className="text-sm leading-relaxed"
                  />
                  {detachedImageUrls.length > 0 && (
                    <div className="grid gap-2 sm:grid-cols-2">
                      {detachedImageUrls.map((u, i) => (
                        <QuestionMedia key={i} src={u} />
                      ))}
                    </div>
                  )}
                </div>
              )
            })()
          ) : null}
        </div>
      )}
    </div>
  )
}

function formatExplanation(explanation: unknown, locale: Locale): string {
  if (typeof explanation === "string") return explanation
  const localized = localize(explanation as LocalizedText, locale)
  if (localized) return localized
  return JSON.stringify(explanation, null, 2) || ""
}
