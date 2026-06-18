"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import useSWR from "swr"
import {
  Activity,
  ArrowRight,
  BarChart3,
  BookOpen,
  CheckCircle2,
  Clock3,
  Gauge,
  Gift,
  ListChecks,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingUp,
  Trophy,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import {
  DashboardEmpty,
  MiniMetric,
  ProgressLine,
  SessionStatusBadge,
  StatCard,
} from "@/components/dashboard/data-display"
import { clampPct, formatBestPoints, formatDuration } from "@/lib/dashboard/format"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { AccessByExamItem, ExamType, SessionListItem, UserExamStats, UserStats } from "@/lib/api/types"

const EntProgressLineChart = dynamic(
  () =>
    import("@/components/dashboard/ent-progress-line-chart").then(
      (mod) => mod.EntProgressLineChart,
    ),
  {
    ssr: false,
    loading: () => <Skeleton className="h-64 w-full rounded-lg" />,
  },
)

export default function DashboardHomePage() {
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const userName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    user?.telegramUsername ||
    user?.username ||
    ""
  const { data: stats, isLoading: statsLoading } = useSWR<UserStats>("/users/me/stats")
  const { data: sessions, isLoading: sessLoading } = useSWR<{ items: SessionListItem[] }>(
    "/tests/sessions?page=1&limit=5",
  )
  const { data: examTypes } = useSWR<ExamType[]>("/exams/types")

  const items = (sessions as { items?: SessionListItem[] } | SessionListItem[] | undefined)
  const sessionList: SessionListItem[] = Array.isArray(items)
    ? items
    : items && Array.isArray(items.items)
      ? items.items
      : []

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
  const entStats = stats?.byExamType?.find((item) => item.examSlug === "ent")
  const averageResult = stats ? `${Math.round(stats.averageScore)}%` : "—"
  const bestResult = bestExam ? formatBestPoints(bestExam) : stats?.bestScore ?? "—"

  return (
    <div className="flex flex-col gap-6">
      {/* Hero greeting */}
      <div className="relative overflow-hidden rounded-xl border border-border bg-card p-6 sm:p-8">
        <div className="grain pointer-events-none absolute inset-0 opacity-60" />
        <div className="relative flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <Sparkles className="size-3" />
              Готов к ЕНТ
            </span>
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
          icon={Clock3}
          label="В процессе"
          value={stats?.inProgressSessionsCount ?? 0}
          loading={statsLoading}
          accent="orange"
        />
      </div>

      <EntProgressChart item={entStats} loading={statsLoading} />

      <StatsDashboards
        stats={stats}
        loading={statsLoading}
        locale={locale}
        accessByExam={user?.accessByExam ?? []}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between gap-4">
            <CardTitle>Последние пробники</CardTitle>
            <Link
              href={quickStartHref}
              className="text-sm font-medium text-foreground hover:underline inline-flex items-center gap-1"
            >
              Сдать пробный <ArrowRight className="size-3.5" />
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
                      <div className="flex flex-col gap-1 min-w-0">
                        <p className="font-medium truncate">
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
            <CardTitle>Старт за минуту</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <Button asChild className="h-11">
              <Link href={quickStartHref}>
                <BookOpen className="size-4" />
                Сдать пробный
              </Link>
            </Button>
            <Button asChild variant="outline" className="h-11">
              <Link href="/dashboard/mistakes">
                <Target className="size-4" />
                Работа над ошибками
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11">
              <Link href="/dashboard/leaderboard">
                <Trophy className="size-4" />
                Лидерборд ЕНТ
              </Link>
            </Button>
            <Button asChild variant="ghost" className="h-11">
              <Link href="/dashboard/stats">
                <TrendingUp className="size-4" />
                Мой прогресс
              </Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function EntProgressChart({
  item,
  loading,
}: {
  item?: UserExamStats
  loading: boolean
}) {
  const scores = item?.recentScores ?? []
  const chartData = scores.map((score, index) => ({
    attempt: index + 1,
    score: clampPct(score),
  }))
  const latest = scores.length > 0 ? clampPct(scores[scores.length - 1]) : null
  const first = scores.length > 0 ? clampPct(scores[0]) : null
  const delta = latest != null && first != null ? latest - first : null

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <TrendingUp className="size-4" />
          Прогресс ЕНТ
        </CardTitle>
        <Badge variant="secondary">последние {scores.length}</Badge>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-64 w-full rounded-lg" />
        ) : scores.length === 0 ? (
          <DashboardEmpty
            icon={TrendingUp}
            title="График появится после ЕНТ"
            text="Завершите хотя бы один полный пробный ЕНТ, чтобы увидеть динамику баллов."
          />
        ) : (
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
            <EntProgressLineChart data={chartData} />
            <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
              <MiniMetric label="Последний" value={latest != null ? `${latest}%` : "—"} />
              <MiniMetric label="Лучший балл" value={item ? formatBestPoints(item) : "—"} />
              <MiniMetric
                label="Динамика"
                value={delta == null ? "—" : `${delta >= 0 ? "+" : ""}${delta}%`}
              />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function StatsDashboards({
  stats,
  loading,
  locale,
  accessByExam,
}: {
  stats?: UserStats
  loading: boolean
  locale: Locale
  accessByExam: AccessByExamItem[]
}) {
  const byExam = [...(stats?.byExamType ?? [])].sort(
    (a, b) =>
      (b.testsCount + (b.inProgressCount ?? 0)) -
      (a.testsCount + (a.inProgressCount ?? 0)),
  )
  const totalStarted = (stats?.completedTests ?? 0) + (stats?.inProgressSessionsCount ?? 0)
  const completionPct = totalStarted
    ? Math.round(((stats?.completedTests ?? 0) / totalStarted) * 100)
    : 0

  return (
    <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(320px,0.8fr)]">
      <ExamStatsPanel items={byExam} loading={loading} locale={locale} />
      <div className="grid gap-6">
        <ActivityPanel
          stats={stats}
          loading={loading}
          totalStarted={totalStarted}
          completionPct={completionPct}
        />
        <TrendPanel items={byExam} loading={loading} locale={locale} />
        <AccessPanel items={accessByExam} loading={false} />
      </div>
    </div>
  )
}

function ExamStatsPanel({
  items,
  loading,
  locale,
}: {
  items: UserExamStats[]
  loading: boolean
  locale: Locale
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-4">
        <CardTitle className="flex items-center gap-2 text-base">
          <BarChart3 className="size-4" />
          Статистика по экзаменам
        </CardTitle>
        <Button asChild variant="ghost" size="sm">
          <Link href="/dashboard/exams">
            Каталог
            <ArrowRight className="size-3.5" />
          </Link>
        </Button>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-lg" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <DashboardEmpty
            icon={BarChart3}
            title="Данных пока нет"
            text="После первого завершённого пробника здесь появится разбивка по экзаменам."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {items.map((item) => {
              const name = localize(item.examType?.name, locale, item.examSlug || "Экзамен")
              const avg = clampPct(item.averageScore)
              const correct = clampPct(item.averageCorrectPercent)
              const attempts = item.testsCount + (item.inProgressCount ?? 0)
              return (
                <li key={item.examTypeId} className="py-4 first:pt-0 last:pb-0">
                  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_220px]">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="truncate font-medium">{name}</p>
                        {item.examSlug && (
                          <Badge variant="secondary" className="font-mono uppercase">
                            {item.examSlug}
                          </Badge>
                        )}
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                        <MiniMetric label="Попыток" value={attempts} />
                        <MiniMetric label="Завершено" value={item.completedCount ?? item.testsCount} />
                        <MiniMetric label="Лучшие баллы" value={formatBestPoints(item)} />
                        <MiniMetric label="Среднее время" value={formatDuration(item.averageDurationSecs)} />
                      </div>
                    </div>
                    <div className="flex flex-col justify-center gap-3">
                      <ProgressLine label="Средний результат" value={avg} suffix="%" />
                      <ProgressLine label="Точность" value={correct} suffix="%" />
                    </div>
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}

function ActivityPanel({
  stats,
  loading,
  totalStarted,
  completionPct,
}: {
  stats?: UserStats
  loading: boolean
  totalStarted: number
  completionPct: number
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Activity className="size-4" />
          Активность
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            <Skeleton className="h-8 w-28" />
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            <div>
              <div className="flex items-baseline justify-between gap-3">
                <span className="text-sm text-muted-foreground">Завершение пробников</span>
                <span className="text-2xl font-semibold tabular-nums">{completionPct}%</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-foreground" style={{ width: `${completionPct}%` }} />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <MiniMetric label="Начато" value={totalStarted} icon={ListChecks} />
              <MiniMetric label="Закончено" value={stats?.completedTests ?? 0} icon={CheckCircle2} />
              <MiniMetric label="В процессе" value={stats?.inProgressSessionsCount ?? 0} icon={Clock3} />
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function TrendPanel({
  items,
  loading,
  locale,
}: {
  items: UserExamStats[]
  loading: boolean
  locale: Locale
}) {
  const withScores = items.filter((item) => (item.recentScores?.length ?? 0) > 0).slice(0, 3)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="size-4" />
          Динамика результатов
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 2 }).map((_, i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : withScores.length === 0 ? (
          <DashboardEmpty
            icon={Gauge}
            title="Динамика появится позже"
            text="Нужно хотя бы несколько завершённых тестов с оценкой."
          />
        ) : (
          <div className="flex flex-col gap-4">
            {withScores.map((item) => (
              <div key={item.examTypeId} className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-medium">
                    {localize(item.examType?.name, locale, item.examSlug || "Экзамен")}
                  </p>
                  <span className="text-xs text-muted-foreground">
                    {item.recentScores?.at(-1) ?? 0}%
                  </span>
                </div>
                <div
                  className="flex h-16 items-end gap-1 rounded-md border border-border bg-secondary/40 px-2 py-2"
                  aria-label="Последние результаты"
                >
                  {(item.recentScores ?? []).map((score, idx) => {
                    const height = Math.max(8, clampPct(score))
                    return (
                      <span
                        key={`${item.examTypeId}-${idx}`}
                        className="flex-1 rounded-sm bg-foreground/80"
                        style={{ height: `${height}%` }}
                        title={`${score}%`}
                      />
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function AccessPanel({
  items,
  loading,
}: {
  items: AccessByExamItem[]
  loading: boolean
}) {
  const visible = items.slice(0, 4)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldCheck className="size-4" />
          Доступ
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-20 w-full" />
        ) : visible.length === 0 ? (
          <DashboardEmpty
            icon={ShieldCheck}
            title="Лимиты не загружены"
            text="Доступ подтянется после обновления профиля."
          />
        ) : (
          <ul className="flex flex-col divide-y divide-border">
            {visible.map((item) => (
              <li key={item.examTypeId} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium uppercase">{item.examSlug || "exam"}</p>
                  <p className="text-xs text-muted-foreground">{formatAccessLine(item)}</p>
                </div>
                <Badge variant={item.hasAccess ? "default" : "outline"}>
                  {item.hasAccess ? "Доступ есть" : accessReasonLabel(item.reasonCode)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
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

function accessReasonLabel(reason: AccessByExamItem["reasonCode"]): string {
  if (reason === "DAILY_LIMIT_REACHED") return "Лимит дня"
  if (reason === "TOTAL_LIMIT_EXHAUSTED") return "Лимит исчерпан"
  if (reason === "NO_ENTITLEMENT") return "Нет доступа"
  return "Нет доступа"
}

function formatAccessLine(item: AccessByExamItem): string {
  if (item.daily.isUnlimited) return "Без дневного лимита"
  if (item.daily.limit == null) return "Дневной лимит не задан"
  return `Сегодня: ${item.daily.remaining ?? 0}/${item.daily.limit}`
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
