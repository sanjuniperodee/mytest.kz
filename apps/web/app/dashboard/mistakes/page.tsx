"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, BookOpen, CheckCheck, Crown, Play, Target } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { MistakesPracticeDialog } from "@/components/dashboard/mistakes-practice-dialog"
import { useUiI18n } from "@/lib/i18n/ui"
import { useAuth } from "@/lib/api/auth-context"
import { localize } from "@/lib/api/i18n"
import { recordFunnelEvent } from "@/lib/api/analytics"
import type { MistakesSummary } from "@/lib/api/types"

type PracticeScope = { examTypeId: string; subjectId?: string }
const subjectHref = (subject: MistakesSummary["openBySubject"][number]) =>
  `/dashboard/mistakes/subjects/${subject.subjectId}?examTypeId=${encodeURIComponent(subject.examTypeId)}`

export default function MistakesPage() {
  const { user, refresh } = useAuth()
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => locale === "kk" ? kk : ru
  const { data, error, isLoading, isValidating, mutate } = useSWR<MistakesSummary>("/tests/mistakes/summary")
  const [examFilter, setExamFilter] = useState("all")
  const [practice, setPractice] = useState<PracticeScope | null>(null)
  const practiceTrigger = useRef<HTMLButtonElement | null>(null)
  const paid = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const exams = data?.openByExam ?? []
  const subjects = [...(data?.openBySubject ?? [])].sort((a, b) => b.count - a.count)
  const selectedExam = exams.some(exam => exam.examTypeId === examFilter) ? examFilter : "all"
  const visibleSubjects = subjects.filter(subject => selectedExam === "all" || subject.examTypeId === selectedExam)
  const recommended = subjects[0]
  const total = data?.openTotal ?? 0
  const recoveries = data?.recentRecoveries?.slice(0, 3) ?? []

  useEffect(() => { void refresh({ silent: true }) }, [refresh])

  const openPractice = (scope: PracticeScope, trigger: HTMLButtonElement) => {
    practiceTrigger.current = trigger
    setPractice(scope)
  }

  return <div className="flex min-w-0 flex-col gap-6" data-no-translate>
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("Работа над ошибками", "Қателермен жұмыс")}</p>
        <h1 className="mt-1 text-2xl font-semibold tracking-tight sm:text-3xl">{t("Мои ошибки", "Менің қателерім")}</h1>
        <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{t("Разберите сложные вопросы и закрепите то, что пока не получилось.", "Қиын сұрақтарды талдап, әлі меңгермеген тақырыптарды бекітіңіз.")}</p>
      </div>
      <Link href="/dashboard/history" className="inline-flex min-h-10 items-center gap-2 text-sm font-medium hover:underline">{t("История пробных", "Сынақтар тарихы")}<ArrowRight className="size-4" /></Link>
    </header>

    {error && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm">
      <p>{t("Не удалось обновить ошибки. Попробуйте загрузить их ещё раз.", "Қателерді жаңарту мүмкін болмады. Қайта жүктеп көріңіз.")}</p>
      <Button variant="outline" size="sm" disabled={isValidating} onClick={() => { void mutate().catch(() => {}) }}>{t("Повторить загрузку", "Қайта жүктеу")}</Button>
    </div>}

    {isLoading ? <section aria-busy="true" aria-label={t("Загрузка ошибок", "Қателер жүктелуде")} className="space-y-5 rounded-xl border border-border bg-card p-6"><Skeleton className="h-7 w-2/3" /><Skeleton className="h-12 w-full" /><Skeleton className="h-11 w-44" /><Skeleton className="h-32 w-full" /></section> : data && total === 0 ? <section className="rounded-xl border border-border bg-card p-6 sm:p-8" data-testid="mistakes-empty">
      <span className="mb-4 flex size-11 items-center justify-center rounded-full bg-muted"><CheckCheck className="size-5 text-muted-foreground" /></span>
      <h2 className="text-xl font-semibold">{t("Сейчас нет открытых ошибок", "Қазір ашық қателер жоқ")}</h2>
      <p className="mt-2 max-w-lg text-sm leading-relaxed text-muted-foreground">{t("После завершённого пробного здесь появятся вопросы, на которые вы ответили неверно. Если ошибки уже исправлены — можно проверить себя снова.", "Аяқталған сынақтан кейін қате жауап берген сұрақтар осында пайда болады. Қателер түзетілсе, өзіңізді қайта тексере аласыз.")}</p>
      <Button asChild className="mt-5 h-auto min-h-11 whitespace-normal py-3"><Link href="/dashboard/exams">{t("Выбрать пробный", "Сынақты таңдау")}<ArrowRight className="size-4" /></Link></Button>
    </section> : data && <>
      <section className="overflow-hidden rounded-xl border border-border bg-card" data-testid="mistakes-next-step">
        <div className="grid md:grid-cols-[minmax(0,1fr)_220px]">
          <div className="min-w-0 p-5 sm:p-6">
            <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Target className="size-4" />{t("С чего начать", "Неден бастау керек")}</p>
            <h2 className="break-words text-xl font-semibold tracking-tight sm:text-2xl">{recommended ? localize(recommended.subjectName, locale, t("Разберите один предмет", "Бір пәнді талдаңыз")) : t("Вернитесь к сложным вопросам", "Қиын сұрақтарға оралыңыз")}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{recommended ? t(`Здесь больше всего открытых ошибок: ${recommended.count}. Начните с разбора тем, затем проверьте себя в короткой тренировке.`, `Ашық қателер ең көп осы пәнде: ${recommended.count}. Тақырыптарды талдап, қысқа жаттығуда өзіңізді тексеріңіз.`) : t("Выберите экзамен и повторите вопросы из прошлых попыток.", "Емтиханды таңдап, өткен әрекеттердегі сұрақтарды қайталаңыз.")}</p>
            {recommended && <p className="mt-2 text-xs text-muted-foreground">{localize(recommended.examName, locale)}</p>}
            <div className="mt-5 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
              {recommended && <Button asChild className="h-auto min-h-11 whitespace-normal py-3"><Link href={subjectHref(recommended)}>{t("Разобрать предмет", "Пәнді талдау")}<ArrowRight className="size-4" /></Link></Button>}
              {paid && exams[0] && <Button variant="outline" disabled={Boolean(error)} className="h-auto min-h-11 whitespace-normal py-3" onClick={event => openPractice({examTypeId: recommended?.examTypeId ?? exams[0].examTypeId, subjectId: recommended?.subjectId}, event.currentTarget)}><Play className="size-4" />{t("Настроить тренировку", "Жаттығуды баптау")}</Button>}
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-4 border-t border-border bg-muted/30 p-5 sm:p-6 md:grid-cols-1 md:content-center md:border-l md:border-t-0">
            <div><dt className="text-xs text-muted-foreground">{t("Ошибок в работе", "Түзетілмеген қателер")}</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{total}</dd></div>
            <div><dt className="text-xs text-muted-foreground">{t("Предметов с ошибками", "Қате бар пәндер")}</dt><dd className="mt-1 text-3xl font-semibold tabular-nums">{subjects.length}</dd></div>
          </dl>
        </div>
      </section>

      {!paid && <section className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-border bg-muted/30 p-4 sm:p-5">
        <div className="flex min-w-0 items-start gap-3"><Crown className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><h2 className="text-sm font-semibold">{t("Тренировки и AI-разбор — с Premium", "Жаттығулар мен AI талдауы — Premium арқылы")}</h2><p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">{t("Карта ошибок доступна уже сейчас. Premium добавляет разбор причин, уроки и практику по вашим вопросам.", "Қателер картасы қазір қолжетімді. Premium қате себептерін талдауды, сабақтар мен сұрақтарыңыз бойынша жаттығуды қосады.")}</p></div></div>
        <Button asChild variant="outline" className="h-auto min-h-10 whitespace-normal py-2"><Link href="/dashboard/billing?reason=mistakes_practice" onClick={() => { void recordFunnelEvent("premium_gate", {feature:"mistakes_practice"}) }}>{t("Посмотреть тарифы", "Тарифтерді көру")}<ArrowRight className="size-4" /></Link></Button>
      </section>}

      <section className="min-w-0 overflow-hidden rounded-xl border border-border bg-card" aria-labelledby="mistakes-subjects-title">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border p-5">
          <div><h2 id="mistakes-subjects-title" className="font-semibold">{t("Ошибки по предметам", "Пәндер бойынша қателер")}</h2><p className="mt-1 text-xs text-muted-foreground">{t("Сначала — предметы с наибольшим количеством ошибок", "Алдымен — қатесі ең көп пәндер")}</p></div>
          {exams.length > 1 && <label className="flex max-w-full flex-col gap-1 text-xs text-muted-foreground">{t("Экзамен", "Емтихан")}<select aria-label={t("Фильтр по экзамену", "Емтихан бойынша сүзгі")} value={selectedExam} onChange={event => setExamFilter(event.target.value)} className="h-10 max-w-full rounded-md border border-input bg-background px-3 text-sm text-foreground"><option value="all">{t("Все экзамены", "Барлық емтихандар")}</option>{exams.map(exam => <option key={exam.examTypeId} value={exam.examTypeId}>{localize(exam.examName, locale, t("Экзамен", "Емтихан"))}</option>)}</select></label>}
        </div>
        <ul className="divide-y divide-border" data-testid="mistakes-subjects">{visibleSubjects.map(subject => {
          const name = localize(subject.subjectName, locale, t("Предмет", "Пән"))
          return <li key={`${subject.examTypeId}:${subject.subjectId}`} className="flex flex-wrap items-center gap-x-3 px-4 py-2 sm:px-5">
            <Link href={subjectHref(subject)} className="group flex min-w-0 flex-1 basis-48 items-center gap-3 rounded-lg py-3 focus-visible:outline-2 focus-visible:outline-ring">
              <BookOpen className="hidden size-4 shrink-0 text-muted-foreground sm:block" />
              <div className="min-w-0 flex-1"><h3 className="break-words text-sm font-medium group-hover:underline">{name}</h3><p className="mt-1 text-xs text-muted-foreground">{localize(subject.examName, locale)} · {t("Ошибок", "Қателер")}: <span className="font-medium tabular-nums text-foreground">{subject.count}</span></p></div>
              <ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link>
            {paid && <Button variant="outline" size="sm" disabled={Boolean(error)} className="mb-2 min-h-9 sm:mb-0" aria-label={`${t("Тренировать", "Жаттығу")}: ${name}`} onClick={event => openPractice({examTypeId:subject.examTypeId, subjectId:subject.subjectId}, event.currentTarget)}><Play className="size-3.5" />{t("Тренировать", "Жаттығу")}</Button>}
          </li>
        })}</ul>
        <p className="border-t border-border px-5 py-3 text-xs leading-relaxed text-muted-foreground">{t("Здесь вопросы, на которые вы в последний раз ответили неверно. После правильного ответа в завершённом тесте ошибка исчезнет из списка.", "Мұнда соңғы рет қате жауап берген сұрақтар көрсетілген. Аяқталған тестте дұрыс жауап бергеннен кейін қате тізімнен жойылады.")}</p>
      </section>
    </>}

    {data && recoveries.length > 0 && <section className="rounded-xl border border-border bg-card p-5" aria-labelledby="mistakes-recovered-title">
      <h2 id="mistakes-recovered-title" className="flex items-center gap-2 text-sm font-semibold"><CheckCheck className="size-4 text-emerald-600 dark:text-emerald-400" />{t("Недавно исправлены", "Жақында түзетілген")}</h2>
      <p className="mt-1 text-xs text-muted-foreground">{t("В этих вопросах неверный ответ сменился правильным.", "Бұл сұрақтарда қате жауап дұрыс жауапқа ауысты.")}</p>
      <ul className="mt-3 divide-y divide-border">{recoveries.map((item, index) => <li key={`${item.sessionId}:${item.questionId}:${index}`}><Link href={`/exam/${item.sessionId}/review`} className="flex min-h-12 items-center justify-between gap-3 py-2 text-sm hover:underline"><span className="min-w-0 break-words">{localize(item.subjectName, locale, t("Предмет", "Пән"))}<span className="mt-0.5 block text-xs text-muted-foreground">{localize(item.examName, locale)} · {new Date(item.recoveredAt).toLocaleDateString(locale === "kk" ? "kk-KZ" : "ru-RU", {day:"2-digit",month:"2-digit",year:"numeric"})}</span></span><ArrowRight className="size-4 shrink-0 text-muted-foreground" /></Link></li>)}</ul>
    </section>}

    {practice && data && <MistakesPracticeDialog summary={data} initialScope={practice} onClose={() => setPractice(null)} onRestoreFocus={() => practiceTrigger.current?.focus()} />}
  </div>
}
