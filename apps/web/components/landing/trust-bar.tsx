"use client"

import { useLandingProof } from "@/lib/api/landing"

export function TrustBar() {
  const { data } = useLandingProof()
  const stats = data
    ? [
        {
          value: data.registeredStudents.toLocaleString("ru-RU"),
          label: "учеников зарегистрировано",
        },
        {
          value: data.completedTrials.toLocaleString("ru-RU"),
          label: "пробных ЕНТ завершено",
        },
        {
          value: data.activeQuestions.toLocaleString("ru-RU"),
          label: "активных заданий в базе",
        },
        {
          value: data.completedTrials30d.toLocaleString("ru-RU"),
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
        <p className="text-center text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
          {data ? "Цифры платформы — автоматически из реальных данных" : "Формат пробного ЕНТ"}
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
