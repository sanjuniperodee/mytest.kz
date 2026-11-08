import { Reveal } from "@/components/motion/reveal"
import { Check, Flame, Gift } from "lucide-react"
import { ConversionLink } from "./conversion-link"
import { loginHref, START_ENT_PATH } from "@/lib/api/login-return"

type Plan = {
  code: string
  name: string
  price: string
  perDay?: string
  period: string
  description: string
  features: string[]
  cta: string
  href: string
  highlighted?: boolean
  badge?: string
  badgeTone?: "accent" | "muted"
}

// Те же тарифы, что в каталоге по умолчанию (@bilimland/shared DEFAULT_MONETIZATION_PLANS).
// Все открывают одно и то же — разбор, тренировку и AI-план — и отличаются только сроком.
const paidFeatures = [
  "Объяснение к каждой ошибке",
  "Тренировка слабых тем",
  "AI-разбор и план до цели",
  "Безлимитные пробные ЕНТ и повтор",
  "Без рекламы",
]

const planHref = (code: string) => loginHref(`/dashboard/billing?plan=${code}`, `pricing-${code}`)

const plans: Plan[] = [
  {
    code: "starter",
    name: "Неделя",
    price: "490",
    period: "7 дней",
    description: "Разбери ошибки последнего пробного и потренируй слабые темы.",
    features: paidFeatures,
    cta: "Открыть на 7 дней",
    href: planHref("starter"),
  },
  {
    code: "premium",
    name: "Месяц",
    price: "2 990",
    perDay: "≈ 100 ₸ в день",
    period: "30 дней",
    description: "Месяц системной подготовки: разборы, слабые темы, пробные без лимита.",
    features: paidFeatures,
    cta: "Готовиться месяц",
    href: planHref("premium"),
  },
  {
    code: "season",
    name: "До ЕНТ 2027",
    price: "9 990",
    perDay: "≈ 1 110 ₸ в месяц — почти втрое дешевле помесячной",
    period: "9 месяцев · один платёж",
    description: "Вся подготовка до экзамена без продлений и доплат.",
    features: paidFeatures,
    cta: "Готовиться до ЕНТ",
    href: planHref("season"),
    highlighted: true,
    badge: "Выгоднее всего",
    badgeTone: "accent",
  },
]

export function Pricing() {
  return (
    <section id="pricing" className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <Reveal className="mx-auto max-w-3xl text-center">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
            <Flame className="h-3.5 w-3.5" aria-hidden="true" />
            Тарифы
          </span>
          <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Тест —{" "}
            <span className="font-serif italic font-normal">бесплатно.</span>{" "}
            Платишь только за то, что{" "}
            <span className="font-serif italic font-normal">поднимает балл.</span>
          </h2>
          <p className="mt-5 text-pretty text-base leading-relaxed text-muted-foreground">
            Полный пробный ЕНТ можно сдавать бесплатно каждый день. Тариф открывает разбор каждой
            ошибки, тренировку слабых тем и AI-план — всё, чтобы добрать баллы до гранта.
          </p>
        </Reveal>

        {/* Free tier highlight */}
        <Reveal delay={60} className="mt-10 rounded-2xl border-2 border-accent/30 bg-accent/5 p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-start gap-4">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-accent/15">
                <Gift className="h-5 w-5 text-accent" aria-hidden="true" />
              </div>
              <div>
                <p className="font-semibold text-foreground">Пробный ЕНТ бесплатно — каждый день</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Полный тест в реальном формате · 140 вопросов · таймер · балл по предметам и шанс на грант. Без карты и оплаты.
                </p>
              </div>
            </div>
            <ConversionLink
              href={loginHref(START_ENT_PATH, "pricing-free")}
              placement="pricing_free"
              className="inline-flex shrink-0 items-center gap-2 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
            >
              <Gift className="h-4 w-4" aria-hidden="true" />
              Получить бесплатно
            </ConversionLink>
          </div>
        </Reveal>

        <div className="mx-auto mt-8 grid max-w-5xl gap-4 md:grid-cols-3">
          {plans.map((plan, index) => (
            <Reveal
              as="article"
              key={plan.code}
              delay={index * 80}
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
              </div>

              <div className="mt-5">
                <div className="mt-1 flex items-baseline gap-1.5 whitespace-nowrap">
                  <span className="text-4xl font-semibold tracking-tight tabular-nums lg:text-[2.35rem] xl:text-[2.75rem]">
                    {plan.price}
                  </span>
                  <span
                    className={[
                      "text-base font-semibold",
                      plan.highlighted ? "text-background/70" : "text-muted-foreground",
                    ].join(" ")}
                  >
                    ₸
                  </span>
                </div>
                <div
                  className={[
                    "mt-1 text-xs font-medium",
                    plan.highlighted ? "text-background/70" : "text-muted-foreground",
                  ].join(" ")}
                >
                  {plan.period}
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

              <ConversionLink
                href={plan.href}
                placement={`pricing_${plan.code}`}
                className={[
                  "press mt-7 inline-flex items-center justify-center rounded-full px-5 py-3 text-sm font-semibold transition-[opacity,transform]",
                  plan.highlighted
                    ? "bg-accent text-accent-foreground hover:opacity-90"
                    : "bg-foreground text-background hover:opacity-90",
                ].join(" ")}
              >
                {plan.cta}
              </ConversionLink>
            </Reveal>
          ))}
        </div>

        <div className="mt-10 flex flex-col items-center gap-2 text-center">
          <p className="text-sm text-muted-foreground">
            Цены в тенге. Оплата через Kaspi или картой Visa / Mastercard. Без автопродления.
          </p>
        </div>
      </div>
    </section>
  )
}
