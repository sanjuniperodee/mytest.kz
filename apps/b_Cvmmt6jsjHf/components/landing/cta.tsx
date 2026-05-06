"use client"

import { ArrowRight } from "lucide-react"

export function CTA() {
  return (
    <section id="start" className="border-b border-border/60">
      <div className="mx-auto max-w-7xl px-4 py-20 sm:px-6 sm:py-28">
        <div className="relative overflow-hidden rounded-3xl bg-foreground px-6 py-16 text-background sm:px-12 sm:py-24">
          <div
            className="absolute inset-0 grain opacity-[0.18]"
            aria-hidden="true"
          />
          <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-accent/30 blur-3xl" aria-hidden="true" />
          <div className="absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-accent/15 blur-3xl" aria-hidden="true" />

          <div className="relative mx-auto max-w-3xl text-center">
            <span className="inline-block text-xs font-medium uppercase tracking-[0.2em] text-accent">
              До ЕНТ 2026 — 184 дня
            </span>
            <h2 className="mt-5 text-balance text-4xl font-semibold leading-[1.05] tracking-tight sm:text-6xl">
              Не угадывай свой балл.{" "}
              <span className="font-serif italic font-normal">Узнай его.</span>
            </h2>
            <p className="mx-auto mt-6 max-w-xl text-pretty text-base leading-relaxed text-background/70 sm:text-lg">
              Первый пробный — бесплатно, без карты, без подвоха. 240 минут — и ты
              точно знаешь, где стоишь.
            </p>

            <form
              className="mx-auto mt-10 flex max-w-md flex-col gap-2 sm:flex-row"
              onSubmit={(e) => e.preventDefault()}
            >
              <label htmlFor="cta-email" className="sr-only">
                Email
              </label>
              <input
                id="cta-email"
                type="email"
                required
                placeholder="твой@email.kz"
                className="h-12 w-full rounded-full border border-background/20 bg-background/10 px-5 text-sm text-background placeholder:text-background/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
              />
              <button
                type="submit"
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground hover:opacity-90"
              >
                Начать пробный
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
            </form>

            <p className="mt-4 text-xs text-background/60">
              Регистрируясь, ты соглашаешься с{" "}
              <a href="#" className="underline underline-offset-4">
                условиями
              </a>{" "}
              и{" "}
              <a href="#" className="underline underline-offset-4">
                политикой конфиденциальности
              </a>
              .
            </p>
          </div>
        </div>
      </div>
    </section>
  )
}
