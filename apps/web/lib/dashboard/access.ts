import type { AccessByExamItem, TrialStatusItem } from "@/lib/api/types"

export type AccessTone = "ok" | "limit" | "locked"

export interface AccessStatus {
  /** Short label suitable for a badge. */
  label: string
  tone: AccessTone
}

/**
 * Maps an exam's access state into a badge-friendly {label, tone}.
 * `trial` (when provided) lets us show remaining free attempts for locked exams.
 */
export function examAccessStatus(
  access: AccessByExamItem | undefined,
  trial?: TrialStatusItem,
): AccessStatus {
  if (access?.hasAccess) {
    if (access.daily.isUnlimited || access.daily.limit == null) {
      return { label: "Доступ открыт", tone: "ok" }
    }
    const remaining = access.daily.remaining ?? 0
    return {
      label: `Сегодня ${remaining}/${access.daily.limit}`,
      tone: remaining > 0 ? "ok" : "limit",
    }
  }

  if (access?.reasonCode === "DAILY_LIMIT_REACHED") {
    return { label: "Дневной лимит", tone: "limit" }
  }

  const freeRemaining = trial?.freeRemaining ?? trial?.remaining
  const freeLimit = trial?.freeLimit ?? trial?.limit
  if (freeRemaining != null && freeLimit && freeLimit > 0 && freeRemaining > 0) {
    return { label: `Пробных ${freeRemaining}/${freeLimit}`, tone: "ok" }
  }

  return { label: "Нужен Premium", tone: "locked" }
}

/** Tailwind classes for an access badge by tone. */
export const ACCESS_TONE_CLASSES: Record<AccessTone, string> = {
  ok: "border-emerald-200 bg-emerald-50 text-emerald-700",
  limit: "border-amber-200 bg-amber-50 text-amber-800",
  locked: "border-border bg-secondary text-muted-foreground",
}
