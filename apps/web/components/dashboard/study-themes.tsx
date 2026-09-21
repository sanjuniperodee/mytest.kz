"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import type { StudyMap } from "@/lib/api/types"
import type { FixedPracticeScope } from "./mistakes-practice-dialog"

export function StudyThemes({ subjectId, examTypeId, language, onPractice }: {
  subjectId: string; examTypeId: string; language: "ru" | "kk"
  onPractice: (scope: FixedPracticeScope, trigger: HTMLButtonElement) => void
}) {
  const t = (ru: string, kk: string) => language === "kk" ? kk : ru
  const key = `/ai/mistakes/subjects/${subjectId}/study-map/overview?examTypeId=${examTypeId}`
  const { data, error, isLoading, mutate } = useSWR<StudyMap>([key, language], ([url]: [string, string]) => api<StudyMap>(url))
  const [busy, setBusy] = useState(false)
  const [failure, setFailure] = useState("")
  const inFlight = useRef(false)
  const prepare = async () => {
    if (inFlight.current) return
    inFlight.current = true; setBusy(true); setFailure("")
    try {
      const next = await api<StudyMap>(`/ai/mistakes/subjects/${subjectId}/study-map/prepare`, {method:"POST"})
      await mutate(next, {revalidate:false})
    } catch (err) {
      setFailure(err instanceof ApiError && err.message === "AI_DAILY_LIMIT"
        ? t("Лимит AI на сегодня исчерпан. Обычная тренировка остаётся доступной.", "Бүгінгі AI лимиті таусылды. Әдеттегі жаттығу қолжетімді.")
        : t("Не удалось подготовить темы. Можно тренироваться по темам программы ниже.", "Тақырыптарды дайындау мүмкін болмады. Төмендегі бағдарлама тақырыптары бойынша жаттығуға болады."))
    } finally { inFlight.current = false; setBusy(false) }
  }
  return <section className="rounded-xl border border-border bg-card p-5" data-no-translate data-testid="study-themes">
    <h2 className="font-semibold">{t("Темы для изучения с AI", "AI арқылы оқуға арналған тақырыптар")}</h2>
    <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("Дополнительная группировка ошибок с уроками. Подготовка запускается только по вашей кнопке и использует лимит AI.", "Сабақтары бар қосымша қателер топтамасы. Дайындау тек батырманы басқанда басталады және AI лимитін пайдаланады.")}</p>
    {isLoading && <p role="status" className="mt-4 text-sm text-muted-foreground">{t("Загружаем сохранённые темы…", "Сақталған тақырыптар жүктелуде…")}</p>}
    {error && <div role="alert" className="mt-4 text-sm"><p>{t("Список тем не загрузился.", "Тақырыптар тізімі жүктелмеді.")}</p><Button variant="outline" size="sm" className="mt-2" onClick={() => { void mutate().catch(() => {}) }}>{t("Повторить", "Қайталау")}</Button></div>}
    {data && <>
      <ul className="mt-4 divide-y divide-border">{data.themes.map(theme => {
        const name = localize(theme.name, language, theme.key)
        return <li key={theme.themeId} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0 flex-1 basis-48"><Link href={`/dashboard/mistakes/themes/${theme.themeId}`} className="flex items-center gap-2 text-sm font-medium hover:underline"><span className="break-words">{name}</span><ArrowRight className="size-4 shrink-0" /></Link><p className="mt-1 text-xs text-muted-foreground">{t("Ошибок", "Қателер")}: {theme.openCount} · {t("Для практики", "Жаттығуға")}: {theme.activeOpenCount}</p></div>
          <Button variant="outline" size="sm" disabled={theme.activeOpenCount === 0} onClick={event => onPractice({examTypeId,subjectId,themeId:theme.themeId,title:name,available:theme.activeOpenCount},event.currentTarget)}><Play className="size-3.5" />{t("Тренировать", "Жаттығу")}</Button>
        </li>
      })}</ul>
      {(data.reviewThemes?.length ?? 0) > 0 && <div className="mt-4 border-t border-border pt-4"><h3 className="text-sm font-medium">{t("Исправлены — можно повторить", "Түзетілген — қайталауға болады")}</h3><ul className="mt-2 space-y-2">{data.reviewThemes.map(theme => <li key={theme.themeId}><Link className="inline-flex min-h-10 items-center gap-2 text-sm hover:underline" href={`/dashboard/mistakes/themes/${theme.themeId}`}>{localize(theme.name,language,theme.key)}<ArrowRight className="size-4 shrink-0" /></Link></li>)}</ul></div>}
      {data.otherOpenCount > 0 && <div className="mt-3 rounded-lg border border-dashed border-border p-4">
        <p className="text-sm font-medium">{t("Без AI-темы", "AI тақырыбы жоқ")}: {data.otherOpenCount}</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{t("Вопросы, ещё не привязанные к активной AI-теме. Тренировка включает только их.", "Белсенді AI тақырыбына әлі байланыстырылмаған сұрақтар. Жаттығуға тек солар кіреді.")}</p>
        <Button className="mt-3 h-auto whitespace-normal py-2" size="sm" variant="outline" disabled={data.otherActiveOpenCount === 0} onClick={event => onPractice({examTypeId,subjectId,unclassifiedOnly:true,title:t("Ошибки без AI-темы", "AI тақырыбы жоқ қателер"),available:data.otherActiveOpenCount},event.currentTarget)}>{t("Тренировать эти вопросы", "Осы сұрақтармен жаттығу")}</Button>
      </div>}
      {data.generationAvailable && data.unclassifiedCount > 0 && <Button variant="outline" className="mt-4 h-auto min-h-11 whitespace-normal py-2" disabled={busy} onClick={() => void prepare()}>{busy && <Spinner className="size-4" />}{busy ? t("Готовим темы…", "Тақырыптар дайындалуда…") : t("Подготовить темы с AI", "AI арқылы тақырыптарды дайындау")}</Button>}
      {data.unclassifiedCount > 0 && <p className="mt-2 text-xs text-muted-foreground">{t("Ещё не обработано", "Әлі өңделмеген")}: {data.unclassifiedCount}. {t("Большой список обрабатывается частями.", "Үлкен тізім бөліктермен өңделеді.")}</p>}
      {!data.generationAvailable && <p className="mt-3 text-xs text-muted-foreground">{t("AI временно недоступен. Сохранённые материалы и тренировки продолжают работать.", "AI уақытша қолжетімсіз. Сақталған материалдар мен жаттығулар жұмыс істейді.")}</p>}
      {data.openTotal === 0 && <p className="mt-3 text-sm text-muted-foreground">{t("Открытых ошибок нет. Повторить сохранённый урок можно по его ссылке.", "Ашық қателер жоқ. Сақталған сабақты сілтемесі арқылы қайталауға болады.")}</p>}
    </>}
    {failure && <p role="alert" className="mt-3 text-sm text-destructive">{failure}</p>}
  </section>
}
