"use client"

import Link from "next/link"
import { Gift, Hourglass } from "lucide-react"
import type { AccessByExamItem } from "@/lib/api/types"
import { useUiI18n } from "@/lib/i18n/ui"
import { formatResetMoment, formatWait, useCountdown } from "./free-reset"

/** Подпись под кнопкой старта: сколько бесплатных ЕНТ осталось сегодня или когда откроется следующий. */
export function AttemptAccessNote({ access }: { access: AccessByExamItem | undefined }) {
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => (locale === "kk" ? kk : ru)
  const free = access?.free ?? null
  const paidAvailable = Boolean(access && (access.total.isUnlimited || (access.total.remaining ?? 0) > 0))
  const waiting = Boolean(free && free.remainingToday === 0 && !paidAvailable)
  const secondsLeft = useCountdown(free?.nextResetAt ?? null, waiting)

  if (!free || paidAvailable) return null

  if (!waiting) {
    return (
      <p className="text-sm text-muted-foreground" data-no-translate>
        <Gift className="mr-1.5 inline size-4 align-[-3px] text-emerald-600" aria-hidden />
        {t(
          `Сегодня бесплатно: ${free.remainingToday} из ${free.dailyLimit} пробных ЕНТ`,
          `Бүгін тегін: ${free.dailyLimit} ҰБТ сынағының ${free.remainingToday}`,
        )}
      </p>
    )
  }

  const moment = free.nextResetAt ? formatResetMoment(free.nextResetAt, locale) : null
  const wait = secondsLeft != null ? formatWait(secondsLeft, locale) : null

  return (
    <p className="text-sm leading-relaxed text-muted-foreground" data-no-translate>
      <Hourglass className="mr-1.5 inline size-4 align-[-3px] text-amber-600" aria-hidden />
      {t("Бесплатный ЕНТ на сегодня использован. Следующий —", "Бүгінгі тегін ҰБТ пайдаланылды. Келесісі —")}{" "}
      <span className="font-medium text-foreground">{moment ?? t("завтра", "ертең")}</span>
      {wait && (
        <span className="tabular-nums">
          {t(`, через ${wait}`, ` (${wait} қалды)`)}
        </span>
      )}
      .{" "}
      <Link
        href="/dashboard/billing?reason=daily_limit"
        className="font-medium text-foreground underline underline-offset-4 hover:text-primary"
      >
        {t("Без ожидания — Premium", "Күтпей — Premium")}
      </Link>
    </p>
  )
}
