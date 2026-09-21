"use client"

import { Suspense, useRef, useState } from "react"
import Link from "next/link"
import dynamic from "next/dynamic"
import { useParams, useSearchParams } from "next/navigation"
import useSWR from "swr"
import { ArrowLeft, ArrowRight, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { StudyThemes } from "@/components/dashboard/study-themes"
import { MistakesPracticeDialog, type FixedPracticeScope } from "@/components/dashboard/mistakes-practice-dialog"
import { useUiI18n } from "@/lib/i18n/ui"
import { useAuth } from "@/lib/api/auth-context"
import { api } from "@/lib/api/client"
import { localize } from "@/lib/api/i18n"
import type { MistakesSubjectDetail } from "@/lib/api/types"

const AiMistakesCoach = dynamic(() => import("@/components/dashboard/ai-mistakes-coach").then(module => module.AiMistakesCoach))
const loading = <Skeleton className="h-48 w-full rounded-xl" />

export default function SubjectMistakesPage() {
  return <Suspense fallback={loading}><SubjectRoute /></Suspense>
}

function SubjectRoute() {
  const { subjectId } = useParams<{subjectId:string}>()
  const query = useSearchParams()
  const { locale } = useUiI18n()
  const examId = query.get("examTypeId")
  return <SubjectContent key={`${subjectId}:${examId}:${locale}`} subjectId={subjectId} examId={examId} language={locale} />
}

function SubjectContent({ subjectId, examId, language }: {subjectId:string; examId:string|null; language:"ru"|"kk"}) {
  const t = (ru: string, kk: string) => language === "kk" ? kk : ru
  const { user } = useAuth()
  const paid = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const url = `/tests/mistakes/subjects/${subjectId}${examId ? `?examTypeId=${encodeURIComponent(examId)}` : ""}`
  const { data, error, isLoading, isValidating, mutate } = useSWR<MistakesSubjectDetail>([url,language], ([path]:[string,string]) => api<MistakesSubjectDetail>(path))
  const [practice, setPractice] = useState<FixedPracticeScope|null>(null)
  const [coachOpen, setCoachOpen] = useState(false)
  const trigger = useRef<HTMLButtonElement|null>(null)
  const name = localize(data?.subjectName, language, t("Предмет", "Пән"))
  const openPractice = (scope: FixedPracticeScope, button: HTMLButtonElement) => { trigger.current = button; setPractice(scope) }
  const topics = [...(data?.topics ?? [])].sort((a,b) => b.activeOpenCount - a.activeOpenCount || b.openCount - a.openCount)
  const recommended = topics.find(topic => topic.activeOpenCount > 0)
  const scope = (topic?: typeof topics[number]): FixedPracticeScope => ({
    examTypeId:data!.examTypeId,subjectId,topicId:topic?.topicId,
    title:topic ? localize(topic.topicName,language) : name,
    available:topic?.activeOpenCount ?? data!.activeOpenTotal,
  })

  return <div className="flex min-w-0 flex-col gap-6">
    <header data-no-translate>
      <Link href="/dashboard/mistakes" className="inline-flex min-h-10 items-center gap-2 text-sm text-muted-foreground hover:text-foreground"><ArrowLeft className="size-4" />{t("Все мои ошибки", "Барлық қателерім")}</Link>
      <p className="mt-3 text-xs text-muted-foreground">{localize(data?.examName,language)}</p>
      <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{name}</h1>
      <p className="mt-2 text-sm text-muted-foreground">{t("Выберите одну тему, разберите её и проверьте себя. Правильный ответ в завершённой тренировке закроет ошибку.", "Бір тақырыпты таңдап, талдаңыз және өзіңізді тексеріңіз. Аяқталған жаттығудағы дұрыс жауап қатені түзетеді.")}</p>
    </header>
    {error && <div role="alert" className="rounded-xl border border-border bg-card p-5" data-no-translate><p className="text-sm">{t("Не удалось загрузить предмет. Проверьте ссылку или повторите попытку.", "Пәнді жүктеу мүмкін болмады. Сілтемені тексеріңіз немесе қайталаңыз.")}</p><Button variant="outline" className="mt-3" disabled={isValidating} onClick={() => { void mutate().catch(() => {}) }}>{t("Повторить", "Қайталау")}</Button></div>}
    {isLoading ? loading : data && <>
      <section className="overflow-hidden rounded-xl border border-border bg-card" data-no-translate data-testid="subject-next-step">
        <dl className="grid grid-cols-2 divide-x divide-border border-b border-border bg-muted/30">
          <div className="p-5"><dt className="text-xs text-muted-foreground">{t("Ошибок в работе", "Түзетілмеген қателер")}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{data.openTotal}</dd></div>
          <div className="p-5"><dt className="text-xs text-muted-foreground">{t("Доступно для практики", "Жаттығуға қолжетімді")}</dt><dd className="mt-1 text-2xl font-semibold tabular-nums">{data.activeOpenTotal}</dd></div>
        </dl>
        <div className="p-5 sm:p-6">
          <p className="text-xs font-medium text-muted-foreground">{t("Следующий шаг", "Келесі қадам")}</p>
          <h2 className="mt-2 break-words text-xl font-semibold">{recommended ? localize(recommended.topicName,language) : data.openTotal === 0 ? t("Ошибки по предмету закрыты", "Пән бойынша қателер түзетілген") : t("Вопросы временно недоступны", "Сұрақтар уақытша қолжетімсіз")}</h2>
          <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{recommended ? t("Начните с темы, где больше доступных ошибок. Короткая практика поможет проверить, что вы поняли решение.", "Қолжетімді қатесі көп тақырыптан бастаңыз. Қысқа жаттығу шешімді түсінгеніңізді тексеруге көмектеседі.") : data.openTotal === 0 ? t("Можно перейти к новому пробному или повторить сохранённые уроки.", "Жаңа сынаққа өтуге немесе сақталған сабақтарды қайталауға болады.") : t("Ошибки сохранены, но вопросы исключены из активного банка. Они не попадут в тренировку.", "Қателер сақталған, бірақ сұрақтар белсенді қордан алынған. Олар жаттығуға кірмейді.")}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {paid && recommended && <Button disabled={Boolean(error)} className="h-auto min-h-11 whitespace-normal py-2" onClick={event => openPractice(scope(recommended),event.currentTarget)}><Play className="size-4" />{t("Практика по этой теме", "Осы тақырып бойынша жаттығу")}</Button>}
            {paid && data.activeOpenTotal > 0 && <Button variant="outline" disabled={Boolean(error)} className="h-auto min-h-11 whitespace-normal py-2" onClick={event => openPractice(scope(),event.currentTarget)}>{t("Весь предмет", "Бүкіл пән")}</Button>}
            {data.activeOpenTotal === 0 && <Button asChild variant="outline"><Link href="/dashboard/exams">{t("Выбрать пробный", "Сынақты таңдау")}<ArrowRight className="size-4" /></Link></Button>}
          </div>
          {data.openTotal > data.activeOpenTotal && <p className="mt-3 text-xs text-muted-foreground">{t("Архивных вопросов", "Мұрағаттағы сұрақтар")}: {data.openTotal-data.activeOpenTotal}. {t("Они учитываются в истории, но не в практике.", "Олар тарихта есепке алынады, бірақ жаттығуда емес.")}</p>}
        </div>
      </section>
      {!paid && data.openTotal > 0 && <section className="rounded-xl border border-border bg-muted/30 p-5" data-no-translate><h2 className="font-semibold">{t("Практика и AI-уроки с Premium", "Premium арқылы жаттығу және AI сабақтары")}</h2><p className="mt-1 text-sm text-muted-foreground">{t("Список тем виден бесплатно. Платный доступ добавляет тренировку по вашим вопросам и объяснения.", "Тақырыптар тізімі тегін көрінеді. Ақылы қолжетімділік сұрақтарыңыз бойынша жаттығу мен түсіндірмелерді қосады.")}</p><Button asChild variant="outline" className="mt-4"><Link href="/dashboard/billing?reason=mistakes_subject_detail">{t("Посмотреть тарифы", "Тарифтерді көру")}</Link></Button></section>}
      <section className="rounded-xl border border-border bg-card p-5" data-no-translate data-testid="subject-topics">
        <h2 className="font-semibold">{t("Темы программы", "Бағдарлама тақырыптары")}</h2>
        <p className="mt-1 text-xs text-muted-foreground">{t("По реальным вопросам из ваших завершённых тестов. Не зависит от AI.", "Аяқталған тесттеріңіздегі нақты сұрақтар бойынша. AI-ға тәуелді емес.")}</p>
        <ul className="mt-3 divide-y divide-border">{topics.map(topic => <li key={topic.topicId} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div className="min-w-0 flex-1 basis-48"><h3 className="break-words text-sm font-medium">{localize(topic.topicName,language)}</h3><p className="mt-1 text-xs text-muted-foreground">{t("Ошибок", "Қателер")}: {topic.openCount} · {t("Для практики", "Жаттығуға")}: {topic.activeOpenCount}</p></div>
          {paid && <Button variant="outline" size="sm" disabled={Boolean(error) || topic.activeOpenCount === 0} onClick={event => openPractice(scope(topic),event.currentTarget)}>{t("Тренировать", "Жаттығу")}</Button>}
        </li>)}</ul>
        {topics.length === 0 && <p className="mt-4 text-sm text-muted-foreground">{t("Нет тем с открытыми ошибками.", "Ашық қатесі бар тақырыптар жоқ.")}</p>}
      </section>
      {paid && <StudyThemes key={language} subjectId={subjectId} examTypeId={data.examTypeId} language={language} onPractice={openPractice} />}
      {paid && data.openTotal > 0 && <section>
        <Button variant="outline" className="h-auto min-h-11 whitespace-normal py-2" onClick={() => setCoachOpen(!coachOpen)} aria-expanded={coachOpen} data-no-translate>{coachOpen ? t("Скрыть подробный AI-разбор", "Толық AI талдауын жасыру") : t("Причины ошибок и персональный разбор", "Қате себептері және жеке талдау")}</Button>
        {coachOpen && <div className="mt-4"><AiMistakesCoach key={language} language={language} examTypeId={data.examTypeId} subjectId={subjectId} totalOpen={data.openTotal} onTrainSubject={() => setPractice(scope())} onTrainTopic={topicId => { const topic=topics.find(item=>item.topicId===topicId); if(topic?.activeOpenCount) setPractice(scope(topic)) }} /></div>}
      </section>}
    </>}
    {practice && <MistakesPracticeDialog fixedScope={practice} onClose={() => setPractice(null)} onRestoreFocus={() => trigger.current?.focus()} />}
  </div>
}
