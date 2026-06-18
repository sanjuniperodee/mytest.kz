import Link from "next/link"
import { Check, Flame, Gift } from "lucide-react"

type Plan = {
  name: string
  oldPrice?: string
  price: string
  perDay?: string
  period: string
  description: string
  features: string[]
  cta: string
  href: string
  highlighted?: boolean
  free?: boolean
  badge?: string
  badgeTone?: "accent" | "muted"
  discount?: string
}

const plans: Plan[] = [
  {
    name: "Стартер",
    oldPrice: "1 380",
    price: "690",
    period: "₸ / 7 дней · 1 попытка",
    description: "Один полный пробный ЕНТ с Premium-разбором.",
    features: [
      "1 полный пробный ЕНТ",
      "Premium-разбор вопросов",
      "Статистика результата",
      "Доступ 7 дней",
    ],
    cta: "Купить Стартер",
    href: "/login",
    discount: "−50%",
  },
  {
    name: "Базовый",
    oldPrice: "2 980",
    price: "1 490",
    period: "₸ / 30 дней · 3 попытки",
    description: "Три полные попытки ЕНТ с Premium-разбором.",
    features: [
      "3 полных пробных ЕНТ",
      "Premium-разбор вопросов",
      "Статистика по попыткам",
      "Доступ 30 дней",
    ],
    cta: "Купить Базовый",
    href: "/login",
    discount: "−50%",
  },
  {
    name: "Про",
    oldPrice: "3 980",
    price: "1 990",
    period: "₸ / 30 дней · 5 попыток",
    description: "Пять полных попыток ЕНТ с Premium-разбором.",
    features: [
      "5 полных пробных ЕНТ",
      "Premium-разбор вопросов",
      "Статистика по попыткам",
      "Доступ 30 дней",
    ],
    cta: "Купить Про",
    href: "/login",
    badge: "Выгодно",
    badgeTone: "muted",
    discount: "−50%",
  },
  {
    name: "Премиум",
    oldPrice: "7 800",
    price: "3 900",
    perDay: "≈ 130 ₸ в день",
    period: "₸ / 30 дней · безлимит",
    description: "Оптимально, чтобы реально подтянуть слабые темы.",
    features: [
      "Безлимитные попытки ЕНТ",
      "Доступ на 30 дней без ограничений",
      "Аналитика по предметам и темам",
      "Работа над ошибками",
      "Объяснения ко всем вопросам",
    ],
    cta: "Купить Премиум",
    href: "/login",
    highlighted: true,
    badge: "Популярный",
    badgeTone: "accent",
    discount: "−50%",
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            Скидка 50% до конца сезона
          </span>
          <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Начни{" "}
            <span className="font-serif italic font-normal">бесплатно.</span>{" "}
            Потом — понятный план дешевле, чем{" "}
            <span className="font-serif italic font-normal">пара чашек кофе.</span>
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground">
            Первый пробный ЕНТ — бесплатно и без карты. Понравится — выбирай тариф и готовься дальше.
          </p>
        </div>

        {/* Free tier highlight */}
        <div className="mt-10 rounded-2xl border-2 border-accent/30 bg-accent/5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
                <Gift className="h-5 w-5 text-accent" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-foreground">1 бесплатный пробный ЕНТ — сразу после регистрации</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Полный тест в реальном формате · 140 вопросов · таймер · базовый разбор ошибок. Без карты и оплаты.
                </p>
              </div>
            </div>
            <Link
              href="/login"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              <Gift className="h-4 w-4" aria-hidden="true" />
              Получить бесплатно
            </Link>
          </div>
        </div>

        <div className="mt-8 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {plans.filter((p) => !p.free).map((plan) => (
            <article
              key={plan.name}
              className={[
                "relative flex flex-col rounded-2xl border p-6 sm:p-7",
                plan.highlighted
                  ? "border-foreground bg-foreground text-background shadow-[0_30px_80px_-30px_oklch(0.18_0.012_60_/_0.55)]"
                  : "border-border bg-card",
              ].join(" ")}
            >
              {plan.badge && (
                <span
                  className={[
                    "absolute -top-3 left-6 rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wider",
                    plan.badgeTone === "accent"
                      ? "bg-accent text-accent-foreground"
                      : "bg-foreground text-background",
                  ].join(" ")}
                >
                  {plan.badge}
                </span>
              )}

              <div className="flex items-start justify-between">
                <h3 className="text-base font-semibold tracking-tight">{plan.name}</h3>
                {plan.discount && (
                  <span
                    className={[
                      "rounded-full px-2 py-0.5 text-[11px] font-bold tabular-nums",
                      plan.highlighted
                        ? "bg-accent text-accent-foreground"
                        : "bg-accent/10 text-accent",
                    ].join(" ")}
                    aria-label={`Скидка ${plan.discount}`}
                  >
                    {plan.discount}
                  </span>
                )}
              </div>

              <div className="mt-5">
                {plan.oldPrice && (
                  <div
                    className={[
                      "text-sm line-through tabular-nums",
                      plan.highlighted ? "text-background/45" : "text-muted-foreground/70",
                    ].join(" ")}
                    aria-label="Старая цена"
                  >
                    {plan.oldPrice} ₸
                  </div>
                )}
                <div className="mt-1 flex items-baseline gap-1.5">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums sm:text-[2.75rem]">
                    {plan.price}
                  </span>
                  <span
                    className={[
                      "text-xs font-medium",
                      plan.highlighted ? "text-background/70" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    {plan.period}
                  </span>
                </div>
                {plan.perDay && (
                  <div className="mt-1 text-xs text-accent">
                    {plan.perDay}
                  </div>
                )}
              </div>

              <p
                className={[
                  "mt-4 text-sm leading-relaxed",
                  plan.highlighted ? "text-background/75" : "text-muted-foreground",
                ].join(" ")}
              >
                {plan.description}
              </p>

              <ul className="mt-6 space-y-2.5 text-sm">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check
                      className={[
                        "mt-0.5 h-4 w-4 shrink-0",
                        plan.highlighted ? "text-accent" : "text-foreground",
                      ].join(" ")}
                    />
                    <span className={plan.highlighted ? "text-background/90" : ""}>
                      {f}
                    </span>
                  </li>
                ))}
              </ul>

              <Link
                href={plan.href}
                className={[
                  "mt-7 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-all",
                  plan.highlighted
                    ? "bg-accent text-accent-foreground hover:opacity-90"
                    : "bg-foreground text-background hover:opacity-90",
                ].join(" ")}
              >
                {plan.cta}
              </Link>
            </article>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            Цены указаны в тенге. Оплата через Freedom Pay, картой Visa / Mastercard или через Kaspi.
          </p>
        </div>
      </div>
    </section>
  )
}
