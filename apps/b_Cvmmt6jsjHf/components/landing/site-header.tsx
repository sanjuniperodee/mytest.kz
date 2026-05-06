"use client"

import { useState } from "react"
import { Menu, X } from "lucide-react"
import { cn } from "@/lib/utils"

const nav = [
  { label: "Возможности", href: "#features" },
  { label: "Предметы", href: "#subjects" },
  { label: "Как это работает", href: "#how" },
  { label: "Тарифы", href: "#pricing" },
  { label: "Отзывы", href: "#reviews" },
]

export function SiteHeader() {
  const [open, setOpen] = useState(false)

  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-6 px-4 py-3.5 sm:px-6">
        <a href="#" className="flex items-center gap-2" aria-label="mytest — главная">
          <Logo />
          <span className="text-lg font-semibold tracking-tight lowercase">mytest</span>
        </a>

        <nav className="hidden items-center gap-7 lg:flex" aria-label="Главная навигация">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              className="text-sm text-muted-foreground transition-colors hover:text-foreground"
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <a
            href="#login"
            className="px-3 py-2 text-sm font-medium text-foreground/80 transition-colors hover:text-foreground"
          >
            Войти
          </a>
          <a
            href="#start"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background transition-all hover:opacity-90"
          >
            Начать пробный
          </a>
        </div>

        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border lg:hidden"
          aria-label={open ? "Закрыть меню" : "Открыть меню"}
          aria-expanded={open}
        >
          {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <div
        className={cn(
          "overflow-hidden border-t border-border/60 lg:hidden",
          open ? "max-h-96" : "max-h-0",
          "transition-[max-height] duration-300",
        )}
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-1 px-4 py-3">
          {nav.map((item) => (
            <a
              key={item.href}
              href={item.href}
              onClick={() => setOpen(false)}
              className="rounded-md px-2 py-3 text-base font-medium text-foreground/90 hover:bg-secondary"
            >
              {item.label}
            </a>
          ))}
          <div className="mt-2 flex flex-col gap-2 border-t border-border/60 pt-3">
            <a
              href="#login"
              className="rounded-full border border-border px-5 py-3 text-center text-sm font-medium"
            >
              Войти
            </a>
            <a
              href="#start"
              className="rounded-full bg-foreground px-5 py-3 text-center text-sm font-semibold text-background"
            >
              Начать пробный
            </a>
          </div>
        </div>
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
