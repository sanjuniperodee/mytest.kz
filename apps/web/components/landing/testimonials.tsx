import { ArrowRight, HeartHandshake, School, UserRound } from "lucide-react"
import { ConversionLink } from "./conversion-link"

const audiences = [
  {
    icon: UserRound,
    eyebrow: "Ученику",
    title: "Понимать, где теряются баллы",
    text: "Не «заниматься больше», а видеть слабые темы, разбирать ошибки и проверять рост следующим пробным.",
    points: ["Реальный формат и таймер", "Разбор каждого ответа", "Динамика по попыткам"],
    cta: "Начать бесплатно",
    href: "/login?source=audience-student",
    placement: "audience_student",
  },
  {
    icon: HeartHandshake,
    eyebrow: "Родителю",
    title: "Видеть прогресс без ежедневного контроля",
    text: "Результат в баллах и темах понятнее, чем часы за учебниками. Можно обсуждать конкретный следующий шаг.",
    points: ["Прозрачный результат", "План слабых тем", "Оплата без скрытой подписки"],
    cta: "Посмотреть тарифы",
    href: "#pricing",
    placement: "audience_parent",
  },
  {
    icon: School,
    eyebrow: "Школе и учителю",
    title: "Быстро диагностировать класс",
    text: "Пробный помогает увидеть общие пробелы группы и не тратить урок на темы, которые большинство уже знает.",
    points: ["Единый формат проверки", "Срез по предметам", "Условия для классов"],
    cta: "Обсудить подключение",
    href: "#lead",
    placement: "audience_school",
  },
]

export function Testimonials() {
  return (
    <section id="reviews" className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-3xl">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              Для кого mytest
            </span>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Один результат.{" "}
              <span className="font-serif font-normal italic">Три понятные пользы.</span>
            </h2>
          </div>
          <p className="max-w-sm text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            Вместо громких обещаний — конкретно, что меняется после первой попытки.
          </p>
        </div>

        <div className="mt-12 grid gap-4 lg:grid-cols-3">
          {audiences.map((audience, index) => (
            <article
              key={audience.eyebrow}
              className={[
                "flex min-h-[28rem] flex-col rounded-3xl border p-6 sm:p-8",
                index === 0
                  ? "border-foreground bg-foreground text-background"
                  : "border-border bg-background",
              ].join(" ")}
            >
              <span
                className={[
                  "flex size-12 items-center justify-center rounded-2xl",
                  index === 0 ? "bg-accent text-accent-foreground" : "bg-accent/10 text-accent",
                ].join(" ")}
              >
                <audience.icon className="size-6" />
              </span>
              <div
                className={[
                  "mt-8 text-xs font-semibold uppercase tracking-[0.16em]",
                  index === 0 ? "text-accent" : "text-muted-foreground",
                ].join(" ")}
              >
                {audience.eyebrow}
              </div>
              <h3 className="mt-3 text-2xl font-semibold tracking-tight">{audience.title}</h3>
              <p
                className={[
                  "mt-4 text-sm leading-relaxed",
                  index === 0 ? "text-background/65" : "text-muted-foreground",
                ].join(" ")}
              >
                {audience.text}
              </p>
              <ul className="mt-6 space-y-3 text-sm">
                {audience.points.map((point) => (
                  <li key={point} className="flex items-center gap-2.5">
                    <span className="size-1.5 rounded-full bg-accent" />
                    {point}
                  </li>
                ))}
              </ul>
              <ConversionLink
                href={audience.href}
                placement={audience.placement}
                className={[
                  "group mt-auto inline-flex items-center gap-2 pt-8 text-sm font-semibold",
                  index === 0 ? "text-background" : "text-foreground",
                ].join(" ")}
              >
                {audience.cta}
                <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
              </ConversionLink>
            </article>
          ))}
        </div>
      </div>
    </section>
  )
}
