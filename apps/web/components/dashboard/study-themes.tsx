"use client"

import { useMemo, useRef, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  Crown,
  Play,
  Sparkles,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api/client"
import type { StudyMap, StudyMapTheme } from "@/lib/api/types"

interface StudyThemesProps {
  subjectId: string
  examTypeId: string
  language: "ru" | "kk"
  hasPremium: boolean
  limit: number
  duration: number
}

type PracticeSessionResponse = {
  id: string
}

export function StudyThemes({
  subjectId,
  examTypeId,
  language,
  hasPremium,
  limit,
  duration,
}: StudyThemesProps) {
  const router = useRouter()
  const [startingKey, setStartingKey] = useState<string | null>(null)

  const studyMapKey =
    hasPremium && subjectId && examTypeId
      ? `/ai/mistakes/subjects/${encodeURIComponent(subjectId)}/study-map?examTypeId=${encodeURIComponent(examTypeId)}`
      : null
  // Auto-refresh while AI is still classifying — but cap the polls so a stalled
  // classification (e.g. quota) can never poll forever.
  const pollCountRef = useRef(0)
  const { data, isLoading, error } = useSWR<StudyMap>(studyMapKey, {
    refreshInterval: (latestData) =>
      latestData?.pending && pollCountRef.current < 6 ? 5000 : 0,
    onSuccess: (latestData) => {
      if (latestData?.pending) pollCountRef.current += 1
    },
  })

  const maxOpenCount = useMemo(
    () => Math.max(1, ...(data?.themes ?? []).map((theme) => theme.openCount)),
    [data?.themes],
  )

  if (!hasPremium) {
    return (
      <Card className="border-amber-200 bg-amber-50">
        <CardContent className="grid gap-4 p-5 text-amber-950 sm:grid-cols-[1fr_auto] sm:items-center">
          <div className="flex items-start gap-3">
            <Crown className="mt-0.5 size-5 shrink-0 text-amber-700" />
            <div>
              <p className="font-semibold">AI-темы доступны в Premium</p>
              <p className="mt-1 text-sm leading-6 text-amber-900">
                Premium сгруппирует ошибки по темам ЕНТ и подготовит уроки по самым слабым местам.
              </p>
            </div>
          </div>
          <Button asChild className="bg-amber-700 text-white hover:bg-amber-800">
            <Link href="/dashboard/billing?reason=study_themes">
              <Crown className="size-4" />
              Открыть Premium
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const startPractice = async (themeId?: string) => {
    const key = themeId ?? "other"
    setStartingKey(key)
    try {
      const session = await api<PracticeSessionResponse>("/tests/mistakes/practice", {
        method: "POST",
        body: {
          language,
          examTypeId,
          subjectId,
          themeId,
          limit,
          durationMins: duration,
        },
      })
      router.push(`/exam/${session.id}`)
    } catch (err) {
      setStartingKey(null)
      if (err instanceof ApiError && (err.status === 402 || err.status === 403)) {
        router.push("/dashboard/billing?reason=study_themes")
        return
      }
      toast.error(errorToastMessage(err, "Не удалось запустить тренировку"))
    }
  }

  return (
    <Card className="overflow-hidden border-violet-200 bg-gradient-to-br from-violet-50/70 to-card">
      <CardHeader>
        <CardTitle className="flex flex-wrap items-center gap-2 text-base">
          <span className="flex size-7 items-center justify-center rounded-lg bg-violet-600 text-white">
            <BrainCircuit className="size-4" />
          </span>
          Темы для изучения
          <Badge className="border-violet-200 bg-violet-100 text-violet-700" variant="outline">
            AI
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
          AI сгруппировал твои ошибки по темам программы ЕНТ.
        </p>

        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, index) => (
              <Skeleton key={index} className="h-24 rounded-xl" />
            ))}
          </div>
        ) : error ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <AlertTriangle className="size-4 text-amber-600" />
            Не удалось загрузить темы для изучения.
          </div>
        ) : data && data.openTotal === 0 ? (
          <div className="flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-sm text-muted-foreground">
            <CheckCircle2 className="size-4 text-emerald-600" />
            Открытых ошибок по этому предмету нет.
          </div>
        ) : data ? (
          <>
            {data.pending && (
              <div className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50 px-4 py-3 text-sm text-violet-900">
                <Sparkles className="size-4 shrink-0" />
                AI распределяет остальные ошибки... ({data.classifiedCount} из {data.openTotal})
              </div>
            )}

            <div className="flex flex-col gap-3">
              {data.themes.map((theme) => (
                <ThemeRow
                  key={theme.themeId}
                  theme={theme}
                  progressValue={Math.round((theme.openCount / maxOpenCount) * 100)}
                  loadingPractice={startingKey === theme.themeId}
                  onPractice={() => void startPractice(theme.themeId)}
                />
              ))}

              {data.otherOpenCount > 0 && (
                <div className="grid gap-3 rounded-xl border border-dashed border-border bg-muted/30 p-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="font-medium text-muted-foreground">Прочие ошибки</p>
                      <Badge variant="secondary">{data.otherOpenCount} ошибок</Badge>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">
                      Ошибки, которые AI пока не привязал к конкретной теме.
                    </p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void startPractice()}
                    disabled={data.otherActiveOpenCount === 0 || startingKey != null}
                  >
                    {startingKey === "other" ? <Spinner className="size-4" /> : <Play className="size-4" />}
                    Тренировать
                  </Button>
                </div>
              )}
            </div>
          </>
        ) : null}
      </CardContent>
    </Card>
  )
}

function ThemeRow({
  theme,
  progressValue,
  loadingPractice,
  onPractice,
}: {
  theme: StudyMapTheme
  progressValue: number
  loadingPractice: boolean
  onPractice: () => void
}) {
  return (
    <div className="grid gap-4 rounded-xl border border-border bg-card p-4 shadow-sm lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="min-w-0 truncate font-medium">{theme.name}</p>
          <Badge className="bg-violet-100 text-violet-700" variant="secondary">
            {theme.openCount} ошибок
          </Badge>
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Progress value={progressValue} className="h-2 flex-1 bg-violet-100 [&>div]:bg-violet-600" />
          <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
            {progressValue}%
          </span>
        </div>
      </div>
      <div className="flex flex-wrap gap-2 lg:justify-end">
        <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
          <Link href={`/dashboard/mistakes/themes/${theme.themeId}`}>
            <BookOpen className="size-4" />
            Изучить тему
          </Link>
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={onPractice}
          disabled={theme.activeOpenCount === 0 || loadingPractice}
        >
          {loadingPractice ? <Spinner className="size-4" /> : <Play className="size-4" />}
          Тренировать тему
        </Button>
      </div>
    </div>
  )
}

function errorToastMessage(err: unknown, fallback: string) {
  // Not an ApiError → connection-level failure (dropped/blocked), not a server reply.
  if (!(err instanceof ApiError)) {
    return "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз."
  }
  switch (err.message) {
    case "AI_DAILY_LIMIT":
      return "Дневной лимит AI исчерпан — продолжишь завтра"
    case "AI_BUSY":
      return "AI перегружен, попробуйте позже"
    case "NO_OPEN_MISTAKES_FOR_THEME":
      return "По этой теме больше нет открытых ошибок — выбери другую."
    case "NO_OPEN_MISTAKES_FOR_SUBJECT":
      return "По этому предмету нет открытых ошибок."
    case "NO_OPEN_MISTAKES":
      return "Открытых ошибок пока нет."
    case "EXAM_TYPE_REQUIRED":
      return "Выберите конкретный экзамен."
  }
  if (err.status === 503) return "AI перегружен, попробуйте позже"
  if (err.status === 429) return "Слишком часто — подождите минуту и попробуйте снова."
  if (err.status >= 500) return "Сервис временно недоступен. Попробуйте ещё раз."
  return fallback
}
