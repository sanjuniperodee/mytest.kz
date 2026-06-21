"use client"

import { useCallback, useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useParams, useRouter } from "next/navigation"
import { toast } from "sonner"
import {
  ArrowLeft,
  BookOpen,
  Crown,
  Lightbulb,
  MessageSquare,
  Play,
  Send,
  Sparkles,
  Target,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { Textarea } from "@/components/ui/textarea"
import { RichText } from "@/components/exam/rich-text"
import {
  FullLessonReader,
  getPresentLessonSections,
} from "@/components/dashboard/lesson-content"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import type { AiTopicLesson } from "@/lib/api/types"

type LessonStatus = "idle" | "loading"

export default function ThemeLessonPage() {
  const router = useRouter()
  const params = useParams<{ themeId: string }>()
  const themeId = typeof params.themeId === "string" ? params.themeId : ""
  const { user, isLoading: authLoading } = useAuth()
  const language: "ru" | "kk" = user?.preferredLanguage === "kk" ? "kk" : "ru"
  const hasPremium = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)

  const [lesson, setLesson] = useState<AiTopicLesson | null>(null)
  const [status, setStatus] = useState<LessonStatus>("idle")
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [training, setTraining] = useState(false)
  const [noteOpen, setNoteOpen] = useState(false)
  const [noteMessage, setNoteMessage] = useState("")
  const [noteSubmitting, setNoteSubmitting] = useState(false)

  const presentSections = useMemo(
    () => (lesson && !lesson.pages?.length ? getPresentLessonSections(lesson) : []),
    [lesson],
  )

  const loadLesson = useCallback(
    async () => {
      if (!themeId || !hasPremium) return
      setStatus("loading")
      setErrorMessage(null)
      try {
        const nextLesson = await api<AiTopicLesson>("/ai/mistakes/theme-lesson", {
          method: "POST",
          body: { themeId, language },
        })
        setLesson(nextLesson)
      } catch (err) {
        if (err instanceof ApiError && (err.status === 402 || err.status === 403)) {
          router.push("/dashboard/billing?reason=theme_lesson")
          return
        }

        const message = lessonErrorMessage(err)
        toast.error(message)
        setErrorMessage(message)
      } finally {
        setStatus("idle")
      }
    },
    [hasPremium, language, router, themeId],
  )

  useEffect(() => {
    if (authLoading || !hasPremium) return
    void loadLesson()
  }, [authLoading, hasPremium, loadLesson])

  const startPractice = async () => {
    if (!lesson) return
    setTraining(true)
    try {
      const session = await api<{ id: string }>("/tests/mistakes/practice", {
        method: "POST",
        body: {
          language,
          examTypeId: lesson.examTypeId,
          subjectId: lesson.subjectId,
          themeId: lesson.topicId,
          limit: 15,
          durationMins: 25,
        },
      })
      router.push(`/exam/${session.id}`)
    } catch (err) {
      setTraining(false)
      if (err instanceof ApiError && (err.status === 402 || err.status === 403)) {
        router.push("/dashboard/billing?reason=theme_lesson")
        return
      }
      toast.error(practiceErrorMessage(err))
    }
  }

  const submitLessonNote = async () => {
    const message = noteMessage.trim()
    if (!lesson?.lessonId) {
      toast.error("Урок ещё не сохранён. Попробуйте открыть его заново.")
      return
    }
    if (message.length < 12) {
      toast.error("Опишите замечание чуть подробнее")
      return
    }

    setNoteSubmitting(true)
    try {
      await api(`/ai/mistakes/theme-lesson/${lesson.lessonId}/note`, {
        method: "POST",
        body: { message },
      })
      setNoteMessage("")
      setNoteOpen(false)
      toast.success("Замечание отправлено админу")
    } catch (err) {
      toast.error(lessonNoteErrorMessage(err))
    } finally {
      setNoteSubmitting(false)
    }
  }

  if (authLoading) {
    return (
      <div className="mx-auto flex min-h-80 w-full max-w-7xl items-center justify-center gap-3 text-sm text-muted-foreground">
        <Spinner className="size-5 text-violet-600" />
        Загружаем доступ...
      </div>
    )
  }

  if (!hasPremium) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
          <Link href="/dashboard/mistakes">
            <ArrowLeft className="size-4" />
            Работа над ошибками
          </Link>
        </Button>
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="grid gap-4 p-5 text-amber-950 sm:grid-cols-[1fr_auto] sm:items-center">
            <div className="flex items-start gap-3">
              <Crown className="mt-0.5 size-5 shrink-0 text-amber-700" />
              <div>
                <p className="font-semibold">Персональный урок доступен в Premium</p>
                <p className="mt-1 text-sm leading-6 text-amber-900">
                  Premium откроет AI-уроки по темам ошибок, визуализации, примеры и мини-тест.
                </p>
              </div>
            </div>
            <Button asChild className="bg-amber-700 text-white hover:bg-amber-800">
              <Link href="/dashboard/billing?reason=theme_lesson">
                <Crown className="size-4" />
                Открыть Premium
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (status === "loading" && !lesson) {
    return (
      <div className="mx-auto flex min-h-80 w-full max-w-7xl items-center justify-center gap-3 rounded-xl border border-violet-100 bg-violet-50 text-sm text-violet-950">
        <Spinner className="size-6 text-violet-600" />
        AI готовит полный урок...
      </div>
    )
  }

  if (!lesson) {
    return (
      <div className="mx-auto flex w-full max-w-7xl flex-col gap-4">
        <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
          <Link href="/dashboard/mistakes">
            <ArrowLeft className="size-4" />
            Работа над ошибками
          </Link>
        </Button>
        <Card>
          <CardContent className="flex flex-col gap-4 p-6">
            <p className="text-sm text-muted-foreground">
              {errorMessage ?? "Не удалось открыть урок по теме."}
            </p>
            <Button type="button" className="w-fit" onClick={() => void loadLesson()}>
              <Sparkles className="size-4" />
              Повторить
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-7xl flex-col gap-6">
      <Button asChild variant="ghost" className="w-fit px-0 hover:bg-transparent">
        <Link href={`/dashboard/mistakes/subjects/${lesson.subjectId}`}>
          <ArrowLeft className="size-4" />
          К предмету
        </Link>
      </Button>

      <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50 via-card to-violet-50/70">
        <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-start">
            <div className="flex min-w-0 flex-col gap-2">
              <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <BookOpen className="size-4 text-emerald-600" />
                <RichText value={lesson.subjectName} locale={language} as="span" />
                <span>·</span>
                <RichText value={lesson.topicName} locale={language} as="span" />
              </div>
              <RichText
                value={lesson.title}
                locale={language}
                as="div"
                className="text-2xl font-semibold leading-tight tracking-tight sm:text-3xl"
              />
            </div>

            <div className="grid gap-2 sm:grid-cols-2 lg:w-[340px]">
              <Button type="button" size="lg" onClick={() => void startPractice()} disabled={training}>
                {training ? <Spinner className="size-4" /> : <Play className="size-4" />}
                Тренировать
              </Button>
              <Button type="button" size="lg" variant="outline" onClick={() => setNoteOpen(true)}>
                <MessageSquare className="size-4" />
                Замечание
              </Button>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="rounded-xl border border-emerald-100 bg-white/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-emerald-900">
                <Target className="size-4" />
                Цель
              </div>
              <RichText value={lesson.studentGoal} locale={language} as="div" className="text-sm leading-6 text-emerald-950" />
            </div>
            <div className="rounded-xl border border-violet-100 bg-white/70 p-4">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-violet-900">
                <Lightbulb className="size-4" />
                Зачем на ЕНТ
              </div>
              <RichText value={lesson.whyItMatters} locale={language} as="div" className="text-sm leading-6 text-violet-950" />
            </div>
          </div>
        </CardContent>
      </Card>

      {presentSections.length > 0 && (
        <nav className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-3">
          {presentSections.map((section) => (
            <a
              key={section.id}
              href={`#sec-${section.id}`}
              className="rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {section.label}
            </a>
          ))}
        </nav>
      )}

      <main className="min-w-0">
        <FullLessonReader lesson={lesson} language={language} />
        <p className="mt-6 text-sm text-muted-foreground">
          {lesson.cached ? "Сохранённый урок" : "Сгенерировано сейчас"} · {lesson.model}
        </p>
      </main>

      <Dialog open={noteOpen} onOpenChange={setNoteOpen}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Замечание к уроку</DialogTitle>
            <DialogDescription>
              Сообщение попадёт админу, а сам урок ученики обновлять не могут.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={noteMessage}
            onChange={(event) => setNoteMessage(event.target.value)}
            placeholder="Например: в этой формуле ошибка или тема названа неточно"
            className="min-h-32 resize-none text-sm"
            maxLength={2000}
          />
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setNoteOpen(false)}
              disabled={noteSubmitting}
            >
              Закрыть
            </Button>
            <Button
              type="button"
              onClick={() => void submitLessonNote()}
              disabled={noteSubmitting || noteMessage.trim().length < 12}
            >
              {noteSubmitting ? <Spinner className="size-4" /> : <Send className="size-4" />}
              Отправить админу
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function lessonNoteErrorMessage(err: unknown) {
  if (!(err instanceof ApiError)) return "Не удалось отправить замечание. Попробуйте ещё раз."
  if (err.message === "LESSON_NOTE_TOO_SHORT") return "Опишите замечание чуть подробнее"
  if (err.message === "NO_OPEN_MISTAKES_FOR_THEME") return "По этой теме нет открытых ошибок"
  if (err.status === 429) return "Слишком часто — подождите минуту"
  return err.message || "Не удалось отправить замечание. Попробуйте ещё раз."
}

function lessonErrorMessage(err: unknown) {
  if (!(err instanceof ApiError)) return "Не удалось подготовить урок. Попробуйте ещё раз."
  if (err.message === "AI_DAILY_LIMIT") {
    return "Дневной лимит AI исчерпан — продолжишь завтра"
  }
  if (err.message === "AI_BUSY" || err.status === 503) {
    return "AI перегружен, попробуйте позже"
  }
  if (err.message === "NO_OPEN_MISTAKES_FOR_THEME") {
    return "По этой теме нет открытых ошибок"
  }
  if (err.status === 429) {
    return "Слишком часто, подождите минуту"
  }
  return err.message || "Не удалось подготовить урок. Попробуйте ещё раз."
}

function practiceErrorMessage(err: unknown) {
  // Not an ApiError → the request never got an HTTP response (connection dropped/blocked).
  if (!(err instanceof ApiError)) {
    return "Не удалось связаться с сервером. Проверьте интернет и попробуйте ещё раз."
  }
  switch (err.message) {
    case "NO_OPEN_MISTAKES_FOR_THEME":
      return "По этой теме больше нет открытых ошибок — выбери другую."
    case "NO_OPEN_MISTAKES_FOR_SUBJECT":
      return "По этому предмету нет открытых ошибок."
    case "NO_OPEN_MISTAKES":
      return "Открытых ошибок пока нет."
    case "EXAM_TYPE_REQUIRED":
      return "Выберите конкретный экзамен."
  }
  if (err.status === 429) return "Слишком часто — подождите минуту и попробуйте снова."
  if (err.status >= 500) return "Сервис временно недоступен. Попробуйте ещё раз."
  return "Не удалось запустить тренировку. Попробуйте ещё раз."
}
