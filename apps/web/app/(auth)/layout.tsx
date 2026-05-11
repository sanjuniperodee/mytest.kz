import type { Metadata } from "next"
import Link from "next/link"
import { Logo } from "@/components/landing/logo"
import { LanguageSwitcher } from "@/components/language-switcher"

export const metadata: Metadata = {
  title: "Вход в аккаунт",
  description: "Войди в mytest, чтобы продолжить подготовку к ЕНТ. Пробный тест — бесплатно.",
  robots: {
    index: false,
    follow: false,
  },
}

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh bg-background flex flex-col">
      <header className="border-b border-border/60">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="mytest — главная">
            <Logo />
            <span className="text-base font-semibold tracking-tight lowercase">mytest</span>
          </Link>
          <div className="flex items-center gap-2">
            <LanguageSwitcher />
            <Link
              href="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              На главную
            </Link>
          </div>
        </div>
      </header>
      <main className="flex-1 flex items-center justify-center px-4 py-10">{children}</main>
    </div>
  )
}
