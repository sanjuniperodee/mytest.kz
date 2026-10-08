"use client"

import { useEffect, useState } from "react"

/** Секунды до `target` (ISO), обновляются раз в секунду, пока `active`. null — времени нет. */
export function useCountdown(target: string | null, active: boolean) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (!active || !target) return
    setNow(Date.now())
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active, target])
  const targetMs = target ? Date.parse(target) : NaN
  if (!Number.isFinite(targetMs)) return null
  return Math.max(0, Math.ceil((targetMs - now) / 1000))
}

const pad = (n: number) => String(n).padStart(2, "0")

/**
 * Сколько ждать — словами, а не «22:08:55» (это читается как время суток).
 * От часа: «22 ч 09 мин» (минуты вверх — «через 1 мин», пока осталось 30 с);
 * меньше часа — с секундами, чтобы было видно, что таймер идёт.
 */
export function formatWait(totalSeconds: number, locale: string) {
  const [h, m, s] = locale === "kk" ? ["сағ", "мин", "сек"] : ["ч", "мин", "с"]
  if (totalSeconds >= 3600) {
    const minutes = Math.ceil(totalSeconds / 60)
    return `${Math.floor(minutes / 60)} ${h} ${pad(minutes % 60)} ${m}`
  }
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60
  return minutes > 0 ? `${minutes} ${m} ${pad(seconds)} ${s}` : `${seconds} ${s}`
}

/**
 * Когда откроется — с днём: «завтра в 00:00», а не «в 00:00» (в 01:51 это
 * выглядит как уже прошедшее время). Время — по часам устройства.
 */
export function formatResetMoment(iso: string, locale: string, nowMs = Date.now()) {
  const at = new Date(iso)
  if (!Number.isFinite(at.getTime())) return null
  const intl = locale === "kk" ? "kk-KZ" : "ru-RU"
  const time = at.toLocaleTimeString(intl, { hour: "2-digit", minute: "2-digit" })
  const dayStart = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
  const days = Math.round((dayStart(at) - dayStart(new Date(nowMs))) / 86_400_000)
  // В казахском падежное окончание у числа зависит от его звучания — «сағат 00:00» без окончания.
  if (days === 0) return locale === "kk" ? `бүгін, сағат ${time}` : `сегодня в ${time}`
  if (days === 1) return locale === "kk" ? `ертең, сағат ${time}` : `завтра в ${time}`
  const date = at.toLocaleDateString(intl, { day: "numeric", month: "long" })
  return locale === "kk" ? `${date}, сағат ${time}` : `${date} в ${time}`
}

/** Живая строка «через 22 ч 09 мин» до следующей бесплатной попытки. */
export function FreeResetIn({ at, locale }: { at: string; locale: string }) {
  const seconds = useCountdown(at, true)
  if (seconds == null) return null
  if (seconds === 0) return <>{locale === "kk" ? "қазір қолжетімді" : "уже доступен"}</>
  return <>{locale === "kk" ? `${formatWait(seconds, locale)} қалды` : `через ${formatWait(seconds, locale)}`}</>
}
