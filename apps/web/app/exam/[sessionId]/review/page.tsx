"use client"

import { useUiI18n } from "@/lib/i18n/ui"

import { use, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import {
  ArrowRight,
  ArrowLeft,
  Flag,
  CheckCircle2,
  ChevronDown,
  Crown,
  Lightbulb,
  RefreshCw,
  Target,
  XCircle,
} from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Progress } from "@/components/ui/progress"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Textarea } from "@/components/ui/textarea"
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
import { TestFeedback } from "@/components/exam/test-feedback"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale, type LocalizedText } from "@/lib/api/i18n"
import {
  buildReviewSections,
  type FlatSessionQuestion,
  type ReviewSectionModel,
} from "@/lib/api/test-session"
import { cn } from "@/lib/utils"
import type {
  QuestionAppeal,
  QuestionAppealReason,
  QuestionAppealStatus,
  ReviewResponse,
  TestSession,
} from "@/lib/api/types"

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
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => locale === "kk" ? kk : ru
  const { data, isLoading, error, mutate } = useSWR<ReviewResponse>(
    `/tests/sessions/${sessionId}/review`,
  )
  const [retaking, setRetaking] = useState(false)
  const [filter, setFilter] = useState<"all" | "mistakes" | "unanswered">("all")

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
  const accuracy = displayMax ? Math.round((displayScore / displayMax) * 100) : 0
  const canRetakeEnt =
    data?.examType?.slug === "ent" && data.metadata?.kind !== "remediation"
  const hasPremium = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const scoreSegment = useMemo(
    () => getScoreSegment(displayScore, displayMax),
    [displayMax, displayScore],
  )
  const weakSections = useMemo(() => {
    return sections
      .filter((sec) => sec.id !== "all")
      .map((sec) => {
        const pct =
          sec.score != null
            ? Math.round(sec.score)
            : sec.totalCount
              ? Math.round((sec.correctCount / sec.totalCount) * 100)
              : 0
        return {
          title: sec.title,
          pct,
          lost:
            sec.maxPoints != null && sec.rawPoints != null
              ? Math.max(0, sec.maxPoints - sec.rawPoints)
              : Math.max(0, sec.totalCount - sec.correctCount),
        }
      })
      .sort((a, b) => a.pct - b.pct)
      .slice(0, 3)
  }, [sections])

  const matchesFilter = (q: FlatSessionQuestion) => filter === "all" ||
    (filter === "mistakes" ? q.reviewStatus !== "correct" : q.reviewStatus === "unanswered")
  const questionCount = sections.reduce((sum, sec) => sum + sec.questions.length, 0)
  const mistakeCount = sections.reduce((sum, sec) => sum + sec.questions.filter(q => q.reviewStatus !== "correct").length, 0)
  const unansweredCount = sections.reduce((sum, sec) => sum + sec.questions.filter(q => q.reviewStatus === "unanswered").length, 0)
  const visibleCount = sections.reduce((sum, sec) => sum + sec.questions.filter(matchesFilter).length, 0)

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
              <Button variant="outline" className="mt-4" onClick={() => void mutate()} data-no-translate>{t("Попробовать снова", "Қайта көру")}</Button>
            </CardContent>
          </Card>
        ) : data ? (
          <>
            {/* Score summary */}
            <Card className="gap-0 overflow-hidden py-0" data-testid="review-summary">
              <CardContent className="grid gap-6 p-5 sm:p-6 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] md:items-center">
                <div className="flex min-w-0 flex-col gap-2">
                  <p className="text-sm font-medium uppercase tracking-wide text-muted-foreground" data-no-translate>
                    {t("Ваш результат", "Сіздің нәтижеңіз")}
                  </p>
                  <div className="flex items-baseline gap-3">
                    <h1 className="text-5xl font-semibold tracking-tight tabular-nums sm:text-6xl">
                      {displayScore}
                      <span className="sr-only" data-no-translate> {t("баллов", "балл")}</span>
                    </h1>
                    <span className="text-xl text-muted-foreground tabular-nums">
                      / {displayMax}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center gap-3">
                    <Progress value={accuracy} className="max-w-xs" />
                    <span className="text-sm font-medium tabular-nums">{accuracy}%</span>
                  </div>
                  <p className="text-sm text-muted-foreground" data-no-translate>
                    {t("Точно верных ответов", "Толық дұрыс жауаптар")}: {overallCorrect} / {overallTotal}
                  </p>
                  {canRetakeEnt && (
                    <div className="mt-3 flex flex-wrap items-center gap-3">
                      {hasPremium ? (
                        <Button variant="outline" size="sm" onClick={startRetake} disabled={retaking}>
                          {retaking ? (
                            <Spinner className="size-4" />
                          ) : (
                            <RefreshCw className="size-4" />
                          )}
                          Повторить этот ЕНТ
                        </Button>
                      ) : (
                        <Button asChild variant="outline" size="sm">
                          <Link
                            href={`/dashboard/billing?reason=retake&sessionId=${encodeURIComponent(sessionId)}`}
                            onClick={() => void recordFunnelEvent("premium_gate", { feature: "retake" }, sessionId)}
                          >
                            <RefreshCw className="size-4" />
                            Повторить в Premium
                          </Link>
                        </Button>
                      )}
                    </div>
                  )}
                </div>
                <ReviewNextStep sessionId={sessionId} weakSections={weakSections} hasPremium={hasPremium} hasMistakes={mistakeCount > 0} practiceHref={data.metadata?.kind === "remediation" ? data.metadata.remediationScope?.themeId ? `/dashboard/mistakes/themes/${data.metadata.remediationScope.themeId}` : data.metadata.remediationScope?.subjectId ? `/dashboard/mistakes/subjects/${data.metadata.remediationScope.subjectId}` : "/dashboard/mistakes" : undefined} />
              </CardContent>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border bg-muted/30 px-4 py-3 sm:px-6">
                <Button asChild variant="ghost" size="sm"><a href="#review-questions" data-no-translate>{t("Перейти к разбору", "Талдауға өту")}<ChevronDown className="size-4" /></a></Button>
                <TestFeedback key={sessionId} sessionId={sessionId} />
              </div>
            </Card>

            {/* Section breakdown */}
            {sections.length > 1 && (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {sections.map((sec) => {
                  const total = sec.totalCount
                  const correct = sec.correctCount
                  const rawPoints = sec.rawPoints
                  const maxPoints = sec.maxPoints
                  const pct =
                    sec.score != null
                      ? Math.round(sec.score)
                      : total
                        ? Math.round((correct / total) * 100)
                        : 0
                  const pointsLabel =
                    rawPoints != null && maxPoints != null
                      ? `${rawPoints}/${maxPoints} ${pluralizePoints(maxPoints)}`
                      : `${correct}/${total}`
                  return (
                    <a key={sec.id} href={`#review-section-${sec.id}`} onClick={() => setFilter("all")} className="rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-2 focus-visible:outline-ring">
                      <div className="flex flex-col gap-2">
                        <p className="text-sm font-medium">{sec.title}</p>
                        <div className="flex items-baseline gap-2">
                          <span className="text-xl font-semibold tabular-nums">
                            {pointsLabel}
                          </span>
                          <span className="text-xs text-muted-foreground">{pct}%</span>
                        </div>
                        {rawPoints != null && maxPoints != null && (
                          <p className="text-xs text-muted-foreground">
                            Точно верно: {correct}/{total}
                          </p>
                        )}
                        <Progress value={pct} />
                      </div>
                    </a>
                  )
                })}
              </div>
            )}

            <div id="review-questions" className="scroll-mt-20 space-y-3" data-no-translate>
              <div className="flex flex-wrap items-baseline justify-between gap-2">
                <h2 className="text-xl font-semibold tracking-tight">{t("Разбор ответов", "Жауаптарды талдау")}</h2>
                <p role="status" className="text-sm text-muted-foreground">{t("Показано", "Көрсетілді")}: {visibleCount} / {questionCount}</p>
              </div>
              <div className="flex flex-wrap gap-2" role="group" aria-label={t("Фильтр ответов", "Жауаптар сүзгісі")}>
                {([
                  ["all", t("Все", "Барлығы"), questionCount],
                  ["mistakes", t("Ошибки", "Қателер"), mistakeCount],
                  ["unanswered", t("Без ответа", "Жауапсыз"), unansweredCount],
                ] as const).map(([value, label, count]) => <Button key={value} size="sm" variant={filter === value ? "default" : "outline"} aria-pressed={filter === value} onClick={() => setFilter(value)}>{label}<span className="opacity-60 tabular-nums">{count}</span></Button>)}
              </div>
              {visibleCount === 0 && <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">{questionCount === 0 ? t("В этом разборе пока нет вопросов.", "Бұл талдауда әзірге сұрақтар жоқ.") : t("Таких ответов нет. Выберите другой фильтр.", "Мұндай жауаптар жоқ. Басқа сүзгіні таңдаңыз.")}</p>}
            </div>

            {/* Sections + questions */}
            {sections.map((sec) => {
              if (!sec.questions.some(matchesFilter)) return null
              return (
                <section key={sec.id} id={`review-section-${sec.id}`} className="scroll-mt-20">
                  <h2 className="mb-3 text-lg font-semibold">{sec.title}</h2>
                  <Accordion type="multiple" className="flex flex-col gap-2">
                    {sec.questions.map((q, idx) => {
                      if (!matchesFilter(q)) return null
                      const qSubject = localize(q.subjectName, locale)
                      const reviewMeta = getQuestionReviewMeta(q)
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
                            q.reviewStatus === "correct"
                              ? "border-emerald-200 dark:border-emerald-900"
                              : q.reviewStatus === "partial"
                                ? "border-amber-200 dark:border-amber-900"
                                : q.reviewStatus === "unanswered"
                                  ? "border-slate-200 dark:border-slate-700"
                                  : "border-rose-200 dark:border-rose-900",
                          )}
                        >
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex w-full min-w-0 flex-col gap-2 pr-2 text-left sm:flex-row sm:items-center sm:gap-3">
                              <div className="flex min-w-0 flex-1 items-center gap-3">
                                <reviewMeta.Icon className={cn("size-5 shrink-0", reviewMeta.iconClassName)} />
                                <span className="text-sm font-medium tabular-nums text-muted-foreground">
                                  №{idx + 1}
                                </span>
                                <RichText
                                  as="span"
                                  value={q.display.stem || q.display.topicLine || qSubject || "Вопрос"}
                                  locale={locale}
                                  className="line-clamp-2 min-w-0 flex-1 text-sm font-normal sm:line-clamp-1"
                                />
                              </div>
                              <div className="flex shrink-0 items-center gap-2 pl-8 sm:pl-0">
                                <Badge
                                  variant="outline"
                                  className={cn(
                                    "border-current/20 bg-background/80 text-xs",
                                    reviewMeta.badgeClassName,
                                  )}
                                >
                                  {reviewMeta.label}
                                </Badge>
                                <Badge variant="outline" className="tabular-nums">
                                  {formatQuestionPoints(q.earnedPoints, q.maxPoints)}
                                </Badge>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="border-t border-border px-4 py-4">
                            <div className="flex flex-col gap-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <Badge className={reviewMeta.fillClassName}>{reviewMeta.label}</Badge>
                                <Badge variant="outline" className="tabular-nums">
                                  {formatQuestionPoints(q.earnedPoints, q.maxPoints)}
                                </Badge>
                                {q.errorCount != null && q.errorCount > 0 && (
                                  <span className="text-xs text-muted-foreground">
                                    {formatErrorCount(q.errorCount)}
                                  </span>
                                )}
                              </div>
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
                                  const optionMeta = getReviewOptionMeta(isSelected, Boolean(opt.isCorrect))
                                  return (
                                    <div
                                      key={opt.id}
                                      className={cn(
                                        "flex items-start gap-3 rounded-md border px-4 py-3",
                                        optionMeta.containerClassName,
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
                                        {optionMeta.badges.map((badge) => (
                                          <Badge
                                            key={badge.label}
                                            variant={badge.variant}
                                            className={badge.className}
                                          >
                                            {badge.label}
                                          </Badge>
                                        ))}
                                      </div>
                                    </div>
                                  )
                                })}
                              </div>

                              <QuestionAppealBlock
                                sessionId={sessionId}
                                questionId={q.id}
                                appeal={data.appeals?.find((item) => item.questionId === q.id) ?? null}
                                onAppealSaved={(appeal) => {
                                  void mutate((current) => {
                                    if (!current) return current
                                    const nextAppeals = upsertAppeal(current.appeals || [], appeal)
                                    return { ...current, appeals: nextAppeals }
                                  }, false)
                                }}
                              />

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

function pluralizeRu(
  value: number,
  forms: [one: string, few: string, many: string],
) {
  const abs = Math.abs(value) % 100
  const tail = abs % 10
  if (abs > 10 && abs < 20) return forms[2]
  if (tail > 1 && tail < 5) return forms[1]
  if (tail === 1) return forms[0]
  return forms[2]
}

function pluralizePoints(value: number) {
  return pluralizeRu(value, ["балл", "балла", "баллов"])
}

function formatQuestionPoints(earnedPoints: number, maxPoints: number) {
  return `${earnedPoints}/${maxPoints} ${pluralizePoints(maxPoints)}`
}

function formatErrorCount(errorCount: number) {
  return `${errorCount} ${pluralizeRu(errorCount, ["ошибка", "ошибки", "ошибок"])}`
}

function getQuestionReviewMeta(question: Pick<
  FlatSessionQuestion,
  "reviewStatus" | "earnedPoints" | "maxPoints"
>) {
  if (question.reviewStatus === "correct") {
    return {
      label: "Верно",
      Icon: CheckCircle2,
      iconClassName: "text-emerald-600",
      badgeClassName: "text-emerald-700 dark:text-emerald-400",
      fillClassName: "bg-emerald-600 hover:bg-emerald-600 text-white",
    }
  }
  if (question.reviewStatus === "partial") {
    return {
      label: "Частично",
      Icon: Target,
      iconClassName: "text-amber-600",
      badgeClassName: "text-amber-700 dark:text-amber-400",
      fillClassName: "bg-amber-600 hover:bg-amber-600 text-white",
    }
  }
  if (question.reviewStatus === "unanswered") {
    return {
      label: "Без ответа",
      Icon: Flag,
      iconClassName: "text-slate-500",
      badgeClassName: "text-slate-700 dark:text-slate-300",
      fillClassName: "bg-slate-600 hover:bg-slate-600 text-white",
    }
  }
  return {
    label: question.earnedPoints > 0 && question.earnedPoints < question.maxPoints ? "Частично" : "Неверно",
    Icon: XCircle,
    iconClassName: "text-rose-600",
    badgeClassName: "text-rose-700 dark:text-rose-400",
    fillClassName: "bg-rose-600 hover:bg-rose-600 text-white",
  }
}

function getReviewOptionMeta(isSelected: boolean, isCorrect: boolean) {
  if (isSelected && isCorrect) {
    return {
      containerClassName: "border-emerald-400 bg-emerald-50 dark:border-emerald-700 dark:bg-emerald-950/40",
      badges: [
        { label: "Ваш выбор", variant: "outline" as const, className: "border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300" },
        { label: "Верно", variant: "default" as const, className: "bg-emerald-600 hover:bg-emerald-600" },
      ],
    }
  }
  if (isCorrect) {
    return {
      containerClassName: "border-emerald-200 bg-emerald-50/60 dark:border-emerald-900 dark:bg-emerald-950/30",
      badges: [
        { label: "Правильный ответ", variant: "outline" as const, className: "border-emerald-300 text-emerald-800 dark:border-emerald-800 dark:text-emerald-300" },
      ],
    }
  }
  if (isSelected) {
    return {
      containerClassName: "border-rose-300 bg-rose-50 dark:border-rose-900 dark:bg-rose-950/30",
      badges: [
        { label: "Ваш выбор", variant: "destructive" as const, className: "" },
      ],
    }
  }
  return {
    containerClassName: "border-border bg-card",
    badges: [],
  }
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

function ReviewNextStep({
  sessionId,
  weakSections,
  hasPremium,
  hasMistakes,
  practiceHref,
}: {
  sessionId: string
  weakSections: Array<{ title: string; pct: number; lost: number }>
  hasPremium: boolean
  hasMistakes: boolean
  practiceHref?: string
}) {
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => locale === "kk" ? kk : ru
  const primaryWeak = weakSections.find(section => section.lost > 0)

  return (
    <div className="min-w-0 rounded-xl border border-border bg-muted/40 p-4 sm:p-5" data-no-translate>
        <div className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Target className="size-4" />{t("Следующий шаг", "Келесі қадам")}
          {hasPremium && <Badge variant="outline" className="ml-auto">Premium</Badge>}
        </div>
        <h2 className="text-lg font-semibold tracking-tight">{hasMistakes ? t("Работа над ошибками", "Қателермен жұмыс") : t("Закрепите результат", "Нәтижені бекітіңіз")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          {hasMistakes
            ? t("Разберите неверные ответы и потренируйтесь в темах, где потеряли баллы.", "Қате жауаптарды талдап, балл жоғалтқан тақырыптар бойынша жаттығыңыз.")
            : t("Просмотрите ответы и решения, чтобы закрепить пройденные темы.", "Өткен тақырыптарды бекіту үшін жауаптар мен шешімдерді қарап шығыңыз.")}
        </p>
        {hasMistakes && primaryWeak && <p className="mt-2 text-sm"><span className="text-muted-foreground">{t("Начните с: ", "Осыдан бастаңыз: ")}</span>{primaryWeak.title}</p>}
        <Button asChild className="mt-4 h-auto min-h-11 w-full whitespace-normal px-3 py-3">
          <Link
            href={
              practiceHref || (!hasMistakes ? "#review-questions" : hasPremium
                ? "/dashboard/mistakes"
                : `/dashboard/billing?reason=review_recovery&sessionId=${encodeURIComponent(sessionId)}`)
            }
            onClick={() => {
              if (!hasPremium && hasMistakes) {
                void recordFunnelEvent("premium_gate", { feature: "review_recovery" }, sessionId)
              }
            }}
          >
            {practiceHref ? t("Посмотреть прогресс по ошибкам", "Қателер бойынша ілгерілеуді көру") : !hasMistakes ? t("Посмотреть ответы", "Жауаптарды көру") : hasPremium ? t("Работать над ошибками", "Қателермен жұмыс істеу") : t("Открыть работу над ошибками", "Қателермен жұмысты ашу")}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
        {hasMistakes && !hasPremium && <p className="mt-2 text-xs text-muted-foreground">{t("Тренировка и объяснения — в Premium. Ответы доступны ниже.", "Жаттығу мен түсіндірмелер — Premium-де. Жауаптар төменде қолжетімді.")}</p>}
    </div>
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

const APPEAL_REASON_OPTIONS: Array<{
  value: QuestionAppealReason
  label: string
  hint: string
}> = [
  {
    value: "incorrect_answer",
    label: "Неверный ответ",
    hint: "Правильный вариант отмечен ошибочно или ключ не совпадает с условием.",
  },
  {
    value: "ambiguous_wording",
    label: "Неясная формулировка",
    hint: "Вопрос или варианты допускают несколько трактовок.",
  },
  {
    value: "outdated_content",
    label: "Устаревший контент",
    hint: "Данные, формулировка или факт уже неактуальны.",
  },
  {
    value: "broken_media",
    label: "Проблема с медиа",
    hint: "Не загружается картинка, схема или часть условия.",
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
  if (existingIndex === -1) {
    return [next, ...appeals]
  }
  const cloned = [...appeals]
  cloned[existingIndex] = next
  return cloned
}

function QuestionAppealBlock({
  sessionId,
  questionId,
  appeal,
  onAppealSaved,
}: {
  sessionId: string
  questionId: string
  appeal: QuestionAppeal | null
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
        `/tests/sessions/${sessionId}/review/${questionId}/appeal`,
        {
          method: "POST",
          body: {
            reason,
            message: trimmed,
          },
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
    <div className="rounded-md border border-border bg-background/70 p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 text-sm font-medium">
              <Flag className="size-4" />
              Апелляция по вопросу
            </span>
            {appeal && meta ? (
              <Badge className={meta.className}>{meta.label}</Badge>
            ) : null}
          </div>
          <p className="text-sm text-muted-foreground">
            Если в вопросе ошибка, неясная формулировка или сломанное медиа, отправьте это команде на проверку.
          </p>
          {appeal ? (
            <div className="flex flex-col gap-1 text-sm">
              <span className={meta?.textClassName}>
                Причина: {appealReasonLabel(appeal.reason)}
              </span>
              {appeal.adminNote ? (
                <span className="text-muted-foreground">
                  Комментарий команды: {appeal.adminNote}
                </span>
              ) : (
                <span className="text-muted-foreground">
                  Статус обновится здесь после проверки.
                </span>
              )}
            </div>
          ) : null}
        </div>
        <Button
          variant={appeal ? "outline" : "default"}
          size="sm"
          onClick={() => setOpen(true)}
        >
          {appeal ? "Открыть апелляцию" : "Подать апелляцию"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Апелляция по вопросу</DialogTitle>
            <DialogDescription>
              Мы сохраняем ваш комментарий вместе со снимком вопроса и ответа из этой попытки.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-4">
            {appeal && meta ? (
              <div className="rounded-md border border-border bg-secondary/40 p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">Текущий статус:</span>
                  <Badge className={meta.className}>{meta.label}</Badge>
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
              <label className="text-sm font-medium" htmlFor={`appeal-reason-${questionId}`}>
                Причина
              </label>
              <select
                id={`appeal-reason-${questionId}`}
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
              <label className="text-sm font-medium" htmlFor={`appeal-message-${questionId}`}>
                Комментарий
              </label>
              <Textarea
                id={`appeal-message-${questionId}`}
                value={message}
                onChange={(event) => setMessage(event.target.value)}
                disabled={!editable || submitting}
                rows={6}
                placeholder="Опишите, что именно не так: какой ответ, формулировка, картинка или факт вызывают проблему."
              />
              <p className="text-xs text-muted-foreground">
                Минимум 12 символов. Чем конкретнее описание, тем быстрее команда сможет проверить вопрос.
              </p>
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
    </div>
  )
}
