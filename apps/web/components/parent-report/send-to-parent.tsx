"use client"

import { useState, type ReactNode } from "react"
import useSWR from "swr"
import { Check, Copy, ExternalLink, HeartHandshake, Link2Off, MessageCircle, Send } from "lucide-react"
import { toast } from "sonner"
import type { ParentReportLinkDto } from "@bilimland/shared"
import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { api } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { useUiI18n } from "@/lib/i18n/ui"
import { openShareTarget as openTarget } from "@/lib/share-target"
import { cn } from "@/lib/utils"

/**
 * «Отправить отчёт родителям»: приватная ссылка на отчёт о прогрессе + WhatsApp / Telegram
 * с готовым сообщением на языке интерфейса. Ссылка одна и та же, пока ученик её не отзовёт, —
 * закладка у родителя не ломается.
 */

const LINK_KEY = "/users/me/parent-report-link"
type Channel = "whatsapp" | "telegram" | "copy"
type Placement = "dashboard" | "review"

function useParentReportLink(enabled: boolean) {
  const { locale } = useUiI18n()
  const t = (ru: string, kk: string) => (locale === "kk" ? kk : ru)
  const link = useSWR<ParentReportLinkDto>(enabled ? LINK_KEY : null)
  const [busy, setBusy] = useState(false)

  // Родитель откроет отчёт на том же языке, что и интерфейс ученика.
  const withLang = (url: string) => (locale === "kk" ? `${url}?lang=kk` : url)
  const shareUrl = link.data?.url ? withLang(link.data.url) : null
  const message = (url: string) =>
    t(
      `Привет! Это мой отчёт о подготовке к ЕНТ на mytest: результаты пробных, цель поступления и предметы, где я теряю баллы. Он обновляется сам: ${url}`,
      `Сәлем! Бұл — mytest-тегі ҰБТ-ға дайындық есебім: сынақ нәтижелері, түсу мақсаты және балл жоғалтатын пәндер. Есеп өздігінен жаңарады: ${url}`,
    ).trim()
  const channelUrl = (channel: Exclude<Channel, "copy">, url: string) =>
    channel === "whatsapp"
      ? `https://wa.me/?text=${encodeURIComponent(message(url))}`
      : `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(message(""))}`

  const copy = async (url: string) => {
    try {
      await navigator.clipboard.writeText(url)
      toast.success(t("Ссылка скопирована", "Сілтеме көшірілді"))
    } catch {
      toast.info(t("Ссылка готова — выделите и скопируйте её ниже", "Сілтеме дайын — төменнен белгілеп, көшіріп алыңыз"))
    }
  }

  const share = async (channel: Channel, placement: Placement): Promise<string | null> => {
    if (busy) return null
    const track = () => void recordFunnelEvent("parent_report_shared", { channel, placement, lang: locale })
    if (shareUrl) {
      // Ссылка уже есть — открываем синхронно, прямо в обработчике клика.
      track()
      if (channel === "copy") await copy(shareUrl)
      else openTarget(channelUrl(channel, shareUrl), null)
      return shareUrl
    }
    const popup = channel === "copy" ? null : window.open("about:blank", "_blank")
    setBusy(true)
    try {
      const created = await api<{ url: string }>(LINK_KEY, { method: "POST" })
      await link.mutate({ url: created.url }, { revalidate: false })
      const url = withLang(created.url)
      track()
      if (channel === "copy") await copy(url)
      else openTarget(channelUrl(channel, url), popup)
      return url
    } catch {
      popup?.close()
      toast.error(t("Не удалось создать ссылку. Попробуйте ещё раз.", "Сілтеме жасалмады. Қайталап көріңіз."))
      return null
    } finally {
      setBusy(false)
    }
  }

  const revoke = async (placement: Placement) => {
    setBusy(true)
    try {
      await api(LINK_KEY, { method: "DELETE" })
      await link.mutate({ url: null }, { revalidate: false })
      void recordFunnelEvent("parent_report_revoked", { placement })
      toast.success(t("Ссылка отозвана — по ней отчёт больше не откроется", "Сілтеме кері қайтарылды — есеп енді ол арқылы ашылмайды"))
    } catch {
      toast.error(t("Не удалось отозвать ссылку", "Сілтемені кері қайтару мүмкін болмады"))
    } finally {
      setBusy(false)
    }
  }

  return { t, shareUrl, busy, share, revoke }
}

type LinkState = ReturnType<typeof useParentReportLink>

function ShareActions({ placement, state, className }: { placement: Placement; state: LinkState; className?: string }) {
  const { t, busy, share, shareUrl } = state
  const [copied, setCopied] = useState(false)
  return (
    <div className={cn("space-y-2", className)}>
      <div className="grid grid-cols-2 gap-2">
        <Button type="button" variant="outline" disabled={busy} onClick={() => void share("whatsapp", placement)} className="h-10">
          <MessageCircle className="size-4" aria-hidden />
          WhatsApp
        </Button>
        <Button type="button" variant="outline" disabled={busy} onClick={() => void share("telegram", placement)} className="h-10">
          <Send className="size-4" aria-hidden />
          Telegram
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        disabled={busy}
        onClick={async () => {
          if (await share("copy", placement)) setCopied(true)
        }}
        className="w-full"
      >
        {copied ? <Check className="size-4" aria-hidden /> : <Copy className="size-4" aria-hidden />}
        {t("Копировать ссылку", "Сілтемені көшіру")}
      </Button>
      {/* Если буфер обмена недоступен — ссылку можно выделить и скопировать вручную. */}
      {shareUrl && (
        <input
          readOnly
          value={shareUrl}
          onFocus={(e) => e.currentTarget.select()}
          aria-label={t("Ссылка на отчёт", "Есепке сілтеме")}
          className="h-9 w-full rounded-md border border-border bg-muted/40 px-3 text-xs text-muted-foreground"
        />
      )}
    </div>
  )
}

function LinkFooter({ placement, state }: { placement: Placement; state: LinkState }) {
  const { t, busy, revoke, shareUrl } = state
  if (!shareUrl) return null
  // preview=1 — чтобы просмотр самим учеником не считался открытием отчёта родителем.
  const previewUrl = `${shareUrl}${shareUrl.includes("?") ? "&" : "?"}preview=1`
  return (
    <AlertDialog>
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-3 text-xs">
        <a
          href={previewUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-8 items-center gap-1 text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ExternalLink className="size-3.5" aria-hidden />
          {t("Что увидят родители", "Ата-ана не көреді")}
        </a>
        <AlertDialogTrigger asChild>
          <button
            type="button"
            disabled={busy}
            className="inline-flex min-h-8 items-center gap-1 text-muted-foreground underline-offset-4 hover:text-destructive hover:underline disabled:opacity-50"
          >
            <Link2Off className="size-3.5" aria-hidden />
            {t("Отозвать ссылку", "Сілтемені кері қайтару")}
          </button>
        </AlertDialogTrigger>
      </div>
      <AlertDialogContent data-no-translate>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("Отозвать ссылку на отчёт?", "Есеп сілтемесін кері қайтару керек пе?")}</AlertDialogTitle>
          <AlertDialogDescription>
            {t(
              "Старая ссылка сразу перестанет открываться. Чтобы снова поделиться отчётом, отправьте новую.",
              "Ескі сілтеме бірден ашылмайтын болады. Есеппен қайта бөлісу үшін жаңасын жіберіңіз.",
            )}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>{t("Отмена", "Болдырмау")}</AlertDialogCancel>
          <AlertDialogAction onClick={() => void revoke(placement)}>{t("Отозвать", "Кері қайтару")}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

function Intro({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary text-foreground">
        <HeartHandshake className="size-4" aria-hidden />
      </span>
      <div className="min-w-0">
        <h2 className="text-base font-semibold tracking-tight">{title}</h2>
        <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{children}</p>
      </div>
    </div>
  )
}

/** Карточка на главной кабинета: отправить, скопировать, посмотреть, отозвать. */
export function SendToParentCard() {
  const state = useParentReportLink(true)
  const { t } = state
  return (
    <section className="rounded-xl border border-border bg-card p-5" aria-label={t("Отчёт для родителей", "Ата-анаға арналған есеп")} data-no-translate>
      <Intro title={t("Отправить отчёт родителям", "Ата-анаға есеп жіберу")}>
        {t(
          "Родители увидят баллы пробных, динамику, цель и слабые предметы — без ваших ответов и переписки. Отчёт обновляется сам.",
          "Ата-анаңыз сынақ балдарын, динамиканы, мақсатты және әлсіз пәндерді көреді — жауаптарыңыз бен хат-хабарсыз. Есеп өздігінен жаңарады.",
        )}
      </Intro>
      <ShareActions placement="dashboard" state={state} className="mt-4" />
      <div className="mt-3">
        <LinkFooter placement="dashboard" state={state} />
      </div>
    </section>
  )
}

/** Кнопка на странице результата, рядом с «Поделиться». */
export function SendToParentButton() {
  const [open, setOpen] = useState(false)
  const state = useParentReportLink(open)
  const { t } = state
  return (
    <>
      <Button type="button" variant="ghost" size="sm" onClick={() => setOpen(true)} data-no-translate>
        <HeartHandshake className="size-4" aria-hidden />
        {t("Родителям", "Ата-анаға")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-md" data-no-translate>
          <DialogHeader>
            <DialogTitle>{t("Отправить отчёт родителям", "Ата-анаға есеп жіберу")}</DialogTitle>
            <DialogDescription>
              {t(
                "Приватная ссылка: баллы пробных, динамика, цель и слабые предметы. Ответы и переписку родители не увидят. Отозвать ссылку можно здесь или на главной кабинета.",
                "Жеке сілтеме: сынақ балдары, динамика, мақсат және әлсіз пәндер. Жауаптар мен хат-хабарды ата-анаңыз көрмейді. Сілтемені осы жерде немесе кабинеттің басты бетінде кері қайтаруға болады.",
              )}
            </DialogDescription>
          </DialogHeader>
          <ShareActions placement="review" state={state} />
          <LinkFooter placement="review" state={state} />
        </DialogContent>
      </Dialog>
    </>
  )
}
