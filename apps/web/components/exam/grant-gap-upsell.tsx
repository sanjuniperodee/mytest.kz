"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, Check, GraduationCap, Target, TrendingDown } from "lucide-react"
import { SEASON_PLAN_CODE, type BillingPlanDto } from "@bilimland/shared"
import { Button } from "@/components/ui/button"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { usePremiumAccess } from "@/lib/api/monetization"
import { getFormatLocale } from "@/lib/i18n/locale"
import { ruPlural, useT } from "@/components/admission/chance"
import type { AdmissionGoalResponse } from "@/lib/api/types"

/** Порог допуска ЕНТ и ориентиры для гранта, если цель ещё не выбрана. */
const ENT_THRESHOLD = 50
const REGIONAL_GRANT_FROM = 70
const TOP_GRANT_FROM = 110

type WeakSection = { title: string; lost: number }

/**
 * Главный момент продажи: человек только что увидел свой балл. Показываем,
 * сколько не хватает до гранта (по сохранённой цели или ориентирам), где именно
 * потеряны баллы и что откроет тариф — с ценой прямо на кнопке.
 */
export function GrantGapUpsell({
  sessionId,
  score,
  maxScore,
  isEstimate = false,
  weakSections,
  mistakeCount,
}: {
  sessionId: string
  /** Балл ЕНТ; при isEstimate — оценка из 140 по экспресс-тесту. */
  score: number
  maxScore: number
  /** Экспресс-ЕНТ: балл примерный — показываем его со знаком «≈». */
  isEstimate?: boolean
  weakSections: WeakSection[]
  mistakeCount: number
}) {
  const t = useT()
  const { isPremium, config } = usePremiumAccess()
  const { data: goalData } = useSWR<AdmissionGoalResponse>(isPremium ? null : "/admission/goal")

  if (isPremium || mistakeCount === 0) return null

  const goal = goalData?.goal ?? null
  const required = goal?.requiredScore ?? null
  const plans = config?.plans ?? []
  const shortPlan = pickShortPlan(plans)
  const seasonPlan = plans.find((plan) => plan.id === SEASON_PLAN_CODE) ?? null
  const lostTop = weakSections.filter((section) => section.lost > 0).slice(0, 3)
  const lostTotal = Math.max(0, maxScore - score)
  const approx = isEstimate ? "≈ " : ""

  const billingHref = (planId: string) =>
    `/dashboard/billing?${new URLSearchParams({ reason: "review_recovery", plan: planId, sessionId }).toString()}`
  const track = (planId: string) =>
    void recordFunnelEvent("premium_gate", { feature: "result_upsell", planCode: planId, hasGoal: Boolean(goal) }, sessionId)

  return (
    <section
      className="overflow-hidden rounded-xl border border-accent/30 bg-accent/5"
      data-testid="grant-gap-upsell"
      data-no-translate
    >
      <div className="grid gap-5 p-5 sm:p-6 md:grid-cols-[minmax(0,1.1fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-4">
          <GapHeadline goal={goal} required={required} score={score} approx={approx} t={t} />

          {lostTop.length > 0 && (
            <div className="rounded-lg border border-border bg-background/80 p-4">
              <p className="flex items-center gap-2 text-sm font-medium">
                <TrendingDown className="size-4 text-rose-600" />
                {t("Где ты потерял баллы", "Балды қай жерде жоғалттың")}
              </p>
              <ul className="mt-3 space-y-2 text-sm">
                {lostTop.map((section) => (
                  <li key={section.title} className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate">{section.title}</span>
                    <span className="shrink-0 font-semibold tabular-nums text-rose-700 dark:text-rose-400">
                      −{section.lost}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-muted-foreground">
                {t(
                  `Всего ${approx}${lostTotal} ${ruPlural(lostTotal, "балл", "балла", "баллов")} из ${maxScore} ушло на ${mistakeCount} ${ruPlural(mistakeCount, "ошибку", "ошибки", "ошибок")}.`,
                  `Барлығы ${maxScore}-ден ${approx}${lostTotal} балл ${mistakeCount} қатеге кетті.`,
                )}
              </p>
            </div>
          )}
        </div>

        <div className="flex min-w-0 flex-col gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <p className="text-base font-semibold tracking-tight">
            {t("Разбери эти ошибки — и не повтори их на ЕНТ", "Осы қателерді талдап, ҰБТ-да қайталама")}
          </p>
          <ul className="space-y-2 text-sm">
            {[
              t(`Объяснение к каждой из ${mistakeCount} ошибок — 3 можно открыть бесплатно уже сейчас`, `${mistakeCount} қатенің әрқайсысына түсіндірме — 3-еуін қазір тегін ашуға болады`),
              t("Тренировка именно тех тем, где ушли баллы", "Балл кеткен тақырыптар бойынша жаттығу"),
              t("Повтор этого ЕНТ, чтобы увидеть рост", "Өсуді көру үшін осы ҰБТ-ны қайта тапсыру"),
              t("AI-план: что подтянуть до следующего пробного", "AI-жоспар: келесі сынаққа дейін не түзету керек"),
            ].map((item) => (
              <li key={item} className="flex items-start gap-2">
                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                <span>{item}</span>
              </li>
            ))}
          </ul>

          <div className="mt-auto flex flex-col gap-2">
            {shortPlan ? (
              <Button asChild className="h-auto min-h-11 w-full whitespace-normal py-3">
                <Link href={billingHref(shortPlan.id)} onClick={() => track(shortPlan.id)}>
                  {t(
                    `Разобрать ошибки — ${formatKzt(shortPlan.priceKzt)} за ${durationLabelRu(shortPlan.durationDays)}`,
                    `Қателерді талдау — ${formatKzt(shortPlan.priceKzt)}, ${shortPlan.durationDays} күн`,
                  )}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            ) : (
              <Button asChild className="h-auto min-h-11 w-full whitespace-normal py-3">
                <Link href={`/dashboard/billing?reason=review_recovery&sessionId=${encodeURIComponent(sessionId)}`}>
                  {t("Открыть разбор ошибок", "Қателер талдауын ашу")}
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            )}
            {seasonPlan && seasonPlan.id !== shortPlan?.id && (
              <Button asChild variant="outline" className="h-auto min-h-11 w-full whitespace-normal py-3">
                <Link href={billingHref(seasonPlan.id)} onClick={() => track(seasonPlan.id)}>
                  {t(
                    `${seasonPlan.name} — ${formatKzt(seasonPlan.priceKzt)}${perMonthRu(seasonPlan)}`,
                    `${seasonPlan.name} — ${formatKzt(seasonPlan.priceKzt)}`,
                  )}
                </Link>
              </Button>
            )}
            <p className="text-center text-xs text-muted-foreground">
              {t("Kaspi или карта · без автопродления", "Kaspi немесе карта · автоұзартусыз")}
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}

function GapHeadline({
  goal,
  required,
  score,
  approx,
  t,
}: {
  goal: AdmissionGoalResponse["goal"]
  required: number | null
  score: number
  /** «≈ » для оценки по экспресс-тесту, иначе пусто. */
  approx: string
  t: (ru: string, kk: string) => string
}) {
  if (goal && required != null) {
    const gap = required - score
    const target = `${goal.programName} · ${goal.universityShortName || goal.universityName}`
    return (
      <div className="flex flex-col gap-2">
        <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">
          <Target className="size-4" />
          {t("Твоя цель", "Сенің мақсатың")}
        </p>
        <h2 className="text-2xl font-semibold tracking-tight">
          {gap > 0
            ? t(
                `До гранта не хватает ${gap} ${ruPlural(gap, "балла", "баллов", "баллов")}`,
                `Грантқа ${gap} балл жетпейді`,
              )
            : t(
                `Ты проходишь на грант с запасом ${-gap}`,
                `Сен грантқа ${-gap} балл артығымен өтесің`,
              )}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t(
            `${target}: проходной ${required}, у тебя ${approx}${score}.`,
            `${target}: өту балы ${required}, сенде ${approx}${score}.`,
          )}{" "}
          {gap > 0
            ? t("Эти баллы прячутся в ошибках ниже.", "Бұл балдар төмендегі қателерде жатыр.")
            : t("Главное — не терять лёгкие баллы.", "Бастысы — оңай балдарды жоғалтпау.")}
        </p>
      </div>
    )
  }

  const toThreshold = ENT_THRESHOLD - score
  return (
    <div className="flex flex-col gap-2">
      <p className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-accent">
        <GraduationCap className="size-4" />
        {t("Твой балл и грант", "Сенің балың және грант")}
      </p>
      <h2 className="text-2xl font-semibold tracking-tight">
        {toThreshold > 0
          ? t(
              `До порога ${ENT_THRESHOLD} не хватает ${toThreshold} ${ruPlural(toThreshold, "балла", "баллов", "баллов")}`,
              `${ENT_THRESHOLD} шекті балға ${toThreshold} балл жетпейді`,
            )
          : score < REGIONAL_GRANT_FROM
            ? t(
                `До грантов в региональных вузах — ещё ${REGIONAL_GRANT_FROM - score}`,
                `Өңірлік ЖОО гранттарына дейін тағы ${REGIONAL_GRANT_FROM - score} балл`,
              )
            : score < TOP_GRANT_FROM
              ? t(
                  `До грантов топ-вузов — ещё ${TOP_GRANT_FROM - score}`,
                  `Үздік ЖОО гранттарына дейін тағы ${TOP_GRANT_FROM - score} балл`,
                )
              : t("Ты в зоне грантов топ-вузов", "Сен үздік ЖОО гранттары аймағындасың")}
      </h2>
      <p className="text-sm text-muted-foreground">
        {t(
          `Порог допуска — ${ENT_THRESHOLD}, грант в регионах — от ~${REGIONAL_GRANT_FROM}, топ-вузы — ${TOP_GRANT_FROM}+.`,
          `Шекті балл — ${ENT_THRESHOLD}, өңірлерде грант — ~${REGIONAL_GRANT_FROM}-тен, үздік ЖОО — ${TOP_GRANT_FROM}+.`,
        )}{" "}
        <Link href="/dashboard/admission" className="font-medium text-foreground underline underline-offset-4">
          {t("Выбери вуз и специальность — посчитаем точный разрыв", "ЖОО мен мамандықты таңда — нақты айырманы есептейміз")}
        </Link>
      </p>
    </div>
  )
}

/** Самый короткий тариф в продаже — импульсная покупка «разобрать прямо сейчас». */
function pickShortPlan(plans: BillingPlanDto[]): BillingPlanDto | null {
  const paid = plans.filter((plan) => plan.priceKzt > 0)
  if (!paid.length) return null
  return [...paid].sort((a, b) => a.durationDays - b.durationDays || a.priceKzt - b.priceKzt)[0]
}

function formatKzt(value: number) {
  return `${value.toLocaleString(getFormatLocale())} ₸`
}

function durationLabelRu(days: number) {
  if (days === 7) return "неделю"
  if (days === 30) return "месяц"
  return `${days} ${ruPlural(days, "день", "дня", "дней")}`
}

function perMonthRu(plan: BillingPlanDto) {
  if (plan.durationDays < 60) return ""
  const perMonth = Math.round(plan.priceKzt / (plan.durationDays / 30) / 10) * 10
  return ` · ≈ ${perMonth.toLocaleString(getFormatLocale())} ₸/мес`
}
