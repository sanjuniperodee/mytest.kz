"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckCircle2, ExternalLink, RefreshCw, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/api/auth-context"

const CHANNEL_URL =
  process.env.NEXT_PUBLIC_TELEGRAM_CHANNEL_URL || "https://t.me/bilimilimland"

export default function ChannelGatePage() {
  const router = useRouter()
  const { refresh } = useAuth()
  const [checking, setChecking] = useState(false)

  async function checkSubscription() {
    setChecking(true)
    try {
      const updated = await refresh()
      if (updated?.isChannelMember) {
        toast.success("Подписка подтверждена")
        router.replace("/dashboard")
        return
      }
      toast.error("Подписка пока не найдена")
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="mx-auto flex min-h-[calc(100svh-8rem)] max-w-xl items-center">
      <Card className="w-full rounded-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-2 flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Send className="size-5" />
          </div>
          <CardTitle className="text-2xl">Подпишитесь на канал</CardTitle>
          <CardDescription className="text-base">
            Чтобы открыть пробные тесты MyTest, подпишитесь на наш Telegram-канал.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          <p className="text-center text-sm text-muted-foreground">
            После подписки вернитесь сюда и нажмите проверку.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            <Button asChild size="lg">
              <a href={CHANNEL_URL} target="_blank" rel="noreferrer">
                <ExternalLink className="size-4" />
                Открыть канал
              </a>
            </Button>
            <Button
              type="button"
              size="lg"
              variant="outline"
              onClick={checkSubscription}
              disabled={checking}
            >
              {checking ? (
                <Spinner className="size-4" />
              ) : (
                <RefreshCw className="size-4" />
              )}
              {checking ? "Проверяем..." : "Проверить подписку"}
            </Button>
          </div>

          <div className="flex items-start gap-3 rounded-md border bg-secondary/50 p-3 text-sm text-muted-foreground">
            <CheckCircle2 className="mt-0.5 size-4 shrink-0 text-primary" />
            <span>Подписка нужна только для пользователей, которые вошли через Telegram.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
