import type { User } from "@/lib/api/types"

const REVIEW_EMAIL = "apple-review@my-test.kz"
const REVIEW_TELEGRAM_ID = 641159287
const REVIEW_TELEGRAM_USERNAME = "sanjuniperodee"
/** Нормализованные цифры номера (включая код страны). */
const REVIEW_PHONE_DIGITS = "77082420482"
const REVIEW_USERNAME = "sanjunipero"

function digitsOnly(s: string): string {
  return s.replace(/\D/g, "")
}

function telegramIdMatches(value: unknown): boolean {
  if (value === REVIEW_TELEGRAM_ID) return true
  if (typeof value === "string" && value.trim() !== "") {
    const n = Number(value)
    return Number.isFinite(n) && n === REVIEW_TELEGRAM_ID
  }
  return false
}

/**
 * Аккаунты, для которых в приложении не показываем коммерцию Kaspi / тарифы как у ревью Apple
 * и при исчерпании лимитов ЕНТ ведём на нейтральный экран без оплаты.
 */
export function isAppStoreReviewLikeUser(user: User | null | undefined): boolean {
  if (!user) return false
  if (user.email === REVIEW_EMAIL) return true
  if (telegramIdMatches(user.telegramId)) return true
  const tg = (user.telegramUsername ?? "").trim().replace(/^@/, "").toLowerCase()
  if (tg === REVIEW_TELEGRAM_USERNAME) return true
  const phone = digitsOnly(typeof user.phone === "string" ? user.phone : "")
  if (phone.length >= 9) {
    if (phone === REVIEW_PHONE_DIGITS) return true
    if (phone.endsWith(REVIEW_PHONE_DIGITS.slice(-9))) return true
  }
  const un = (user.username ?? "").trim().toLowerCase()
  if (un === REVIEW_USERNAME) return true
  return false
}
