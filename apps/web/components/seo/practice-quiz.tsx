"use client"

import { useState } from "react"
import Link from "next/link"
import { ArrowRight, CheckCircle2, Gift, RotateCcw, XCircle } from "lucide-react"
import { cn } from "@/lib/utils"

export type PracticeQuizQuestion = {
  passageHtml?: string
  stemHtml: string
  optionsHtml: string[]
  correct: number
  explanationHtml: string
}

const LETTERS = ["A", "B", "C", "D", "E", "F"]

const RICH = "rich-text [&_code]:rounded [&_code]:bg-secondary [&_code]:px-1 [&_code]:font-mono [&_code]:text-[0.9em]"

/**
 * Тест по теме без регистрации. Весь текст (вопросы, варианты, разборы) приходит
 * готовым HTML и есть в серверной разметке — разбор лежит в <details>, клиент лишь
 * отмечает ответы и раскрывает объяснение.
 */
export function PracticeQuiz({ questions, ctaHref }: { questions: PracticeQuizQuestion[]; ctaHref: string }) {
  const [answers, setAnswers] = useState<(number | null)[]>(() => questions.map(() => null))
  const [open, setOpen] = useState<boolean[]>(() => questions.map(() => false))

  const answered = answers.filter((a) => a !== null).length
  const score = answers.filter((a, i) => a === questions[i].correct).length
  const done = answered === questions.length

  const choose = (qi: number, oi: number) => {
    if (answers[qi] !== null) return
    setAnswers((prev) => prev.map((a, i) => (i === qi ? oi : a)))
    setOpen((prev) => prev.map((o, i) => (i === qi ? true : o)))
  }

  const reset = () => {
    setAnswers(questions.map(() => null))
    setOpen(questions.map(() => false))
  }

  return (
    <div className="flex flex-col gap-5">
      <ol className="flex flex-col gap-5">
        {questions.map((q, qi) => {
          const picked = answers[qi]
          const isAnswered = picked !== null
          return (
            <li key={qi} className="rounded-2xl border border-border bg-card p-5 sm:p-6">
              <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-muted-foreground">
                Вопрос {qi + 1} из {questions.length}
              </p>
              {q.passageHtml && (
                <div
                  className={cn(RICH, "mb-4 block rounded-xl bg-secondary/60 p-4 text-sm leading-relaxed")}
                  dangerouslySetInnerHTML={{ __html: q.passageHtml }}
                />
              )}
              <div
                className={cn(RICH, "block text-base font-medium leading-relaxed sm:text-lg")}
                dangerouslySetInnerHTML={{ __html: q.stemHtml }}
              />
              <div className="mt-4 grid gap-2" role="group" aria-label={`Варианты ответа на вопрос ${qi + 1}`}>
                {q.optionsHtml.map((html, oi) => {
                  const isCorrect = oi === q.correct
                  const isPicked = oi === picked
                  return (
                    <button
                      key={oi}
                      type="button"
                      onClick={() => choose(qi, oi)}
                      disabled={isAnswered}
                      aria-pressed={isPicked}
                      className={cn(
                        "flex w-full items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors",
                        !isAnswered && "border-border bg-background hover:border-foreground/40 hover:bg-secondary/50",
                        isAnswered && isCorrect && "border-emerald-500 bg-emerald-50 text-emerald-950 dark:bg-emerald-950/40 dark:text-emerald-50",
                        isAnswered && isPicked && !isCorrect && "border-rose-300 bg-rose-50 text-rose-900 dark:bg-rose-950/40 dark:text-rose-50",
                        isAnswered && !isCorrect && !isPicked && "border-border bg-background opacity-60",
                      )}
                    >
                      <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md border border-current/20 text-xs font-semibold">
                        {LETTERS[oi]}
                      </span>
                      <span className={cn(RICH, "min-w-0 flex-1 leading-relaxed")} dangerouslySetInnerHTML={{ __html: html }} />
                      {isAnswered && isCorrect && <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600" aria-label="Верно" />}
                      {isAnswered && isPicked && !isCorrect && <XCircle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" aria-label="Неверно" />}
                    </button>
                  )
                })}
              </div>
              <details
                open={open[qi]}
                onToggle={(e) => {
                  const next = e.currentTarget.open
                  setOpen((prev) => (prev[qi] === next ? prev : prev.map((o, i) => (i === qi ? next : o))))
                }}
                className="group mt-4 rounded-xl border border-border/70 bg-secondary/30 px-4 py-3"
              >
                <summary className="cursor-pointer select-none text-sm font-medium text-muted-foreground hover:text-foreground">
                  {isAnswered ? (picked === q.correct ? "Верно! Разбор" : "Разбор ответа") : "Показать ответ и объяснение"}
                </summary>
                <div className="mt-3 text-sm leading-relaxed">
                  <p className="font-semibold">Правильный ответ: {LETTERS[q.correct]}</p>
                  <div className={cn(RICH, "mt-1 block text-muted-foreground")} dangerouslySetInnerHTML={{ __html: q.explanationHtml }} />
                </div>
              </details>
            </li>
          )
        })}
      </ol>

      {/* Прилипает к низу экрана только после первого ответа — до этого не закрывает вопросы. */}
      <div
        className={cn(
          "z-20 rounded-2xl border border-border bg-background/95 p-4 backdrop-blur sm:p-5",
          answered > 0 && "sticky bottom-3 shadow-lg",
        )}
      >
        {done ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-lg font-semibold">
                Результат: {score} из {questions.length}
              </p>
              <p className="text-sm text-muted-foreground">
                На ЕНТ такие темы смешаны в одном тесте на время. Проверь себя в полном формате.
              </p>
            </div>
            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={reset}
                className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2.5 text-sm font-semibold hover:bg-secondary"
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                Ещё раз
              </button>
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2 rounded-full bg-foreground px-5 py-2.5 text-sm font-semibold text-background hover:opacity-90"
              >
                <Gift className="h-4 w-4" aria-hidden="true" />
                Пробный ЕНТ бесплатно
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium">
                Отвечено {answered} из {questions.length}
                {answered > 0 && <span className="text-muted-foreground"> · верно {score}</span>}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-secondary">
                <div
                  className="h-full rounded-full bg-accent transition-[width]"
                  style={{ width: `${(answered / questions.length) * 100}%` }}
                />
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
