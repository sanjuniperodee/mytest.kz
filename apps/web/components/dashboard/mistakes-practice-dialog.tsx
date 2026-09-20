"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Spinner } from "@/components/ui/spinner"
import { useUiI18n } from "@/lib/i18n/ui"
import { api, ApiError } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import { recordFunnelEvent } from "@/lib/api/analytics"
import type { MistakesSummary, TestSession } from "@/lib/api/types"

const selectClass = "h-11 w-full min-w-0 rounded-md border border-input bg-background px-3 text-sm text-foreground focus-visible:outline-2 focus-visible:outline-ring"

export function MistakesPracticeDialog({ summary, initialScope, onClose, onRestoreFocus }: {
  summary: MistakesSummary
  initialScope: { examTypeId: string; subjectId?: string }
  onClose: () => void
  onRestoreFocus: () => void
}) {
  const router = useRouter()
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => locale === "kk" ? kk : ru
  const [examId, setExamId] = useState(initialScope.examTypeId)
  const [subjectId, setSubjectId] = useState(initialScope.subjectId ?? "all")
  const [language, setLanguage] = useState(locale === "kk" ? "kk" : "ru")
  const [limit, setLimit] = useState(15)
  const [duration, setDuration] = useState(25)
  const [starting, setStarting] = useState(false)
  const [error, setError] = useState("")
  const inFlight = useRef(false)
  const subjects = summary.openBySubject.filter(subject => subject.examTypeId === examId)
  const selectedSubject = subjects.find(subject => subject.subjectId === subjectId)
  const selectedExam = summary.openByExam.find(exam => exam.examTypeId === examId)
  const validScope = Boolean(selectedExam && (subjectId === "all" || selectedSubject))
  const available = subjectId === "all" ? selectedExam?.count ?? 0 : selectedSubject?.count ?? 0
  // The API caps practice at 40 and can exclude archived questions from this total.
  const maxQuestions = Math.max(1, Math.min(40, available))
  const questionLimit = Math.min(limit, maxQuestions)

  const launch = async () => {
    if (inFlight.current || !validScope || available === 0) return
    inFlight.current = true
    setStarting(true)
    setError("")
    try {
      const session = await api<TestSession>("/tests/mistakes/practice", {
        method: "POST",
        body: { language, examTypeId: examId, subjectId: subjectId === "all" ? undefined : subjectId, limit: questionLimit, durationMins: duration },
      })
      router.push(`/exam/${session.id}`)
    } catch (err) {
      if (err instanceof ApiError && (err.status === 402 || err.status === 403)) {
        void recordFunnelEvent("premium_gate", {feature:"mistakes_practice"})
        router.push("/dashboard/billing?reason=mistakes_practice")
        return
      }
      setError(err instanceof ApiError && err.message.startsWith("NO_OPEN_MISTAKES")
        ? t("Для этого выбора нет доступных вопросов. Выберите другой предмет или обновите страницу.", "Бұл таңдау үшін қолжетімді сұрақтар жоқ. Басқа пәнді таңдаңыз немесе бетті жаңартыңыз.")
        : t("Не удалось начать тренировку. Настройки сохранены — попробуйте ещё раз.", "Жаттығуды бастау мүмкін болмады. Баптаулар сақталған — қайталап көріңіз."))
      inFlight.current = false
      setStarting(false)
    }
  }

  return <Dialog open onOpenChange={open => { if (!open && !inFlight.current) onClose() }}>
    <DialogContent data-no-translate showCloseButton={false} onCloseAutoFocus={event => { event.preventDefault(); onRestoreFocus() }}>
      <DialogHeader className="text-left">
        <DialogTitle>{t("Тренировка по ошибкам", "Қателер бойынша жаттығу")}</DialogTitle>
        <DialogDescription>{t("Короткий тест из вопросов, в которых вы ошиблись. Один экзамен за тренировку.", "Қате жауап берген сұрақтарыңыздан қысқа тест. Бір жаттығуда бір емтихан.")}</DialogDescription>
      </DialogHeader>
      <form className="min-w-0 space-y-5" onSubmit={event => { event.preventDefault(); void launch() }} aria-busy={starting}>
        <fieldset disabled={starting} className="min-w-0 space-y-4 disabled:opacity-60">
          <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
            <label htmlFor="practice-exam">{t("Экзамен", "Емтихан")}</label>
            <select id="practice-exam" className={selectClass} value={examId} onChange={event => { setExamId(event.target.value); setSubjectId("all"); setError("") }}>
              {summary.openByExam.map(exam => <option key={exam.examTypeId} value={exam.examTypeId}>{localize(exam.examName, locale)} ({exam.count})</option>)}
            </select>
          </div>
          <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
            <label htmlFor="practice-subject">{t("Предмет", "Пән")}</label>
            <select id="practice-subject" className={selectClass} value={subjectId} onChange={event => { setSubjectId(event.target.value); setError("") }}>
              <option value="all">{t("Все предметы экзамена", "Емтиханның барлық пәндері")}</option>
              {subjects.map(subject => <option key={subject.subjectId} value={subject.subjectId}>{localize(subject.subjectName, locale)} ({subject.count})</option>)}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              <label htmlFor="practice-language">{t("Язык вопросов", "Сұрақтар тілі")}</label>
              <select id="practice-language" className={selectClass} value={language} onChange={event => setLanguage(event.target.value)}><option value="ru">Русский</option><option value="kk">Қазақша</option></select>
            </div>
            <div className="flex min-w-0 flex-col gap-2 text-sm font-medium">
              <label htmlFor="practice-duration">{t("Время, мин", "Уақыт, мин")}</label>
              <select id="practice-duration" className={selectClass} value={duration} onChange={event => setDuration(Number(event.target.value))}>{[10,15,25,30,45,60].map(value => <option key={value} value={value}>{value}</option>)}</select>
            </div>
          </div>
          <label className="flex flex-col gap-3 text-sm font-medium">
            <span className="flex flex-wrap justify-between gap-2"><span>{t("Вопросов в тренировке", "Жаттығудағы сұрақтар")}</span><span className="tabular-nums">{t("До", "Ең көбі")} {questionLimit}</span></span>
            <input aria-label={t("Количество вопросов", "Сұрақтар саны")} type="range" min={1} max={maxQuestions} step={1} value={questionLimit} onChange={event => setLimit(Number(event.target.value))} className="h-6 w-full cursor-pointer accent-primary" />
          </label>
        </fieldset>
        <p className="rounded-lg bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">{t("Берём только доступные вопросы из ваших ошибок. Их может оказаться меньше выбранного количества. Результат появится после завершения тренировки.", "Қателеріңізден тек қолжетімді сұрақтарды аламыз. Олардың саны таңдалған мөлшерден аз болуы мүмкін. Нәтиже жаттығу аяқталған соң пайда болады.")}</p>
        {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" disabled={starting} onClick={onClose} className="min-h-11">{t("Отмена", "Бас тарту")}</Button>
          <Button type="submit" disabled={starting || !validScope || available === 0} className="h-auto min-h-11 whitespace-normal py-3">{starting ? <Spinner className="size-4" /> : <Play className="size-4" />}{starting ? t("Запускаем…", "Басталуда…") : t("Начать тренировку", "Жаттығуды бастау")}</Button>
        </div>
      </form>
    </DialogContent>
  </Dialog>
}
