"use client"

import { Users } from "lucide-react"
import { useLandingProof } from "@/lib/api/landing"
import { ConversionLink } from "./conversion-link"

export function LiveActivityStrip() {
  const { data } = useLandingProof()
  const value = data?.completedTrials30d

  return (
    <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/50 p-5 sm:flex-row sm:p-6">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
          <Users className="h-5 w-5" />
        </span>
        <div className="leading-tight">
          <div className="text-sm font-semibold">
            {value === undefined
              ? "Считаем активность платформы…"
              : value > 0
                ? `${value.toLocaleString("ru-RU")} пробных завершено за 30 дней`
                : "Первый пробный доступен сразу после регистрации"}
          </div>
          <div className="text-xs text-muted-foreground">
            Данные обновляются из реальных завершённых попыток
          </div>
        </div>
      </div>
      <ConversionLink
        href="/login?source=activity"
        placement="activity_strip"
        className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
      >
        Присоединиться
      </ConversionLink>
    </div>
  )
}
