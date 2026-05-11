import type { Metadata } from "next"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { Logo } from "@/components/landing/logo"
import { Button } from "@/components/ui/button"
import { SiteFooter } from "@/components/landing/site-footer"

export const metadata: Metadata = {
  title: "Калькулятор поступления 2026 — куда пройти с баллами ЕНТ",
  description:
    "Узнай, на какие специальности и в какие вузы Казахстана ты проходишь по грантовым и сельским квотам. Введи баллы ЕНТ — получи список подходящих программ.",
  keywords: [
    "калькулятор поступления",
    "пороговые баллы ЕНТ",
    "грант 2026",
    "поступление вузы Казахстан",
    "проходные баллы",
  ],
  openGraph: {
    title: "Калькулятор поступления 2026 | mytest",
    description:
      "Узнай, на какие специальности ты проходишь. Введи баллы ЕНТ — получи список подходящих вузов и программ.",
    images: ["/og-image.png"],
  },
  alternates: {
    canonical: `${process.env.NEXT_PUBLIC_SITE_URL ?? "https://mytest.kz"}/admission`,
  },
}

export default function AdmissionLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-svh flex flex-col bg-background">
      <header className="sticky top-0 z-30 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 w-full max-w-7xl items-center justify-between px-4">
          <Link href="/" className="flex items-center gap-2" aria-label="mytest — главная">
            <Logo />
            <span className="text-base font-semibold tracking-tight lowercase">mytest</span>
          </Link>
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" size="sm">
              <Link href="/">
                <ArrowLeft className="size-4" />
                <span className="hidden sm:inline">На главную</span>
              </Link>
            </Button>
            <Button asChild size="sm">
              <Link href="/login">Войти</Link>
            </Button>
          </div>
        </div>
      </header>
      <main className="flex-1">{children}</main>
      <SiteFooter />
    </div>
  )
}
