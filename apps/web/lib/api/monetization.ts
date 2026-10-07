"use client"

import useSWR from "swr"
import type { PremiumFeatureKey, PublicMonetizationConfig } from "@bilimland/shared"
import { useAuth } from "./auth-context"
import { api } from "./client"
import { useUiI18n } from "../i18n/ui"
import type { User } from "./types"

/**
 * Публичные настройки монетизации из админки («Тарифы и доступ»): бесплатный
 * лимит, какие функции платные, тарифы в продаже и реклама. Меняются редко —
 * держим в кэше SWR и не перезапрашиваем при фокусе окна.
 */
export function usePublicMonetization() {
  const { locale } = useUiI18n()
  const lang = locale === "kk" ? "kk" : "ru"
  return useSWR<PublicMonetizationConfig>(
    ["/public/monetization", lang],
    ([path]: [string, string]) => api<PublicMonetizationConfig>(path, { auth: false, query: { lang } }),
    { revalidateOnFocus: false, dedupingInterval: 5 * 60_000 },
  )
}

export function hasPaidAccess(user: User | null | undefined): boolean {
  return Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
}

/**
 * Что доступно текущему пользователю. Функция открыта, если у него есть
 * подписка или админ сделал её бесплатной. Пока конфиг грузится, считаем
 * функции платными (как и сервер по умолчанию).
 */
export function usePremiumAccess() {
  const { user } = useAuth()
  const { data: config } = usePublicMonetization()
  const isPremium = hasPaidAccess(user)
  const can = (feature: PremiumFeatureKey) =>
    isPremium || config?.premiumFeatures[feature] === false
  return { isPremium, can, config }
}

/** Самая низкая цена среди тарифов в продаже — для коротких CTA «от 490 ₸». */
export function cheapestPlanPrice(config: PublicMonetizationConfig | undefined): number | null {
  const prices = config?.plans.map((plan) => plan.priceKzt).filter((price) => price > 0) ?? []
  return prices.length ? Math.min(...prices) : null
}
