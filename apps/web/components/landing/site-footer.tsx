import Link from "next/link"
import { PaymentBrandStrip } from "@/components/legal/payment-brand-strip"
import { SUPPORT_EMAIL } from "@/lib/legal-content"
import { Logo } from "./logo"
import { SocialLinks } from "./social-links"

const groups = [
  {
    title: "Платформа",
    links: [
      { label: "Возможности", href: "#features" },
      { label: "Предметы", href: "#subjects" },
      { label: "Тарифы", href: "#pricing" },
      { label: "Отзывы", href: "#reviews" },
    ],
  },
  {
    title: "Подготовка",
    links: [
      { label: "Пробный ЕНТ бесплатно", href: "/probnyy-ent" },
      { label: "Тегін ҰБТ (қазақша)", href: "/uat" },
      { label: "Подготовка к ЕНТ", href: "/podgotovka-k-ent" },
      { label: "Проходной балл ЕНТ 2027", href: "/prohodnoj-ball-ent" },
      { label: "ҰБТ өту балдары (қазақша)", href: "/ubt-otu-baly" },
      { label: "Шансы на грант", href: "/admission" },
    ],
  },
  {
    title: "Документы",
    links: [
      { label: "Оферта", href: "/terms" },
      { label: "Конфиденциальность", href: "/privacy" },
      { label: "Оплата и возврат", href: "/payment" },
      { label: "Поддержка", href: "/support" },
    ],
  },
]

export function SiteFooter() {
  return (
    <footer className="bg-background">
      <div className="mx-auto max-w-7xl px-4 py-16 sm:px-6 sm:py-20">
        <div className="grid gap-12 md:grid-cols-12">
          <div className="md:col-span-5">
            <div className="flex items-center gap-2">
              <Logo />
              <span className="text-lg font-semibold tracking-tight lowercase">mytest</span>
            </div>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-muted-foreground">
              Пробные ЕНТ в реальном формате. Готовим школьников Казахстана к экзамену
              осознанно — без зубрёжки и страха.
            </p>

            <div className="mt-5 space-y-2 text-sm text-muted-foreground">
              <p>Все цены на сайте указаны в тенге (₸).</p>
              <p>
                Поддержка:{" "}
                <a href={`mailto:${SUPPORT_EMAIL}`} className="font-medium text-foreground hover:underline">
                  {SUPPORT_EMAIL}
                </a>
              </p>
            </div>

            <div className="mt-5">
              <PaymentBrandStrip compact />
            </div>

            <SocialLinks />
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 md:col-span-7">
            {groups.map((g) => (
              <div key={g.title}>
                <h4 className="text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                  {g.title}
                </h4>
                <ul className="mt-5 space-y-3">
                  {g.links.map((l) => (
                    <li key={l.label}>
                      <Link
                        href={l.href}
                        className="text-sm text-foreground/85 transition-colors hover:text-foreground"
                      >
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

          <div className="mt-16 flex flex-col items-start justify-between gap-4 border-t border-border pt-6 sm:flex-row sm:items-center">
          <p className="text-xs text-muted-foreground">
            © {new Date().getFullYear()} mytest. Алматы, Казахстан. Все права защищены.
          </p>
          <div className="flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-muted-foreground">
            <Link href="/terms" className="hover:text-foreground">
              Оферта
            </Link>
            <Link href="/privacy" className="hover:text-foreground">
              Конфиденциальность
            </Link>
            <Link href="/payment" className="hover:text-foreground">
              Оплата
            </Link>
            <Link href="/support" className="hover:text-foreground">
              Поддержка
            </Link>
            <Link href="/mobile" className="hover:text-foreground">
              Приложение
            </Link>
          </div>
        </div>
      </div>
    </footer>
  )
}
