"use client"

import { useLandingProof } from "@/lib/api/landing"
import { CountUp } from "@/components/motion/count-up"
import { Reveal } from "@/components/motion/reveal"

export function TrustBar() {
  const { data } = useLandingProof()
  const stats = data
    ? [
        {
          value: <CountUp value={data.registeredStudents} />,
          label: "учеников зарегистрировано",
        },
        {
          value: <CountUp value={data.completedTrials} />,
          label: "пробных ЕНТ завершено",
        },
        {
          value: <CountUp value={data.activeQuestions} />,
          label: "активных заданий в базе",
        },
        {
          value: <CountUp value={data.completedTrials30d} />,
          label: "попыток за последние 30 дней",
        },
      ]
    : [
        { value: "140", label: "вопросов в полном пробном ЕНТ" },
        { value: "240 мин", label: "таймер как на настоящем экзамене" },
        { value: "2 языка", label: "русский и қазақ тілі" },
        { value: "1 бесплатно", label: "после регистрации без карты" },
      ]

  return (
    <section className="border-b border-border/60 bg-secondary/40">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 sm:py-12">
        <Reveal as="p" className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {data ? "Цифры платформы — автоматически из реальных данных" : "Формат пробного ЕНТ"}
        </Reveal>
        <div className="mt-8 grid grid-cols-2 gap-y-8 sm:grid-cols-4">
          {stats.map((s, i) => (
            <Reveal key={s.label} delay={i * 70} className="text-center">
              <div className="text-3xl font-semibold tracking-tight sm:text-4xl">
                {s.value}
              </div>
              <div className="mx-auto mt-1.5 max-w-[20ch] text-pretty text-xs leading-relaxed text-muted-foreground sm:text-sm">
                {s.label}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
