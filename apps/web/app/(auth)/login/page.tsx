"use client"

import { Suspense, useEffect } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { ArrowRight, Check, Gift, LockKeyhole, Route, Sparkles } from "lucide-react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PhoneForm } from "@/components/auth/phone-form"
import { GoogleButton } from "@/components/auth/google-button"
import { useAuth } from "@/lib/api/auth-context"
import { getTelegramBotLink, getTelegramBotUsername } from "@/lib/telegram"

export default function LoginPage() {
  return (
    <Suspense fallback={<LoginLoadingState />}>
      <LoginContent />
    </Suspense>
  )
}

function LoginContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { isAuthenticated, isLoading } = useAuth()
  const botUsername = getTelegramBotUsername()
  const botLink = getTelegramBotLink("web")
  const source = searchParams.get("source")
  const currentScore = parseScore(searchParams.get("score"))
  const targetScore = parseScore(searchParams.get("target"))
  const profile = searchParams.get("profile")
  const fromDiagnostic = source === "diagnostic" && currentScore !== null && targetScore !== null
  const hasGoogle = Boolean(process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID)

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard")
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return <LoginLoadingState />
  }

  return (
    <div className="grid w-full max-w-5xl grid-cols-1 gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-center lg:gap-14">
      <div className="flex flex-col gap-4 md:pr-4">
        <span className="inline-flex w-fit items-center gap-2 rounded-full border border-accent/20 bg-accent/8 px-3 py-1.5 text-xs font-semibold text-accent">
          <Gift className="size-3.5" />
          1 полный пробный бесплатно · без карты
        </span>
        <h1 className="text-balance text-3xl font-semibold leading-[1.05] tracking-tight sm:text-4xl lg:text-5xl">
          {fromDiagnostic ? (
            <>
              Маршрут готов. Осталось проверить{" "}
              <span className="font-serif font-normal italic text-accent">точку A.</span>
            </>
          ) : (
            <>
              Начни с бесплатного пробного{" "}
              <span className="font-serif font-normal italic text-accent">ЕНТ 2027.</span>
            </>
          )}
        </h1>
        <p className="text-pretty text-base text-muted-foreground leading-relaxed">
          Один аккаунт сохраняет результаты, слабые темы и прогресс. Первый полный
          пробный откроется сразу после входа — покупать тариф заранее не нужно.
        </p>

        {fromDiagnostic && (
          <div className="rounded-2xl border border-border bg-card p-4 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-accent">
              <Route className="size-4" />
              Твой маршрут сохранён
            </div>
            <div className="mt-4 grid grid-cols-3 gap-2">
              <JourneyMetric label="Сейчас" value={currentScore} />
              <JourneyMetric
                label="До цели"
                value={Math.max(0, targetScore - currentScore)}
                accent
              />
              <JourneyMetric label="Цель" value={targetScore} />
            </div>
            {profile && (
              <p className="mt-3 truncate text-xs text-muted-foreground">{profile}</p>
            )}
          </div>
        )}

        <ul className="mt-1 grid gap-2 text-sm text-muted-foreground sm:grid-cols-3 md:grid-cols-1">
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-accent" /> 140 вопросов и реальный таймер
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-accent" /> Результат и слабые темы сразу
          </li>
          <li className="flex items-center gap-2">
            <Check className="size-4 shrink-0 text-accent" /> Без карты и скрытой подписки
          </li>
        </ul>
      </div>

      <Card className="w-full overflow-hidden border-border/80 shadow-[0_30px_90px_-45px_oklch(0.18_0.012_60_/_0.4)]">
        <div className="flex items-center justify-between gap-3 border-b border-border bg-secondary/45 px-5 py-3 text-xs sm:px-6">
          <span className="inline-flex items-center gap-1.5 font-medium text-foreground">
            <Sparkles className="size-3.5 text-accent" />
            Займёт около минуты
          </span>
          <span className="inline-flex items-center gap-1.5 text-muted-foreground">
            <LockKeyhole className="size-3.5" />
            Данные защищены
          </span>
        </div>
        <CardHeader className="space-y-1 px-5 pb-4 pt-6 sm:px-6">
          <CardTitle className="text-2xl">
            {fromDiagnostic ? "Сохрани результат" : "Войти или создать аккаунт"}
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Выбери удобный способ — новый аккаунт создастся автоматически
          </p>
        </CardHeader>
        <CardContent className="px-5 pb-6 sm:px-6">
          <Tabs defaultValue={hasGoogle ? "google" : "phone"} className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="google">Google</TabsTrigger>
              <TabsTrigger value="phone">Телефон</TabsTrigger>
            </TabsList>
            <TabsContent value="google" className="mt-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground text-center">
                Самый быстрый способ — без кода и Telegram
              </p>
              <GoogleButton />
            </TabsContent>
            <TabsContent value="phone" className="mt-6 space-y-5">
              <PhoneForm />
              <p className="text-center text-xs leading-relaxed text-muted-foreground">
                Код придёт в Telegram. Если номер ещё не привязан,{" "}
                <a
                  href={botLink}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-foreground underline underline-offset-4"
                >
                  открой @{botUsername}
                </a>
                .
              </p>
            </TabsContent>
          </Tabs>

          <p className="mt-6 flex items-center justify-center gap-1.5 border-t border-border pt-4 text-center text-xs text-muted-foreground">
            После входа сразу откроем выбор профильных предметов
            <ArrowRight className="size-3.5" />
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

function JourneyMetric({
  label,
  value,
  accent = false,
}: {
  label: string
  value: number
  accent?: boolean
}) {
  return (
    <div className={`rounded-xl p-3 ${accent ? "bg-accent/10" : "bg-secondary/70"}`}>
      <div className={`font-mono text-xl font-semibold ${accent ? "text-accent" : ""}`}>
        {value}
      </div>
      <div className="mt-0.5 text-[11px] text-muted-foreground">{label}</div>
    </div>
  )
}

function LoginLoadingState() {
  return (
    <div
      className="grid w-full max-w-5xl animate-pulse grid-cols-1 gap-8 md:grid-cols-[0.95fr_1.05fr] md:items-center lg:gap-14"
      aria-label="Загружаем вход"
      role="status"
    >
      <div className="space-y-4">
        <div className="h-7 w-52 rounded-full bg-muted" />
        <div className="h-12 w-full max-w-md rounded-xl bg-muted" />
        <div className="h-12 w-4/5 max-w-sm rounded-xl bg-muted" />
        <div className="h-16 w-full max-w-md rounded-xl bg-muted/70" />
      </div>
      <div className="h-[25rem] rounded-2xl border border-border bg-card shadow-sm">
        <div className="h-11 border-b border-border bg-muted/50" />
        <div className="space-y-5 p-6">
          <div className="h-8 w-44 rounded-lg bg-muted" />
          <div className="h-10 w-full rounded-xl bg-muted" />
          <div className="h-11 w-full rounded-xl bg-muted" />
          <div className="h-11 w-full rounded-xl bg-muted" />
        </div>
      </div>
      <span className="sr-only">Загружаем форму входа…</span>
    </div>
  )
}

function parseScore(value: string | null) {
  if (value === null) return null
  const parsed = Number(value)
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 140 ? Math.round(parsed) : null
}
