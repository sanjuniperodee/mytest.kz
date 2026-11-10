"use client"

import { useState } from "react"
import { Check, Copy, Loader2, MessageCircle, Send } from "lucide-react"
import { toast } from "sonner"
import type { ParentPayLinkDto } from "@bilimland/shared"
import { Button } from "@/components/ui/button"
import { api } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { useUiI18n } from "@/lib/i18n/ui"
import { openShareTarget } from "@/lib/share-target"
import { cn } from "@/lib/utils"

/**
 * «Отправить родителю ссылку на оплату». Ссылка /pay/<token> живёт 30 дней и открывается без
 * входа: родитель сам выбирает способ и платит со своего Kaspi, доступ получает ученик.
 * Раньше родителю уходила ссылка Kaspi, которая действует 5 минут, — он не успевал её открыть.
 */

type Channel = "whatsapp" | "telegram" | "copy"

export function ParentPayShare({
  planId,
  planName,
  amountLabel,
  placement,
  invoiceId,
  invoiceSent = false,
  className,
}: {
  planId: string
  planName: string
  /** Сумма с валютой, как её видит ученик: «2 990 ₸». */
  amountLabel: string
  placement: "billing_modal" | "kaspi_page"
  invoiceId?: string | null
  /** Счёт уже ушёл на номер родителя — в сообщении говорим и про счёт, и про ссылку. */
  invoiceSent?: boolean
  className?: string
}) {
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => (locale === "kk" ? kk : ru)
  const [created, setCreated] = useState<{ planId: string; url: string } | null>(null)
  const [busy, setBusy] = useState<Channel | null>(null)
  const [copied, setCopied] = useState(false)
  const link = created?.planId === planId ? created.url : null

  // Родитель откроет страницу на том же языке, что и интерфейс ученика.
  const withLang = (url: string) => (locale === "kk" ? `${url}${url.includes("?") ? "&" : "?"}lang=kk` : url)

  const body = invoiceSent
    ? t(
        `Привет! Я отправил(а) тебе счёт в Kaspi на ${amountLabel} — это моя подготовка к ЕНТ на my-test.kz, тариф «${planName}». Открой Kaspi → «Платежи» → «Счета на оплату» и оплати, пожалуйста. Если счёта там нет — можно оплатить по ссылке, входить никуда не нужно.`,
        `Сәлем! Саған Kaspi-ге ${amountLabel} шот жібердім — бұл my-test.kz сайтындағы ҰБТ-ға дайындығым, «${planName}» тарифі. Kaspi → «Төлемдер» → «Төлемге арналған шоттар» бөлімін ашып, төлеп жіберші. Шот көрінбесе — сілтеме арқылы төлеуге болады, еш жерге кірудің қажеті жоқ.`,
      )
    : t(
        `Привет! Оплати, пожалуйста, мою подготовку к ЕНТ на my-test.kz — тариф «${planName}», ${amountLabel}. По ссылке можно оплатить со своего Kaspi, регистрироваться не нужно.`,
        `Сәлем! my-test.kz сайтындағы ҰБТ-ға дайындығымды төлеп жіберші — «${planName}» тарифі, ${amountLabel}. Сілтеме арқылы өз Kaspi-іңнен төлеуге болады, тіркелудің қажеті жоқ.`,
      )

  const channelUrl = (channel: Exclude<Channel, "copy">, url: string) =>
    channel === "whatsapp"
      ? `https://wa.me/?text=${encodeURIComponent(`${body} ${url}`)}`
      : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(body)}`

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
      toast.success(t("Ссылка скопирована", "Сілтеме көшірілді"))
    } catch {
      toast.info(t("Ссылка готова — выделите и скопируйте её ниже", "Сілтеме дайын — төменнен белгілеп, көшіріп алыңыз"))
    }
  }

  const share = async (channel: Channel) => {
    if (busy) return
    const track = () =>
      void recordFunnelEvent("payment_opened", {
        provider: "kaspi",
        action: `share_parent_link_${channel}`,
        planCode: planId,
        placement,
        ...(invoiceId ? { invoiceId } : {}),
      })
    if (link) {
      // Ссылка уже есть — открываем синхронно, прямо в обработчике клика.
      track()
      if (channel === "copy") await copy(link)
      else openShareTarget(channelUrl(channel, link), null)
      return
    }
    const popup = channel === "copy" ? null : window.open("about:blank", "_blank")
    setBusy(channel)
    try {
      const result = await api<ParentPayLinkDto>("/billing/parent-pay-link", { method: "POST", body: { planId } })
      const url = withLang(result.url)
      setCreated({ planId, url })
      track()
      if (channel === "copy") await copy(url)
      else openShareTarget(channelUrl(channel, url), popup)
    } catch {
      popup?.close()
      toast.error(t("Не удалось создать ссылку. Попробуйте ещё раз.", "Сілтеме жасалмады. Қайталап көріңіз."))
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className={cn("space-y-2", className)} data-no-translate>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void share("whatsapp")} className="h-10">
          {busy === "whatsapp" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <MessageCircle className="size-4" aria-hidden />}
          WhatsApp
        </Button>
        <Button type="button" variant="outline" disabled={busy !== null} onClick={() => void share("telegram")} className="h-10">
          {busy === "telegram" ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Send className="size-4" aria-hidden />}
          Telegram
        </Button>
      </div>
      <Button type="button" variant="ghost" size="sm" disabled={busy !== null} onClick={() => void share("copy")} className="w-full">
        {busy === "copy" ? (
          <Loader2 className="size-4 animate-spin" aria-hidden />
        ) : copied ? (
          <Check className="size-4" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
        {t("Копировать ссылку", "Сілтемені көшіру")}
      </Button>
      {/* Если буфер обмена недоступен — ссылку можно выделить и скопировать вручную. */}
      {link && (
        <input
          readOnly
          value={link}
          onFocus={(event) => event.currentTarget.select()}
          aria-label={t("Ссылка на оплату для родителя", "Ата-анаға арналған төлем сілтемесі")}
          className="h-9 w-full rounded-md border border-border bg-muted/40 px-3 text-xs text-muted-foreground"
        />
      )}
    </div>
  )
}
