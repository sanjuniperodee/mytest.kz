import { Bell, BookCheck, Sparkles, Target, Trophy, Users } from "lucide-react"

export function Features() {
  return (
    <section id="features" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-3xl">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Возможности
          </span>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Не просто тест.{" "}
            <span className="font-serif italic font-normal">Тренажёр</span>, который
            учит думать как на ЕНТ.
          </h2>
        </div>

        {/* Bento grid */}
        <div className="mt-14 grid gap-4 md:grid-cols-6 md:grid-rows-2">
          {/* Big — analytics dashboard */}
          <article className="md:col-span-4 md:row-span-1 flex flex-col overflow-hidden rounded-2xl border border-border bg-card p-7">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent">
              <Target className="h-4 w-4" />
              Аналитика по темам
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight sm:text-3xl">
              Видно, где ты проседаешь — и что подтянуть к следующему пробному.
            </h3>
            <p className="mt-3 max-w-md text-sm leading-relaxed text-muted-foreground">
              По каждому предмету — топ слабых тем, динамика балла и сравнение с
              пороговым значением для твоего вуза.
            </p>

            <div className="mt-6 space-y-3 rounded-xl border border-border bg-secondary/50 p-4 sm:p-5">
              {[
                { topic: "Производная функции", percent: 92, tone: "good" as const },
                { topic: "Векторы в пространстве", percent: 71, tone: "ok" as const },
                { topic: "Логарифмические уравнения", percent: 38, tone: "weak" as const },
                { topic: "Стереометрия", percent: 24, tone: "weak" as const },
              ].map((row) => (
                <div key={row.topic} className="flex items-center gap-3">
                  <span className="w-44 truncate text-xs font-medium sm:w-56 sm:text-sm">
                    {row.topic}
                  </span>
                  <div className="relative h-2 flex-1 overflow-hidden rounded-full bg-background">
                    <div
                      className={[
                        "h-full rounded-full",
                        row.tone === "good"
                          ? "bg-foreground"
                          : row.tone === "ok"
                            ? "bg-foreground/60"
                            : "bg-accent",
                      ].join(" ")}
                      style={{ width: `${row.percent}%` }}
                    />
                  </div>
                  <span className="w-9 text-right text-xs font-semibold tabular-nums">
                    {row.percent}%
                  </span>
                </div>
              ))}
            </div>
          </article>

          {/* Tall — score chart */}
          <article className="md:col-span-2 md:row-span-2 flex flex-col overflow-hidden rounded-2xl bg-foreground p-7 text-background">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-accent">
              <Trophy className="h-4 w-4" />
              Динамика балла
            </div>
            <h3 className="mt-3 text-2xl font-semibold tracking-tight">
              От 87 до 128 — за 6 пробных.
            </h3>
            <p className="mt-3 text-sm leading-relaxed text-background/70">
              Реальная траектория ученицы Айдан. Каждый пробный — +6–8 баллов.
            </p>

            <div className="mt-6 flex-1 rounded-xl bg-background/[0.07] p-5">
              <div className="flex items-end justify-between gap-2 h-40 sm:h-52">
                {[40, 55, 62, 70, 82, 88, 100].map((h, i) => (
                  <div key={i} className="flex flex-1 flex-col items-center gap-2">
                    <div
                      className={[
                        "w-full rounded-t-md transition-all",
                        i === 6 ? "bg-accent" : "bg-background/30",
                      ].join(" ")}
                      style={{ height: `${h}%` }}
                    />
                    <span className="text-[10px] text-background/50">П{i + 1}</span>
                  </div>
                ))}
              </div>
              <div className="mt-5 flex items-baseline justify-between border-t border-background/10 pt-4">
                <div>
                  <div className="text-[11px] uppercase tracking-wider text-background/60">
                    Текущий балл
                  </div>
                  <div className="mt-1 text-3xl font-semibold tracking-tight">128</div>
                </div>
                <div className="rounded-full bg-accent/15 px-2.5 py-1 text-xs font-semibold text-accent">
                  +41
                </div>
              </div>
            </div>
          </article>

          {/* small cards */}
          <FeatureCard
            icon={BookCheck}
            title="Разбор каждой ошибки"
            text="Не просто «правильный ответ B». Полное решение, формулы, ссылки на теорию."
            className="md:col-span-2"
          />
          <FeatureCard
            icon={Sparkles}
            title="Адаптивный режим"
            text="Слабые темы повторяются чаще. Сильные — реже. Готовишься точечно."
            className="md:col-span-1"
          />
          <FeatureCard
            icon={Bell}
            title="Расписание подготовки"
            text="План до дня экзамена. Напоминания в Telegram, чтобы не сорваться."
            className="md:col-span-1"
          />
        </div>

        {/* Live counter strip */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 rounded-2xl border border-border bg-secondary/50 p-5 sm:flex-row sm:p-6">
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
              <Users className="h-5 w-5" />
            </span>
            <div className="leading-tight">
              <div className="text-sm font-semibold">
                Сейчас сдают пробный: <span className="tabular-nums">347</span> учеников
              </div>
              <div className="text-xs text-muted-foreground">обновляется в реальном времени</div>
            </div>
          </div>
          <a
            href="#start"
            className="inline-flex items-center justify-center rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
          >
            Присоединиться
          </a>
        </div>
      </div>
    </section>
  )
}

function FeatureCard({
  icon: Icon,
  title,
  text,
  className,
}: {
  icon: typeof Bell
  title: string
  text: string
  className?: string
}) {
  return (
    <article
      className={[
        "flex flex-col rounded-2xl border border-border bg-card p-6",
        className ?? "",
      ].join(" ")}
    >
      <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
        <Icon className="h-5 w-5" />
      </span>
      <h3 className="mt-5 text-lg font-semibold tracking-tight">{title}</h3>
      <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{text}</p>
    </article>
  )
}
