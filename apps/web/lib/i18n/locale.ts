export type UiLocale = "ru" | "kk"
export const STORAGE_KEY = "mytest-locale"

let activeLocale: UiLocale | null = null

export function setRequestLocale(locale: UiLocale) {
  activeLocale = locale
}

export function getRequestLocale(): UiLocale {
  if (typeof window === "undefined") return "ru"
  if (activeLocale) return activeLocale
  const fromUrl = new URLSearchParams(window.location.search).get("lang")
  if (fromUrl === "ru" || fromUrl === "kk") return fromUrl
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === "ru" || stored === "kk") return stored
  return document.documentElement.lang === "kk" || window.navigator.language.toLowerCase().startsWith("kk") ? "kk" : "ru"
}

export function getFormatLocale(): string {
  return getRequestLocale() === "kk" ? "kk-KZ" : "ru-RU"
}
