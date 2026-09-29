import type { MaterialCommunityIcons } from "@expo/vector-icons"

export type NavIcon = keyof typeof MaterialCommunityIcons.glyphMap

export type NavItem = {
  href: string
  label: { ru: string; kk: string }
  /** Short label for the bottom tab bar. */
  tab?: { ru: string; kk: string }
  icon: NavIcon
  primary?: boolean
  showUnread?: boolean
  match: (pathname: string, userId?: string) => boolean
}

const isOwnProfile = (p: string, userId?: string) =>
  p === "/dashboard/profile" || (!!userId && p === `/dashboard/profile/${userId}`)
const isOtherProfile = (p: string, userId?: string) =>
  p.startsWith("/dashboard/profile/") && !isOwnProfile(p, userId)
const isFeed = (p: string) =>
  p === "/dashboard/community" ||
  p.startsWith("/dashboard/community/post/") ||
  p.startsWith("/dashboard/community/invite/")
const isPeople = (p: string, userId?: string) =>
  p.startsWith("/dashboard/community/people") || isOtherProfile(p, userId)
const prefix = (href: string) => (p: string) => p === href || p.startsWith(`${href}/`)

/** The whole social area is highlighted under the "Лента" tab on small screens. */
export const isCommunityArea = (p: string, userId?: string) =>
  isFeed(p) || isPeople(p, userId) || p.startsWith("/dashboard/messages") || p === "/dashboard/global-chat"

// Same structure and order as apps/web/components/dashboard/shell.tsx.
export const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: { ru: "Обзор", kk: "Шолу" }, icon: "view-dashboard-outline", primary: true, match: (p) => p === "/dashboard" },
  { href: "/dashboard/exams", label: { ru: "Экзамены", kk: "Емтихандар" }, tab: { ru: "Тесты", kk: "Тесттер" }, icon: "file-document-outline", primary: true, match: prefix("/dashboard/exams") },
  { href: "/dashboard/mistakes", label: { ru: "Мои ошибки", kk: "Менің қателерім" }, tab: { ru: "Ошибки", kk: "Қателер" }, icon: "target", primary: true, match: prefix("/dashboard/mistakes") },
  { href: "/dashboard/community", label: { ru: "Лента", kk: "Лента" }, icon: "earth", primary: true, match: isFeed },
  { href: "/dashboard/admission", label: { ru: "Шанс поступления", kk: "Түсу мүмкіндігі" }, icon: "school-outline", match: prefix("/dashboard/admission") },
  { href: "/dashboard/leaderboard", label: { ru: "Лидерборд", kk: "Көшбасшылар" }, icon: "trophy-outline", match: prefix("/dashboard/leaderboard") },
  { href: "/dashboard/stats", label: { ru: "Статистика", kk: "Статистика" }, icon: "trending-up", match: prefix("/dashboard/stats") },
  { href: "/dashboard/history", label: { ru: "История", kk: "Тарих" }, icon: "history", match: prefix("/dashboard/history") },
  { href: "/dashboard/community/people", label: { ru: "Люди", kk: "Адамдар" }, icon: "account-group-outline", match: isPeople },
  { href: "/dashboard/messages", label: { ru: "Сообщения", kk: "Хабарламалар" }, icon: "message-outline", showUnread: true, match: prefix("/dashboard/messages") },
  { href: "/dashboard/global-chat", label: { ru: "Глобальный чат", kk: "Жаһандық чат" }, icon: "radio-tower", match: (p) => p === "/dashboard/global-chat" },
  { href: "/dashboard/billing", label: { ru: "Тарифы", kk: "Тарифтер" }, icon: "creation", match: prefix("/dashboard/billing") },
  { href: "/dashboard/profile", label: { ru: "Профиль", kk: "Профиль" }, icon: "account-circle-outline", match: isOwnProfile },
]

export const PRIMARY_NAV = NAV_ITEMS.filter((item) => item.primary)
export const MORE_NAV = NAV_ITEMS.filter((item) => !item.primary)

/** Screens that own the whole viewport (composer + keyboard): no tab bar, no floating button. */
export function isImmersiveRoute(pathname: string) {
  return /^\/dashboard\/messages\/[^/]+$/.test(pathname) || pathname === "/dashboard/global-chat"
}
