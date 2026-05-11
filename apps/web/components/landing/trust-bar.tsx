const stats = [
  { value: "12 000+", label: "школьников готовятся" },
  { value: "1 400+", label: "пробных ЕНТ за месяц" },
  { value: "92%", label: "сдают выше своего прошлого пробного" },
  { value: "4.9 / 5", label: "оценка от учеников" },
]

export function TrustBar() {
  return (
    <section className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          Готовятся школьники из Алматы, Астаны, Шымкента и ещё 87 городов
        </p>
        <div className="mt-8 grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {stats.map((s) => (
            <div key={s.label} className="text-center">
              <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {s.value}
              </div>
              <div className="mx-auto mt-1.5 max-w-[20ch] text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {s.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
