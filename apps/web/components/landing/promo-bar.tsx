"use client"

import { ArrowRight, Sparkles } from "lucide-react"
import { useLandingSettings } from "@/lib/api/landing"
import { ConversionLink } from "./conversion-link"

export function PromoBar() {
  const { data } = useLandingSettings()
  const campaign = data?.campaign

  if (campaign && !campaign.enabled) return null

  const title = campaign?.title || "Первый полный пробный — бесплатно"
  const eyebrow = campaign?.eyebrow || "Подготовка к ЕНТ 2027"
  const href = campaign?.ctaHref || "/login?source=campaign"
  const ctaLabel = campaign?.ctaLabel || "Начать"
  const deadline = campaign?.endsAt ? new Date(campaign.endsAt) : null
  const deadlineLabel =
    deadline && !Number.isNaN(deadline.getTime()) && deadline.getTime() > Date.now()
      ? ` · до ${deadline.toLocaleDateString("ru-RU", { day: "numeric", month: "long" })}`
      : ""

  return (
    <div className="bg-foreground text-background">
      <div className="mx-auto flex max-w-7xl items-center justify-center gap-2 px-4 py-2.5 text-xs sm:text-sm">
        <Sparkles className="h-3.5 w-3.5 text-accent" aria-hidden="true" />
        <span className="hidden opacity-70 sm:inline">{eyebrow}.</span>
        <span className="max-w-[48vw] truncate opacity-90 sm:max-w-none">
          {title}
          {deadlineLabel}
        </span>
        {campaign?.description ? (
          <span className="hidden max-w-sm truncate opacity-60 xl:inline">
            · {campaign.description}
          </span>
        ) : null}
        <ConversionLink
          href={href}
          placement="promo_bar"
          className="ml-1 inline-flex items-center gap-1 font-medium underline-offset-4 hover:underline"
        >
          {ctaLabel}
          <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
        </ConversionLink>
      </div>
    </div>
  )
}
