"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BookOpen,
  CreditCard,
  GraduationCap,
  Home,
  LogOut,
  Menu,
  MoreHorizontal,
  Target,
  Trophy,
  User,
  X,
} from "lucide-react"
import { useAuth } from "@/lib/api/auth-context"
import { Spinner } from "@/components/ui/spinner"
import { Logo } from "@/components/landing/logo"
import { cn } from "@/lib/utils"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { resolveMediaUrl } from "@/lib/api/client"
import { localize, type Locale } from "@/lib/api/i18n"
import { LanguageSwitcher } from "@/components/language-switcher"
import { WhatsAppFab } from "@/components/common/whatsapp-fab"

const nav = [
  { href: "/dashboard", label: "Обзор", icon: Home },
  { href: "/dashboard/exams", label: "Экзамены", icon: BookOpen },
  { href: "/dashboard/mistakes", label: "Мои ошибки", icon: Target },
  { href: "/dashboard/admission", label: "Шанс поступления", icon: GraduationCap },
  { href: "/dashboard/leaderboard", label: "Лидерборд", icon: Trophy },
  { href: "/dashboard/billing", label: "Тарифы", icon: CreditCard },
  { href: "/dashboard/profile", label: "Профиль", icon: User },
]

const mobileNav = [
  { href: "/dashboard", label: "Обзор", icon: Home },
  { href: "/dashboard/exams", label: "Тесты", icon: BookOpen },
  { href: "/dashboard/mistakes", label: "Ошибки", icon: Target },
  { href: "/dashboard/admission", label: "Грант", icon: GraduationCap },
]

const CHANNEL_GATE_PATH = "/dashboard/channel-gate"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, signOut } = useAuth()
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    if (!isLoading && !isAuthenticated) router.replace("/login")
  }, [isAuthenticated, isLoading, router])

  useEffect(() => {
    if (
      !isLoading &&
      isAuthenticated &&
      user?.telegramId &&
      user.isChannelMember === false &&
      pathname !== CHANNEL_GATE_PATH
    ) {
      router.replace(CHANNEL_GATE_PATH)
    }
  }, [isAuthenticated, isLoading, pathname, router, user?.isChannelMember, user?.telegramId])

  useEffect(() => {
    setMobileOpen(false)
  }, [pathname])

  if (isLoading || !isAuthenticated) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  if (user?.telegramId && user.isChannelMember === false && pathname !== CHANNEL_GATE_PATH) {
    return (
      <div className="min-h-svh flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const firstLastName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim()
  const fullNameStr = firstLastName || localize(user?.fullName, locale)
  const displayName =
    fullNameStr || user?.telegramUsername || user?.username || user?.phone || "U"
  const initials = displayName.toString().slice(0, 2).toUpperCase()

  return (
    <div className="min-h-svh bg-secondary/30">
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background focus:shadow-lg"
      >
        Перейти к содержимому
      </a>
      {/* Mobile header */}
      <div className="lg:hidden sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background px-4">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo />
          <span className="text-base font-semibold lowercase">mytest</span>
        </Link>
        <div className="flex items-center gap-2">
          <LanguageSwitcher className="h-9" />
          <button
            onClick={() => setMobileOpen((v) => !v)}
            className="inline-flex h-9 w-9 items-center justify-center rounded-md border border-border transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
            aria-expanded={mobileOpen}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside
          className={cn(
            "fixed lg:sticky lg:top-0 z-40 h-svh w-64 shrink-0 border-r border-border bg-background flex flex-col transition-transform lg:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          <div className="hidden lg:flex h-14 items-center px-5 border-b border-border">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo />
              <span className="text-base font-semibold lowercase">mytest</span>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-3" aria-label="Основная навигация">
            <ul className="flex flex-col gap-1">
              {nav.map((item) => {
                const Icon = item.icon
                const active =
                  item.href === "/dashboard"
                    ? pathname === "/dashboard"
                    : pathname.startsWith(item.href)
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                        active
                          ? "bg-foreground text-background"
                          : "text-foreground/80 hover:bg-secondary",
                      )}
                    >
                      <Icon className="size-4 shrink-0" aria-hidden="true" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          <div className="border-t border-border p-3">
            <div className="mb-3 hidden lg:block">
              <LanguageSwitcher className="w-full justify-center" />
            </div>
            <Link
              href="/dashboard/profile"
              className="flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <Avatar className="size-9">
                <AvatarImage src={resolveMediaUrl(user?.avatarUrl)} alt={initials} />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <p className="truncate text-sm font-medium">
                  {displayName === "U" ? "Профиль" : displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.phone || user?.telegramUsername || ""}
                </p>
              </div>
            </Link>
            <button
              onClick={() => {
                signOut()
                router.replace("/")
              }}
              className="mt-2 flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Выйти
            </button>
          </div>
        </aside>

        {mobileOpen && (
          <button
            type="button"
            aria-label="Закрыть меню"
            onClick={() => setMobileOpen(false)}
            className="fixed inset-0 z-30 bg-black/30 lg:hidden"
          />
        )}

        <main id="dashboard-content" className="min-w-0 flex-1 pb-24 lg:pb-0">
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_35px_-24px_oklch(0.18_0.012_60_/_0.45)] backdrop-blur-xl lg:hidden"
        aria-label="Быстрая навигация"
      >
        <ul className="grid grid-cols-5">
          {mobileNav.map((item) => {
            const Icon = item.icon
            const active =
              item.href === "/dashboard"
                ? pathname === "/dashboard"
                : pathname.startsWith(item.href)
            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex min-h-12 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors",
                    active ? "bg-accent/10 text-accent" : "text-muted-foreground",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                  {item.label}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMobileOpen(true)}
              aria-expanded={mobileOpen}
              className={cn(
                "flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors",
                mobileOpen ? "bg-accent/10 text-accent" : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
              Ещё
            </button>
          </li>
        </ul>
      </nav>

      <WhatsAppFab />
    </div>
  )
}
