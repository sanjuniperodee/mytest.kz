"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, BookOpen, Sparkles, Target, Trophy } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { PageHeader } from "@/components/dashboard/page-header"
import { DashboardEmpty } from "@/components/dashboard/data-display"
import { formatBestPoints } from "@/lib/dashboard/format"
import {
  ACCESS_TONE_CLASSES,
  examAccessStatus,
  type AccessStatus,
} from "@/lib/dashboard/access"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import { cn } from "@/lib/utils"
import type { ExamType, UserExamStats, UserStats } from "@/lib/api/types"

export default function ExamsPage() {
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data, isLoading } = useSWR<ExamType[]>("/exams/types")
  const { data: stats } = useSWR<UserStats>("/users/me/stats")
  const items = Array.isArray(data) ? data : []

  const statsBySlug = new Map<string, UserExamStats>()
  for (const s of stats?.byExamType ?? []) {
    if (s.examSlug) statsBySlug.set(s.examSlug, s)
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Каталог пробников"
        eyebrowIcon={Sparkles}
        title="Экзамены"
        description="Выберите тип экзамена, чтобы начать пробное тестирование в реальном формате."
      />

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-52 rounded-xl" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <Card>
          <CardContent className="p-0">
            <DashboardEmpty
              icon={BookOpen}
              title="Каталог пока пуст"
              text="Экзамены появятся здесь, как только их добавят. Загляните позже."
            />
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((exam) => {
            const slug = exam.slug || exam.code || ""
            const access = user?.accessByExam?.find((a) => a.examSlug === slug)
            const trial = slug === "ent" ? user?.trialStatus?.ent : undefined
            return (
              <ExamCard
                key={exam.id}
                exam={exam}
                locale={locale}
                stats={statsBySlug.get(slug)}
                access={examAccessStatus(access, trial)}
              />
            )
          })}
        </div>
      )}
    </div>
  )
}

function ExamCard({
  exam,
  locale,
  stats,
  access,
}: {
  exam: ExamType
  locale: Locale
  stats?: UserExamStats
  access: AccessStatus
}) {
  const name = localize(exam.name, locale, "Экзамен")
  const description = localize(exam.description, locale)
  const slug = exam.slug || exam.code || "exam"
  const attempts = (stats?.testsCount ?? 0) + (stats?.inProgressCount ?? 0)
  const hasBest = stats?.bestScore != null || stats?.bestRawScore != null

  return (
    <Link
      href={`/dashboard/exams/${exam.id}`}
      className="group block rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
    >
      <Card className="flex h-full flex-col overflow-hidden py-0 transition-all duration-200 group-hover:-translate-y-0.5 group-hover:border-foreground/40 group-hover:shadow-md">
        <CardContent className="flex flex-1 flex-col gap-3 p-5">
          <div className="flex items-start justify-between gap-3">
            <div className="flex size-11 items-center justify-center rounded-lg bg-foreground text-background shadow-sm">
              <BookOpen className="size-5" aria-hidden="true" />
            </div>
            <Badge
              variant="outline"
              className={cn("font-medium", ACCESS_TONE_CLASSES[access.tone])}
            >
              {access.label}
            </Badge>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold leading-tight">{name}</h2>
              <Badge variant="secondary" className="font-mono text-[10px] uppercase tracking-wider">
                {slug}
              </Badge>
            </div>
            {description && (
              <p className="text-sm text-muted-foreground line-clamp-2">{description}</p>
            )}
          </div>

          {(hasBest || attempts > 0) && (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {hasBest && (
                <span className="inline-flex items-center gap-1.5">
                  <Trophy className="size-3.5 text-amber-500" aria-hidden="true" />
                  Лучший:{" "}
                  <span className="font-semibold tabular-nums text-foreground">
                    {formatBestPoints(stats!)}
                  </span>
                </span>
              )}
              {attempts > 0 && (
                <span className="inline-flex items-center gap-1.5">
                  <Target className="size-3.5" aria-hidden="true" />
                  Попыток:{" "}
                  <span className="font-semibold tabular-nums text-foreground">{attempts}</span>
                </span>
              )}
            </div>
          )}

          <div className="mt-auto flex items-center gap-1 pt-1 text-sm font-medium text-foreground/80">
            Открыть
            <ArrowRight
              className="size-3.5 transition-transform group-hover:translate-x-0.5"
              aria-hidden="true"
            />
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
