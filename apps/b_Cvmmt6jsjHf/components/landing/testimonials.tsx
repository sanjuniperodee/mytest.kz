import { Star } from "lucide-react"

const items = [
  {
    quote:
      "После третьего пробного увидела, что валю стереометрию. За месяц повторила, на ЕНТ — 132 балла. КазНУ, грант. Без репетитора.",
    name: "Айдана М.",
    school: "11 класс · Алматы",
    score: "132",
  },
  {
    quote:
      "Раньше готовился по PDF-сборникам 2019 года. Здесь формат точь-в-точь как на экзамене, и сразу видно, что я зря тратил время на лёгкие темы.",
    name: "Ерасыл К.",
    school: "11 класс · Астана",
    score: "118",
  },
  {
    quote:
      "Дочка боялась таймера. Прошла 5 пробных — привыкла. Пришла на ЕНТ спокойная, написала на 124. Мы дома плакали от счастья.",
    name: "Гульнара А.",
    school: "Мама выпускницы · Шымкент",
    score: "124",
  },
  {
    quote:
      "История Казахстана — мой кошмар. Адаптивный режим вытащил. За 2 недели с 14/30 поднялся до 27/30. Серьёзно работает.",
    name: "Данияр Б.",
    school: "11 класс · Караганда",
    score: "127",
  },
  {
    quote:
      "Сдавала пробные на телефоне в автобусе по дороге в школу. Удобно, что прогресс синхронизируется. Балл на ЕНТ — 135.",
    name: "Аружан Т.",
    school: "11 класс · Актобе",
    score: "135",
  },
  {
    quote:
      "Аналитика по темам — это золото. Я думал, что хорошо знаю физику, а оказалось — провисал в электричестве. Подтянул и закрыл.",
    name: "Тимур Н.",
    school: "11 класс · Павлодар",
    score: "129",
  },
]

export function Testimonials() {
  return (
    <section id="reviews" className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              Отзывы
            </span>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Это работает.{" "}
              <span className="font-serif italic font-normal">У них сработало.</span>
            </h2>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star
                  key={i}
                  className="h-5 w-5 fill-accent text-accent"
                  aria-hidden="true"
                />
              ))}
            </div>
            <span className="text-sm text-muted-foreground">
              4.9 / 5 · 2 800+ отзывов
            </span>
          </div>
        </div>

        <ul className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {items.map((t, i) => (
            <li
              key={i}
              className="flex flex-col rounded-2xl border border-border bg-background p-6"
            >
              <div className="flex items-center justify-between">
                <div className="flex">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star
                      key={j}
                      className="h-4 w-4 fill-foreground text-foreground"
                      aria-hidden="true"
                    />
                  ))}
                </div>
                <div className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-semibold tabular-nums text-accent">
                  ЕНТ {t.score}
                </div>
              </div>
              <blockquote className="mt-4 flex-1 text-pretty text-[15px] leading-relaxed">
                {`«${t.quote}»`}
              </blockquote>
              <footer className="mt-5 flex items-center gap-3 border-t border-border/70 pt-4">
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-foreground text-sm font-semibold text-background">
                  {t.name.charAt(0)}
                </span>
                <div className="leading-tight">
                  <div className="text-sm font-semibold">{t.name}</div>
                  <div className="text-xs text-muted-foreground">{t.school}</div>
                </div>
              </footer>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
