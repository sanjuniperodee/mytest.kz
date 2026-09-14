import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { cn } from "@/lib/utils"
import type { SessionListItem } from "@/lib/api/types"

export type StatAccent = "default" | "emerald" | "blue" | "amber" | "orange"

const STAT_ACCENTS: Record<StatAccent, { badge: string; border: string; glow: string }> = {
  default: {
    badge: "bg-secondary text-foreground",
    border: "hover:border-foreground/30",
    glow: "from-secondary/30",
  },
  emerald: {
    badge: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300",
    border: "hover:border-emerald-500/40",
    glow: "from-emerald-500/15",
  },
  blue: {
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-950/50 dark:text-blue-300",
    border: "hover:border-blue-500/40",
    glow: "from-blue-500/15",
  },
  amber: {
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300",
    border: "hover:border-amber-500/40",
    glow: "from-amber-500/15",
  },
  orange: {
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-950/50 dark:text-orange-300",
    border: "hover:border-orange-500/40",
    glow: "from-orange-500/15",
  },
}

/** Large headline metric tile used in the dashboard KPI row. */
export function StatCard({
  icon: Icon,
  label,
  value,
  loading,
  accent = "default",
}: {
  icon: React.ElementType
  label: string
  value: string | number
  loading?: boolean
  accent?: StatAccent
}) {
  const meta = STAT_ACCENTS[accent]
  return (
    <Card className={cn(
      "relative overflow-hidden rounded-xl border border-border/80 bg-card/90 backdrop-blur-xs transition-all duration-300 hover:-translate-y-1 hover:shadow-lg shadow-xs",
      meta.border,
    )}>
      <div className={cn("pointer-events-none absolute -right-6 -top-6 size-24 rounded-full bg-gradient-to-br to-transparent opacity-60 blur-xl", meta.glow)} />
      <CardContent className="flex flex-col gap-3 p-4">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-medium text-muted-foreground">{label}</span>
          <div
            aria-hidden="true"
            className={cn(
              "flex size-8 items-center justify-center rounded-lg shadow-2xs transition-transform duration-300 group-hover:scale-105",
              meta.badge,
            )}
          >
            <Icon className="size-4" />
          </div>
        </div>
        {loading ? (
          <Skeleton className="h-8 w-16" />
        ) : (
          <span className="text-3xl font-semibold tabular-nums tracking-tight">{value}</span>
        )}
      </CardContent>
    </Card>
  )
}

/** Compact labelled value used inside cards (optionally with a leading icon). */
export function MiniMetric({
  label,
  value,
  icon: Icon,
}: {
  label: string
  value: string | number
  icon?: React.ElementType
}) {
  return (
    <div className="rounded-md border border-border bg-secondary/30 px-3 py-2">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        <span className="truncate">{label}</span>
      </div>
      <p className="mt-1 truncate text-sm font-semibold tabular-nums">{value}</p>
    </div>
  )
}

/** Labelled horizontal progress bar with an accessible meter role. */
export function ProgressLine({
  label,
  value,
  suffix = "",
}: {
  label: string
  value: number
  suffix?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <div>
      <div className="mb-1 flex items-center justify-between gap-2 text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium tabular-nums">
          {value}
          {suffix}
        </span>
      </div>
      <div
        className="h-2 overflow-hidden rounded-full bg-secondary"
        role="progressbar"
        aria-valuenow={pct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full bg-foreground" style={{ width: `${pct}%` }} />
      </div>
    </div>
  )
}

/** Centered empty/zero state used inside dashboard cards. */
export function DashboardEmpty({
  icon: Icon,
  title,
  text,
}: {
  icon: React.ElementType
  title: string
  text: string
}) {
  return (
    <div className="flex flex-col items-center gap-2 py-6 text-center">
      <div
        aria-hidden="true"
        className="flex size-10 items-center justify-center rounded-full bg-secondary"
      >
        <Icon className="size-4 text-muted-foreground" />
      </div>
      <div>
        <p className="text-sm font-medium">{title}</p>
        <p className="max-w-sm text-xs text-muted-foreground">{text}</p>
      </div>
    </div>
  )
}

const SESSION_STATUS: Record<
  SessionListItem["status"],
  { label: string; cls: string }
> = {
  in_progress: {
    label: "В процессе",
    cls: "bg-amber-100 text-amber-900 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
  },
  completed: {
    label: "Завершён",
    cls: "bg-emerald-100 text-emerald-900 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  },
  timed_out: {
    label: "Время вышло",
    cls: "bg-rose-100 text-rose-900 border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-900/50",
  },
  abandoned: {
    label: "Отменён",
    cls: "bg-muted text-muted-foreground border-border",
  },
}

/** Colour-coded badge for a test session's lifecycle status. */
export function SessionStatusBadge({ status }: { status: SessionListItem["status"] }) {
  const v = SESSION_STATUS[status] ?? SESSION_STATUS.abandoned
  return (
    <Badge variant="outline" className={v.cls}>
      {v.label}
    </Badge>
  )
}
