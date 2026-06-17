"use client"

import { Clock } from "lucide-react"
import { cn } from "@/lib/utils"

export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  }
  return `${m}:${String(sec).padStart(2, "0")}`
}

import { useEffect, useState } from "react"

export function ExamTimer({
  timerEndMs,
  timerEpoch = 0,
  onZero,
  className,
}: {
  timerEndMs: number | null
  timerEpoch?: number
  onZero?: () => void
  className?: string
}) {
  const [remaining, setRemaining] = useState<number | null>(null)

  useEffect(() => {
    if (timerEndMs == null) {
      setRemaining(null)
      return
    }

    const tick = () => {
      const next = Math.max(0, Math.ceil((timerEndMs - Date.now()) / 1000))
      setRemaining((prev) => {
        if (prev !== next) {
          if (next <= 0 && prev !== 0 && prev != null) {
            onZero?.()
          }
          return next
        }
        return prev
      })
    }
    tick()
    const id = setInterval(tick, 250)

    const onVis = () => {
      if (document.visibilityState === "visible") tick()
    }
    document.addEventListener("visibilitychange", onVis)
    const onPageShow = () => tick()
    window.addEventListener("pageshow", onPageShow)

    return () => {
      clearInterval(id)
      document.removeEventListener("visibilitychange", onVis)
      window.removeEventListener("pageshow", onPageShow)
    }
  }, [timerEndMs, timerEpoch, onZero])

  if (remaining == null) return null
  const secs = Number(remaining)
  if (!Number.isFinite(secs)) return null
  const isCritical = secs <= 60
  const isWarning = secs <= 300 && !isCritical
  return (
    <div
      data-no-translate
      className={cn(
        "inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-sm font-semibold tabular-nums transition-colors",
        isCritical
          ? "border-rose-300 bg-rose-50 text-rose-900"
          : isWarning
            ? "border-amber-300 bg-amber-50 text-amber-900"
            : "border-border bg-secondary text-foreground",
        className,
      )}
    >
      <Clock className="size-3.5" />
      <span>{formatHMS(secs)}</span>
    </div>
  )
}
