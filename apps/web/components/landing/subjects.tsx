const subjects = [
  { letter: "М", name: "Математика", count: "1 240 заданий" },
  { letter: "Ф", name: "Физика", count: "980 заданий" },
  { letter: "Х", name: "Химия", count: "860 заданий" },
  { letter: "Б", name: "Биология", count: "1 020 заданий" },
  { letter: "Г", name: "География", count: "740 заданий" },
  { letter: "И", name: "История Казахстана", count: "1 460 заданий" },
  { letter: "В", name: "Всемирная история", count: "620 заданий" },
  { letter: "А", name: "Английский язык", count: "910 заданий" },
  { letter: "Қ", name: "Қазақ тілі", count: "1 100 заданий" },
  { letter: "Р", name: "Русский язык", count: "880 заданий" },
  { letter: "Г", name: "Грамотность чтения", count: "540 заданий" },
  { letter: "М", name: "Мат. грамотность", count: "470 заданий" },
]

export function Subjects() {
  return (
    <section id="subjects" className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="flex flex-col items-start justify-between gap-6 md:flex-row md:items-end">
          <div className="max-w-2xl">
            <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
              Предметы
            </span>
            <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Все предметы ЕНТ —{" "}
              <span className="font-serif italic font-normal">в одном месте.</span>
            </h2>
          </div>
          <p className="max-w-md text-pretty text-sm leading-relaxed text-muted-foreground sm:text-base">
            База обновляется каждый месяц по официальной программе МОН РК. Без устаревших
            заданий 2018-го, как у репетиторов за «недорого».
          </p>
        </div>

        <ul className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
          {subjects.map((s) => (
            <li key={s.name}>
              <a
                href="#start"
                className="group flex items-center gap-3 rounded-xl border border-border bg-background p-4 transition-all hover:border-foreground/40 hover:shadow-[0_8px_30px_-12px_oklch(0.18_0.012_60_/_0.25)]"
              >
                <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-foreground text-lg font-semibold text-background transition-colors group-hover:bg-accent group-hover:text-accent-foreground">
                  {s.letter}
                </span>
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{s.name}</div>
                  <div className="text-xs text-muted-foreground">{s.count}</div>
                </div>
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
