import type { ReactNode } from "react"
import { SiteFooter } from "@/components/landing/site-footer"
import { SiteHeader } from "@/components/landing/site-header"

export function LegalShell({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteHeader />
      <main className="mx-auto max-w-3xl px-4 pb-24 pt-8 sm:pt-12">
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
        {children}
      </main>
      <SiteFooter />
    </div>
  )
}
