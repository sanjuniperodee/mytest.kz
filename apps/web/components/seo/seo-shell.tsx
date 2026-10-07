import Link from "next/link"
import { ArrowRight, ChevronRight } from "lucide-react"
import { Logo } from "@/components/landing/logo"
import { SiteFooter } from "@/components/landing/site-footer"
import { getSiteUrl } from "@/lib/site"
import type { SeoLang } from "@/lib/seo/grant-cutoffs"

export interface Crumb {
  name: string
  href: string
}

const NAV: Record<SeoLang, { label: string; href: string }[]> = {
  ru: [
    { label: "Пробный ЕНТ", href: "/probnyy-ent" },
    { label: "Проходные баллы", href: "/prohodnoj-ball-ent" },
    { label: "Шансы на грант", href: "/admission" },
    { label: "Подготовка", href: "/podgotovka-k-ent" },
  ],
  kk: [
    { label: "Тегін ҰБТ", href: "/uat" },
    { label: "Өту балдары", href: "/ubt-otu-baly" },
    { label: "Грант мүмкіндігі", href: "/admission" },
  ],
}

/**
 * Обёртка публичных SEO-страниц: лёгкая серверная шапка (без клиентского JS —
 * не тормозит LCP), хлебные крошки с BreadcrumbList и общий футер. Даёт
 * страницам навигацию и сквозную перелинковку, которых раньше не было.
 */
export function SeoShell({
  lang,
  crumbs,
  alternate,
  children,
}: {
  lang: SeoLang
  /** Цепочка без «Главной» — её добавляем сами. */
  crumbs?: Crumb[]
  /** Та же страница на другом языке. */
  alternate?: { href: string }
  children: React.ReactNode
}) {
  const siteUrl = getSiteUrl()
  const home = lang === "kk" ? "Басты бет" : "Главная"
  const chain: Crumb[] = crumbs?.length ? [{ name: home, href: "/" }, ...crumbs] : []
  const breadcrumbLd = chain.length
    ? {
        "@context": "https://schema.org",
        "@type": "BreadcrumbList",
        itemListElement: chain.map((c, i) => ({
          "@type": "ListItem",
          position: i + 1,
          name: c.name,
          item: `${siteUrl}${c.href === "/" ? "" : c.href}`,
        })),
      }
    : null

  return (
    <div lang={lang} className="flex min-h-svh flex-col bg-background text-foreground">
      {breadcrumbLd && (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbLd) }} />
      )}
      <header className="sticky top-0 z-30 border-b border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-4 px-4 sm:px-6">
          <Link href="/" className="flex shrink-0 items-center gap-2" aria-label="mytest">
            <Logo />
            <span className="hidden text-base font-semibold lowercase tracking-tight sm:inline">mytest</span>
          </Link>
          <nav
            aria-label={lang === "kk" ? "Негізгі бөлімдер" : "Основные разделы"}
            className="-mx-1 flex min-w-0 flex-1 items-center gap-1 overflow-x-auto px-1 text-sm [scrollbar-width:none]"
          >
            {NAV[lang].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="shrink-0 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {item.label}
              </Link>
            ))}
            {alternate && (
              <Link
                href={alternate.href}
                hrefLang={lang === "kk" ? "ru" : "kk"}
                className="shrink-0 rounded-full px-3 py-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
              >
                {lang === "kk" ? "Русский" : "Қазақша"}
              </Link>
            )}
          </nav>
          <Link
            href="/login"
            className="hidden shrink-0 items-center gap-1.5 rounded-full bg-foreground px-4 py-2 text-sm font-semibold text-background transition-opacity hover:opacity-90 sm:inline-flex"
          >
            {lang === "kk" ? "Тегін бастау" : "Начать бесплатно"}
            <ArrowRight className="size-4" />
          </Link>
        </div>
      </header>

      {chain.length > 0 && (
        <nav aria-label={lang === "kk" ? "Навигация тізбегі" : "Хлебные крошки"} className="mx-auto w-full max-w-6xl px-4 pt-4 sm:px-6">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-muted-foreground">
            {chain.map((c, i) => (
              <li key={c.href} className="flex items-center gap-1">
                {i > 0 && <ChevronRight className="size-3 shrink-0" aria-hidden />}
                {i === chain.length - 1 ? (
                  <span aria-current="page" className="text-foreground">
                    {c.name}
                  </span>
                ) : (
                  <Link href={c.href} className="hover:text-foreground hover:underline">
                    {c.name}
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </nav>
      )}

      <div className="flex-1">{children}</div>
      <SiteFooter />
    </div>
  )
}
