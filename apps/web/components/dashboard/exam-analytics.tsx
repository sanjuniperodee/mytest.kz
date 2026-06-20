"use client"

import Link from "next/link"
import dynamic from "next/dynamic"
import {
  Activity,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  Gauge,
  ListChecks,
  ShieldCheck,
  TrendingUp,
} from "lucide-react"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  DashboardEmpty,
  MiniMetric,
  ProgressLine,
} from "@/components/dashboard/data-display"
import { clampPct, formatBestPoints, formatDuration } from "@/lib/dashboard/format"
import { localize, type Locale } from "@/lib/api/i18n"
import type { AccessByExamItem, UserExamStats, UserStats } from "@/lib/api/types"

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

export function ExamAnalytics({
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
  const entStats = stats?.byExamType?.find((item) => item.examSlug === "ent")

  return (
    <>
      <EntProgressChart item={entStats} loading={loading} />
      <StatsDashboards
        stats={stats}
        loading={loading}
        locale={locale}
        accessByExam={accessByExam}
      />
    </>
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
