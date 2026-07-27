"use client"

import Link from "next/link"
import { useEffect, useRef, useState } from "react"
import { ArrowRight, LayoutDashboard, Menu } from "lucide-react"
import { useAuth } from "@/lib/api/auth-context"
import { LanguageSwitcher } from "@/components/language-switcher"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet"
import { ConversionLink } from "./conversion-link"

const nav = [
  { label: "Пробный ЕНТ", href: "/probnyy-ent", external: true },
  { label: "Мой маршрут", href: "#diagnostic" },
  { label: "Предметы", href: "#subjects" },
  { label: "Тарифы", href: "#pricing" },
  { label: "Шансы поступления", href: "/admission", external: true },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)
  const progressRef = useRef<HTMLDivElement>(null)
  const { isAuthenticated, isLoading } = useAuth()

  useEffect(() => {
    const updateProgress = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight
      const progress =
        scrollable > 0 ? Math.min(100, (window.scrollY / scrollable) * 100) : 0
      progressRef.current?.style.setProperty("width", `${progress}%`)
    }
    updateProgress()
    window.addEventListener("scroll", updateProgress, { passive: true })
    window.addEventListener("resize", updateProgress)
    return () => {
      window.removeEventListener("scroll", updateProgress)
      window.removeEventListener("resize", updateProgress)
    }
  }, [])

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/90 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6">
        <Link href="/" className="flex items-center gap-2" aria-label="mytest — главная">
          <Logo />
          <span className="text-lg font-semibold tracking-tight lowercase">mytest</span>
        </Link>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Главная навигация">
          {nav.map((item) =>
            item.external ? (
              <Link
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </Link>
            ) : (
              <a
                key={item.href}
                href={item.href}
                className="text-sm text-muted-foreground transition-colors hover:text-foreground"
              >
                {item.label}
              </a>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <LanguageSwitcher />
          {isLoading ? (
            <span className="h-9 w-32 rounded-full bg-muted animate-pulse" aria-hidden />
          ) : isAuthenticated ? (
            <Link
              href="/dashboard"
              className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
            >
              <LayoutDashboard className="size-4" />
              Мой кабинет
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
              >
                Войти
              </Link>
              <ConversionLink
                href="/login?source=header"
                placement="header_primary"
                className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
              >
                Начать пробный
              </ConversionLink>
            </>
          )}
        </div>

        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger asChild>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background transition-colors hover:bg-secondary lg:hidden"
              aria-label="Открыть меню"
            >
              <Menu className="h-5 w-5" />
            </button>
          </SheetTrigger>
          <SheetContent side="right" className="w-[min(88vw,24rem)] p-0">
            <SheetHeader className="border-b border-border px-5 py-5 text-left">
              <SheetTitle className="flex items-center gap-2 text-lg">
                <Logo />
                <span className="lowercase">mytest</span>
              </SheetTitle>
              <SheetDescription className="sr-only">
                Навигация по платформе mytest
              </SheetDescription>
            </SheetHeader>
            <nav className="flex flex-1 flex-col px-3 py-4" aria-label="Мобильная навигация">
              {nav.map((item) =>
                item.external ? (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3.5 text-base font-medium text-foreground/90 transition-colors hover:bg-secondary"
                  >
                    {item.label}
                  </Link>
                ) : (
                  <a
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className="rounded-xl px-3 py-3.5 text-base font-medium text-foreground/90 transition-colors hover:bg-secondary"
                  >
                    {item.label}
                  </a>
                ),
              )}
            </nav>
            <div className="space-y-3 border-t border-border p-4">
              <LanguageSwitcher className="w-full justify-center" />
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  onClick={() => setOpen(false)}
                  className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
                >
                  <LayoutDashboard className="size-4" />
                  Мой кабинет
                </Link>
              ) : (
                <>
                  <ConversionLink
                    href="/login?source=mobile_menu"
                    placement="mobile_menu_primary"
                    onClick={() => setOpen(false)}
                    className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-sm font-semibold text-background"
                  >
                    Начать бесплатно
                    <ArrowRight className="size-4" />
                  </ConversionLink>
                  <Link
                    href="/login"
                    onClick={() => setOpen(false)}
                    className="block py-1 text-center text-sm font-medium text-muted-foreground"
                  >
                    Уже есть аккаунт? Войти
                  </Link>
                </>
              )}
            </div>
          </SheetContent>
        </Sheet>
      </div>

      <div className="absolute inset-x-0 bottom-0 h-px bg-border/40" aria-hidden="true">
        <div
          ref={progressRef}
          className="h-full origin-left bg-accent transition-[width] duration-150"
          style={{ width: 0 }}
        />
      </div>
    </header>
  )
}

function Logo() {
  return (
    <span
      className="flex h-8 w-8 items-center justify-center rounded-lg bg-foreground text-background"
      aria-hidden="true"
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4">
        <path
          d="M4 6h16M4 12h10M4 18h16"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <circle cx="18" cy="12" r="2" fill="oklch(0.65 0.18 35)" />
      </svg>
    </span>
  )
}
