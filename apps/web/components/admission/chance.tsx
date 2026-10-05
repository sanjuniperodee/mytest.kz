"use client"

import { ArrowDownRight, ArrowRight, ArrowUpRight } from "lucide-react"
import type { AdmissionChanceLevel } from "@bilimland/shared"
import { cn } from "@/lib/utils"
import { useUiI18n } from "@/lib/i18n/ui"

/** Russian / Kazakh picker bound to the current UI locale. */
export function useT() {
  const { locale } = useUiI18n()
  return (ru: string, kk: string) => (locale === "kk" ? kk : ru)
}

/** Russian plural: 1 грант, 2 гранта, 5 грантов. */
export function ruPlural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

export function grantsLabel(n: number, t: (ru: string, kk: string) => string) {
  return t(`${n} ${ruPlural(n, "грант", "гранта", "грантов")}`, `${n} грант`)
}

const CHANCE_STYLE: Record<AdmissionChanceLevel, string> = {
  HIGH: "bg-emerald-100 text-emerald-900 dark:bg-emerald-950/50 dark:text-emerald-200",
  MEDIUM: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  LOW: "bg-orange-100 text-orange-900 dark:bg-orange-950/50 dark:text-orange-200",
  NONE: "bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-200",
}

export function chanceLabel(
  level: AdmissionChanceLevel,
  t: (ru: string, kk: string) => string,
  passesEntThresholds = true,
) {
  if (!passesEntThresholds) return t("Не пройден порог ЕНТ", "ҰБТ шегінен өтпеді")
  switch (level) {
    case "HIGH":
      return t("Высокий шанс", "Мүмкіндік жоғары")
    case "MEDIUM":
      return t("На грани", "Шекарада")
    case "LOW":
      return t("Немного не хватает", "Сәл жетпейді")
    default:
      return t("Пока не хватает", "Әзірге жетпейді")
  }
}

export function ChanceBadge({
  level,
  passesEntThresholds = true,
  className,
}: {
  level: AdmissionChanceLevel
  passesEntThresholds?: boolean
  className?: string
}) {
  const t = useT()
  return (
    <span
      data-no-translate
      className={cn(
        "inline-flex shrink-0 items-center whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-semibold",
        CHANCE_STYLE[passesEntThresholds ? level : "NONE"],
        className,
      )}
    >
      {chanceLabel(level, t, passesEntThresholds)}
    </span>
  )
}

/** "2025: 98 → 100" with a coloured arrow; renders nothing without a previous year. */
export function CutoffTrend({
  current,
  previous,
  previousYear,
}: {
  current: number
  previous: number | null | undefined
  previousYear: number | null | undefined
}) {
  if (previous == null) return null
  const diff = current - previous
  const Icon = diff > 0 ? ArrowUpRight : diff < 0 ? ArrowDownRight : ArrowRight
  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 tabular-nums",
        diff > 0 ? "text-rose-700 dark:text-rose-300" : diff < 0 ? "text-emerald-700 dark:text-emerald-300" : "",
      )}
      title={previousYear ? `${previousYear}: ${previous}` : undefined}
      data-no-translate
    >
      <Icon className="size-3" aria-hidden="true" />
      {previousYear ? `${previousYear}: ${previous}` : previous}
      {diff !== 0 && ` (${diff > 0 ? "+" : ""}${diff})`}
    </span>
  )
}

/** Short legend explaining the chance levels. */
export function ChanceLegend() {
  const t = useT()
  return (
    <ul className="grid gap-1.5 text-xs text-muted-foreground sm:grid-cols-2" data-no-translate>
      <li className="flex items-start gap-2">
        <ChanceBadge level="HIGH" />
        {t("балл не ниже среднего у получивших грант", "балл грант алғандардың орташасынан төмен емес")}
      </li>
      <li className="flex items-start gap-2">
        <ChanceBadge level="MEDIUM" />
        {t("выше проходного, но ниже среднего", "өту балынан жоғары, орташадан төмен")}
      </li>
      <li className="flex items-start gap-2">
        <ChanceBadge level="LOW" />
        {t("до 5 баллов ниже проходного", "өту балынан 5 балға дейін төмен")}
      </li>
      <li className="flex items-start gap-2">
        <ChanceBadge level="NONE" />
        {t("ниже проходного больше чем на 5 баллов", "өту балынан 5 балдан артық төмен")}
      </li>
    </ul>
  )
}
