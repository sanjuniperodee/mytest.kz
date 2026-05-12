"use client"

import Link from "next/link"
import { useParams } from "next/navigation"
import useSWR from "swr"
import { useSWRConfig } from "swr"
import { useEffect, useRef, useState } from "react"
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
  checkoutUrl: string | null
  receiptUrl: string | null
  orderNumber?: string | null
  paidAt?: string | null
  createdAt: string
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return ""
  return new Date(value).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function statusView(status: PaymentOrder["status"]) {
  if (status === "paid") {
    return {
      title: "Оплата прошла",
      description: "Подписка уже активирована. Можно возвращаться к пробникам.",
      icon: CheckCircle2,
      badge: "Оплачено",
      className: "border-emerald-200 bg-emerald-50 text-emerald-950",
    }
  }
  if (status === "failed" || status === "cancelled") {
    return {
      title: "Счёт не оплачен",
      description: "Этот счёт отменён или истёк. Вернитесь к тарифам и выставьте новый.",
      icon: XCircle,
      badge: "Неактивен",
      className: "border-red-200 bg-red-50 text-red-950",
    }
  }
  return {
    title: "Ожидаем оплату",
    description: "Откройте счёт Kaspi и подтвердите оплату в приложении. Статус обновляется автоматически.",
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
  const { data: order, error, isLoading, mutate, isValidating } = useSWR<PaymentOrder>(
    invoiceId ? `/billing/orders/${encodeURIComponent(invoiceId)}` : null,
    (url: string) => api(url),
    {
      refreshInterval: (current) => (current?.status === "pending" ? 5000 : 0),
      keepPreviousData: true,
    },
  )

  useEffect(() => {
    if (order?.status === "paid" && !refreshedAfterPaid.current) {
      refreshedAfterPaid.current = true
      void refresh({ silent: true }).then(() => {
        void mutateGlobal("/billing/kaspi/orders/active")
      })
    }
  }, [mutateGlobal, order?.status, refresh])

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

  const view = statusView(order.status)
  const StatusIcon = view.icon
  const payUrl = order.receiptUrl || order.checkoutUrl
  const canCancel = order.status === "pending"

  const cancelOrder = async () => {
    if (!invoiceId || !window.confirm("Отменить этот счёт Kaspi? После отмены можно будет выставить новый.")) {
      return
    }
    setCancelling(true)
    try {
      const updated = await api<PaymentOrder>(`/billing/kaspi/orders/${encodeURIComponent(invoiceId)}/cancel`, {
        method: "POST",
      })
      await mutate(updated, false)
      await mutateGlobal("/billing/kaspi/orders/active")
      if (updated.status === "paid") {
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
                <p className="mt-1 text-sm opacity-80">{view.description}</p>
              </div>
            </div>
            <Badge variant="outline" className="w-fit bg-white/70">
              {view.badge}
            </Badge>
          </div>

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
            {order.paidAt && (
              <div className="mt-2 flex items-center justify-between gap-4">
                <span className="text-muted-foreground">Оплачен</span>
                <span>{formatDateTime(order.paidAt)}</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2 sm:flex-row">
            {payUrl && order.status === "pending" && (
              <Button
                className="h-11 flex-1"
                onClick={() => window.open(payUrl, "_blank", "noopener,noreferrer")}
              >
                Открыть счёт Kaspi
                <ExternalLink className="size-4" />
              </Button>
            )}
            {!payUrl && order.status === "pending" && (
              <div className="rounded-md border border-current/10 bg-white/70 p-3 text-sm text-foreground sm:flex-1">
                Счёт выставлен в Kaspi, но ссылка на оплату пока не пришла. Откройте приложение Kaspi или проверьте статус через несколько секунд.
              </div>
            )}
            {order.status === "paid" ? (
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
