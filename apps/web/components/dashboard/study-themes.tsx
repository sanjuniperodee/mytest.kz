"use client"

import { useMemo, useState } from "react"
import type { ReactNode } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import {
  AlertTriangle,
  BookOpen,
  BrainCircuit,
  CheckCircle2,
  ClipboardCheck,
  Crown,
  ListChecks,
  Play,
  RefreshCw,
  Sparkles,
  Wand2,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { RichText } from "@/components/exam/rich-text"
import { api, ApiError } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import type { AiTopicLesson, StudyMap, StudyMapTheme } from "@/lib/api/types"

interface StudyThemesProps {
  subjectId: string
  examTypeId: string
  language: "ru" | "kk"
  hasPremium: boolean
  limit: number
  duration: number
}

type LessonState = {
  loading: boolean
  data: AiTopicLesson | null
}

type PracticeSessionResponse = {
  id: string
}

type LessonTask = {
  prompt: string
  options?: string[]
  answer: string
  explanation: string
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
  const [selectedTheme, setSelectedTheme] = useState<StudyMapTheme | null>(null)
  const [lessons, setLessons] = useState<Record<string, LessonState>>({})
  const [startingKey, setStartingKey] = useState<string | null>(null)

  const studyMapKey =
    hasPremium && subjectId && examTypeId
      ? `/ai/mistakes/subjects/${encodeURIComponent(subjectId)}/study-map?examTypeId=${encodeURIComponent(examTypeId)}`
      : null
  const { data, isLoading, error } = useSWR<StudyMap>(studyMapKey, {
    refreshInterval: (latestData) => (latestData?.pending ? 5000 : 0),
  })

  const maxOpenCount = useMemo(
    () => Math.max(1, ...(data?.themes ?? []).map((theme) => theme.openCount)),
    [data?.themes],
  )
  const selectedLesson = selectedTheme ? lessons[selectedTheme.themeId] : null

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

  const openLesson = async (theme: StudyMapTheme, force = false) => {
    setSelectedTheme(theme)
    const current = lessons[theme.themeId]
    if (current?.data && !force) return

    setLessons((prev) => ({
      ...prev,
      [theme.themeId]: { loading: true, data: prev[theme.themeId]?.data ?? null },
    }))

    try {
      const lesson = await api<AiTopicLesson>("/ai/mistakes/theme-lesson", {
        method: "POST",
        body: { themeId: theme.themeId, language, force },
      })
      setLessons((prev) => ({
        ...prev,
        [theme.themeId]: { loading: false, data: lesson },
      }))
    } catch (err) {
      if (err instanceof ApiError && (err.status === 402 || err.status === 403)) {
        router.push("/dashboard/billing?reason=study_themes")
        return
      }
      setLessons((prev) => ({
        ...prev,
        [theme.themeId]: { loading: false, data: prev[theme.themeId]?.data ?? null },
      }))
      toast.error(errorToastMessage(err, "Не удалось подготовить урок. Попробуйте ещё раз."))
    }
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
    <>
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
                    loadingLesson={lessons[theme.themeId]?.loading ?? false}
                    onOpenLesson={() => void openLesson(theme)}
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

      <Dialog open={selectedTheme != null} onOpenChange={(open) => !open && setSelectedTheme(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto md:max-w-3xl">
          <DialogHeader>
            <DialogTitle className="pr-8">
              {selectedTheme?.name ?? "Урок по теме"}
            </DialogTitle>
            <DialogDescription>
              {selectedLesson?.data?.cached ? "Готовый урок из кеша" : "Персональный урок по твоим ошибкам"}
              {selectedLesson?.data?.model ? ` · ${selectedLesson.data.model}` : ""}
            </DialogDescription>
          </DialogHeader>

          {selectedLesson?.loading && !selectedLesson.data ? (
            <div className="flex min-h-52 items-center justify-center">
              <Spinner className="size-8 text-violet-600" />
            </div>
          ) : selectedLesson?.data ? (
            <LessonView
              lesson={selectedLesson.data}
              language={language}
              refreshing={selectedLesson.loading}
              onRefresh={() => {
                if (selectedTheme) void openLesson(selectedTheme, true)
              }}
            />
          ) : (
            <div className="flex min-h-52 items-center justify-center text-sm text-muted-foreground">
              Урок появится здесь после загрузки.
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ThemeRow({
  theme,
  progressValue,
  loadingLesson,
  loadingPractice,
  onOpenLesson,
  onPractice,
}: {
  theme: StudyMapTheme
  progressValue: number
  loadingLesson: boolean
  loadingPractice: boolean
  onOpenLesson: () => void
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
        <Button
          size="sm"
          onClick={onOpenLesson}
          disabled={loadingLesson}
          className="bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {loadingLesson ? <Spinner className="size-4" /> : <BookOpen className="size-4" />}
          Изучить тему
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

function LessonView({
  lesson,
  language,
  refreshing,
  onRefresh,
}: {
  lesson: AiTopicLesson
  language: "ru" | "kk"
  refreshing: boolean
  onRefresh: () => void
}) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-3 rounded-xl border border-emerald-100 bg-emerald-50 p-4 text-emerald-950">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <RichText value={lesson.title} locale={language} as="div" className="text-lg font-semibold leading-snug" />
            <RichText value={lesson.studentGoal} locale={language} as="div" className="mt-2 text-sm leading-6" />
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={refreshing}
            className="shrink-0 border-emerald-200 bg-white/70 text-emerald-900 hover:bg-white"
          >
            {refreshing ? <Spinner className="size-4" /> : <RefreshCw className="size-4" />}
            Обновить урок
          </Button>
        </div>
        {lesson.whyItMatters && (
          <RichText value={lesson.whyItMatters} locale={language} as="div" className="text-sm leading-6" />
        )}
      </div>

      {lesson.sections.length > 0 && (
        <LessonSection icon={<BookOpen className="size-4" />} title="Теория">
          <div className="grid gap-4">
            {lesson.sections.map((section, index) => (
              <div key={`${section.title}-${index}`} className="rounded-xl border border-border p-4">
                <RichText value={section.title} locale={language} as="div" className="font-semibold" />
                <RichText value={section.content} locale={language} as="div" className="mt-2 text-sm leading-6 text-muted-foreground" />
              </div>
            ))}
          </div>
        </LessonSection>
      )}

      {lesson.formulas.length > 0 && (
        <LessonSection icon={<Wand2 className="size-4" />} title="Формулы">
          <div className="grid gap-3">
            {lesson.formulas.map((formula, index) => (
              <div key={`${formula.latex}-${index}`} className="rounded-xl border border-violet-100 bg-violet-50/60 p-4">
                <RichText value={`$$${formula.latex}$$`} locale={language} as="div" className="overflow-x-auto" />
                {formula.note && (
                  <RichText value={formula.note} locale={language} as="div" className="mt-2 text-sm leading-6 text-violet-950" />
                )}
              </div>
            ))}
          </div>
        </LessonSection>
      )}

      {lesson.workedExamples.length > 0 && (
        <LessonSection icon={<ClipboardCheck className="size-4" />} title="Разбор примеров">
          <div className="grid gap-4">
            {lesson.workedExamples.map((example, index) => (
              <div key={`${example.title}-${index}`} className="rounded-xl border border-border p-4">
                <RichText value={example.title || `Пример ${index + 1}`} locale={language} as="div" className="font-semibold" />
                <RichText value={example.question} locale={language} as="div" className="mt-2 text-sm leading-6" />
                {example.steps.length > 0 && (
                  <ol className="mt-3 grid gap-2">
                    {example.steps.map((step, stepIndex) => (
                      <li key={stepIndex} className="flex gap-2 text-sm">
                        <span className="text-muted-foreground">{stepIndex + 1}.</span>
                        <RichText value={step} locale={language} as="div" className="min-w-0 flex-1 leading-6" />
                      </li>
                    ))}
                  </ol>
                )}
                {example.answer && (
                  <RichText
                    value={example.answer}
                    locale={language}
                    as="div"
                    className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950"
                  />
                )}
                {example.trap && (
                  <div className="mt-3 flex gap-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-950">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    <RichText value={example.trap} locale={language} as="div" className="leading-6" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </LessonSection>
      )}

      {lesson.practice.length > 0 && (
        <LessonSection icon={<Sparkles className="size-4" />} title="Практика">
          <TaskList tasks={lesson.practice} language={language} />
        </LessonSection>
      )}

      {(lesson.commonTraps.length > 0 || lesson.checklist.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {lesson.commonTraps.length > 0 && (
            <LessonSection icon={<AlertTriangle className="size-4" />} title="Типичные ловушки">
              <BulletList items={lesson.commonTraps} language={language} tone="amber" />
            </LessonSection>
          )}
          {lesson.checklist.length > 0 && (
            <LessonSection icon={<ListChecks className="size-4" />} title="Чек-лист">
              <BulletList items={lesson.checklist} language={language} tone="emerald" />
            </LessonSection>
          )}
        </div>
      )}

      {lesson.miniTest.length > 0 && (
        <LessonSection icon={<CheckCircle2 className="size-4" />} title="Мини-тест">
          <TaskList tasks={lesson.miniTest} language={language} />
        </LessonSection>
      )}
    </div>
  )
}

function LessonSection({
  icon,
  title,
  children,
}: {
  icon: ReactNode
  title: string
  children: ReactNode
}) {
  return (
    <section className="flex flex-col gap-3">
      <h3 className="flex items-center gap-2 text-base font-semibold">
        <span className="flex size-7 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
          {icon}
        </span>
        {title}
      </h3>
      {children}
    </section>
  )
}

function BulletList({
  items,
  language,
  tone,
}: {
  items: string[]
  language: "ru" | "kk"
  tone: "amber" | "emerald"
}) {
  return (
    <ul className="grid gap-2">
      {items.map((item, index) => (
        <li
          key={`${item}-${index}`}
          className={cn(
            "rounded-lg p-3 text-sm leading-6",
            tone === "amber" ? "bg-amber-50 text-amber-950" : "bg-emerald-50 text-emerald-950",
          )}
        >
          <RichText value={item} locale={language} as="div" />
        </li>
      ))}
    </ul>
  )
}

function TaskList({
  tasks,
  language,
}: {
  tasks: LessonTask[]
  language: "ru" | "kk"
}) {
  return (
    <div className="grid gap-3">
      {tasks.map((task, index) => {
        const options = task.options ?? []
        return (
          <div key={`${task.prompt}-${index}`} className="rounded-xl border border-border p-4">
            <div className="flex gap-2">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-100 text-xs font-semibold text-violet-700">
                {index + 1}
              </span>
              <RichText value={task.prompt} locale={language} as="div" className="min-w-0 flex-1 text-sm font-medium leading-6" />
            </div>
            {options.length > 0 && (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {options.map((option, optionIndex) => (
                  <div key={`${option}-${optionIndex}`} className="flex items-start gap-2 rounded-lg bg-secondary/50 p-3 text-sm">
                    <span className="mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full bg-background text-[11px] font-semibold text-muted-foreground">
                      {String.fromCharCode(65 + optionIndex)}
                    </span>
                    <RichText value={option} locale={language} as="div" className="min-w-0 flex-1 leading-6" />
                  </div>
                ))}
              </div>
            )}
            {task.answer && (
              <RichText
                value={task.answer}
                locale={language}
                as="div"
                className="mt-3 rounded-lg bg-emerald-50 p-3 text-sm leading-6 text-emerald-950"
              />
            )}
            {task.explanation && (
              <RichText
                value={task.explanation}
                locale={language}
                as="div"
                className="mt-2 rounded-lg border border-border bg-card p-3 text-sm leading-6 text-muted-foreground"
              />
            )}
          </div>
        )
      })}
    </div>
  )
}

function errorToastMessage(err: unknown, fallback: string) {
  if (!(err instanceof ApiError)) return fallback
  if (err.message === "AI_DAILY_LIMIT") {
    return "Дневной лимит AI исчерпан — продолжишь завтра"
  }
  if (err.message === "AI_BUSY" || err.status === 503) {
    return "AI перегружен, попробуйте позже"
  }
  if (err.status === 429) {
    return "Слишком часто, подождите минуту"
  }
  if (err.message === "NO_OPEN_MISTAKES_FOR_THEME") {
    return "По этой теме нет открытых ошибок"
  }
  return err.message || fallback
}
