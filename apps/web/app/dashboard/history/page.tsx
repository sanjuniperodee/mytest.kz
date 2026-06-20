"use client"

import * as React from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowLeft, ArrowRight, BookOpen, History } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { PageHeader } from "@/components/dashboard/page-header"
import { SessionStatusBadge } from "@/components/dashboard/data-display"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { ExamType, SessionListItem } from "@/lib/api/types"

type SessionsResponse =
  | SessionListItem[]
  | {
      items?: SessionListItem[]
      total?: number
      page?: number
      totalPages?: number
    }

export default function ExamHistoryPage() {
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const [page, setPage] = React.useState(1)
  const [examTypeId, setExamTypeId] = React.useState("all")
  const { data: examTypes } = useSWR<ExamType[]>("/exams/types")
  const sessionsKey = `/tests/sessions?page=${page}&limit=20${
    examTypeId !== "all" ? `&examTypeId=${encodeURIComponent(examTypeId)}` : ""
  }`
  const { data, isLoading } = useSWR<SessionsResponse>(sessionsKey)
  const sessions = normalizeSessions(data)
  // API returns { total, page, limit } (no totalPages) — derive it so the last
  // exact-20-item page doesn't enable "Далее" into an empty page.
  const totalPages = Array.isArray(data)
    ? undefined
    : (data?.totalPages ??
        (data?.total != null ? Math.max(1, Math.ceil(data.total / 20)) : undefined))
  const canGoPrev = page > 1
  const canGoNext = totalPages != null ? page < totalPages : sessions.length === 20

  function changeExamType(value: string) {
    setExamTypeId(value)
    setPage(1)
  }

  return (
    <div className="flex flex-col gap-6">
      <Button asChild variant="ghost" size="sm" className="w-fit">
        <Link href="/dashboard">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Назад
        </Link>
      </Button>

      <PageHeader
        title="История экзаменов"
        description="Все твои попытки по всем экзаменам"
        actions={
          <Select value={examTypeId} onValueChange={changeExamType}>
            <SelectTrigger className="w-full sm:w-56">
              <SelectValue placeholder="Все экзамены" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все экзамены</SelectItem>
              {(examTypes ?? []).map((exam) => (
                <SelectItem key={exam.id} value={exam.id}>
                  {localize(exam.name, locale, "Экзамен")}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        }
      />

      <Card className="rounded-xl border bg-card">
        <CardContent className="p-0">
          {isLoading ? (
            <HistorySkeleton />
          ) : sessions.length === 0 ? (
            <EmptyHistory />
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((session) => (
                <SessionRow key={session.id} session={session} locale={locale} />
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex items-center justify-between gap-3">
        <Button
          variant="outline"
          disabled={!canGoPrev}
          onClick={() => setPage((value) => Math.max(1, value - 1))}
        >
          Назад
        </Button>
        <span className="text-sm text-muted-foreground">
          Страница {page}
          {totalPages != null ? ` из ${totalPages}` : ""}
        </span>
        <Button
          variant="outline"
          disabled={!canGoNext}
          onClick={() => setPage((value) => value + 1)}
        >
          Далее
          <ArrowRight className="size-4" aria-hidden="true" />
        </Button>
      </div>
    </div>
  )
}

function SessionRow({ session, locale }: { session: SessionListItem; locale: Locale }) {
  const href =
    session.status === "in_progress" ? `/exam/${session.id}` : `/exam/${session.id}/review`
  const score = formatScore(session)

  return (
    <Link
      href={href}
      className="grid gap-3 px-4 py-4 transition-colors hover:bg-secondary/40 sm:grid-cols-[minmax(0,1fr)_170px_110px_120px] sm:items-center"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {localize(session.examType?.name, locale) || "Пробный тест"}
        </p>
        <p className="mt-1 text-xs text-muted-foreground sm:hidden">
          {formatStartedAt(session.startedAt)}
        </p>
      </div>
      <div className="text-sm text-muted-foreground sm:hidden">
        {score ? <span className="font-semibold text-foreground">{score}</span> : null}
      </div>
      <p className="hidden text-sm text-muted-foreground sm:block">
        {formatStartedAt(session.startedAt)}
      </p>
      <p className="hidden text-sm font-semibold tabular-nums sm:block">{score || "—"}</p>
      <div className="flex justify-start sm:justify-end">
        <SessionStatusBadge status={session.status} />
      </div>
    </Link>
  )
}

function HistorySkeleton() {
  return (
    <div className="flex flex-col gap-0">
      {Array.from({ length: 6 }).map((_, index) => (
        <div key={index} className="grid gap-3 border-b px-4 py-4 last:border-b-0 sm:grid-cols-4">
          <Skeleton className="h-5 w-48 max-w-full" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-6 w-24 sm:justify-self-end" />
        </div>
      ))}
    </div>
  )
}

function EmptyHistory() {
  return (
    <div className="flex flex-col items-center gap-3 px-4 py-12 text-center">
      <div className="flex size-11 items-center justify-center rounded-full bg-secondary">
        <History className="size-5 text-muted-foreground" aria-hidden="true" />
      </div>
      <div>
        <p className="font-medium">Пока нет попыток</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Начни пробный экзамен, и история появится здесь.
        </p>
      </div>
      <Button asChild>
        <Link href="/dashboard/exams">
          <BookOpen className="size-4" aria-hidden="true" />
          К экзаменам
        </Link>
      </Button>
    </div>
  )
}

function normalizeSessions(data?: SessionsResponse): SessionListItem[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return Array.isArray(data.items) ? data.items : []
}

function formatScore(session: SessionListItem) {
  if ((session.rawScore == null && session.score == null) || session.maxScore == null) {
    return ""
  }
  return `${session.rawScore ?? session.score}/${session.maxScore}`
}

function formatStartedAt(value?: string) {
  if (!value) return "—"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "—"
  return date.toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}
