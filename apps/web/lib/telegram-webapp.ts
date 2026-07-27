"use client"

export interface TelegramWebAppUser {
  id: number
  first_name: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramWebApp {
  version?: string
  initData?: string
  initDataUnsafe?: {
    user?: TelegramWebAppUser
  }
  ready?: () => void
  expand?: () => void
}

declare global {
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp
    }
  }
}

export function getTelegramWebApp(): TelegramWebApp | null {
  if (typeof window === "undefined") return null
  return window.Telegram?.WebApp ?? null
}

export function getTelegramInitData(): string {
  return (getTelegramWebApp()?.initData || "").trim()
}

export function isTelegramWebAppLaunch(): boolean {
  if (typeof window === "undefined") return false
  if (getTelegramInitData()) return true

  const launchContext = `${window.location.search}&${window.location.hash}`
  return (
    /tgWebApp(?:Data|Version|Platform)=/i.test(launchContext) ||
    window.navigator.userAgent.toLowerCase().includes("telegram")
  )
}

export function prepareTelegramWebApp(webApp = getTelegramWebApp()) {
  if (!webApp) return
  try {
    webApp.ready?.()
  } catch {}
  try {
    webApp.expand?.()
  } catch {}
}

export async function waitForTelegramInitData(
  timeoutMs = 1500,
  intervalMs = 50,
): Promise<string> {
  const immediate = getTelegramInitData()
  if (immediate || typeof window === "undefined") return immediate

  const startedAt = Date.now()
  while (Date.now() - startedAt < timeoutMs) {
    await new Promise((resolve) => window.setTimeout(resolve, intervalMs))
    const initData = getTelegramInitData()
    if (initData) return initData
  }

  return ""
}
