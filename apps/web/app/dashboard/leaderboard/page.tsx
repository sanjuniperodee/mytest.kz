"use client"

import { useState } from "react"
import useSWR from "swr"
import { Crown, Medal, Sparkles, Trophy } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Badge } from "@/components/ui/badge"
import { useAuth } from "@/lib/api/auth-context"
import { resolveMediaUrl } from "@/lib/api/client"
import { localize, type Locale } from "@/lib/api/i18n"
import { cn } from "@/lib/utils"
import type { LeaderboardEntry } from "@/lib/api/types"

const LIMITS = [10, 50, 100] as const

// Normalize a leaderboard entry that may come back with very different shapes
// from different backends. We try multiple field names so the UI always shows
// real data even when the API renames things.
interface NormalizedEntry {
  rank: number
  userId: string
  name: string
  username: string | null
  avatarUrl: string | null
  score: number
  maxScore: number | null
  totalTests: number | null
  raw: LeaderboardEntry
}

function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v)
    }
  }
  return null
}

function normalizeEntry(entry: LeaderboardEntry, idx: number, locale: Locale): NormalizedEntry {
  const u = entry.user || ({} as NonNullable<LeaderboardEntry["user"]>)

  const fullName =
    localize(entry.fullName, locale) ||
    localize(u.fullName, locale) ||
    localize(entry.name, locale) ||
    localize(u.name, locale) ||
    localize(entry.displayName, locale) ||
    localize(u.displayName, locale)

  const firstName =
    localize(entry.firstName, locale) || localize(u.firstName, locale)
  const lastName =
    localize(entry.lastName, locale) || localize(u.lastName, locale)
  const composedName = [firstName, lastName].filter(Boolean).join(" ").trim()

  const username = entry.username ?? u.username ?? null
  const phone = entry.phone ?? u.phone ?? null

  // Build the best display name we can, masking phone for privacy
  const maskedPhone = phone
    ? phone.length > 6
      ? `${phone.slice(0, 4)}•••${phone.slice(-2)}`
      : phone
    : null

  const name =
    fullName ||
    composedName ||
    username ||
    maskedPhone ||
    "Аноним"

  const score =
    pickNumber(
      entry.rawScore,
      entry.bestRawScore,
      entry.totalScore,
      entry.points,
      entry.value,
      entry.bestScore,
      entry.total,
      entry.score,
    ) ?? 0
  const maxScore = pickNumber(entry.maxScore, entry.bestMaxScore)

  const totalTests = pickNumber(
    entry.totalTests,
    entry.testsCount,
    entry.attempts,
    entry.attemptsCount,
  )

  const avatarUrl =
    entry.avatarUrl || u.avatarUrl || null

  const userId =
    entry.userId ||
    u.id ||
    (entry as Record<string, unknown>).id?.toString() ||
    `entry-${idx}`

  const rank = pickNumber(entry.rank, entry.position) ?? idx + 1

  return {
    rank,
    userId: String(userId),
    name,
    username,
    avatarUrl,
    score,
    maxScore,
    totalTests,
    raw: entry,
  }
}

function formatPoints(entry: Pick<NormalizedEntry, "score" | "maxScore">): string {
  return entry.maxScore != null && entry.maxScore > 0
    ? `${entry.score}/${entry.maxScore}`
    : String(entry.score)
}

export default function LeaderboardPage() {
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const [limit, setLimit] = useState<(typeof LIMITS)[number]>(50)
  const { data, isLoading } = useSWR<
    | { items?: LeaderboardEntry[]; me?: LeaderboardEntry | null }
    | LeaderboardEntry[]
    | { data?: LeaderboardEntry[]; me?: LeaderboardEntry | null }
  >(`/leaderboard/ent?limit=${limit}`)

  const rawItems: LeaderboardEntry[] = Array.isArray(data)
    ? data
    : (data && Array.isArray((data as { items?: unknown }).items)
        ? ((data as { items: LeaderboardEntry[] }).items)
        : (data && Array.isArray((data as { data?: unknown }).data)
            ? ((data as { data: LeaderboardEntry[] }).data)
            : []))

  const items: NormalizedEntry[] = rawItems.map((e, i) => normalizeEntry(e, i, locale))
  const responseMe =
    data && !Array.isArray(data) && "me" in data && data.me
      ? normalizeEntry(data.me, rawItems.length, locale)
      : null
  const myRank = items.find((it) => it.userId === user?.id) || responseMe
  const podium = items.slice(0, 3)
  const rest = items.slice(3)

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <Sparkles className="size-3" />
          Соревнование
        </span>
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
          Лидерборд ЕНТ
        </h1>
        <p className="text-muted-foreground">
          Топ участников по набранным баллам пробного ЕНТ
        </p>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <ToggleGroup
          type="single"
          value={String(limit)}
          onValueChange={(v) => v && setLimit(Number(v) as (typeof LIMITS)[number])}
          className="border border-border rounded-md p-0.5 bg-card"
        >
          {LIMITS.map((l) => (
            <ToggleGroupItem
              key={l}
              value={String(l)}
              className="h-8 px-3 text-xs data-[state=on]:bg-foreground data-[state=on]:text-background"
            >
              Топ {l}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
        {myRank && (
          <Badge variant="outline" className="bg-secondary px-3 py-1.5">
            Ваш ранг: <span className="ml-1 font-semibold">#{myRank.rank}</span>
            <span className="ml-2 text-muted-foreground">·</span>
            <span className="ml-2 font-semibold tabular-nums">
              {formatPoints(myRank)} баллов
            </span>
          </Badge>
        )}
      </div>

      {/* Podium */}
      {!isLoading && podium.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-3">
          {[1, 0, 2].map((order) => {
            const entry = podium[order]
            if (!entry) return <div key={order} />
            return (
              <PodiumCard
                key={entry.userId}
                entry={entry}
                highlight={entry.userId === user?.id}
              />
            )
          })}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Все участники</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="flex flex-col">
              {Array.from({ length: 8 }).map((_, i) => (
                <div
                  key={i}
                  className="flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0"
                >
                  <Skeleton className="size-9 rounded-full" />
                  <Skeleton className="h-4 flex-1" />
                  <Skeleton className="h-4 w-12" />
                </div>
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center gap-3 py-12 text-center">
              <div className="flex size-12 items-center justify-center rounded-full bg-secondary">
                <Trophy className="size-5 text-muted-foreground" />
              </div>
              <div>
                <p className="font-medium">Пока нет результатов</p>
                <p className="text-sm text-muted-foreground">
                  Пройдите пробный ЕНТ, чтобы попасть в топ
                </p>
              </div>
            </div>
          ) : (
            <ul className="flex flex-col">
              {rest.map((entry) => (
                <LeaderRow
                  key={entry.userId}
                  entry={entry}
                  highlight={entry.userId === user?.id}
                />
              ))}
              {rest.length === 0 && podium.length > 0 && (
                <li className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Пока только участники топ-3
                </li>
              )}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function PodiumCard({
  entry,
  highlight,
}: {
  entry: NormalizedEntry
  highlight?: boolean
}) {
  const initials = entry.name.slice(0, 2).toUpperCase()
  const meta = (() => {
    if (entry.rank === 1)
      return {
        Icon: Crown,
        color: "text-amber-500",
        label: "1 место",
        ring: "ring-amber-200",
        bg: "bg-amber-50",
      }
    if (entry.rank === 2)
      return {
        Icon: Trophy,
        color: "text-zinc-500",
        label: "2 место",
        ring: "ring-zinc-200",
        bg: "bg-zinc-50",
      }
    return {
      Icon: Medal,
      color: "text-orange-500",
      label: "3 место",
      ring: "ring-orange-200",
      bg: "bg-orange-50",
    }
  })()
  const { Icon, color, label, ring, bg } = meta

  return (
    <Card
      className={cn(
        "overflow-hidden transition-all duration-200",
        highlight ? "border-foreground shadow-md" : "",
        entry.rank === 1 ? "sm:order-2 sm:scale-105" : entry.rank === 2 ? "sm:order-1" : "sm:order-3",
      )}
    >
      <CardContent className="flex flex-col items-center gap-3 p-5">
        <div className="flex items-center gap-2">
          <Icon className={cn("size-5", color)} />
          <span className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {label}
          </span>
        </div>
        <Avatar className={cn("size-16 ring-4 ring-offset-2 ring-offset-card", ring, bg)}>
          <AvatarImage src={resolveMediaUrl(entry.avatarUrl)} alt={initials} />
          <AvatarFallback className="font-semibold">{initials}</AvatarFallback>
        </Avatar>
        <div className="flex flex-col items-center gap-0.5 text-center">
          <p className="line-clamp-1 max-w-full text-sm font-medium">{entry.name}</p>
          <p className="text-3xl font-semibold tabular-nums">{formatPoints(entry)}</p>
          <p className="text-xs text-muted-foreground">баллов</p>
          {entry.totalTests != null && (
            <p className="text-xs text-muted-foreground">{entry.totalTests} тестов</p>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

function LeaderRow({
  entry,
  highlight,
}: {
  entry: NormalizedEntry
  highlight?: boolean
}) {
  const initials = entry.name.slice(0, 2).toUpperCase()
  return (
    <li
      className={cn(
        "flex items-center gap-3 border-t border-border px-4 py-3 first:border-t-0 transition-colors",
        highlight && "bg-secondary",
      )}
    >
      <span className="w-8 text-center text-sm font-semibold tabular-nums text-muted-foreground">
        {entry.rank}
      </span>
      <Avatar className="size-9">
        <AvatarImage src={resolveMediaUrl(entry.avatarUrl)} alt={initials} />
        <AvatarFallback>{initials}</AvatarFallback>
      </Avatar>
      <div className="flex flex-1 flex-col gap-0.5 min-w-0">
        <p className="truncate text-sm font-medium">
          {entry.name}
          {highlight && (
            <span className="ml-2 text-xs text-muted-foreground">(вы)</span>
          )}
        </p>
        {entry.totalTests != null && (
          <p className="text-xs text-muted-foreground">{entry.totalTests} тестов</p>
        )}
      </div>
      <div className="flex shrink-0 flex-col items-end">
        <span className="text-base font-semibold tabular-nums">{formatPoints(entry)}</span>
        <span className="text-xs text-muted-foreground">баллов</span>
      </div>
    </li>
  )
}
