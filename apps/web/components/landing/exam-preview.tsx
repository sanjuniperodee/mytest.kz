import { CheckCircle2, Flag, Timer } from "lucide-react"

export function ExamPreview() {
  return (
    <div className="relative">
      {/* Floating score card */}
      <div className="absolute -left-4 -top-4 z-20 hidden rounded-2xl border border-border bg-card p-4 shadow-[0_20px_60px_-20px_oklch(0.18_0.012_60_/_0.25)] sm:left-auto sm:right-[-1.5rem] sm:top-[-1.5rem] sm:block">
        <div className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
          Результат
        </div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-3xl font-semibold tracking-tight">128</span>
          <span className="text-sm text-muted-foreground">/ 140</span>
        </div>
        <div className="mt-2 flex items-center gap-1.5 text-xs font-medium text-accent">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-accent" />
          +18 за неделю
        </div>
      </div>

      {/* Floating subject chip */}
      <div className="absolute -bottom-3 left-2 z-20 hidden rounded-xl border border-border bg-card px-3 py-2 shadow-[0_20px_40px_-20px_oklch(0.18_0.012_60_/_0.25)] sm:block">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-accent/10 text-sm font-semibold text-accent">
            М
          </span>
          <div className="leading-tight">
            <div className="text-xs text-muted-foreground">Математика</div>
            <div className="text-sm font-semibold">36 / 40</div>
          </div>
        </div>
      </div>

      {/* Main card — exam UI mockup */}
      <div className="relative overflow-hidden rounded-2xl border border-border bg-card shadow-[0_30px_80px_-30px_oklch(0.18_0.012_60_/_0.35)]">
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-border/70 bg-secondary/40 px-5 py-3">
          <div className="flex items-center gap-2">
            <span className="flex h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="flex h-2.5 w-2.5 rounded-full bg-foreground/15" />
            <span className="flex h-2.5 w-2.5 rounded-full bg-foreground/15" />
          </div>
          <div className="flex items-center gap-2 rounded-full bg-background px-3 py-1 text-xs font-semibold tabular-nums">
            <Timer className="h-3.5 w-3.5 text-accent" />
            02:14:37
          </div>
        </div>

        {/* Question */}
        <div className="px-5 py-6 sm:px-7 sm:py-8">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Математика · Вопрос 14 / 40
            </span>
            <button
              type="button"
              className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
              aria-label="Отметить вопрос"
            >
              <Flag className="h-3.5 w-3.5" />
              Отметить
            </button>
          </div>

          <h3 className="mt-3 text-base font-semibold leading-snug sm:text-lg">
            Найдите наименьшее значение функции{" "}
            <span className="font-mono">y = x² − 6x + 11</span> на отрезке{" "}
            <span className="font-mono">[0; 5]</span>.
          </h3>

          <ul className="mt-5 space-y-2.5">
            {[
              { label: "A", text: "2", state: "correct" as const },
              { label: "B", text: "3", state: "selected" as const },
              { label: "C", text: "5", state: "idle" as const },
              { label: "D", text: "11", state: "idle" as const },
            ].map((opt) => (
              <li key={opt.label}>
                <div
                  className={[
                    "flex items-center gap-3 rounded-xl border px-4 py-3 transition-colors",
                    opt.state === "correct"
                      ? "border-accent/40 bg-accent/8"
                      : opt.state === "selected"
                        ? "border-foreground/80 bg-foreground/[0.04]"
                        : "border-border bg-background/60",
                  ].join(" ")}
                >
                  <span
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-sm font-semibold",
                      opt.state === "correct"
                        ? "bg-accent text-accent-foreground"
                        : opt.state === "selected"
                          ? "bg-foreground text-background"
                          : "bg-secondary text-foreground/70",
                    ].join(" ")}
                  >
                    {opt.label}
                  </span>
                  <span className="text-sm sm:text-base">{opt.text}</span>
                  {opt.state === "correct" && (
                    <span className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-accent">
                      <CheckCircle2 className="h-3.5 w-3.5" />
                      Верно
                    </span>
                  )}
                </div>
              </li>
            ))}
          </ul>

          {/* Progress bar */}
          <div className="mt-7">
            <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
              <span>Прогресс</span>
              <span className="tabular-nums">14 / 40</span>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full rounded-full bg-accent"
                style={{ width: "35%" }}
                aria-hidden="true"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
