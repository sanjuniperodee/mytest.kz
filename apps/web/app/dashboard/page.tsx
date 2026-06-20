"use client"

import Link from "next/link"
import useSWR from "swr"
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Flame,
  Gift,
  History,
  ListChecks,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { AdmissionGoalCard } from "@/components/dashboard/admission-goal-card"
import { ScoreProjection } from "@/components/dashboard/score-projection"
import {
  SessionStatusBadge,
  StatCard,
} from "@/components/dashboard/data-display"
import { formatBestPoints } from "@/lib/dashboard/format"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type {
  AccessByExamItem,
  ExamType,
  MistakesSummary,
  SessionListItem,
  UserExamStats,
  UserStats,
} from "@/lib/api/types"

type SessionsResponse = { items?: SessionListItem[] } | SessionListItem[]

export default function DashboardHomePage() {
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.telegramUsername ||
    user?.username ||
    ""
  const { data: stats, isLoading: statsLoading } = useSWR<UserStats>("/users/me/stats")
  const { data: summary } = useSWR<MistakesSummary>("/tests/mistakes/summary")
  const { data: sessions, isLoading: sessLoading } = useSWR<SessionsResponse>(
    "/tests/sessions?page=1&limit=4",
  )
  const { data: examTypes } = useSWR<ExamType[]>("/exams/types")

  const sessionList = normalizeSessions(sessions)
  const inProgress = sessionList.find((s) => s.status === "in_progress")
  const entExam = (examTypes || []).find((exam) => exam.slug === "ent")
  const entAccess = user?.accessByExam?.find((item) => item.examSlug === "ent")
  const entTrial = user?.trialStatus?.ent
  const hasPaidSubscription = Boolean(user?.hasActiveSubscription)
  const freeTrialRemaining =
    entTrial?.freeRemaining ?? entTrial?.remaining ?? null
  const hasUnusedFreeTrial =
    !hasPaidSubscription &&
    freeTrialRemaining != null &&
    freeTrialRemaining > 0 &&
    (stats?.completedTests ?? 0) === 0
  const quickStartHref =
    entExam && entAccess && !entAccess.hasAccess
      ? "/dashboard/billing?reason=no_access"
      : entExam
        ? `/dashboard/exams/${entExam.id}`
        : "/dashboard/exams"
  const tariffName = localize(
    user?.currentTariff?.name,
    locale,
    hasPaidSubscription ? "Premium" : "Стартовый доступ",
  )
  const bestExam =
    stats?.byExamType?.reduce<UserExamStats | null>((best, item) => {
      if (item.bestScore == null) return best
      if (!best || best.bestScore == null || item.bestScore > best.bestScore) return item
      return best
    }, null) ?? null
  const scoreImpact = summary?.scoreImpact
  const averageResult = stats ? `${Math.round(stats.averageScore)}%` : "—"
  const bestResult = bestExam
    ? formatBestPoints(bestExam)
    : stats?.bestScore != null
      ? `${Math.round(stats.bestScore)}%`
      : "—"
  const weeklyStreak = stats?.weeklyStreak ?? 0

  return (
    <div className="flex flex-col gap-6">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="grain pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                <Sparkles className="size-3" />
                Готов к ЕНТ
              </span>
              {weeklyStreak > 0 && (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-orange-100 px-3 py-1 text-xs font-medium text-orange-800">
                  <Flame className="size-3" />
                  {weeklyStreak} нед. подряд
                </span>
              )}
            </div>
            <h1 className="font-serif text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              Привет{userName ? `, ${userName.split(" ")[0]}` : ""}.
            </h1>
            <p className="max-w-xl text-muted-foreground">
              Готов к новому пробному ЕНТ? Продолжим там, где остановились — каждая
              отработанная ошибка приближает к высокому баллу.
            </p>
            <div
              className={`mt-2 grid gap-2 text-sm ${
                hasPaidSubscription ? "sm:grid-cols-2" : "sm:grid-cols-3"
              }`}
            >
              <HeroLimit label="Текущий тариф" value={tariffName} />
              <HeroLimit
                label="Сегодня осталось"
                value={formatDailyRemaining(entAccess)}
              />
              {!hasPaidSubscription && (
                <HeroLimit
                  label="Доступ к ЕНТ"
                  value={formatEntAccess(entAccess, entTrial)}
                />
              )}
            </div>
          </div>
          {inProgress ? (
            <Button asChild size="lg" className="h-11 shrink-0">
              <Link href={`/exam/${inProgress.id}`}>
                Продолжить
                <ArrowRight className="size-4" />
              </Link>
            </Button>
          ) : (
            <Button asChild size="lg" className="h-11 shrink-0">
              <Link href={quickStartHref}>
                <BookOpen className="size-4" />
                Сдать пробный
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* Free trial nudge — only for new users with unused trial */}
      {hasUnusedFreeTrial && (
        <div className="flex flex-col gap-3 rounded-xl border-2 border-accent/30 bg-accent/5 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-full bg-accent/15">
              <Gift className="size-5 text-accent" />
            </div>
            <div>
              <p className="font-semibold text-foreground">
                У тебя есть бесплатный пробный ЕНТ
              </p>
              <p className="mt-0.5 text-sm text-muted-foreground">
                140 вопросов · реальный формат · разбор ошибок — без карты
              </p>
            </div>
          </div>
          <Button asChild size="sm" className="h-9 shrink-0">
            <Link href={quickStartHref}>
              <BookOpen className="size-4" />
              Начать сейчас
            </Link>
          </Button>
        </div>
      )}

      <NextActionCard
        inProgress={inProgress}
        openTotal={summary?.openTotal ?? 0}
        scoreImpact={scoreImpact}
        quickStartHref={quickStartHref}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <ScoreProjection impact={scoreImpact} />
        <AdmissionGoalCard
          currentScore={scoreImpact?.available ? scoreImpact.lastScore : null}
          potentialScore={scoreImpact?.available ? scoreImpact.potentialScore : null}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard
          icon={CheckCircle2}
          label="Пройдено пробников"
          value={stats?.completedTests ?? 0}
          loading={statsLoading}
          accent="emerald"
        />
        <StatCard
          icon={TrendingUp}
          label="Средний результат"
          value={averageResult}
          loading={statsLoading}
          accent="blue"
        />
        <StatCard
          icon={Trophy}
          label="Лучший результат"
          value={bestResult}
          loading={statsLoading}
          accent="amber"
        />
        <StatCard
          icon={Flame}
          label="Серия"
          value={`${weeklyStreak} нед.`}
          loading={statsLoading}
          accent="orange"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Последние пробники</CardTitle>
            <Link
              href="/dashboard/history"
              className="inline-flex items-center gap-1 text-sm font-medium text-foreground hover:underline"
            >
              Вся история <ArrowRight className="size-3.5" />
            </Link>
          </CardHeader>
          <CardContent>
            {sessLoading ? (
              <div className="flex items-center justify-center py-8">
                <Spinner className="size-5" />
              </div>
            ) : sessionList.length === 0 ? (
              <EmptySessions href={quickStartHref} />
            ) : (
              <ul className="flex flex-col divide-y divide-border">
                {sessionList.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={
                        s.status === "in_progress"
                          ? `/exam/${s.id}`
                          : `/exam/${s.id}/review`
                      }
                      className="flex items-center justify-between gap-4 py-3 hover:bg-secondary/40 -mx-2 px-2 rounded-md transition-colors"
                    >
                      <div className="flex min-w-0 flex-col gap-1">
                        <p className="truncate font-medium">
                          {localize(s.examType?.name, locale) || "Пробный тест"}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {s.startedAt
                            ? new Date(s.startedAt).toLocaleString("ru-RU", {
                                day: "2-digit",
                                month: "short",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {(s.rawScore != null || s.score != null) && s.maxScore != null && (
                          <span className="text-sm font-semibold tabular-nums">
                            {s.rawScore ?? s.score}/{s.maxScore}
                          </span>
                        )}
                        <SessionStatusBadge status={s.status} />
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Быстрые действия</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="h-11 justify-start">
              <Link href={quickStartHref}>
                <BookOpen className="size-4" />
                Сдать пробный
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11 justify-start">
              <Link href="/dashboard/mistakes">
                <Target className="size-4" />
                Работа над ошибками
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 justify-start">
              <Link href="/dashboard/leaderboard">
                <Trophy className="size-4" />
                Лидерборд
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 justify-start">
              <Link href="/dashboard/stats">
                <BarChart3 className="size-4" />
                Вся статистика
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11 justify-start">
              <Link href="/dashboard/history">
                <History className="size-4" />
                История
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function NextActionCard({
  inProgress,
  openTotal,
  scoreImpact,
  quickStartHref,
}: {
  inProgress?: SessionListItem
  openTotal: number
  scoreImpact?: MistakesSummary["scoreImpact"]
  quickStartHref: string
}) {
  const action = inProgress
    ? {
        title: "Продолжи пробник",
        text: "Незавершённая попытка ждёт тебя в том же месте.",
        href: `/exam/${inProgress.id}`,
        label: "Продолжить",
        icon: ListChecks,
      }
    : openTotal > 0
      ? {
          title: "Проработай ошибки",
          text: `${openTotal} открытых ошибок${
            scoreImpact?.available ? ` · потенциал +${scoreImpact.recoverable} б.` : ""
          }`,
          href: "/dashboard/mistakes",
          label: "Работа над ошибками",
          icon: Target,
        }
      : {
          title: "Сдай пробный ЕНТ",
          text: "Полная попытка обновит прогноз, цель поступления и историю результатов.",
          href: quickStartHref,
          label: "Сдать пробный",
          icon: BookOpen,
        }
  const Icon = action.icon

  return (
    <Card className="overflow-hidden rounded-xl border-violet-300 bg-violet-600 text-white">
      <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
        <div className="flex items-start gap-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-white/15 text-white">
            <Icon className="size-5" />
          </span>
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-white/75">
              Что дальше
            </p>
            <h2 className="mt-1 text-xl font-semibold tracking-tight">{action.title}</h2>
            <p className="mt-1 max-w-2xl text-sm text-white/80">{action.text}</p>
          </div>
        </div>
        <Button asChild variant="secondary" className="h-10 shrink-0">
          <Link href={action.href}>
            {action.label}
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </CardContent>
    </Card>
  )
}

function HeroLimit({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-border/70 bg-background/70 px-3 py-2 backdrop-blur">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 truncate font-semibold tabular-nums">{value}</p>
    </div>
  )
}

function formatDailyRemaining(item: AccessByExamItem | undefined): string {
  if (!item) return "—"
  if (item.daily.isUnlimited) return "Без лимита"
  if (item.daily.limit == null) return "—"
  return `${item.daily.remaining ?? 0}/${item.daily.limit}`
}

function formatEntAccess(
  access: AccessByExamItem | undefined,
  trial: { freeRemaining?: number; freeLimit?: number; remaining?: number; limit?: number } | undefined,
): string {
  if (access?.hasAccess) {
    const remaining = access.total.remaining
    if (access.total.isUnlimited || remaining == null) return "Premium"
    return `${remaining}/${access.total.limit ?? remaining}`
  }
  if (!trial) return "Нужен Premium"
  const remaining = trial.freeRemaining ?? trial.remaining ?? 0
  const limit = trial.freeLimit ?? trial.limit ?? 0
  if (limit <= 0) return "Нужен Premium"
  return `${remaining}/${limit}`
}

function EmptySessions({ href }: { href: string }) {
  return (
    <div className="flex flex-col items-center gap-3 py-8 text-center">
      <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
        <BookOpen className="size-5 text-muted-foreground" />
      </div>
      <div>
        <p className="font-medium">Пока нет пробников</p>
        <p className="text-sm text-muted-foreground">
          Откройте первый пробный и получите Premium-разбор
        </p>
      </div>
      <Button asChild>
        <Link href={href}>Сдать пробный</Link>
      </Button>
    </div>
  )
}

function normalizeSessions(data?: SessionsResponse): SessionListItem[] {
  if (!data) return []
  if (Array.isArray(data)) return data
  return Array.isArray(data.items) ? data.items : []
}
