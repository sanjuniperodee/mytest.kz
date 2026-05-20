import Link from "next/link"
import { ArrowRight, CheckCircle2, Clock, Star } from "lucide-react"
import { ExamPreview } from "./exam-preview"

export function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border/60">
      <div className="absolute inset-0 grain opacity-60" aria-hidden="true" />
      <div className="relative mx-auto grid max-w-7xl gap-12 px-4 pb-16 pt-12 sm:px-6 md:pt-20 lg:grid-cols-12 lg:gap-8 lg:pb-24 lg:pt-24">
        <div className="lg:col-span-7">
          <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/60 px-3 py-1.5 text-xs font-medium text-muted-foreground">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-accent opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-accent" />
            </span>
            Подготовка к ЕНТ 2026 · Premium-разбор ошибок
          </div>

          <h1 className="mt-6 text-balance text-[clamp(2.4rem,6.5vw,4.6rem)] font-semibold leading-[1.02] tracking-tight">
            Сдай пробный ЕНТ{" "}
            <span className="font-serif italic font-normal text-accent">так же,</span>{" "}
            как настоящий — только{" "}
            <span className="font-serif italic font-normal">без последствий.</span>
          </h1>

          <p className="mt-6 max-w-xl text-pretty text-base leading-relaxed text-muted-foreground sm:text-lg">
            Сдаёшь пробный в реальном формате и получаешь не только балл, а
            подробное объяснение к каждому вопросу: почему правильный ответ именно
            такой, где ты ошибся и что подтянуть дальше.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
            <Link
              href="/login"
              className="group inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3.5 text-sm font-semibold text-background transition-all hover:opacity-90 sm:text-base"
            >
              Начать пробный ЕНТ
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
            </Link>
            <a
              href="#how"
              className="inline-flex items-center justify-center gap-2 rounded-full border border-border bg-background px-6 py-3.5 text-sm font-semibold text-foreground transition-colors hover:bg-secondary sm:text-base"
            >
              Как это работает
            </a>
          </div>

          <ul className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-muted-foreground">
            <li className="inline-flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-accent" />
              Premium-разбор после сдачи
            </li>
            <li className="inline-flex items-center gap-2">
              <Clock className="h-4 w-4 text-accent" />
              Таймер как на ЕНТ
            </li>
            <li className="inline-flex items-center gap-2">
              <Star className="h-4 w-4 text-accent" />
              4.9 / 5 у школьников
            </li>
          </ul>
        </div>

        <div className="relative lg:col-span-5">
          <div className="absolute -left-6 -top-6 hidden h-32 w-32 rounded-full bg-accent/10 blur-2xl lg:block" aria-hidden="true" />
          <div className="absolute -bottom-6 -right-6 hidden h-40 w-40 rounded-full bg-foreground/5 blur-2xl lg:block" aria-hidden="true" />
          <div className="relative">
            <ExamPreview />
          </div>
        </div>
      </div>
    </section>
  )
}
