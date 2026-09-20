"use client"

import { useEffect, useRef, useState } from "react"
import useSWR from "swr"
import { api } from "@/lib/api/client"
import { useUiI18n } from "@/lib/i18n/ui"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import { MessageSquare, X } from "lucide-react"

type Feedback = { submittedAt: string | null; skippedAt: string | null } | null

export function TestFeedback({ sessionId }: { sessionId: string }) {
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => locale === "kk" ? kk : ru
  const endpoint = `/tests/sessions/${sessionId}/feedback`
  const { data, error, isLoading, mutate } = useSWR<Feedback>(endpoint, (path: string) => api<Feedback>(path), { revalidateOnFocus: false })
  const [rating, setRating] = useState(0)
  const [intent, setIntent] = useState("")
  const [blocker, setBlocker] = useState("")
  const [comment, setComment] = useState("")
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState("")
  const [open, setOpen] = useState(false)
  const prompted = useRef(false)
  const shown = useRef(false)
  const storageKey = `review-feedback:${sessionId}`
  const closed = Boolean(data?.submittedAt || data?.skippedAt)

  useEffect(() => {
    if (isLoading || error || closed || prompted.current) return
    try { if (sessionStorage.getItem(storageKey)) return } catch { /* Storage can be disabled. */ }
    const timer = window.setTimeout(() => {
      // Never steal focus from another dialog or from a background tab.
      if (document.visibilityState !== "visible" || document.querySelector('[role="dialog"]')) return
      prompted.current = true
      setOpen(true)
    }, 1500)
    return () => window.clearTimeout(timer)
  }, [storageKey, isLoading, error, closed])

  useEffect(() => {
    if (!open) return
    prompted.current = true
    try { sessionStorage.setItem(storageKey, "1") } catch { /* Optional persistence. */ }
    if (!shown.current) {
      shown.current = true
      void api(`${endpoint}/shown`, { method: "POST" }).catch(() => { shown.current = false })
    }
  }, [open, endpoint, storageKey])

  function dismiss() {
    setOpen(false)
    // Closing must never be blocked by an unavailable API.
    if (!busy && !data?.submittedAt) {
      void api(`${endpoint}/skip`, { method: "POST" })
        .then(() => mutate())
        .catch(() => {})
    }
  }

  async function save() {
    if (busy) return
    setBusy(true); setFailure("")
    try {
      const result = await api<Feedback>(endpoint, { method: "PUT", body: { rating, intent, blocker, comment: comment.trim(), locale } })
      await mutate(result, { revalidate: false })
      setOpen(false)
    } catch {
      setFailure(t("Не удалось отправить. Попробуйте ещё раз — текст сохранён в форме.", "Жіберілмеді. Қайта көріңіз — мәтін нысанда сақталды."))
    } finally { setBusy(false) }
  }

  if (isLoading || error) return null
  if (data?.submittedAt) return <p role="status" className="text-sm text-muted-foreground" data-no-translate>{t("Спасибо за отзыв! Он поможет улучшить пробный.", "Пікіріңізге рақмет! Ол сынақты жақсартуға көмектеседі.")}</p>
  const selectClass = "min-h-11 w-full rounded-lg border border-border bg-background px-3 text-sm"
  return (
    <Dialog open={open} onOpenChange={(next) => next ? setOpen(true) : dismiss()}>
      <DialogTrigger asChild><Button variant="ghost" size="sm" data-no-translate><MessageSquare className="size-4" />{t("Оценить пробный", "Сынақты бағалау")}</Button></DialogTrigger>
      <DialogContent showCloseButton={false} className="gap-5 sm:max-w-lg" data-no-translate>
        <DialogHeader className="pr-9 text-left">
          <DialogTitle className="text-xl">{t("Как вам пробный?", "Сынақ қалай өтті?")}</DialogTitle>
          <DialogDescription>{t("Оцените пользу и подскажите, что улучшить. Это необязательно — к разбору можно вернуться в любой момент.", "Пайдасын бағалап, нені жақсартуға болатынын айтыңыз. Бұл міндетті емес — талдауға кез келген уақытта орала аласыз.")}</DialogDescription>
        </DialogHeader>
        <Button type="button" variant="ghost" size="icon" className="absolute right-2 top-2" aria-label={t("Закрыть опрос", "Сауалнаманы жабу")} onClick={dismiss}><X className="size-4" /></Button>
      <form className="space-y-4" onSubmit={(event) => { event.preventDefault(); if (rating && intent && blocker) void save() }}>
        <fieldset disabled={busy}>
          <legend className="mb-2 text-sm">{t("Насколько полезным был пробный?", "Сынақ қаншалықты пайдалы болды?")}</legend>
          <div className="flex gap-2" role="group" aria-label={t("Оценка от 1 до 5", "1-ден 5-ке дейін бағалау")}>
            {[1,2,3,4,5].map((value) => <Button type="button" key={value} variant={rating === value ? "default" : "outline"} className="min-h-11 flex-1" aria-pressed={rating === value} onClick={() => setRating(value)}>{value}</Button>)}
          </div>
          <p className="mt-1 flex justify-between text-xs text-muted-foreground"><span>{t("Совсем не полезен", "Пайдасы болмады")}</span><span>{t("Очень полезен", "Өте пайдалы")}</span></p>
        </fieldset>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1 text-sm"><span>{t("Планируете купить доступ?", "Ақылы қолжетімділікті алуды жоспарлайсыз ба?")}</span>
            <select required disabled={busy} value={intent} onChange={(e) => setIntent(e.target.value)} className={selectClass}>
              <option value="">{t("Выберите ответ", "Жауапты таңдаңыз")}</option>
              {[["yes","Да","Иә"],["maybe","Пока не решил(а)","Әлі шешкен жоқпын"],["no","Нет","Жоқ"],["already_paid","Уже купил(а)","Сатып алдым"]].map(([value,ru,kk]) => <option key={value} value={value}>{t(ru,kk)}</option>)}
            </select>
          </label>
          <label className="space-y-1 text-sm"><span>{t("Что мешает продолжить?", "Жалғастыруға не кедергі?")}</span>
            <select required disabled={busy} value={blocker} onChange={(e) => setBlocker(e.target.value)} className={selectClass}>
              <option value="">{t("Выберите ответ", "Жауапты таңдаңыз")}</option>
              {[["none","Ничего","Ештеңе"],["price","Цена","Бағасы"],["value","Не вижу пользы платного доступа","Ақылы нұсқаның пайдасы түсініксіз"],["payment","Не получается оплатить","Төлем жасай алмаймын"],["trust","Не уверен(а) в качестве","Сапасына сенімді емеспін"],["later","Сейчас не нужно / нет времени","Қазір қажет емес / уақыт жоқ"],["other","Другое","Басқа"]].map(([value,ru,kk]) => <option key={value} value={value}>{t(ru,kk)}</option>)}
            </select>
          </label>
        </div>
        <label className="block space-y-1 text-sm"><span>{t("Что улучшить? Необязательно", "Нені жақсарту керек? Міндетті емес")}</span>
          <textarea value={comment} onChange={(e) => setComment(e.target.value)} maxLength={1000} disabled={busy} rows={2} className="w-full rounded-lg border border-border bg-background p-3" placeholder={t("Не указывайте телефон и другие личные данные", "Телефон мен басқа жеке деректерді жазбаңыз")} />
        </label>
        {failure && <p role="alert" className="text-sm text-destructive">{failure}</p>}
        <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4">
          <Button type="button" variant="ghost" onClick={dismiss}>{t("Не сейчас", "Кейінірек")}</Button>
          <Button type="submit" disabled={busy || !rating || !intent || !blocker}>{busy ? t("Отправляем…", "Жіберілуде…") : t("Отправить отзыв", "Пікір жіберу")}</Button>
        </div>
      </form>
      </DialogContent>
    </Dialog>
  )
}
