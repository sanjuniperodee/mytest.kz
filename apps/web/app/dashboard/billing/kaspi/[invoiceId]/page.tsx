"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { useSWRConfig } from "swr"
import { useEffect, useRef, useState } from "react"
import QRCode from "react-qr-code"
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { api, ApiError } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { useAuth } from "@/lib/api/auth-context"
import { cn } from "@/lib/utils"

interface PaymentOrder {
  invoiceId: string
  providerOrderId: string
  status: "pending" | "paid" | "failed" | "cancelled" | "created" | string
  amount: number
  currency: string
  planCode: string
  planName: string
  paymentType?: "invoice" | "qr" | string
  checkoutUrl: string | null
  receiptUrl: string | null
  qrToken?: string | null
  expiresAt?: string | null
  fallbackToQr?: boolean
  statusDesc?: string | null
  orderNumber?: string | null
  paidAt?: string | null
  createdAt: string
}

type PaymentStatusKind = "pending" | "paid" | "inactive"

function isOpenableUrl(value: string | null | undefined) {
  if (!value) return false
  return /^(https?:\/\/|kaspi:)/i.test(value.trim())
}

function paymentStatusKind(status: unknown, expiresAt?: string | null): PaymentStatusKind {
  const expiresMs = parseTimestamp(expiresAt)
  if (expiresMs != null && expiresMs <= Date.now()) {
    const normalizedStatus = String(status || "").trim().toLowerCase()
    if (!normalizedStatus || normalizedStatus === "pending" || normalizedStatus === "created") {
      return "inactive"
    }
  }
  const normalized = String(status || "").trim().toLowerCase()
  if (normalized === "paid" || normalized === "processed" || normalized === "success" || normalized === "succeeded") {
    return "paid"
  }
  if (
    normalized === "failed" ||
    normalized === "cancelled" ||
    normalized === "canceled" ||
    normalized === "expired" ||
    normalized === "sessionexpired" ||
    normalized === "remotepaymentcanceled" ||
    normalized === "remotepaymentrejected"
  ) {
    return "inactive"
  }
  return "pending"
}

function formatDateTime(value: string | null | undefined) {
  const parsed = parseTimestamp(value)
  if (parsed == null) return ""
  return new Date(parsed).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function parseTimestamp(value: string | null | undefined): number | null {
  if (!value) return null
  const raw = value.trim()
  if (!raw) return null

  const direct = Date.parse(raw)
  if (!Number.isNaN(direct)) return direct

  const withUtc = /(?:Z|[+-]\d{2}:\d{2})$/i.test(raw) ? raw : `${raw}Z`
  const asUtc = Date.parse(withUtc)
  if (!Number.isNaN(asUtc)) return asUtc

  return null
}

function formatTimeLeft(target: string | null | undefined, nowMs: number) {
  const targetMs = parseTimestamp(target)
  if (targetMs == null) return null
  const diffMs = targetMs - nowMs
  if (!Number.isFinite(diffMs)) return null
  if (diffMs <= 0) return "Истёк"
  const totalSeconds = Math.floor(diffMs / 1000)
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
  }
  return `${minutes}:${String(seconds).padStart(2, "0")}`
}

function statusView(status: PaymentOrder["status"]) {
  const normalizedStatus = String(status || "").trim().toLowerCase()
  if (normalizedStatus === "expired") {
    return {
      title: "Срок оплаты истёк",
      description: "Этот Kaspi QR уже просрочен. Вернитесь к тарифам и выставьте новый.",
      icon: XCircle,
      badge: "Истёк",
      className: "border-red-200 bg-red-50 text-red-950",
    }
  }
  const kind = paymentStatusKind(status)
  if (kind === "paid") {
    return {
      title: "Оплата прошла",
      description: "Подписка уже активирована. Можно возвращаться к пробникам.",
      icon: CheckCircle2,
      badge: "Оплачено",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    }
  }
  if (kind === "inactive") {
    return {
      title: "Счёт отменён",
      description: "Этот счёт уже не активен. Вернитесь к тарифам и выставьте новый.",
      icon: XCircle,
      badge: "Отменён",
      className: "border-red-200 bg-red-50 text-red-950",
    }
  }
  return {
    title: "Ожидаем оплату",
    description: "Подтвердите оплату в Kaspi. Статус обновляется автоматически.",
    icon: Clock3,
    badge: "Ожидает",
    className: "border-amber-200 bg-amber-50 text-amber-950",
  }
}

export default function KaspiPaymentPage() {
  const params = useParams<{ invoiceId: string }>()
  const rawInvoiceId = Array.isArray(params.invoiceId) ? params.invoiceId[0] : params.invoiceId
  const invoiceId = rawInvoiceId && rawInvoiceId !== "undefined" && rawInvoiceId !== "null" ? rawInvoiceId : null
  const { refresh } = useAuth()
  const { mutate: mutateGlobal } = useSWRConfig()
  const refreshedAfterPaid = useRef(false)
  const [cancelling, setCancelling] = useState(false)
  const [nowMs, setNowMs] = useState(() => Date.now())
  const { data: order, error, isLoading, mutate, isValidating } = useSWR<PaymentOrder>(
    invoiceId ? `/billing/orders/${encodeURIComponent(invoiceId)}` : null,
    (url: string) => api(url),
    {
      refreshInterval: (current) => (paymentStatusKind(current?.status, current?.expiresAt) === "pending" ? 5000 : 0),
      keepPreviousData: true,
    },
  )

  useEffect(() => {
    if (order?.status === "paid" && !refreshedAfterPaid.current) {
      refreshedAfterPaid.current = true
      void recordFunnelEvent("payment_paid", {
        provider: "kaspi",
        planCode: order.planCode,
        invoiceId: order.invoiceId,
        amount: order.amount,
      })
      void refresh({ silent: true }).then(() => {
        void mutateGlobal("/billing/kaspi/orders/active")
      })
    }
  }, [mutateGlobal, order?.amount, order?.invoiceId, order?.planCode, order?.status, refresh])

  useEffect(() => {
    if (!order) return
    void recordFunnelEvent("payment_opened", {
      provider: "kaspi",
      planCode: order.planCode,
      invoiceId: order.invoiceId,
      status: order.status,
      paymentType: order.paymentType,
    })
  }, [order?.invoiceId, order?.paymentType, order?.planCode, order?.status])

  useEffect(() => {
    const shouldTick =
      Boolean(order?.expiresAt) && paymentStatusKind(order?.status, order?.expiresAt) === "pending"
    if (!shouldTick) return
    setNowMs(Date.now())
    const timer = window.setInterval(() => setNowMs(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [order?.expiresAt, order?.status])

  if (!invoiceId) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link
          href="/dashboard/billing"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          Тарифы
        </Link>
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/80">
                <Clock3 className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Счёт не найден</h1>
                <p className="mt-1 text-sm opacity-80">
                  Вернитесь к тарифам: если счёт был выставлен, он появится в блоке активных счетов.
                </p>
              </div>
            </div>
            <Button asChild className="h-11 w-fit">
              <Link href="/dashboard/billing">Открыть тарифы</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (isLoading && !order) {
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-72 rounded-xl" />
      </div>
    )
  }

  if (!order) {
    const message =
      error instanceof ApiError && error.status === 404
        ? "Мы не нашли этот счёт. Вернитесь к тарифам: активные счета появятся там автоматически."
        : "Не удалось получить статус счёта. Проверьте оплату ещё раз через несколько секунд."
    return (
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <Link
          href="/dashboard/billing"
          className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
        >
          <ArrowLeft className="size-4" />
          Тарифы
        </Link>
        <Card className="border-amber-200 bg-amber-50 text-amber-950">
          <CardContent className="flex flex-col gap-4 p-6">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/80">
                <Clock3 className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">Статус пока недоступен</h1>
                <p className="mt-1 text-sm opacity-80">{message}</p>
              </div>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <Button className="h-11 flex-1" onClick={() => mutate()} disabled={isValidating}>
                {isValidating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Проверить ещё раз
              </Button>
              <Button asChild variant="outline" className="h-11 flex-1">
                <Link href="/dashboard/billing">Открыть тарифы</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const statusKind = paymentStatusKind(order.status, order.expiresAt)
  const view = statusView(statusKind === "inactive" && order.status === "pending" ? "expired" : order.status)
  const StatusIcon = view.icon
  const qrValue = order.qrToken || order.checkoutUrl || order.receiptUrl || null
  const openPayUrl =
    [order.checkoutUrl, order.receiptUrl, order.qrToken].find((value) => isOpenableUrl(value)) ?? null
  const canCancel = statusKind === "pending" && order.paymentType !== "qr"
  const expiresIn = formatTimeLeft(order.expiresAt, nowMs)
  const isQrPayment = order.paymentType === "qr"
  const pendingDescription =
    isQrPayment && qrValue
      ? "Отсканируйте QR в Kaspi или откройте оплату по ссылке. Статус обновляется автоматически."
      : view.description

  const cancelOrder = async () => {
    if (!invoiceId || !window.confirm("Отменить этот счёт Kaspi? После отмены можно будет выставить новый.")) {
      return
    }
    setCancelling(true)
    try {
      const updated = await api<PaymentOrder>(`/billing/kaspi/orders/${encodeURIComponent(invoiceId)}/cancel`, {
        method: "POST",
      })
      void recordFunnelEvent("payment_cancelled", {
        provider: "kaspi",
        planCode: updated.planCode,
        invoiceId: updated.invoiceId,
      })
      await mutate(updated, false)
      await mutateGlobal("/billing/kaspi/orders/active")
      if (paymentStatusKind(updated.status) === "paid") {
        void refresh({ silent: true })
      }
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      <Link
        href="/dashboard/billing"
        className="inline-flex w-fit items-center gap-2 text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
      >
        <ArrowLeft className="size-4" />
        Тарифы
      </Link>

      <Card className={cn("border", view.className)}>
        <CardContent className="flex flex-col gap-5 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex items-start gap-3">
              <div className="flex size-11 shrink-0 items-center justify-center rounded-md bg-white/80">
                <StatusIcon className="size-5" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold tracking-tight">{view.title}</h1>
                <p className="mt-1 text-sm opacity-80">{statusKind === "pending" ? pendingDescription : view.description}</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {isQrPayment && (
                <Badge variant="outline" className="w-fit bg-white/70">
                  Kaspi QR
                </Badge>
              )}
              <Badge variant="outline" className="w-fit bg-white/70">
                {view.badge}
              </Badge>
            </div>
          </div>

          {order.fallbackToQr && (
            <div className="rounded-md border border-current/10 bg-white/75 p-4 text-sm text-foreground">
              Счёт по номеру телефона сейчас не создался, поэтому мы автоматически переключили оплату на Kaspi QR.
            </div>
          )}

          <div className="rounded-md border border-current/10 bg-white/75 p-4 text-sm text-foreground">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Тариф</span>
              <span className="font-medium">{order.planName}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Сумма</span>
              <span className="font-medium tabular-nums">
                {order.amount.toLocaleString("ru-RU")} {order.currency}
              </span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Счёт</span>
              <span className="font-mono text-xs">{order.orderNumber || order.invoiceId}</span>
            </div>
            <div className="mt-2 flex items-center justify-between gap-4">
              <span className="text-muted-foreground">Создан</span>
              <span>{formatDateTime(order.createdAt)}</span>
            </div>
            {order.expiresAt && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Действует до</span>
                <span>{formatDateTime(order.expiresAt)}</span>
              </div>
            )}
            {order.expiresAt && statusKind === "pending" && expiresIn && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Осталось времени</span>
                <span className="font-medium tabular-nums">{expiresIn}</span>
              </div>
            )}
            {order.statusDesc && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Статус Kaspi</span>
                <span className="text-right">{order.statusDesc}</span>
              </div>
            )}
            {order.paidAt && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Оплачен</span>
                <span>{formatDateTime(order.paidAt)}</span>
              </div>
            )}
          </div>

          {isQrPayment && qrValue && statusKind === "pending" && (
            <div className="grid gap-4 rounded-md border border-current/10 bg-white/75 p-4 md:grid-cols-[220px_minmax(0,1fr)]">
              <div className="mx-auto flex w-full max-w-[220px] flex-col items-center gap-3">
                <div className="rounded-xl border border-current/10 bg-white p-4 shadow-sm">
                  <QRCode value={qrValue} size={180} bgColor="transparent" fgColor="currentColor" />
                </div>
                <p className="text-center text-xs text-muted-foreground">
                  Откройте Kaspi и отсканируйте код
                </p>
              </div>
              <div className="flex flex-col gap-3 text-sm text-foreground">
                <div>
                  <p className="font-medium">Kaspi QR уже готов</p>
                  <p className="mt-1 text-muted-foreground">
                    Этот QR ведёт на оплату того же тарифа. После подтверждения подписка активируется автоматически.
                  </p>
                </div>
                {order.expiresAt && (
                  <div className="rounded-md border border-current/10 bg-background/80 p-3">
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">Срок жизни QR</p>
                    <p className="mt-1 font-medium">{formatDateTime(order.expiresAt)}</p>
                    {expiresIn && <p className="mt-1 text-xs text-muted-foreground">Осталось: {expiresIn}</p>}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-2 sm:flex-row">
            {openPayUrl && statusKind === "pending" && (
              <Button
                className="h-11 flex-1"
                onClick={() => {
                  void recordFunnelEvent("payment_opened", {
                    provider: "kaspi",
                    planCode: order.planCode,
                    invoiceId: order.invoiceId,
                    action: "open_external",
                    paymentType: order.paymentType,
                  })
                  window.open(openPayUrl, "_blank", "noopener,noreferrer")
                }}
              >
                {isQrPayment ? "Открыть оплату" : "Открыть счёт Kaspi"}
                <ExternalLink className="size-4" />
              </Button>
            )}
            {!openPayUrl && statusKind === "pending" && (
              <div className="rounded-md border border-current/10 bg-white/70 p-3 text-sm text-foreground sm:flex-1">
                {isQrPayment
                  ? "Kaspi QR уже создан. Отсканируйте код в приложении Kaspi и затем обновите статус."
                  : "Счёт выставлен в Kaspi, но ссылка на оплату пока не пришла. Откройте приложение Kaspi или проверьте статус через несколько секунд."}
              </div>
            )}
            {statusKind === "paid" ? (
              <Button asChild className="h-11 flex-1">
                <Link href="/dashboard">Перейти в кабинет</Link>
              </Button>
            ) : (
              <Button
                variant="outline"
                className="h-11 flex-1"
                onClick={() => mutate()}
                disabled={isValidating}
              >
                {isValidating ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
                Проверить оплату
              </Button>
            )}
            {canCancel && (
              <Button
                variant="outline"
                className="h-11 flex-1 border-red-200 text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={cancelOrder}
                disabled={cancelling || isValidating}
              >
                {cancelling ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
                Отменить счёт
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
