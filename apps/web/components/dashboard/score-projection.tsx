"use client"

import Link from "next/link"
import { ArrowRight, Gauge, Sparkles, TrendingUp } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import type { EntScoreImpact } from "@/lib/api/types"

// Grant thresholds on the 0..140 ЕНТ scale, shown as markers on the bar.
const THRESHOLDS = [
  { score: 50, label: "порог" },
  { score: 70, label: "грант" },
]

export function ScoreProjection({ impact }: { impact: EntScoreImpact | undefined }) {
  if (!impact) return null

  if (!impact.available) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col gap-3 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-muted-foreground">
              <Gauge className="size-5" />
            </span>
            <div>
              <p className="font-semibold">Прогноз балла ЕНТ</p>
              <p className="text-sm text-muted-foreground">
                Пройди полный пробный ЕНТ — и здесь появится твой текущий балл и потенциал
                после работы над ошибками.
              </p>
            </div>
          </div>
          <Button asChild variant="secondary" className="shrink-0">
            <Link href="/dashboard/exams">
              Пройти пробный ЕНТ
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  const { lastScore, maxScore, potentialScore, recoverable, openCount, resolvedCount } = impact
  const pct = (v: number) => `${Math.max(0, Math.min(100, (v / maxScore) * 100))}%`

  return (
    <Card className="overflow-hidden border-emerald-200 bg-gradient-to-br from-emerald-50/70 to-background">
      <CardContent className="flex flex-col gap-5 p-5 sm:p-6">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-600 text-white">
            <Gauge className="size-4" />
          </span>
          <h2 className="text-base font-semibold">Прогноз балла ЕНТ</h2>
        </div>

        {/* Now → Potential */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Сейчас
            </p>
            <p className="text-3xl font-semibold tabular-nums sm:text-4xl">
              {lastScore}
              <span className="text-lg text-muted-foreground">/{maxScore}</span>
            </p>
            <p className="text-xs text-muted-foreground">{impact.baselineTier}</p>
          </div>

          {recoverable > 0 && (
            <div className="flex flex-col items-center pb-1.5 text-emerald-700">
              <TrendingUp className="size-5" />
              <span className="text-sm font-semibold tabular-nums">+{recoverable}</span>
            </div>
          )}

          <div className="text-right">
            <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
              Потенциал
            </p>
            <p className="text-3xl font-semibold tabular-nums text-emerald-700 sm:text-4xl">
              {potentialScore}
              <span className="text-lg text-emerald-600/70">/{maxScore}</span>
            </p>
            <p className="text-xs text-emerald-700">{impact.potentialTier}</p>
          </div>
        </div>

        {/* Bar: baseline (solid) + recoverable gain (striped) + thresholds */}
        <div className="relative h-3 w-full rounded-full bg-secondary">
          <div
            className="absolute inset-y-0 left-0 rounded-l-full bg-foreground"
            style={{ width: pct(lastScore) }}
          />
          {recoverable > 0 && (
            <div
              className="absolute inset-y-0 bg-emerald-500/60 [background-image:repeating-linear-gradient(45deg,transparent,transparent_4px,rgba(255,255,255,0.4)_4px,rgba(255,255,255,0.4)_8px)]"
              style={{ left: pct(lastScore), width: pct(potentialScore - lastScore) }}
            />
          )}
          {THRESHOLDS.filter((t) => t.score < maxScore).map((t) => (
            <div
              key={t.score}
              className="absolute -top-1 bottom-[-1.1rem] w-px bg-border"
              style={{ left: pct(t.score) }}
            >
              <span className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-muted-foreground top-[1.05rem]">
                {t.label} {t.score}
              </span>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-1 pt-2">
          <p className="text-sm text-foreground">
            {recoverable > 0 ? (
              <>
                Закрой <span className="font-semibold tabular-nums">{openCount}</span>{" "}
                {pluralOpen(openCount)} — каждая проработанная ≈ +1 балл к следующему ЕНТ.
              </>
            ) : (
              <>Открытых ошибок нет — держи планку и тренируйся на свежих пробниках.</>
            )}
          </p>
          <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            {resolvedCount > 0 && (
              <span className="inline-flex items-center gap-1 text-emerald-700">
                <Sparkles className="size-3.5" />
                уже закрыто: {resolvedCount}
              </span>
            )}
            <span>
              Прогноз обновляется сам: исправляешь промах в тренировке — он пересчитывается.
            </span>
          </p>
        </div>
      </CardContent>
    </Card>
  )
}

function pluralOpen(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return "ошибку"
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "ошибки"
  return "ошибок"
}
