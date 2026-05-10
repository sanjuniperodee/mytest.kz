import type { Locale } from "@/lib/api/i18n"
import { localize } from "@/lib/api/i18n"
import type { BillingPlan, User } from "@/lib/api/types"

export function getWhatsAppDigits(): string {
  const raw = process.env.EXPO_PUBLIC_WHATSAPP_NUMBER
  const digits = raw ? raw.replace(/\D/g, "") : ""
  return digits.length >= 10 ? digits : "77775932124"
}

function pickNumber(...values: unknown[]): number | null {
  for (const v of values) {
    if (typeof v === "number" && Number.isFinite(v)) return v
    if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
      return Number(v)
    }
  }
  return null
}

export interface NormalizedPlan {
  id: string
  code: string
  name: string
  description: string
  price: number | null
  oldPrice: number | null
  currency: string
  durationDays: number | null
  badge: string | null
  features: string[]
  raw: BillingPlan
}

export function normalizeBillingPlan(plan: BillingPlan, locale: Locale): NormalizedPlan {
  const priceFromCents =
    typeof plan.priceCents === "number" ? plan.priceCents / 100 : null
  const price = pickNumber(plan.priceKzt, priceFromCents, plan.price)
  const oldPrice = pickNumber(plan.originalPriceKzt, plan.oldPrice)
  const currency = plan.currency || "₸"

  return {
    id: plan.id,
    code: plan.code || plan.id,
    name: localize(plan.name, locale, "Тариф"),
    description: localize(plan.description, locale),
    price,
    oldPrice,
    currency,
    durationDays: typeof plan.durationDays === "number" ? plan.durationDays : null,
    badge: plan.highlight || plan.badge || null,
    features: (plan.features || []).map((f) => localize(f, locale)).filter(Boolean),
    raw: plan,
  }
}

export function buildWhatsAppPaymentUrl(
  plan: NormalizedPlan,
  user: User | null,
  locale: Locale,
): string {
  const price = plan.price == null ? "—" : plan.price.toLocaleString("ru-RU")
  const lines =
    locale === "kk"
      ? [`Сәлеметсіз бе! "${plan.name}" тарифін ${price}₸-ға сатып алғым келеді`]
      : [`Здравствуйте! Хочу приобрести тариф "${plan.name}" за ${price}₸`]

  const phone = typeof user?.phone === "string" ? user.phone.trim() : ""
  if (phone) {
    lines.push("", locale === "kk" ? `Нөмірім: ${phone}` : `Мой номер: ${phone}`)
  }

  const telegram =
    typeof user?.telegramUsername === "string"
      ? user.telegramUsername.trim().replace(/^@/, "")
      : ""
  if (telegram) {
    lines.push(`Telegram: @${telegram}`)
  }

  lines.push(
    "",
    locale === "kk"
      ? `Шот тапсыру нөмірі: ${phone || "хатта жазамын"}`
      : `Номер для выставления счёта: ${phone || "укажу в переписке"}`,
  )

  return `https://wa.me/${getWhatsAppDigits()}?text=${encodeURIComponent(lines.join("\n"))}`
}
