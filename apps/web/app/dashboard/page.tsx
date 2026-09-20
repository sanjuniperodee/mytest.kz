"use client"

import Link from "next/link"
import useSWR from "swr"
import { ArrowRight, BookOpen, Flame, MessageCircle, Target, Trophy, TrendingUp } from "lucide-react"
import { useUiI18n } from "@/lib/i18n/ui"
import { getFormatLocale } from "@/lib/i18n/locale"
import { useAuth } from "@/lib/api/auth-context"
import { localize } from "@/lib/api/i18n"
import { formatBestPoints } from "@/lib/dashboard/format"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AdmissionGoalCard } from "@/components/dashboard/admission-goal-card"
import { SessionStatusBadge } from "@/components/dashboard/data-display"
import type { ExamType, MistakesSummary, SessionListItem, UserStats } from "@/lib/api/types"

type SessionsResponse = { items?: SessionListItem[] } | SessionListItem[]
const sessionsList = (data?: SessionsResponse) => Array.isArray(data) ? data : data?.items ?? []

export default function DashboardHomePage() {
  const { user } = useAuth()
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => locale === "kk" ? kk : ru
  const stats = useSWR<UserStats>("/users/me/stats")
  const summary = useSWR<MistakesSummary>("/tests/mistakes/summary")
  const recent = useSWR<SessionsResponse>("/tests/sessions?page=1&limit=4")
  // An unfinished attempt may be older than the four recent sessions.
  const active = useSWR<SessionsResponse>("/tests/sessions?page=1&limit=1&status=in_progress")
  const exams = useSWR<ExamType[]>("/exams/types")
  const requests = [stats, summary, recent, active, exams]
  const failed = requests.some(request => request.error)
  const retry = () => { void Promise.allSettled(requests.map(request => request.mutate())) }
  const name = user?.firstName || user?.telegramUsername || user?.username
  const sessions = sessionsList(recent.data)
  const inProgress = sessionsList(active.data)[0] ?? sessions.find(session => session.status === "in_progress")
  const ent = exams.data?.find(exam => exam.slug === "ent")
  const access = user?.accessByExam?.find(item => item.examSlug === "ent")
  const freeRemaining = user?.trialStatus?.ent.freeRemaining ?? user?.trialStatus?.ent.remaining ?? 0
  const paid = Boolean(user?.hasActiveSubscription || user?.currentTariff?.isPaid)
  const dailyLimit = access?.reasonCode === "DAILY_LIMIT_REACHED"
  const needsAccess = access?.hasAccess === false && !dailyLimit
  const examHref = ent ? `/dashboard/exams/${ent.id}` : "/dashboard/exams"
  const startHref = needsAccess ? "/dashboard/billing?reason=no_access" : examHref
  const openMistakes = summary.data?.openTotal ?? 0
  const entStats = stats.data?.byExamType?.find(item => item.examSlug === "ent")
  const impact = summary.data?.scoreImpact
  const completed = stats.data?.completedTests
  const next = inProgress ? {
    kind: "continue", title: t("Продолжите начатый пробный", "Бастаған сынақты жалғастырыңыз"),
    text: t("Ответы сохранены. Вернитесь к тесту, который ещё не завершён.", "Жауаптар сақталған. Әлі аяқталмаған тестке оралыңыз."),
    label: t("Продолжить пробный", "Сынақты жалғастыру"), href: `/exam/${inProgress.id}`,
  } : active.error ? {
    kind: "history", title: t("Продолжим подготовку", "Дайындықты жалғастырайық"),
    text: t("Не удалось проверить незавершённые попытки. Их можно найти в истории.", "Аяқталмаған әрекеттерді тексеру мүмкін болмады. Оларды тарихтан табуға болады."),
    label: t("Открыть историю", "Тарихты ашу"), href: "/dashboard/history",
  } : openMistakes > 0 ? {
    kind: "mistakes", title: t("Разберите ошибки перед новым тестом", "Жаңа тестке дейін қателерді талдаңыз"),
    text: t(`В работе ${openMistakes} ошибок. Начните с одной темы и закрепите её тренировкой.`, `Қателер саны: ${openMistakes}. Бір тақырыптан бастап, жаттығумен бекітіңіз.`),
    label: t("Работать над ошибками", "Қателермен жұмыс істеу"), href: "/dashboard/mistakes",
  } : dailyLimit ? {
    kind: "daily-limit", title: t("Лимит пробных на сегодня исчерпан", "Бүгінгі сынақтар лимиті таусылды"),
    text: t("Пока можно вернуться к решениям и повторить пройденные темы.", "Әзірге шешімдерді қарап, өткен тақырыптарды қайталауға болады."),
    label: t("Посмотреть результаты", "Нәтижелерді көру"), href: "/dashboard/history",
  } : needsAccess ? {
    kind: "access", title: t("Выберите доступ к следующему пробному", "Келесі сынаққа қолжетімділікті таңдаңыз"),
    text: t("Предыдущие результаты остаются в истории. Для новой попытки выберите подходящий пакет.", "Алдыңғы нәтижелер тарихта сақталады. Жаңа әрекет үшін қолайлы пакетті таңдаңыз."),
    label: t("Посмотреть пакеты", "Пакеттерді көру"), href: startHref,
  } : {
    kind: "start", title: !paid && freeRemaining > 0 ? t("Начните с бесплатного пробного", "Тегін сынақтан бастаңыз") : t("Проверьте себя на новом пробном", "Жаңа сынақта өзіңізді тексеріңіз"),
    text: t("Узнайте свой результат и темы, которым стоит уделить внимание. Выберите предметы перед началом.", "Нәтижеңізді және назар аудару керек тақырыптарды біліңіз. Бастамас бұрын пәндерді таңдаңыз."),
    label: t("Выбрать пробный", "Сынақты таңдау"), href: startHref,
  }
  const actionLoading = active.isLoading || summary.isLoading || exams.isLoading
  const tariff = localize(user?.currentTariff?.name, locale) || (paid ? t("Платный доступ", "Ақылы қолжетімділік") : t("Стартовый доступ", "Бастапқы қолжетімділік"))
  const remaining = !access ? "—" : access.total.isUnlimited ? t("Без лимита", "Шектеусіз") : String(access.total.remaining ?? "—")
  const finiteLimits = access ? [access.total, access.daily].filter(limit => !limit.isUnlimited) : []
  const today = !access ? "—" : finiteLimits.length === 0 ? t("Без лимита", "Шектеусіз")
    : finiteLimits.some(limit => limit.remaining == null) ? "—" : String(Math.max(0, Math.min(...finiteLimits.map(limit => limit.remaining!))))

  return <div className="flex min-w-0 flex-col gap-6">
    <header className="flex flex-wrap items-start justify-between gap-3" data-no-translate>
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t("Моя подготовка", "Менің дайындығым")}</p>
        <h1 className="mt-1 break-words text-2xl font-semibold tracking-tight sm:text-3xl">{t("Привет", "Сәлем")}{name ? `, ${name}` : ""}!</h1>
      </div>
      {(stats.data?.weeklyStreak ?? 0) > 0 && <span className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-xs text-muted-foreground"><Flame className="size-3.5 text-orange-500" />{stats.data?.weeklyStreak} {t("нед. подряд", "апта қатарынан")}</span>}
    </header>

    {failed && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-4 text-sm" data-no-translate><span>{t("Часть данных не загрузилась. Доступные разделы продолжают работать.", "Кейбір деректер жүктелмеді. Қолжетімді бөлімдер жұмыс істейді.")}</span><Button variant="outline" size="sm" onClick={retry}>{t("Повторить загрузку", "Қайта жүктеу")}</Button></div>}

    <section className="overflow-hidden rounded-xl border border-border bg-card" aria-label={t("Следующий шаг", "Келесі қадам")} data-testid="dashboard-next-step" data-no-translate>
      <div className="grid md:grid-cols-[minmax(0,1fr)_260px]">
        <div className="min-w-0 p-5 sm:p-6">
          <p className="mb-3 flex items-center gap-2 text-xs font-medium text-muted-foreground"><Target className="size-4" />{t("Следующий шаг", "Келесі қадам")}</p>
          {actionLoading ? <div className="space-y-3" aria-busy="true"><Skeleton className="h-7 w-3/4" /><Skeleton className="h-10 w-full" /><Skeleton className="h-11 w-44" /></div> : <>
            <h2 className="max-w-lg text-xl font-semibold tracking-tight sm:text-2xl">{next.title}</h2>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">{next.text}</p>
            <Button asChild className="mt-5 h-auto min-h-11 w-full whitespace-normal py-3 sm:w-auto" data-action={next.kind}><Link href={next.href}>{next.label}<ArrowRight className="size-4" /></Link></Button>
          </>}
        </div>
        <div className="border-t border-border bg-muted/30 p-5 sm:p-6 md:border-l md:border-t-0">
          <p className="text-xs text-muted-foreground">{t("Ваш доступ", "Сіздің қолжетімділігіңіз")}</p>
          <p className="mt-1 break-words font-semibold">{tariff}</p>
          <dl className="mt-4 space-y-2 text-sm">
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t("Попыток осталось", "Қалған әрекеттер")}</dt><dd className="text-right font-medium tabular-nums">{remaining}</dd></div>
            <div className="flex justify-between gap-3"><dt className="text-muted-foreground">{t("Можно сегодня", "Бүгін қолжетімді")}</dt><dd className="text-right font-medium tabular-nums">{today}</dd></div>
          </dl>
          <Link href="/dashboard/billing" className="mt-4 inline-flex min-h-9 items-center gap-1 text-xs font-medium underline-offset-4 hover:underline">{t("Управлять доступом", "Қолжетімділікті басқару")}<ArrowRight className="size-3" /></Link>
        </div>
      </div>
    </section>

    <section aria-label={t("Результаты подготовки", "Дайындық нәтижелері")} className="grid grid-cols-1 divide-y divide-border rounded-xl border border-border bg-card sm:grid-cols-3 sm:divide-x sm:divide-y-0" data-no-translate>
      {[
        [t("Завершено пробных", "Аяқталған сынақтар"), completed ?? "—"],
        [t("Лучший результат ЕНТ", "ҰБТ-дағы үздік нәтиже"), entStats ? formatBestPoints(entStats) : "—"],
        [t("Средний результат всех тестов", "Барлық тесттердің орташа нәтижесі"), completed && stats.data ? `${Math.round(stats.data.averageScore)}%` : "—"],
      ].map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 p-4 sm:block sm:p-5"><p className="text-xs text-muted-foreground">{label}</p>{stats.isLoading ? <Skeleton className="mt-1 h-7 w-16" /> : <p className="text-xl font-semibold tabular-nums sm:mt-1 sm:text-2xl">{value}</p>}</div>)}
    </section>

    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      <Card className="min-w-0 gap-4 py-5">
        <CardHeader className="flex flex-wrap flex-row items-center justify-between gap-2 px-5" data-no-translate>
          <CardTitle className="text-base">{t("Последние пробные", "Соңғы сынақтар")}</CardTitle>
          <Link href="/dashboard/history" className="inline-flex min-h-9 items-center gap-1 text-xs font-medium hover:underline">{t("Вся история", "Барлық тарих")}<ArrowRight className="size-3.5" /></Link>
        </CardHeader>
        <CardContent className="px-5">
          {recent.isLoading ? <div className="space-y-3"><Skeleton className="h-16 w-full" /><Skeleton className="h-16 w-full" /></div> : recent.error && !recent.data ? <p className="py-4 text-sm text-muted-foreground" data-no-translate>{t("История временно недоступна. Попробуйте обновить данные.", "Тарих уақытша қолжетімсіз. Деректерді жаңартып көріңіз.")}</p> : sessions.length === 0 ? <div className="rounded-lg border border-dashed border-border p-5" data-no-translate>
            <BookOpen className="mb-3 size-5 text-muted-foreground" /><p className="font-medium">{t("Здесь появятся ваши результаты", "Нәтижелеріңіз осында пайда болады")}</p><p className="mt-1 text-sm leading-relaxed text-muted-foreground">{t("После первого пробного вы сможете открыть разбор ответов и сравнивать попытки.", "Бірінші сынақтан кейін жауаптарды талдап, әрекеттерді салыстыра аласыз.")}</p>
          </div> : <ul className="divide-y divide-border">{sessions.map(session => {
            const finished = session.status === "completed" || session.status === "timed_out"
            const href = session.status === "in_progress" ? `/exam/${session.id}` : finished ? `/exam/${session.id}/review` : "/dashboard/history"
            return <li key={session.id}><Link href={href} className="-mx-2 flex min-w-0 items-center gap-3 rounded-lg px-2 py-4 transition-colors hover:bg-muted/50">
              <div className="min-w-0 flex-1"><p className="truncate text-sm font-medium" data-no-translate>{localize(session.examType?.name, locale) || t("Пробный тест", "Сынақ тесті")}</p><div className="mt-1.5 flex flex-wrap items-center gap-2 text-xs text-muted-foreground"><span data-no-translate>{session.startedAt ? new Date(session.startedAt).toLocaleDateString(getFormatLocale(), {day:"numeric",month:"short"}) : "—"}</span><SessionStatusBadge status={session.status} /></div></div>
              <span className="shrink-0 text-right text-sm font-semibold tabular-nums">{finished && session.rawScore != null && session.maxScore != null ? `${session.rawScore}/${session.maxScore}` : finished && session.score != null ? `${Math.round(session.score)}%` : ""}</span><ArrowRight className="size-4 shrink-0 text-muted-foreground" />
            </Link></li>
          })}</ul>}
        </CardContent>
      </Card>
      <div className="min-w-0"><AdmissionGoalCard currentScore={impact?.available ? impact.lastScore : null} potentialScore={null} /></div>
    </div>

    <nav className="grid gap-3 sm:grid-cols-3" aria-label={t("Другие разделы", "Басқа бөлімдер")} data-no-translate>
      {[
        {href:"/dashboard/stats",Icon:TrendingUp,title:t("Мой прогресс", "Менің жетістігім"),text:t("Динамика результатов по предметам", "Пәндер бойынша нәтижелер динамикасы")},
        {href:"/dashboard/community",Icon:MessageCircle,title:t("Сообщество", "Қауымдастық"),text:t("Обсуждения и помощь с подготовкой", "Талқылаулар мен дайындыққа көмек")},
        {href:"/dashboard/leaderboard",Icon:Trophy,title:t("Лидерборд", "Көшбасшылар"),text:t("Результаты других участников", "Басқа қатысушылардың нәтижелері")},
      ].map(({href,Icon,title,text}) => <Link key={href} href={href} className="flex min-w-0 items-start gap-3 rounded-xl border border-border bg-card p-4 transition-colors hover:bg-muted/50"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div><p className="text-sm font-medium">{title}</p><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{text}</p></div></Link>)}
    </nav>
  </div>
}
