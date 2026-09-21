"use client"

import { useRef, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, Play, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Spinner } from "@/components/ui/spinner"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { FullLessonReader } from "@/components/dashboard/lesson-content"
import { MistakesPracticeDialog, type FixedPracticeScope } from "@/components/dashboard/mistakes-practice-dialog"
import { RichText } from "@/components/exam/rich-text"
import { useUiI18n } from "@/lib/i18n/ui"
import { useAuth } from "@/lib/api/auth-context"
import { api, ApiError } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import type { AiTopicLesson, MistakesThemeDetail } from "@/lib/api/types"

export default function ThemeLessonPage() {
  const { themeId } = useParams<{themeId:string}>()
  const { locale } = useUiI18n()
  return <ThemeContent key={`${themeId}:${locale}`} themeId={themeId} language={locale} />
}

function ThemeContent({ themeId, language }: {themeId:string; language:"ru"|"kk"}) {
  const t = (ru:string,kk:string) => language === "kk" ? kk : ru
  const { user, isLoading: authLoading } = useAuth()
  const paid = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const url = `/ai/mistakes/themes/${themeId}`
  const {data,error,isLoading,isValidating,mutate} = useSWR<MistakesThemeDetail>(paid ? [url,language] : null, ([path]:[string,string]) => api<MistakesThemeDetail>(path))
  const [busy,setBusy] = useState(false)
  const [failure,setFailure] = useState("")
  const [practice,setPractice] = useState<FixedPracticeScope|null>(null)
  const [noteOpen,setNoteOpen] = useState(false)
  const [note,setNote] = useState("")
  const [noteBusy,setNoteBusy] = useState(false)
  const [noteError,setNoteError] = useState("")
  const [noteSent,setNoteSent] = useState(false)
  const generating = useRef(false), sending = useRef(false)
  const practiceTrigger = useRef<HTMLButtonElement|null>(null)
  const noteTrigger = useRef<HTMLButtonElement|null>(null)
  const lesson = data?.lesson
  const back = data ? `/dashboard/mistakes/subjects/${data.subjectId}?examTypeId=${data.examTypeId}` : "/dashboard/mistakes"
  const prepare = async () => {
    if(generating.current || !data) return
    generating.current=true;setBusy(true);setFailure("")
    try {
      const lesson = await api<AiTopicLesson>("/ai/mistakes/theme-lesson",{method:"POST",body:{themeId,language}})
      await mutate(current => current ? {...current,lesson} : current,{revalidate:false})
    } catch(err) {
      setFailure(err instanceof ApiError && err.message==="AI_DAILY_LIMIT" ? t("Лимит AI на сегодня исчерпан. Практика остаётся доступной.", "Бүгінгі AI лимиті таусылды. Жаттығу қолжетімді.") : t("Не удалось подготовить урок. Попробуйте позже или начните практику.", "Сабақты дайындау мүмкін болмады. Кейінірек көріңіз немесе жаттығуды бастаңыз."))
    } finally {generating.current=false;setBusy(false)}
  }
  const sendNote = async () => {
    if(sending.current || !lesson?.lessonId || note.trim().length<12) return
    sending.current=true;setNoteBusy(true);setNoteError("")
    try {
      await api(`/ai/mistakes/theme-lesson/${lesson.lessonId}/note`,{method:"POST",body:{message:note.trim()}})
      setNote("");setNoteOpen(false);setNoteSent(true)
    } catch {setNoteError(t("Не удалось отправить. Текст сохранён — попробуйте ещё раз.", "Жіберу мүмкін болмады. Мәтін сақталған — қайталап көріңіз."))}
    finally {sending.current=false;setNoteBusy(false)}
  }
  return <div className="flex min-w-0 flex-col gap-6">
    <Link href={back} className="inline-flex min-h-10 w-fit items-center gap-2 text-sm text-muted-foreground hover:text-foreground" data-no-translate><ArrowLeft className="size-4" />{data ? t("К предмету", "Пәнге оралу") : t("Мои ошибки", "Менің қателерім")}</Link>
    {authLoading || isLoading ? <Skeleton className="h-52 w-full rounded-xl" /> : !paid ? <section className="rounded-xl border border-border bg-card p-5" data-no-translate><h1 className="text-xl font-semibold">{t("Уроки по ошибкам с Premium", "Premium арқылы қателер бойынша сабақтар")}</h1><p className="mt-2 text-sm text-muted-foreground">{t("Урок помогает разобраться в теме перед тренировкой.", "Сабақ жаттығу алдында тақырыпты түсінуге көмектеседі.")}</p><Button asChild className="mt-4"><Link href="/dashboard/billing?reason=theme_lesson">{t("Посмотреть тарифы", "Тарифтерді көру")}</Link></Button></section> : null}
    {error && <section role="alert" className="rounded-xl border border-border bg-card p-5" data-no-translate><p>{t("Не удалось открыть тему. Она может быть недоступна для вашего аккаунта.", "Тақырыпты ашу мүмкін болмады. Ол аккаунтыңыз үшін қолжетімсіз болуы мүмкін.")}</p><Button className="mt-3" variant="outline" disabled={isValidating} onClick={() => {void mutate().catch(()=>{})}}>{t("Повторить", "Қайталау")}</Button></section>}
    {data && <>
      <section className="rounded-xl border border-border bg-card p-5 sm:p-6" data-no-translate data-testid="theme-summary">
        <p className="text-xs text-muted-foreground">{localize(data.examName,language)} · {localize(data.subjectName,language)}</p>
        <h1 className="mt-2 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{localize(data.themeName,language)}</h1>
        <dl className="mt-5 grid grid-cols-3 gap-3 border-y border-border py-4">
          {[[t("Ошибок", "Қателер"),data.openCount],[t("Для практики", "Жаттығуға"),data.activeOpenCount],[t("Исправлено", "Түзетілген"),data.resolvedCount]].map(([label,value])=><div key={label}><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{value}</dd></div>)}
        </dl>
        <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{data.openCount===0 ? t("Ошибки по этой теме закрыты. Сохранённый урок остаётся доступен для повторения.", "Бұл тақырыптағы қателер түзетілген. Сақталған сабақ қайталау үшін қолжетімді.") : t("Изучите объяснение, попробуйте задания без подсказок и затем проверьте себя в тренировке.", "Түсіндірмені оқып, тапсырмаларды көмексіз орындап, содан кейін жаттығуда өзіңізді тексеріңіз.")}</p>
        <Button className="mt-4 h-auto min-h-11 whitespace-normal py-2" disabled={Boolean(error) || data.activeOpenCount===0} onClick={event=>{practiceTrigger.current=event.currentTarget;setPractice({examTypeId:data.examTypeId,subjectId:data.subjectId,themeId,title:localize(data.themeName,language),available:data.activeOpenCount})}}><Play className="size-4" />{t("Практика по теме", "Тақырып бойынша жаттығу")}</Button>
        {data.openCount>data.activeOpenCount && <p className="mt-2 text-xs text-muted-foreground">{t("Архивные вопросы не включаются в практику.", "Мұрағаттағы сұрақтар жаттығуға кірмейді.")}</p>}
      </section>
      {!lesson && <section className="rounded-xl border border-dashed border-border bg-card p-5" data-no-translate>
        <h2 className="font-semibold">{t("Урок по теме", "Тақырып бойынша сабақ")}</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{data.openCount===0 ? t("Сохранённого урока пока нет. Можно перейти к другим темам.", "Сақталған сабақ әлі жоқ. Басқа тақырыптарға өтуге болады.") : t("AI подготовит объяснения, примеры и задания. Генерация использует лимит AI; готовый урок сохранится.", "AI түсіндірмелер, мысалдар мен тапсырмалар дайындайды. Дайындау AI лимитін пайдаланады; дайын сабақ сақталады.")}</p>
        {data.generationAvailable && data.openCount>0 && <Button variant="outline" className="mt-4 h-auto min-h-11 whitespace-normal py-2" disabled={busy} onClick={()=>void prepare()}>{busy && <Spinner className="size-4" />}{busy ? t("Готовим урок…", "Сабақ дайындалуда…") : t("Подготовить урок", "Сабақты дайындау")}</Button>}
        {!data.generationAvailable && <p className="mt-3 text-sm text-muted-foreground">{t("AI сейчас недоступен. Практика работает независимо от него.", "AI қазір қолжетімсіз. Жаттығу оған тәуелсіз жұмыс істейді.")}</p>}
        {failure && <p role="alert" className="mt-3 text-sm text-destructive">{failure}</p>}
      </section>}
      {lesson && <>
        <section className="rounded-xl border border-border bg-muted/30 p-5">
          <h2 className="text-lg font-semibold" data-no-translate>{t("Что разберём", "Нені талдаймыз")}</h2>
          <RichText value={lesson.studentGoal} locale={language} as="div" className="mt-2 text-sm leading-relaxed" />
          <p className="mt-3 text-xs text-muted-foreground" data-no-translate>{t("Материал подготовлен AI и может содержать неточности. Самопроверка в уроке не меняет статистику — для этого завершите тренировку.", "Материалды AI дайындаған, қателіктер болуы мүмкін. Сабақтағы өзін-өзі тексеру статистиканы өзгертпейді — ол үшін жаттығуды аяқтаңыз.")}</p>
        </section>
        <FullLessonReader key={`${lesson.lessonId ?? themeId}:${language}`} lesson={lesson} language={language} />
        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4" data-no-translate>
          <p className="text-xs text-muted-foreground">{t("Сохранённый AI-урок", "Сақталған AI сабағы")}</p>
          <Button variant="outline" disabled={!lesson.lessonId} ref={noteTrigger} onClick={()=>setNoteOpen(true)}><MessageSquare className="size-4" />{t("Сообщить об ошибке", "Қате туралы хабарлау")}</Button>
          {noteSent && <p role="status" className="w-full text-sm text-muted-foreground">{t("Спасибо. Замечание отправлено на проверку.", "Рақмет. Ескерту тексеруге жіберілді.")}</p>}
        </footer>
      </>}
    </>}
    {practice && <MistakesPracticeDialog fixedScope={practice} onClose={()=>setPractice(null)} onRestoreFocus={()=>practiceTrigger.current?.focus()} />}
    <Dialog open={noteOpen} onOpenChange={open=>{if(!sending.current)setNoteOpen(open)}}>
      <DialogContent showCloseButton={false} data-no-translate onCloseAutoFocus={event=>{event.preventDefault();noteTrigger.current?.focus()}}>
        <DialogHeader><DialogTitle>{t("Ошибка в уроке", "Сабақтағы қате")}</DialogTitle><DialogDescription>{t("Укажите пример или формулу и опишите неточность. Замечание получит модератор.", "Мысалды немесе формуланы көрсетіп, қатені сипаттаңыз. Ескерту модераторға жіберіледі.")}</DialogDescription></DialogHeader>
        <form className="space-y-4" onSubmit={event=>{event.preventDefault();void sendNote()}}>
          <label className="block text-sm">{t("Ваше замечание", "Ескертуіңіз")}<textarea className="mt-2 min-h-32 w-full rounded-lg border border-input bg-background p-3" minLength={12} maxLength={2000} required value={note} disabled={noteBusy} onChange={event=>setNote(event.target.value)} /></label>
          {noteError && <p role="alert" className="text-sm text-destructive">{noteError}</p>}
          <div className="flex flex-wrap justify-end gap-2"><Button type="button" variant="outline" disabled={noteBusy} onClick={()=>setNoteOpen(false)}>{t("Отмена", "Бас тарту")}</Button><Button type="submit" disabled={noteBusy || note.trim().length<12}>{noteBusy && <Spinner className="size-4" />}{t("Отправить", "Жіберу")}</Button></div>
        </form>
      </DialogContent>
    </Dialog>
  </div>
}
