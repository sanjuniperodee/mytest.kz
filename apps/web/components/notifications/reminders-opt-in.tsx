"use client"

import { useEffect, useState } from "react"
import useSWR from "swr"
import { BellRing, Send } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Spinner } from "@/components/ui/spinner"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { useUiI18n } from "@/lib/i18n/ui"
import { isTelegramWebAppLaunch } from "@/lib/telegram-webapp"
import {
  enablePush,
  readPushState,
  syncExistingPushSubscription,
  type PushState,
} from "@/lib/notifications/web-push"

const DISMISS_KEY = "mytest:reminders-optin-dismissed-until"
const DISMISS_DAYS = 14

type PublicKeyResponse = { enabled: boolean; publicKey: string | null }
type TelegramLinkResponse = { linked: boolean; url: string | null }

function dismissedNow() {
  try {
    return Number(window.localStorage.getItem(DISMISS_KEY) || 0) > Date.now()
  } catch {
    return false
  }
}

/**
 * «Включить напоминания»: web push and/or Telegram for accounts that have neither.
 * Asks for the browser permission only after a click; hidden once a channel is on,
 * when nothing is available (unsupported/denied push, Telegram already linked) or after «Не сейчас».
 */
export function RemindersOptIn({ className }: { className?: string }) {
  const { user, refresh } = useAuth()
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => (locale === "kk" ? kk : ru)
  const { data: pushConfig } = useSWR<PublicKeyResponse>("/notifications/push/public-key")
  const [pushState, setPushState] = useState<PushState | "checking">("checking")
  const [dismissed, setDismissed] = useState(true)
  const [busy, setBusy] = useState<"push" | "telegram" | null>(null)
  const [waitingTelegram, setWaitingTelegram] = useState(false)
  const userId = user?.id

  useEffect(() => {
    setDismissed(dismissedNow())
    readPushState()
      .then(setPushState)
      .catch(() => setPushState("unsupported"))
  }, [])

  // Already subscribed in this browser: keep the server copy fresh (no prompt).
  useEffect(() => {
    if (pushState === "subscribed" && userId) void syncExistingPushSubscription(userId).catch(() => undefined)
  }, [pushState, userId])

  // After «Подключить Telegram» the link is confirmed in the bot; pick it up when the user comes back.
  useEffect(() => {
    if (!waitingTelegram) return
    const onReturn = () => {
      if (document.visibilityState === "visible") void refresh({ silent: true })
    }
    window.addEventListener("focus", onReturn)
    document.addEventListener("visibilitychange", onReturn)
    return () => {
      window.removeEventListener("focus", onReturn)
      document.removeEventListener("visibilitychange", onReturn)
    }
  }, [waitingTelegram, refresh])

  const turnOnPush = async () => {
    const publicKey = pushConfig?.publicKey
    if (!publicKey) return
    setBusy("push")
    try {
      const result = await enablePush(publicKey)
      if (result === "subscribed") {
        setPushState("subscribed")
        toast.success(t("Напоминания включены", "Еске салғыштар қосылды"))
      } else if (result === "denied") {
        setPushState("denied")
        toast.error(
          t(
            "Уведомления запрещены в браузере. Их можно разрешить в настройках сайта.",
            "Браузерде хабарландыруларға тыйым салынған. Оларды сайт баптауларынан рұқсат етуге болады.",
          ),
        )
      }
    } catch {
      toast.error(t("Не удалось включить напоминания. Попробуйте ещё раз.", "Еске салғыштарды қосу мүмкін болмады. Қайталап көріңіз."))
    } finally {
      setBusy(null)
    }
  }

  const connectTelegram = async () => {
    setBusy("telegram")
    // Open the tab inside the click so popup blockers allow it; the URL comes from the API.
    const tab = window.open("", "_blank")
    try {
      const res = await api<TelegramLinkResponse>("/notifications/telegram/link", { method: "POST" })
      if (res.linked || !res.url) {
        tab?.close()
        await refresh({ silent: true })
        return
      }
      if (tab) {
        tab.opener = null
        tab.location.href = res.url
      } else {
        window.location.href = res.url
      }
      setWaitingTelegram(true)
      toast(t("Нажмите «Start» в Telegram — и готово", "Telegram-да «Start» батырмасын басыңыз — болды"))
    } catch (e) {
      tab?.close()
      toast.error(
        e instanceof ApiError && e.status === 503
          ? t("Telegram сейчас недоступен. Попробуйте позже.", "Telegram қазір қолжетімсіз. Кейінірек көріңіз.")
          : t("Не удалось получить ссылку. Попробуйте ещё раз.", "Сілтеме алу мүмкін болмады. Қайталап көріңіз."),
      )
    } finally {
      setBusy(null)
    }
  }

  const dismiss = () => {
    try {
      window.localStorage.setItem(DISMISS_KEY, String(Date.now() + DISMISS_DAYS * 24 * 3600 * 1000))
    } catch {
      // Private mode: hide for this view only.
    }
    setDismissed(true)
  }

  if (!user || dismissed || pushState === "checking") return null
  const pushOn = pushState === "subscribed"
  const telegramOn = Boolean(user.telegramId)
  // One working channel is enough — don't keep asking.
  if (pushOn || telegramOn) return null
  const canPush = Boolean(pushConfig?.enabled && pushConfig.publicKey) && (pushState === "default" || pushState === "granted")
  const canTelegram = !isTelegramWebAppLaunch()
  if (!canPush && !canTelegram) return null

  return (
    <section
      className={`rounded-xl border border-border bg-card p-4 sm:p-5 ${className ?? ""}`}
      aria-labelledby="reminders-opt-in-title"
      data-testid="reminders-opt-in"
      data-no-translate
    >
      <div className="flex items-start gap-3">
        <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-muted">
          <BellRing className="size-4" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="reminders-opt-in-title" className="text-base font-semibold tracking-tight">
            {t("Не пропустите бесплатный ЕНТ", "Тегін ҰБТ-ны өткізіп алмаңыз")}
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
            {t(
              "Напомним, когда откроется новый бесплатный пробный, пришлём итог теста и ответы в сообществе. Только важное, без спама.",
              "Жаңа тегін сынақ ашылғанда еске саламыз, тест нәтижесі мен қауымдастықтағы жауаптарды жібереміз. Тек маңыздысы, спамсыз.",
            )}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canPush && (
              <Button size="sm" onClick={() => void turnOnPush()} disabled={busy !== null} data-action="enable-push">
                {busy === "push" ? <Spinner className="size-4" /> : <BellRing className="size-4" />}
                {t("Включить напоминания", "Еске салғыштарды қосу")}
              </Button>
            )}
            {canTelegram && (
              <Button
                size="sm"
                variant={canPush ? "outline" : "default"}
                onClick={() => void connectTelegram()}
                disabled={busy !== null}
                data-action="connect-telegram"
              >
                {busy === "telegram" ? <Spinner className="size-4" /> : <Send className="size-4" />}
                {t("Подключить Telegram", "Telegram қосу")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss} disabled={busy !== null}>
              {t("Не сейчас", "Қазір емес")}
            </Button>
          </div>
        </div>
      </div>
    </section>
  )
}
