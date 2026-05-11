"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Separator } from "@/components/ui/separator"
import { PhoneForm } from "@/components/auth/phone-form"
import { GoogleButton } from "@/components/auth/google-button"
import { useAuth } from "@/lib/api/auth-context"
import { Spinner } from "@/components/ui/spinner"
import { getTelegramBotLink, getTelegramBotUsername } from "@/lib/telegram"

export default function LoginPage() {
  const router = useRouter()
  const { isAuthenticated, isLoading } = useAuth()
  const botUsername = getTelegramBotUsername()
  const botLink = getTelegramBotLink("web")

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/dashboard")
  }, [isAuthenticated, isLoading, router])

  if (isLoading) {
    return (
      <div className="flex items-center justify-center">
        <Spinner className="size-6" />
      </div>
    )
  }

  return (
    <div className="grid w-full max-w-5xl grid-cols-1 gap-10 md:grid-cols-2 md:items-center">
      <div className="hidden md:flex flex-col gap-4 pr-8">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-secondary-foreground">
          <span className="size-1.5 rounded-full bg-accent" />
          Подготовка к ЕНТ 2026
        </span>
        <h1 className="text-balance text-4xl font-semibold tracking-tight leading-[1.05]">
          Войди в <span className="font-serif italic">mytest</span> и продолжи готовиться к экзамену
        </h1>
        <p className="text-pretty text-base text-muted-foreground leading-relaxed">
          Один аккаунт — пробные ЕНТ, разбор ошибок, аналитика и работа над ошибками.
          Первый пробный — бесплатно.
        </p>
        <ul className="mt-2 flex flex-col gap-2 text-sm text-muted-foreground">
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-foreground" /> Реальный формат ЕНТ
          </li>
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-foreground" /> Разбор вопросов после теста
          </li>
          <li className="flex items-center gap-2">
            <span className="size-1.5 rounded-full bg-foreground" /> Аналитика по предметам
          </li>
        </ul>
      </div>

      <Card className="w-full">
        <CardHeader className="space-y-1">
          <CardTitle className="text-2xl">Вход</CardTitle>
          <p className="text-sm text-muted-foreground">
            Войдите, чтобы получить доступ к пробным ЕНТ
          </p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="phone" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="phone">Телефон</TabsTrigger>
              <TabsTrigger value="google">Google</TabsTrigger>
            </TabsList>
            <TabsContent value="phone" className="mt-6">
              <PhoneForm />
            </TabsContent>
            <TabsContent value="google" className="mt-6 flex flex-col items-center gap-3">
              <p className="text-sm text-muted-foreground text-center">
                Используйте свой Google-аккаунт для быстрого входа
              </p>
              <GoogleButton />
            </TabsContent>
          </Tabs>

          <Separator className="my-6" />

          <p className="text-center text-sm text-muted-foreground">
            Для входа по телефону сначала{" "}
            <a
              href={botLink}
              target="_blank"
              rel="noreferrer"
              className="font-medium text-foreground hover:underline"
            >
              привяжите номер в @{botUsername}
            </a>
            , затем вернитесь и получите код.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
