"use client"

import { useEffect, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import useSWR from "swr"
import { toast } from "sonner"
import { BookOpen, Crown, Play, Target, Sparkles } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Slider } from "@/components/ui/slider"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { api, ApiError } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { ExamType, MistakesSummary, TestSession } from "@/lib/api/types"

export default function MistakesPage() {
  const router = useRouter()
  const { user, refresh } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data: summary, isLoading } = useSWR<MistakesSummary>("/tests/mistakes/summary")
  const { data: examTypes } = useSWR<ExamType[]>("/exams/types")

  const [examTypeId, setExamTypeId] = useState<string>("all")
  const [subjectId, setSubjectId] = useState<string>("all")
  const [language, setLanguage] = useState<"ru" | "kk">("ru")
  const [limit, setLimit] = useState(20)
  const [duration, setDuration] = useState(30)
  const [starting, setStarting] = useState(false)
  const hasPremium = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)

  const total = summary?.openTotal ?? 0
  const byExam = summary?.openByExam ?? []
  const bySubject = summary?.openBySubject ?? []
  const examsById = useMemo(
    () => new Map<string, ExamType>((examTypes || []).map((exam) => [exam.id, exam])),
    [examTypes],
  )
  const examOptions = useMemo(
    () =>
      byExam.map((row) => {
        const exam = examsById.get(row.examTypeId)
        return {
          id: row.examTypeId,
          name: localize(exam?.name ?? row.examName, locale, "Экзамен"),
          count: row.count,
        }
      }),
    [byExam, examsById, locale],
  )
  const subjectOptions = useMemo(
    () =>
      bySubject
        .filter((row) => examTypeId === "all" || row.examTypeId === examTypeId)
        .map((row) => {
          const exam = examsById.get(row.examTypeId)
          const examName = localize(exam?.name ?? row.examName, locale, "Экзамен")
          const subjectName = localize(row.subjectName, locale, "Предмет")
          return {
            id: row.subjectId,
            examTypeId: row.examTypeId,
            label: examTypeId === "all" ? `${subjectName} · ${examName}` : subjectName,
            count: row.count,
          }
        }),
    [bySubject, examTypeId, examsById, locale],
  )

  useEffect(() => {
    void refresh({ silent: true })
  }, [refresh])

  useEffect(() => {
    if (subjectId === "all") return
    if (!subjectOptions.some((subject) => subject.id === subjectId)) {
      setSubjectId("all")
    }
  }, [subjectId, subjectOptions])

  useEffect(() => {
    setLanguage(locale === "kk" ? "kk" : "ru")
  }, [locale])

  const start = async () => {
    setStarting(true)
    try {
      const session = await api<TestSession>("/tests/mistakes/practice", {
        method: "POST",
        body: {
          language,
          examTypeId: examTypeId === "all" ? undefined : examTypeId,
          subjectId: subjectId === "all" ? undefined : subjectId,
          limit,
          durationMins: duration,
        },
      })
      router.push(`/exam/${session.id}`)
    } catch (err) {
      let message = "Не удалось запустить практику"
      if (err instanceof ApiError) {
        if (err.message === "EXAM_TYPE_REQUIRED") {
          message = "Выберите конкретный экзамен"
        } else if (err.message === "NO_OPEN_MISTAKES_FOR_SUBJECT") {
          message = "По этому предмету нет открытых ошибок"
        } else if (err.message === "NO_OPEN_MISTAKES") {
          message = "Открытых ошибок пока нет"
        } else if (err.status === 402 || err.status === 403) {
          void recordFunnelEvent("premium_gate", { feature: "mistakes_practice" })
          router.push("/dashboard/billing?reason=mistakes_practice")
          return
        } else {
          message = err.message
        }
      }
      toast.error(message)
      setStarting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-semibold tracking-tight">Работа над ошибками</h1>
        <p className="text-muted-foreground">
          Прорабатывайте вопросы, в которых ранее ошиблись, чтобы закрыть пробелы быстрее
        </p>
      </div>

      {/* Summary stats */}
      <div className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardContent className="flex flex-col gap-2 p-5">
            <div className="flex items-center gap-2 text-muted-foreground">
              <Target className="size-4" />
              <span className="text-xs font-medium uppercase tracking-wide">
                Всего ошибок
              </span>
            </div>
            {isLoading ? (
              <Skeleton className="h-9 w-20" />
            ) : (
              <span className="text-4xl font-semibold tabular-nums">{total}</span>
            )}
            <p className="text-sm text-muted-foreground">
              Каждая отработанная ошибка приближает к высокому баллу
            </p>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base">По экзаменам</CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Skeleton key={i} className="h-9" />
                ))}
              </div>
            ) : examOptions.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Пока нет ошибок — отлично!
              </p>
            ) : (
              <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {examOptions.map((exam) => (
                  <li
                    key={exam.id}
                    className="flex items-center justify-between gap-3 rounded-md border border-border bg-card px-3 py-2"
                  >
                    <span className="truncate text-sm font-medium">
                      {exam.name}
                    </span>
                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold tabular-nums">
                      {exam.count}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {hasPremium ? (
        <Card>
        <CardHeader>
          <CardTitle>Запустить тренировку</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="flex flex-col gap-2">
              <Label htmlFor="examType">Экзамен</Label>
              <Select value={examTypeId} onValueChange={setExamTypeId}>
                <SelectTrigger id="examType">
                  <SelectValue placeholder="Все экзамены" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все экзамены</SelectItem>
                  {examOptions.map((exam) => (
                    <SelectItem key={exam.id} value={exam.id}>
                      {exam.name} ({exam.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {examTypeId === "all" && byExam.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Будут включены ошибки из всех экзаменов
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="subject">Предмет</Label>
              <Select
                value={subjectId}
                onValueChange={setSubjectId}
                disabled={subjectOptions.length === 0}
              >
                <SelectTrigger id="subject">
                  <SelectValue placeholder="Все предметы" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Все предметы</SelectItem>
                  {subjectOptions.map((subject) => (
                    <SelectItem key={`${subject.examTypeId}:${subject.id}`} value={subject.id}>
                      {subject.label} ({subject.count})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {subjectId === "all" && subjectOptions.length > 0 && (
                <p className="text-xs text-muted-foreground">
                  Будут включены ошибки из всех предметов
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Label>Язык</Label>
              <RadioGroup
                value={language}
                onValueChange={(v) => setLanguage(v as "ru" | "kk")}
                className="flex gap-2"
              >
                <Label className="flex flex-1 items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer">
                  <RadioGroupItem value="ru" />
                  Русский
                </Label>
                <Label className="flex flex-1 items-center gap-2 rounded-md border border-border px-3 py-2 cursor-pointer">
                  <RadioGroupItem value="kk" />
                  Қазақша
                </Label>
              </RadioGroup>
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Количество вопросов</Label>
                <span className="text-sm font-medium tabular-nums">{limit}</span>
              </div>
              <Slider
                value={[limit]}
                min={5}
                max={50}
                step={5}
                onValueChange={(v) => setLimit(v[0] ?? 20)}
              />
            </div>

            <div className="flex flex-col gap-3">
              <div className="flex items-center justify-between">
                <Label>Длительность, мин</Label>
                <span className="text-sm font-medium tabular-nums">{duration}</span>
              </div>
              <Slider
                value={[duration]}
                min={5}
                max={120}
                step={5}
                onValueChange={(v) => setDuration(v[0] ?? 30)}
              />
            </div>
          </div>

          <div className="flex flex-col gap-3 rounded-lg border border-dashed border-border bg-secondary/40 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-3">
              <Sparkles className="size-5 shrink-0 text-foreground" />
              <div>
                <p className="text-sm font-medium">Подберём вопросы автоматически</p>
                <p className="text-xs text-muted-foreground">
                  Берём ваши прошлые ошибки и формируем мини-тест на {limit} вопросов
                </p>
              </div>
            </div>
            <Button onClick={start} disabled={starting || total === 0} className="h-11">
              {starting ? (
                <Spinner className="size-4" />
              ) : (
                <>
                  <Play className="size-4" />
                  Начать тренировку
                </>
              )}
            </Button>
          </div>

          {total === 0 && !isLoading && (
            <div className="flex items-center gap-3 rounded-md border border-border bg-card p-4 text-sm">
              <BookOpen className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">
                Сначала пройдите хотя бы один пробник — после него ваши ошибки появятся тут.
              </span>
            </div>
          )}
        </CardContent>
        </Card>
      ) : (
        <Card
          key={`mistakes-premium-${total}`}
          className="overflow-hidden border-amber-200 bg-amber-50"
        >
          <CardContent className="grid gap-5 p-5 text-amber-950 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="flex flex-col gap-2">
              <div className="flex items-center gap-2">
                <Crown className="size-5 text-amber-700" />
                <span className="text-sm font-semibold uppercase tracking-wide">
                  Premium-функция
                </span>
              </div>
              <h2 className="text-2xl font-semibold tracking-tight">
                Работа над ошибками открывается в Premium
              </h2>
              <p className="max-w-2xl text-sm leading-6 text-amber-900">
                Мы соберём ваши ошибки в короткие тренировки, чтобы закрывать слабые места
                быстрее. Сейчас в очереди:{" "}
                <span className="font-semibold tabular-nums">{total}</span> ошибок.
              </p>
            </div>
            <Button asChild size="lg" className="h-11 bg-amber-700 text-white hover:bg-amber-800">
              <Link
                href="/dashboard/billing?reason=mistakes_practice"
                onClick={() =>
                  void recordFunnelEvent("premium_gate", { feature: "mistakes_practice" })
                }
              >
                Открыть Premium
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
