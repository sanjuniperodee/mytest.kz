"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import {
  BarChart3,
  BookOpen,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Home,
  History,
  LogOut,
  MoreHorizontal,
  Target,
  Trophy,
  User,
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
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"

const navigation = [
  {
    href: "/dashboard",
    label: "Обзор",
    mobileLabel: "Обзор",
    icon: Home,
    primary: true,
  },
  {
    href: "/dashboard/exams",
    label: "Экзамены",
    mobileLabel: "Тесты",
    icon: BookOpen,
    primary: true,
  },
  {
    href: "/dashboard/mistakes",
    label: "Мои ошибки",
    mobileLabel: "Ошибки",
    icon: Target,
    primary: true,
  },
  {
    href: "/dashboard/admission",
    label: "Шанс поступления",
    mobileLabel: "Грант",
    icon: GraduationCap,
    primary: true,
  },
  { href: "/dashboard/leaderboard", label: "Лидерборд", icon: Trophy, primary: false },
  { href: "/dashboard/stats", label: "Статистика", icon: BarChart3, primary: false },
  { href: "/dashboard/history", label: "История", icon: History, primary: false },
  { href: "/dashboard/billing", label: "Тарифы", icon: CreditCard, primary: false },
  { href: "/dashboard/profile", label: "Профиль", icon: User, primary: false },
]

const primaryNavigation = navigation.filter((item) => item.primary)
const secondaryNavigation = navigation.filter((item) => !item.primary)

const CHANNEL_GATE_PATH = "/dashboard/channel-gate"

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const pathname = usePathname()
  const { user, isAuthenticated, isLoading, signOut } = useAuth()
  const [moreOpen, setMoreOpen] = useState(false)

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
    setMoreOpen(false)
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
  const isActive = (href: string) =>
    href === "/dashboard" ? pathname === "/dashboard" : pathname.startsWith(href)
  const isMoreRoute = !primaryNavigation.some((item) => isActive(item.href))

  return (
    <div className="min-h-svh bg-secondary/30">
      <a
        href="#dashboard-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-foreground focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:text-background focus:shadow-lg"
      >
        Перейти к содержимому
      </a>
      {/* Mobile app bar */}
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-border bg-background/95 px-4 backdrop-blur-xl lg:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <Logo />
          <span className="text-base font-semibold lowercase">mytest</span>
        </Link>
        <Link
          href="/dashboard/profile"
          aria-label="Открыть профиль"
          className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        >
          <Avatar className="size-9 border border-border">
            <AvatarImage src={resolveMediaUrl(user?.avatarUrl)} alt="" />
            <AvatarFallback className="text-xs font-semibold">{initials}</AvatarFallback>
          </Avatar>
        </Link>
      </header>

      <div className="flex">
        {/* Desktop sidebar */}
        <aside className="sticky top-0 hidden h-svh w-64 shrink-0 flex-col border-r border-border bg-background lg:flex">
          <div className="flex h-14 items-center border-b border-border px-5">
            <Link href="/dashboard" className="flex items-center gap-2">
              <Logo />
              <span className="text-base font-semibold lowercase">mytest</span>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto p-3" aria-label="Основная навигация">
            <ul className="flex flex-col gap-1">
              {navigation.map((item) => {
                const Icon = item.icon
                const active = isActive(item.href)
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
            <div className="mb-3">
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

        <main id="dashboard-content" className="min-w-0 flex-1 pb-24 lg:pb-0">
          <div className="mx-auto max-w-6xl p-4 sm:p-6 lg:p-8">{children}</div>
        </main>
      </div>

      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-background/95 px-2 pb-[max(0.45rem,env(safe-area-inset-bottom))] pt-1.5 shadow-[0_-12px_35px_-24px_oklch(0.18_0.012_60_/_0.45)] backdrop-blur-xl lg:hidden"
        aria-label="Быстрая навигация"
      >
        <ul className="grid grid-cols-5">
          {primaryNavigation.map((item) => {
            const Icon = item.icon
            const active = isActive(item.href)
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
                  {item.mobileLabel}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen(true)}
              aria-expanded={moreOpen}
              aria-controls="dashboard-more-menu"
              className={cn(
                "flex min-h-12 w-full flex-col items-center justify-center gap-1 rounded-xl px-1 text-[10px] font-semibold transition-colors",
                moreOpen || isMoreRoute
                  ? "bg-accent/10 text-accent"
                  : "text-muted-foreground",
              )}
            >
              <MoreHorizontal className="size-5" aria-hidden="true" />
              Ещё
            </button>
          </li>
        </ul>
      </nav>

      <Sheet open={moreOpen} onOpenChange={setMoreOpen}>
        <SheetContent
          id="dashboard-more-menu"
          side="bottom"
          className="max-h-[85svh] gap-0 rounded-t-3xl pb-[max(1rem,env(safe-area-inset-bottom))] lg:hidden"
        >
          <div className="mx-auto mt-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
          <SheetHeader className="border-b border-border px-5 pb-4 pt-3 text-left">
            <SheetTitle>Ещё</SheetTitle>
            <SheetDescription>Аккаунт и дополнительные разделы</SheetDescription>
          </SheetHeader>

          <div className="overflow-y-auto px-3 py-3">
            <Link
              href="/dashboard/profile"
              className="mb-3 flex items-center gap-3 rounded-2xl bg-secondary/70 p-3 transition-colors hover:bg-secondary"
            >
              <Avatar className="size-11 border border-border bg-background">
                <AvatarImage src={resolveMediaUrl(user?.avatarUrl)} alt="" />
                <AvatarFallback>{initials}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">
                  {displayName === "U" ? "Профиль" : displayName}
                </p>
                <p className="truncate text-xs text-muted-foreground">
                  {user?.phone || user?.telegramUsername || "Настройки аккаунта"}
                </p>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
            </Link>

            <nav aria-label="Дополнительная навигация">
              <ul className="flex flex-col gap-1">
                {secondaryNavigation
                  .filter((item) => item.href !== "/dashboard/profile")
                  .map((item) => {
                    const Icon = item.icon
                    const active = isActive(item.href)
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={cn(
                            "flex min-h-12 items-center gap-3 rounded-xl px-3 text-sm font-medium transition-colors",
                            active
                              ? "bg-foreground text-background"
                              : "text-foreground hover:bg-secondary",
                          )}
                        >
                          <span
                            className={cn(
                              "flex size-9 items-center justify-center rounded-lg",
                              active ? "bg-background/15" : "bg-secondary",
                            )}
                          >
                            <Icon className="size-4" aria-hidden="true" />
                          </span>
                          <span className="flex-1">{item.label}</span>
                          <ChevronRight className="size-4 opacity-60" aria-hidden="true" />
                        </Link>
                      </li>
                    )
                  })}
              </ul>
            </nav>

            <div className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-border px-3 py-2.5">
              <span className="text-sm font-medium">Язык</span>
              <LanguageSwitcher className="h-9" />
            </div>

            <button
              type="button"
              onClick={() => {
                signOut()
                router.replace("/")
              }}
              className="mt-2 flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <LogOut className="size-4" aria-hidden="true" />
              Выйти
            </button>
          </div>
        </SheetContent>
      </Sheet>

      <WhatsAppFab />
    </div>
  )
}
