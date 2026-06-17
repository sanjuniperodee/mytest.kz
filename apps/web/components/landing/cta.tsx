"use client"

import { useState } from "react"
import type { FormEvent } from "react"
import { ArrowRight, CheckCircle2 } from "lucide-react"
import { api, ApiError } from "@/lib/api/client"

type LeadStatus = "idle" | "success" | "error"

export function CTA() {
  const [name, setName] = useState("")
  const [phone, setPhone] = useState("")
  const [message, setMessage] = useState("")
  const [status, setStatus] = useState<LeadStatus>("idle")
  const [error, setError] = useState("")
  const [submitting, setSubmitting] = useState(false)

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (submitting) return

    const trimmedName = name.trim()
    const trimmedPhone = phone.trim()
    const trimmedMessage = message.trim()

    if (trimmedName.length < 2 || trimmedPhone.length < 5) {
      setStatus("error")
      setError("Укажите имя и корректный номер телефона.")
      return
    }

    setSubmitting(true)
    setStatus("idle")
    setError("")
    try {
      await api<{ ok: true }>("/leads", {
        method: "POST",
        auth: false,
        body: {
          name: trimmedName,
          phone: trimmedPhone,
          message: trimmedMessage || undefined,
          source: "mytest-v2-landing",
        },
      })
      setName("")
      setPhone("")
      setMessage("")
      setStatus("success")
    } catch (err) {
      setStatus("error")
      setError(err instanceof ApiError ? err.message : "Не удалось отправить заявку.")
    } finally {
      setSubmitting(false)
    }
  }

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
              Разовый доступ открывает полный пробный ЕНТ, подробный разбор и
              понятную картину, где ты стоишь.
            </p>

            <form
              id="lead"
              className="mx-auto mt-10 grid max-w-2xl gap-3 text-left sm:grid-cols-2"
              onSubmit={handleSubmit}
            >
              <label className="flex flex-col gap-1.5">
                <span className="px-1 text-xs font-medium text-background/70">Имя</span>
                <input
                  type="text"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  required
                  minLength={2}
                  maxLength={100}
                  autoComplete="name"
                  placeholder="Айдана"
                  className="h-12 w-full rounded-full border border-background/20 bg-background/10 px-5 text-sm text-background placeholder:text-background/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="px-1 text-xs font-medium text-background/70">Телефон</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  required
                  minLength={5}
                  maxLength={30}
                  autoComplete="tel"
                  placeholder="+7 700 000 00 00"
                  className="h-12 w-full rounded-full border border-background/20 bg-background/10 px-5 text-sm text-background placeholder:text-background/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="px-1 text-xs font-medium text-background/70">
                  Комментарий
                </span>
                <textarea
                  value={message}
                  onChange={(event) => setMessage(event.target.value)}
                  maxLength={1000}
                  rows={3}
                  placeholder="Например: хочу подключить класс или узнать про тарифы"
                  className="min-h-24 w-full resize-none rounded-3xl border border-background/20 bg-background/10 px-5 py-3 text-sm text-background placeholder:text-background/50 focus:border-accent focus:outline-none focus:ring-2 focus:ring-accent/40"
                />
              </label>
              <button
                type="submit"
                disabled={submitting}
                className="group inline-flex h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-sm font-semibold text-accent-foreground transition-opacity hover:opacity-90 disabled:pointer-events-none disabled:opacity-60 sm:col-span-2"
              >
                {submitting ? "Отправляем..." : "Оставить заявку"}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </button>
              {status === "success" && (
                <p
                  role="status"
                  className="flex items-center justify-center gap-2 text-center text-sm font-medium text-accent sm:col-span-2"
                >
                  <CheckCircle2 className="size-4" />
                  Заявка отправлена. Мы скоро свяжемся с вами.
                </p>
              )}
              {status === "error" && (
                <p
                  role="alert"
                  className="text-center text-sm font-medium text-red-200 sm:col-span-2"
                >
                  {error || "Не удалось отправить заявку."}
                </p>
              )}
            </form>

            <p className="mt-4 text-xs text-background/60">
              Отправляя заявку, ты соглашаешься с{" "}
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
