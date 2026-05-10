import Constants from "expo-constants"

/** Strip trailing slash and accidental `/api/v1` — paths are built as `/api/v1/...` in client.ts */
export function normalizeApiOrigin(raw: string): string {
  let s = raw.trim().replace(/\/+$/, "")
  if (s.endsWith("/api/v1")) {
    s = s.slice(0, -"/api/v1".length).replace(/\/+$/, "")
  }
  return s
}

/** Base origin only (host), e.g. https://api.my-test.kz — no `/api/v1` suffix */
export function getApiOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_ORIGIN?.trim()
  if (fromEnv) return normalizeApiOrigin(fromEnv)
  const extra = Constants.expoConfig?.extra as { apiOrigin?: string } | undefined
  const fromExtra = extra?.apiOrigin?.trim()
  if (fromExtra) return normalizeApiOrigin(fromExtra)
  return ""
}

export function requireApiOrigin(): string {
  const o = getApiOrigin()
  if (!o) {
    throw new Error(
      "Set EXPO_PUBLIC_API_ORIGIN (e.g. https://api.my-test.kz — без суффикса /api/v1).",
    )
  }
  return o
}

export function getTelegramBotUsername(): string {
  return (
    process.env.EXPO_PUBLIC_TELEGRAM_BOT_USERNAME?.trim().replace(/^@/, "") || "bilimhan_bot"
  )
}

export function getTelegramBotLink(start = "mobile"): string {
  const username = getTelegramBotUsername()
  const query = start ? `?start=${encodeURIComponent(start)}` : ""
  return `https://t.me/${username}${query}`
}

export function getTelegramChannelUrl(): string {
  return (
    process.env.EXPO_PUBLIC_TELEGRAM_CHANNEL_URL?.trim() ||
    "https://t.me/bilimilimland"
  )
}
