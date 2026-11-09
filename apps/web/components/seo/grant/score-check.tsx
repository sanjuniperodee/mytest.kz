"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import Link from "next/link"
import { ArrowRight, Gift, Search } from "lucide-react"
import { recordPublicFunnelEvent } from "@/lib/api/analytics"
import { loginHref, START_ENT_PATH } from "@/lib/api/login-return"
import { ConversionLink } from "@/components/landing/conversion-link"

export type ScoreCheckItem = {
  key: string
  label: string
  href: string
  /** Проходной балл (минимальный среди грантников) за последний год. */
  min: number
  grants: number
}

type Lang = "ru" | "kk"
const tx = (lang: Lang, ru: string, kk: string) => (lang === "kk" ? kk : ru)

function ruPlural(n: number, one: string, few: string, many: string) {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return one
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few
  return many
}

/** Сколько дополнительных баллов показываем как «следующую ступень». */
const STEP = 10
const ENT_MAX = 140
const ENT_THRESHOLD = 50

/**
 * «Введи свой балл — покажем, куда он проходит»: превращает справочную страницу
 * проходных баллов в первый шаг воронки. Ответ — мгновенно и без регистрации;
 * дальше мостик: «не знаешь точный балл — сдай пробный бесплатно», «+10 баллов
 * откроют ещё N вариантов — разбор ошибок покажет, где их взять».
 */
export function ScoreCheck({
  items,
  kind,
  lang,
  source,
  context,
  latestYear,
}: {
  items: ScoreCheckItem[]
  /** Что перечисляем: группы программ (хаб, страница вуза) или вузы (страница программы). */
  kind: "program" | "university"
  lang: Lang
  /** Метка источника для воронки: seo-hub, seo-program, seo-university… */
  source: string
  /** Для заголовка: название программы или вуза. */
  context?: string
  latestYear: number
}) {
  const [raw, setRaw] = useState("")
  const score = parseScore(raw)
  const tracked = useRef(false)

  useEffect(() => {
    if (score == null || tracked.current) return
    const id = window.setTimeout(() => {
      tracked.current = true
      void recordPublicFunnelEvent("diagnostic_completed", { placement: `score_check_${source}`, currentScore: score })
    }, 1200)
    return () => window.clearTimeout(id)
  }, [score, source])

  const result = useMemo(() => {
    if (score == null) return null
    // min = 0 — в последнем году данных нет; такие строки не считаем «проходными».
    const sorted = items.filter((item) => item.min > 0).sort((a, b) => b.grants - a.grants)
    const pass = sorted.filter((item) => item.min <= score)
    const next = sorted.filter((item) => item.min > score && item.min <= score + STEP)
    return { pass, next }
  }, [items, score])

  const noun = (n: number) =>
    kind === "program"
      ? tx(lang, `${n} ${ruPlural(n, "группе программ", "группах программ", "группах программ")}`, `${n} бағдарлама тобы бойынша`)
      : tx(lang, `${n} ${ruPlural(n, "вузе", "вузах", "вузах")}`, `${n} ЖОО-да`)

  return (
    <section
      className="rounded-2xl border border-accent/30 bg-card p-5 shadow-sm sm:p-6"
      aria-labelledby={`score-check-${source}`}
      data-no-translate
    >
      <h2 id={`score-check-${source}`} className="text-xl font-semibold tracking-tight sm:text-2xl">
        {context
          ? tx(lang, `Хватит ли твоих баллов на «${context}»?`, `«${context}» үшін балың жете ме?`)
          : tx(lang, "Хватит ли твоих баллов на грант?", "Балың грантқа жете ме?")}
      </h2>
      <p className="mt-1 text-sm text-muted-foreground">
        {tx(
          lang,
          `Введи свой балл ЕНТ или пробного — сравним с проходными ${latestYear} года.`,
          `ҰБТ немесе сынақ балыңды енгіз — ${latestYear} жылғы өту балдарымен салыстырамыз.`,
        )}
      </p>

      <label className="mt-4 flex max-w-xs items-center gap-2 rounded-full border border-border bg-background px-4 py-2.5 focus-within:ring-2 focus-within:ring-ring">
        <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span className="sr-only">{tx(lang, "Твой балл ЕНТ", "ҰБТ балың")}</span>
        <input
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={3}
          value={raw}
          onChange={(event) => setRaw(event.target.value.replace(/\D/g, "").slice(0, 3))}
          placeholder={tx(lang, "Например, 85", "Мысалы, 85")}
          className="w-full bg-transparent text-base outline-none placeholder:text-muted-foreground"
        />
        <span className="shrink-0 text-sm text-muted-foreground">/ {ENT_MAX}</span>
      </label>

      {result && score != null && (
        <div className="mt-5 space-y-4" role="status">
          {score < ENT_THRESHOLD ? (
            <p className="text-base font-semibold">
              {tx(
                lang,
                `${score} — ниже порога ${ENT_THRESHOLD}: с таким баллом документы не примут. Не хватает ${ENT_THRESHOLD - score}.`,
                `${score} — ${ENT_THRESHOLD} шекті балдан төмен: құжат қабылданбайды. ${ENT_THRESHOLD - score} балл жетпейді.`,
              )}
            </p>
          ) : result.pass.length > 0 ? (
            <p className="text-base font-semibold">
              {tx(lang, `С баллом ${score} грант был реален в ${noun(result.pass.length)}.`, `${score} балмен грант ${noun(result.pass.length)} қолжетімді болды.`)}
            </p>
          ) : (
            <p className="text-base font-semibold">
              {kind === "university"
                ? tx(lang, `С баллом ${score} в ${latestYear} году гранта здесь не было ни в одном вузе.`, `${latestYear} жылы ${score} балмен мұнда ешбір ЖОО-да грант болған жоқ.`)
                : tx(lang, `С баллом ${score} в ${latestYear} году грантов здесь не было.`, `${latestYear} жылы ${score} балмен мұнда грант болған жоқ.`)}
            </p>
          )}

          {result.pass.length > 0 && (
            <ul className="flex flex-wrap gap-2">
              {result.pass.slice(0, 6).map((item) => (
                <li key={item.key}>
                  <Link href={item.href} className="inline-flex items-center gap-1.5 rounded-full border border-emerald-300/70 bg-emerald-50 px-3 py-1 text-sm text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
                    {item.label}
                    <span className="tabular-nums text-xs opacity-70">{tx(lang, "от", "")} {item.min}</span>
                  </Link>
                </li>
              ))}
              {result.pass.length > 6 && (
                <li className="self-center text-sm text-muted-foreground">
                  {tx(lang, `и ещё ${result.pass.length - 6}`, `тағы ${result.pass.length - 6}`)}
                </li>
              )}
            </ul>
          )}

          {result.next.length > 0 && (
            <div className="rounded-xl border border-amber-300/60 bg-amber-50/70 p-4 text-sm dark:border-amber-400/20 dark:bg-amber-500/5">
              <p className="font-semibold text-amber-950 dark:text-amber-200">
                {tx(
                  lang,
                  `+${STEP} баллов откроют ещё ${result.next.length}: ${result.next.slice(0, 3).map((item) => item.label).join(", ")}${result.next.length > 3 ? "…" : ""}`,
                  `+${STEP} балл тағы ${result.next.length} нұсқа ашады: ${result.next.slice(0, 3).map((item) => item.label).join(", ")}${result.next.length > 3 ? "…" : ""}`,
                )}
              </p>
              <p className="mt-1 text-amber-900/80 dark:text-amber-300/80">
                {tx(
                  lang,
                  "Обычно эти баллы теряются в нескольких темах. Пробный ЕНТ покажет, в каких именно.",
                  "Әдетте бұл балдар бірнеше тақырыпта жоғалады. ҰБТ сынағы қайсысы екенін көрсетеді.",
                )}
              </p>
            </div>
          )}
        </div>
      )}

      <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:items-center">
        <ConversionLink
          href={loginHref(START_ENT_PATH, source)}
          placement={`score_check_${source}`}
          className="inline-flex items-center justify-center gap-2 rounded-full bg-foreground px-6 py-3 text-sm font-semibold text-background transition-opacity hover:opacity-90"
        >
          <Gift className="size-4" aria-hidden="true" />
          {score == null
            ? tx(lang, "Не знаешь свой балл? Пробный ЕНТ бесплатно", "Балыңды білмейсің бе? ҰБТ сынағы тегін")
            : tx(lang, "Проверить балл на пробном ЕНТ — бесплатно", "Балды ҰБТ сынағында тексеру — тегін")}
          <ArrowRight className="size-4" aria-hidden="true" />
        </ConversionLink>
        <span className="text-xs text-muted-foreground">
          {tx(lang, "120 заданий, как на ЕНТ · балл и слабые темы сразу", "ҰБТ-дағыдай 120 тапсырма · балл мен әлсіз тақырыптар бірден")}
        </span>
      </div>
    </section>
  )
}

function parseScore(raw: string): number | null {
  if (!raw) return null
  const value = Number(raw)
  if (!Number.isInteger(value) || value < 1 || value > ENT_MAX) return null
  return value
}
