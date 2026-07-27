"use client"

import { useMemo, useRef, useState } from "react"
import { ArrowRight, Check, Gauge, Sparkles, Target } from "lucide-react"
import { recordPublicFunnelEvent } from "@/lib/api/analytics"
import { ConversionLink } from "./conversion-link"

const profiles = [
  "Математика — Физика",
  "Математика — Информатика",
  "Биология — Химия",
  "Биология — География",
  "Иностранный язык — Всемирная история",
  "География — Иностранный язык",
]

function getPlan(gap: number) {
  if (gap <= 0) {
    return {
      name: "Режим закрепления",
      cadence: "1 пробный в неделю",
      focus: "стабильность результата и работа с редкими ошибками",
      tone: "Ты уже на целевом уровне. Важно удержать балл под таймером.",
    }
  }
  if (gap <= 10) {
    return {
      name: "Точечный спринт",
      cadence: "2 пробных в неделю",
      focus: "2–3 слабые темы с максимальной потерей баллов",
      tone: "Цель близко: нужен точный разбор, а не ещё один сборник задач.",
    }
  }
  if (gap <= 25) {
    return {
      name: "Системный маршрут",
      cadence: "3 пробных за 2 недели",
      focus: "диагностика тем, повторение и контрольный пересчёт",
      tone: "Реалистичный разрыв, если готовиться по данным своих попыток.",
    }
  }
  return {
    name: "Интенсивный маршрут",
    cadence: "2 полноценных цикла в неделю",
    focus: "база обязательных тем, тайминг и приоритетные задания",
    tone: "Начни с честной точки A — первый пробный покажет, где быстрее всего взять баллы.",
  }
}

export function Diagnostic() {
  const [currentScore, setCurrentScore] = useState(78)
  const [targetScore, setTargetScore] = useState(105)
  const [profile, setProfile] = useState(profiles[0])
  const [completed, setCompleted] = useState(false)
  const startedRef = useRef(false)
  const gap = Math.max(0, targetScore - currentScore)
  const plan = useMemo(() => getPlan(targetScore - currentScore), [currentScore, targetScore])

  const markStarted = () => {
    if (startedRef.current) return
    startedRef.current = true
    void recordPublicFunnelEvent("diagnostic_started", { placement: "landing_diagnostic" })
  }

  const complete = () => {
    markStarted()
    setCompleted(true)
    void recordPublicFunnelEvent("diagnostic_completed", {
      profile,
      currentScore,
      targetScore,
      gap,
      plan: plan.name,
    })
  }

  const loginHref = `/login?source=diagnostic&score=${currentScore}&target=${targetScore}`

  return (
    <section id="diagnostic" className="border-b border-border/60 bg-foreground text-background">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="grid gap-10 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <div className="lg:sticky lg:top-28">
            <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-accent">
              <Sparkles className="size-4" />
              Бесплатная диагностика · 60 секунд
            </span>
            <h2 className="mt-5 text-balance text-4xl font-semibold tracking-tight sm:text-5xl">
              Не покупай подготовку{" "}
              <span className="font-serif font-normal italic text-accent">вслепую.</span>
            </h2>
            <p className="mt-5 max-w-xl text-pretty text-base leading-relaxed text-background/65">
              Укажи текущий и целевой балл. Мы покажем размер разрыва и подходящий
              ритм подготовки ещё до регистрации.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-background/10 bg-background/[0.06] p-4">
                <Gauge className="size-5 text-accent" />
                <div className="mt-3 text-2xl font-semibold tabular-nums">{gap}</div>
                <div className="mt-1 text-xs text-background/55">баллов до цели</div>
              </div>
              <div className="rounded-2xl border border-background/10 bg-background/[0.06] p-4">
                <Target className="size-5 text-accent" />
                <div className="mt-3 text-2xl font-semibold tabular-nums">{targetScore}</div>
                <div className="mt-1 text-xs text-background/55">твоя цель</div>
              </div>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-background/12 bg-background text-foreground shadow-[0_40px_100px_-40px_oklch(0_0_0_/_0.65)]">
            <div className="border-b border-border px-5 py-4 sm:px-8">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    Персональный маршрут
                  </div>
                  <div className="mt-1 text-lg font-semibold">Точка A → целевой балл</div>
                </div>
                <span className="rounded-full bg-accent/10 px-3 py-1.5 text-xs font-semibold text-accent">
                  Без телефона
                </span>
              </div>
            </div>

            <div className="space-y-7 p-5 sm:p-8">
              <label className="block">
                <span className="flex items-center justify-between text-sm font-semibold">
                  Текущий балл
                  <output className="rounded-lg bg-secondary px-3 py-1 font-mono text-lg">
                    {currentScore}
                  </output>
                </span>
                <input
                  type="range"
                  min={0}
                  max={140}
                  value={currentScore}
                  onFocus={markStarted}
                  onChange={(event) => {
                    markStarted()
                    setCompleted(false)
                    setCurrentScore(Number(event.target.value))
                  }}
                  className="mt-4 w-full accent-[oklch(0.65_0.18_35)]"
                />
                <span className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>0</span>
                  <span>140</span>
                </span>
              </label>

              <label className="block">
                <span className="flex items-center justify-between text-sm font-semibold">
                  Целевой балл
                  <output className="rounded-lg bg-secondary px-3 py-1 font-mono text-lg">
                    {targetScore}
                  </output>
                </span>
                <input
                  type="range"
                  min={50}
                  max={140}
                  value={targetScore}
                  onFocus={markStarted}
                  onChange={(event) => {
                    markStarted()
                    setCompleted(false)
                    setTargetScore(Number(event.target.value))
                  }}
                  className="mt-4 w-full accent-[oklch(0.65_0.18_35)]"
                />
                <span className="mt-2 flex justify-between text-xs text-muted-foreground">
                  <span>50</span>
                  <span>140</span>
                </span>
              </label>

              <label className="block text-sm font-semibold">
                Профильные предметы
                <select
                  value={profile}
                  onFocus={markStarted}
                  onChange={(event) => {
                    markStarted()
                    setCompleted(false)
                    setProfile(event.target.value)
                  }}
                  className="mt-2 h-12 w-full rounded-xl border border-input bg-background px-4 text-sm outline-none focus:ring-2 focus:ring-ring"
                >
                  {profiles.map((item) => (
                    <option key={item}>{item}</option>
                  ))}
                </select>
              </label>

              {!completed ? (
                <button
                  type="button"
                  onClick={complete}
                  className="group inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-6 text-sm font-semibold text-background transition-opacity hover:opacity-90"
                >
                  Собрать мой маршрут
                  <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                </button>
              ) : (
                <div className="animate-in fade-in slide-in-from-bottom-2 rounded-2xl border border-accent/25 bg-accent/[0.06] p-5 duration-300">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-wider text-accent">
                        Рекомендация
                      </div>
                      <h3 className="mt-2 text-2xl font-semibold">{plan.name}</h3>
                    </div>
                    <span className="rounded-full bg-accent px-3 py-1 text-sm font-bold text-accent-foreground">
                      {gap > 0 ? `${gap} до цели` : "Цель взята"}
                    </span>
                  </div>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">{plan.tone}</p>
                  <ul className="mt-4 space-y-2 text-sm">
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      Ритм: {plan.cadence}
                    </li>
                    <li className="flex gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-accent" />
                      Фокус: {plan.focus}
                    </li>
                  </ul>
                  <ConversionLink
                    href={loginHref}
                    placement="diagnostic_result"
                    className="group mt-5 inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90"
                  >
                    Проверить точку A бесплатно
                    <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5" />
                  </ConversionLink>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
