"use client"

import { useEffect, useRef } from "react"
import Link from "next/link"
import { ArrowRight, Check, Clock3, Crown, Hourglass, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ApiError } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { cheapestPlanPrice, usePublicMonetization } from "@/lib/api/monetization"
import type { AccessReasonCode } from "@/lib/api/types"
import { useUiI18n } from "@/lib/i18n/ui"
import { cn } from "@/lib/utils"
import { formatResetMoment, formatWait, useCountdown } from "./free-reset"

export interface AttemptDenial {
  reason: Exclude<AccessReasonCode, null>
  /** ISO-время следующей бесплатной попытки (только для DAILY_LIMIT_REACHED). */
  nextAllowedAt: string | null
}

const ACCESS_CODES = new Set(["DAILY_LIMIT_REACHED", "TOTAL_LIMIT_EXHAUSTED", "NO_ENTITLEMENT", "TRIAL_LIMIT_EXCEEDED"])

/** Отказ в попытке из ответа API (`/tests/start`) или null, если ошибка другая. */
export function parseAttemptDenial(err: unknown): AttemptDenial | null {
  if (!(err instanceof ApiError)) return null
  const code = err.code ?? err.message
  if (!ACCESS_CODES.has(code)) return null
  const body = err.body as { nextAllowedAt?: unknown } | null
  return {
    reason: code === "TRIAL_LIMIT_EXCEEDED" ? "TOTAL_LIMIT_EXHAUSTED" : (code as AttemptDenial["reason"]),
    nextAllowedAt: typeof body?.nextAllowedAt === "string" ? body.nextAllowedAt : null,
  }
}

/**
 * Окно, которое ученик видит, когда попытки закончились: честно показываем, сколько
 * ждать до следующего бесплатного ЕНТ, и рядом — вариант не ждать (подписка).
 * Без рекламы внутри: это всплывающее окно, AdSense такое запрещает.
 */
export function AttemptLimitDialog({
  denial,
  onOpenChange,
  onRetry,
  examTypeId,
}: {
  denial: AttemptDenial | null
  onOpenChange: (open: boolean) => void
  /** Попробовать снова, когда таймер дошёл до нуля. */
  onRetry?: () => void
  examTypeId?: string
}) {
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => (locale === "kk" ? kk : ru)
  const { data: config } = usePublicMonetization()
  const open = denial != null
  const isDaily = denial?.reason === "DAILY_LIMIT_REACHED" && Boolean(denial.nextAllowedAt)
  const secondsLeft = useCountdown(denial?.nextAllowedAt ?? null, open && isDaily)
  const freeAgain = isDaily && secondsLeft === 0
  const freeDaily = config?.freeTier.enabled ? config.freeTier.dailyEntAttempts : 0
  const price = cheapestPlanPrice(config)
  const loggedFor = useRef<string | null>(null)

  useEffect(() => {
    if (!denial) return
    const key = `${denial.reason}:${denial.nextAllowedAt ?? ""}`
    if (loggedFor.current === key) return
    loggedFor.current = key
    void recordFunnelEvent("premium_gate", { feature: "attempt_limit", reason: denial.reason, examTypeId })
  }, [denial, examTypeId])

  const resetAt = denial?.nextAllowedAt ? formatResetMoment(denial.nextAllowedAt, locale) : null
  const billingHref = `/dashboard/billing?reason=${isDaily ? "daily_limit" : "limit_exhausted"}`
  const perks = [
    t("Пробные ЕНТ без ожидания", "Күтпей-ақ ҰБТ сынақтары"),
    ...(config?.premiumFeatures.aiCoach !== false ? [t("AI-разбор твоих ошибок", "Қателеріңді AI-талдау")] : []),
    ...(config?.premiumFeatures.explanations !== false ? [t("Объяснения к каждому вопросу", "Әр сұраққа түсіндірме")] : []),
    ...(config?.ads.enabled && config.ads.hideForPremium ? [t("Без рекламы", "Жарнамасыз")] : []),
  ]

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="md:max-w-2xl" data-no-translate>
        <DialogHeader className="items-center text-center sm:text-center">
          <span
            className={cn(
              "mb-1 flex size-12 items-center justify-center rounded-full",
              freeAgain ? "bg-emerald-500/10 text-emerald-600" : "bg-amber-500/10 text-amber-600",
            )}
            aria-hidden
          >
            {freeAgain ? <Play className="size-5" /> : <Hourglass className="size-5" />}
          </span>
          <DialogTitle className="text-xl">
            {freeAgain
              ? t("Бесплатная попытка снова доступна", "Тегін әрекет қайта қолжетімді")
              : isDaily
                ? t("Бесплатный ЕНТ на сегодня пройден", "Бүгінгі тегін ҰБТ тапсырылды")
                : t("Попытки закончились", "Әрекеттер таусылды")}
          </DialogTitle>
          <DialogDescription className="max-w-md">
            {freeAgain
              ? t("Можно начинать новый пробный прямо сейчас.", "Жаңа сынақты қазір бастауға болады.")
              : isDaily
                ? t(
                    `Каждый день — ${freeDaily || 1} бесплатный пробный ЕНТ. Подождите до следующего или продолжайте без ожидания с подпиской.`,
                    `Күн сайын — ${freeDaily || 1} тегін ҰБТ сынағы. Келесісін күтіңіз немесе жазылыммен күтпей жалғастырыңыз.`,
                  )
                : t(
                    "Чтобы пройти пробный ЕНТ, оформите подписку.",
                    "ҰБТ сынағын тапсыру үшін жазылым рәсімдеңіз.",
                  )}
          </DialogDescription>
        </DialogHeader>

        {freeAgain ? (
          <Button
            size="lg"
            className="w-full"
            onClick={() => {
              onOpenChange(false)
              onRetry?.()
            }}
          >
            <Play className="size-4" />
            {t("Начать пробный", "Сынақты бастау")}
          </Button>
        ) : (
          <div className={cn("grid gap-3", isDaily && "sm:grid-cols-2")}>
            {isDaily && (
              <section className="flex flex-col rounded-xl border border-border bg-muted/30 p-4">
                <p className="flex items-center gap-2 text-sm font-semibold">
                  <Clock3 className="size-4 text-muted-foreground" />
                  {t("Подождать", "Күту")}
                </p>
                <p
                  className="mt-3 text-3xl font-semibold tabular-nums tracking-tight"
                  role="timer"
                  aria-live="off"
                  aria-label={t("До следующей бесплатной попытки", "Келесі тегін әрекетке дейін")}
                >
                  {secondsLeft != null ? formatWait(secondsLeft, locale) : "—"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {resetAt
                    ? t(`Откроется ${resetAt}`, `Ашылады: ${resetAt}`)
                    : t("Откроется завтра", "Ертең ашылады")}
                </p>
                <div className="mt-auto pt-4">
                  <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
                    {t("Вернусь позже", "Кейін ораламын")}
                  </Button>
                </div>
              </section>
            )}
            <section className="relative flex flex-col rounded-xl border border-primary/40 bg-primary/5 p-4 shadow-sm">
              <p className="flex items-center gap-2 text-sm font-semibold">
                <Crown className="size-4 text-primary" />
                {t("Не ждать — Premium", "Күтпеу — Premium")}
              </p>
              <ul className="mt-3 flex flex-col gap-1.5 text-sm">
                {perks.map((perk) => (
                  <li key={perk} className="flex items-start gap-2">
                    <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                    {perk}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-4">
                <Button asChild className="w-full">
                  <Link
                    href={billingHref}
                    onClick={() =>
                      void recordFunnelEvent("billing_opened", { source: "attempt_limit", reason: denial?.reason })
                    }
                  >
                    {price != null
                      ? t(`Оформить от ${price.toLocaleString("ru-RU")} ₸`, `${price.toLocaleString("ru-RU")} ₸-ден бастап рәсімдеу`)
                      : t("Выбрать тариф", "Тариф таңдау")}
                    <ArrowRight className="size-4" />
                  </Link>
                </Button>
              </div>
            </section>
          </div>
        )}
      </DialogContent>
    </Dialog>
  )
}
