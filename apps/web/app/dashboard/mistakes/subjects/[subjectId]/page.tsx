"use client"

import { useEffect, useMemo, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  ArrowLeft,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Crown,
  Layers3,
  Play,
  Target,
  TrendingUp,
  Zap,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { AiMistakesCoach } from "@/components/dashboard/ai-mistakes-coach"
import { api, ApiError } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { MistakesSubjectDetail, TestSession } from "@/lib/api/types"

export default function SubjectMistakesPage() {
  const router = useRouter()
  const params = useParams<{ subjectId: string }>()
  const subjectId = typeof params.subjectId === "string" ? params.subjectId : ""
  const detailKey = subjectId ? `/tests/mistakes/subjects/${subjectId}` : null

  const { user, refresh } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const [language, setLanguage] = useState<"ru" | "kk">("ru")
  const [limit, setLimit] = useState(15)
  const [duration, setDuration] = useState(25)
  const [startingKey, setStartingKey] = useState<string | null>(null)

  const { data: detail, isLoading, error } = useSWR<MistakesSubjectDetail>(detailKey)
  const hasPremium = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)

  useEffect(() => {
    void refresh({ silent: true })
  }, [refresh])

  useEffect(() => {
    setLanguage(locale === "kk" ? "kk" : "ru")
  }, [locale])

  const subjectName = localize(detail?.subjectName, locale, "Предмет")
  const examName = localize(detail?.examName, locale, "Экзамен")
  const topics = detail?.topics ?? []
  const maxTopicCount = Math.max(1, ...topics.map((topic) => topic.openCount))
  const priorityTopics = useMemo(() => topics.slice(0, 3), [topics])
  const strongestSignal = priorityTopics[0]

  const launch = async (scope: { topicId?: string } = {}) => {
    if (!detail) return
    if (!hasPremium) {
      void recordFunnelEvent("premium_gate", { feature: "mistakes_subject_detail" })
      router.push("/dashboard/billing?reason=mistakes_subject_detail")
      return
    }

    const key = scope.topicId ?? "subject"
    setStartingKey(key)
    try {
      const session = await api<TestSession>("/tests/mistakes/practice", {
        method: "POST",
        body: {
          language,
          examTypeId: detail.examTypeId,
          subjectId: detail.subjectId,
          topicId: scope.topicId,
          limit,
          durationMins: duration,
        },
      })
      router.push(`/exam/${session.id}`)
    } catch (err) {
      let message = "Не удалось запустить тренировку"
      if (err instanceof ApiError) {
        if (err.message === "NO_OPEN_MISTAKES_FOR_TOPIC") {
          message = "По этой теме нет открытых ошибок"
        } else if (err.message === "NO_OPEN_MISTAKES_FOR_SUBJECT") {
          message = "По этому предмету нет открытых ошибок"
        } else if (err.status === 402 || err.status === 403) {
          void recordFunnelEvent("premium_gate", { feature: "mistakes_subject_detail" })
          router.push("/dashboard/billing?reason=mistakes_subject_detail")
          return
        } else {
          message = err.message
        }
      }
      toast.error(message)
      setStartingKey(null)
    }
  }

  const aiDescription =
    "AI смотрит только ошибки этого предмета: выделяет слабые темы, объясняет корневые пробелы и открывает уроки с формулами, графиками и мини-практикой."

  if (error) {
    return (
      <div className="flex flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit">
          <Link href="/dashboard/mistakes">
            <ArrowLeft className="size-4" />
            Назад
          </Link>
        </Button>
        <Card>
          <CardContent className="p-6 text-sm text-muted-foreground">
            Не удалось открыть предмет. Возможно, он больше не доступен.
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3">
        <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
          <Link href="/dashboard/mistakes">
            <ArrowLeft className="size-4" />
            Работа над ошибками
          </Link>
        </Button>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            {isLoading ? (
              <>
                <Skeleton className="h-8 w-64" />
                <Skeleton className="mt-2 h-4 w-40" />
              </>
            ) : (
              <>
                <p className="text-sm text-muted-foreground">{examName}</p>
                <h1 className="text-3xl font-semibold tracking-tight">{subjectName}</h1>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={() => void launch()}
              disabled={!detail || detail.activeOpenTotal === 0 || startingKey != null}
              className="h-10"
            >
              {startingKey === "subject" ? <Spinner className="size-4" /> : <Play className="size-4" />}
              Тренировать предмет
            </Button>
            {!hasPremium && (
              <Button asChild variant="outline" className="h-10">
                <Link
                  href="/dashboard/billing?reason=mistakes_subject_detail"
                  onClick={() =>
                    void recordFunnelEvent("premium_gate", {
                      feature: "mistakes_subject_detail",
                    })
                  }
                >
                  <Crown className="size-4" />
                  Premium
                </Link>
              </Button>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <MetricCard
          loading={isLoading}
          icon={<Target className="size-4" />}
          label="Открытых ошибок"
          value={detail?.openTotal ?? 0}
          hint="Последний ответ по этим вопросам был неверным"
        />
        <MetricCard
          loading={isLoading}
          icon={<Zap className="size-4" />}
          label="Можно тренировать"
          value={detail?.activeOpenTotal ?? 0}
          hint="Активные вопросы в текущем банке"
        />
        <MetricCard
          loading={isLoading}
          icon={<Layers3 className="size-4" />}
          label="Слабых тем"
          value={detail?.topicCount ?? 0}
          hint="Группировка ошибок по темам"
        />
        <MetricCard
          loading={isLoading}
          icon={<TrendingUp className="size-4" />}
          label="Главный приоритет"
          value={strongestSignal?.openCount ?? 0}
          hint={strongestSignal ? localize(strongestSignal.topicName, locale, "Тема") : "Пока нет"}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Layers3 className="size-4" />
            Темы внутри предмета
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isLoading ? (
            <div className="space-y-3">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-16" />
              ))}
            </div>
          ) : topics.length === 0 ? (
            <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4 text-sm text-muted-foreground">
              <CheckCircle2 className="size-4 text-emerald-600" />
              Открытых ошибок по этому предмету нет.
            </div>
          ) : (
            topics.map((topic, index) => {
              const topicName = localize(topic.topicName, locale, "Тема")
              const pct = Math.round((topic.openCount / maxTopicCount) * 100)
              const key = topic.topicId
              return (
                <div
                  key={topic.topicId}
                  className="grid gap-3 rounded-md border border-border bg-card p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-xs font-semibold tabular-nums text-muted-foreground">
                        #{index + 1}
                      </span>
                      <p className="min-w-0 truncate font-medium">{topicName}</p>
                      {topic.lastWrongAt && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                          <Clock3 className="size-3" />
                          {formatDate(topic.lastWrongAt, locale)}
                        </span>
                      )}
                    </div>
                    <div className="mt-3 flex items-center gap-3">
                      <Progress value={pct} className="h-2 flex-1 [&>div]:bg-violet-600" />
                      <span className="w-20 text-right text-xs tabular-nums text-muted-foreground">
                        {topic.openCount} ош.
                      </span>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-2 lg:justify-end">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void launch({ topicId: topic.topicId })}
                      disabled={topic.activeOpenCount === 0 || startingKey != null}
                    >
                      {startingKey === key ? <Spinner className="size-4" /> : <Play className="size-4" />}
                      Тренировать тему
                    </Button>
                  </div>
                </div>
              )
            })
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <BookOpen className="size-4" />
            Настройки тренировки
          </CardTitle>
        </CardHeader>
        <CardContent className="grid gap-5 md:grid-cols-3">
          <div className="flex flex-col gap-2">
            <Label>Язык</Label>
            <RadioGroup
              value={language}
              onValueChange={(value) => setLanguage(value as "ru" | "kk")}
              className="flex gap-2"
            >
              <Label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2">
                <RadioGroupItem value="ru" />
                Русский
              </Label>
              <Label className="flex flex-1 cursor-pointer items-center gap-2 rounded-md border border-border px-3 py-2">
                <RadioGroupItem value="kk" />
                Қазақша
              </Label>
            </RadioGroup>
          </div>
          <RangeControl label="Вопросов" min={5} max={40} step={5} value={limit} onChange={setLimit} />
          <RangeControl label="Минут" min={5} max={120} step={5} value={duration} onChange={setDuration} />
        </CardContent>
      </Card>

      {hasPremium && detail ? (
        <AiMistakesCoach
          language={language}
          examTypeId={detail.examTypeId}
          subjectId={detail.subjectId}
          totalOpen={detail.openTotal}
          title={`AI-разбор: ${subjectName}`}
          description={aiDescription}
          onTrainSubject={() => void launch()}
          onTrainTopic={(topicId) => void launch({ topicId })}
        />
      ) : (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="grid gap-4 p-5 text-amber-950 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex items-start gap-3">
              <BrainCircuit className="mt-0.5 size-5 text-amber-700" />
              <div>
                <p className="font-semibold">Предметный AI-разбор доступен в Premium</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  Здесь появятся причины ошибок, уроки по темам, мини-тесты и персональный план именно по этому предмету.
                </p>
              </div>
            </div>
            <Button asChild className="bg-amber-700 text-white hover:bg-amber-800">
              <Link href="/dashboard/billing?reason=ai_subject_mistakes">
                <Crown className="size-4" />
                Открыть Premium
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function MetricCard({
  loading,
  icon,
  label,
  value,
  hint,
}: {
  loading: boolean
  icon: ReactNode
  label: string
  value: number
  hint: string
}) {
  return (
    <Card>
      <CardContent className="flex h-full flex-col gap-2 p-4">
        <div className="flex items-center gap-2 text-muted-foreground">
          {icon}
          <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="text-3xl font-semibold tabular-nums">{value}</span>
        )}
        <p className="text-xs leading-5 text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  )
}

function RangeControl({
  label,
  min,
  max,
  step,
  value,
  onChange,
}: {
  label: string
  min: number
  max: number
  step: number
  value: number
  onChange: (value: number) => void
}) {
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <Label>{label}</Label>
        <span className="text-sm font-semibold tabular-nums">{value}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onInput={(event) => onChange(Number((event.target as HTMLInputElement).value))}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full cursor-pointer accent-black"
      />
    </div>
  )
}

function formatDate(value: string, locale: Locale) {
  return new Intl.DateTimeFormat(locale === "kk" ? "kk-KZ" : "ru-RU", {
    day: "2-digit",
    month: "short",
  }).format(new Date(value))
}
