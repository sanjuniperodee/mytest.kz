import type { UserExamStats } from "@/lib/api/types"

/** Clamp any numeric value into the 0–100 percentage range, rounding to an int. */
export function clampPct(value: number | null | undefined): number {
  if (value == null || !Number.isFinite(value)) return 0
  return Math.max(0, Math.min(100, Math.round(value)))
}

/**
 * Best score for an exam, preferring the raw "points/max" form and falling
 * back to a rounded percentage, then to an em dash.
 */
export function formatBestPoints(item: UserExamStats): string {
  if (item.bestRawScore != null && item.bestMaxScore != null) {
    return `${item.bestRawScore}/${item.bestMaxScore}`
  }
  if (item.bestScore != null) return `${Math.round(item.bestScore)}%`
  return "—"
}

/** Human-friendly duration in whole minutes, or an em dash when unknown. */
export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || seconds <= 0) return "—"
  const minutes = Math.round(seconds / 60)
  return `${minutes} мин`
}
