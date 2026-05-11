import { BookOpen, ClipboardList, LineChart } from "lucide-react"

const steps = [
  {
    n: "01",
    icon: ClipboardList,
    title: "Выбираешь профиль",
    text: "Математика-Физика, ИЯ-ВИ, География-Биология — все 12 комбинаций ЕНТ. Один клик — и тест готов.",
  },
  {
    n: "02",
    icon: BookOpen,
    title: "Сдаёшь как настоящий ЕНТ",
    text: "240 минут, 140 заданий, формат 1:1 с экзаменом. Таймер, навигация по вопросам, отметка для возврата.",
  },
  {
    n: "03",
    icon: LineChart,
    title: "Получаешь разбор и план",
    text: "Балл сразу. По каждому вопросу — решение. По темам — где провисаешь и что подтянуть до следующего пробного.",
  },
]

export function HowItWorks() {
  return (
    <section id="how" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="max-w-3xl">
          <span className="text-xs font-medium uppercase tracking-[0.18em] text-accent">
            Как это работает
          </span>
          <h2 className="mt-4 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
            Три шага между «боюсь экзамена» и{" "}
            <span className="font-serif italic font-normal">«знаю свой балл»</span>.
          </h2>
        </div>

        <ol className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-border bg-border md:grid-cols-3">
          {steps.map((s) => (
            <li key={s.n} className="bg-background p-7 sm:p-9">
              <div className="flex items-center justify-between">
                <span className="font-mono text-sm font-medium text-muted-foreground">
                  {s.n}
                </span>
                <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent/10 text-accent">
                  <s.icon className="h-5 w-5" />
                </span>
              </div>
              <h3 className="mt-6 text-xl font-semibold tracking-tight">{s.title}</h3>
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground sm:text-base">
                {s.text}
              </p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  )
}
