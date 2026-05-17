"use client"

import useSWR from "swr"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Crown, Sparkles, ShieldCheck, Loader2, ExternalLink, XCircle, QrCode, Smartphone } from "lucide-react"
import { useEffect, useState, type ReactNode } from "react"
import { useSWRConfig } from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { PaymentBrandStrip } from "@/components/legal/payment-brand-strip"
import { useAuth } from "@/lib/api/auth-context"
import { api } from "@/lib/api/client"
import { recordFunnelEvent } from "@/lib/api/analytics"
import { localize, type Locale } from "@/lib/api/i18n"
import { cn } from "@/lib/utils"
import type { AccessByExamItem, BillingPlan, CheckoutResponse, CurrentTariff, TrialStatusItem, User } from "@/lib/api/types"

interface NormalizedPlan {
    id: string
    code: string
    name: string
    description: string
    price: number | null
    oldPrice: number | null
    currency: string
    durationDays: number | null
    badge: string | null
    features: string[]
    raw: BillingPlan
}

interface KaspiOrder {
    invoiceId: string
    providerOrderId: string
    status: string
    amount: number
    currency: string
    planCode: string
    planName: string
    paymentType?: "invoice" | "qr" | string
    checkoutUrl: string | null
    receiptUrl: string | null
    qrToken?: string | null
    expiresAt?: string | null
    orderNumber?: string | null
    createdAt: string
    paidAt?: string | null
}

interface KaspiCheckoutResponse {
    invoiceId?: string | number | null
    providerOrderId?: string | number | null
    orderId?: string | number | null
    receiptUrl?: string | null
    checkoutUrl?: string | null
    data?: KaspiCheckoutResponse
    Data?: {
        Id?: string | number | null
        ReceiptUrl?: string | null
    }
}

type PaymentMethod = "kaspi" | "freedom"
type KaspiMethod = "invoice" | "qr"
type BillingReason =
    | "limit_exhausted"
    | "daily_limit"
    | "no_access"
    | "post_trial"
    | "premium_explanation"
    | "review_recovery"
    | "mistakes_practice"
    | "retake"
    | "default"

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function getString(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) {
        const normalized = value.trim()
        const lower = normalized.toLowerCase()
        if (lower === "undefined" || lower === "null" || lower === "unknown") return null
        return normalized
    }
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
    return null
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

function normalizeKaspiCheckoutResponse(value: unknown): {
    invoiceId: string | null
    receiptUrl: string | null
} {
    if (!isRecord(value)) return { invoiceId: null, receiptUrl: null }

    const nested = isRecord(value.data) ? value.data : isRecord(value.Data) ? value.Data : null
    const invoiceId =
        getString(value.invoiceId) ||
        getString(value.providerOrderId) ||
        getString(value.orderId) ||
        getString(nested?.invoiceId) ||
        getString(nested?.providerOrderId) ||
        getString(nested?.orderId) ||
        getString(nested?.Id)
    const receiptUrl =
        getString(value.receiptUrl) ||
        getString(value.checkoutUrl) ||
        getString(nested?.receiptUrl) ||
        getString(nested?.checkoutUrl) ||
        getString(nested?.ReceiptUrl)

    return { invoiceId, receiptUrl }
}

function resolveOrderInvoiceId(order: KaspiOrder): string | null {
    return getString(order.invoiceId) || getString(order.providerOrderId)
}

function pickNumber(...values: unknown[]): number | null {
    for (const v of values) {
        if (typeof v === "number" && Number.isFinite(v)) return v
        if (typeof v === "string" && v.trim() !== "" && !Number.isNaN(Number(v))) {
            return Number(v)
        }
    }
    return null
}

function normalizePlan(plan: BillingPlan, locale: Locale): NormalizedPlan {
    // Backend uses priceKzt; legacy types support priceCents/price
    const priceFromCents =
        typeof plan.priceCents === "number" ? plan.priceCents / 100 : null
    const price = pickNumber(plan.priceKzt, priceFromCents, plan.price)
    const oldPrice = pickNumber(plan.originalPriceKzt, plan.oldPrice)

    return {
        id: plan.id,
        code: plan.code || plan.id,
        name: localize(plan.name, locale, "Тариф"),
        description: localize(plan.description, locale),
        price,
        oldPrice,
        currency: plan.currency || "₸",
        durationDays: typeof plan.durationDays === "number" ? plan.durationDays : null,
        badge: plan.highlight || plan.badge || null,
        features: (plan.features || []).map((f) => localize(f, locale)).filter(Boolean),
        raw: plan,
    }
}

function normalizeBillingReason(value: string | null): BillingReason {
    if (
        value === "limit_exhausted" ||
        value === "daily_limit" ||
        value === "no_access" ||
        value === "post_trial" ||
        value === "premium_explanation" ||
        value === "review_recovery" ||
        value === "mistakes_practice" ||
        value === "retake"
    ) {
        return value
    }
    return "default"
}

function getBillingPitch(reason: BillingReason, trial?: TrialStatusItem) {
    const left = trial?.freeRemaining ?? trial?.remaining ?? 0
    if (reason === "limit_exhausted" || reason === "no_access") {
        return {
            eyebrow: "Доступ открыт в Premium",
            title: "Начни подготовку с полного пробника",
            text: "Premium открывает пробники, подробный разбор, работу над ошибками и аналитику, чтобы готовиться по цифрам, а не на ощущениях.",
            recommendedPlan: "week",
        }
    }
    if (reason === "daily_limit") {
        return {
            eyebrow: "Лимит на сегодня исчерпан",
            title: "Сохрани темп и продолжай сегодня",
            text: "Premium снимает дневную паузу в подготовке: можно пройти ещё пробник, разобрать ошибки и не терять день.",
            recommendedPlan: "month",
        }
    }
    if (reason === "premium_explanation") {
        return {
            eyebrow: "Разбор открыт в Premium",
            title: "Не просто узнай ответ, а пойми ошибку",
            text: "Premium показывает объяснения к вопросам и превращает ошибки в короткие тренировки. Это самый быстрый путь добрать баллы.",
            recommendedPlan: "trial",
        }
    }
    if (reason === "mistakes_practice") {
        return {
            eyebrow: "Работа над ошибками в Premium",
            title: "Преврати прошлые ошибки в короткую тренировку",
            text: "Premium собирает ваши ошибки в мини-тесты, чтобы закрывать слабые места быстрее и видеть рост по баллам.",
            recommendedPlan: "week",
        }
    }
    if (reason === "retake") {
        return {
            eyebrow: "Пересдача открыта в Premium",
            title: "Повтори ЕНТ и проверь рост",
            text: "Premium даёт следующие попытки и разбор после каждой сдачи: удобно сравнить результат и понять, где ещё теряются баллы.",
            recommendedPlan: "week",
        }
    }
    if (reason === "post_trial" || reason === "review_recovery") {
        return {
            eyebrow: "Пробник уже показал слабые места",
            title: "Закрой ошибки, пока они свежие",
            text: "Мы уже знаем, где ты теряешь баллы. Возьми план с разбором и следующими пробниками, чтобы превратить результат в рост.",
            recommendedPlan: "week",
        }
    }
    return {
        eyebrow: left > 0 ? "Доступные попытки" : "Premium-подготовка",
        title: "Открой полный доступ к пробникам",
        text: "Разборы, аналитика и повторные попытки помогают готовиться по цифрам, а не на ощущениях.",
        recommendedPlan: "month",
    }
}

export default function BillingPage() {
    const { user } = useAuth()
    const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
    const [billingContext, setBillingContext] = useState<{
        reason: BillingReason
        sourceSessionId?: string
        ready: boolean
    }>({ reason: "default", ready: false })
    const reason = billingContext.reason
    const sourceSessionId = billingContext.sourceSessionId
    const { data, isLoading } = useSWR<BillingPlan[] | { items: BillingPlan[] }>("/billing/plans")
    const { data: orders, isLoading: ordersLoading } = useSWR<KaspiOrder[]>(
        '/billing/kaspi/orders/active',
        (url) => api(url),
        { refreshInterval: 10000 },
    )

    const rawPlans: BillingPlan[] = Array.isArray(data) ? data : data?.items ?? []
    const plans = rawPlans.map((p) => normalizePlan(p, locale))
    const sorted = [...plans].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
    const currentTariff = user?.currentTariff ?? null
    const entAccess = user?.accessByExam?.find((item) => item.examSlug === "ent")
    const entTrial = user?.trialStatus?.ent
    const hasPaidSubscription = Boolean(user?.hasActiveSubscription)
    const pitch = getBillingPitch(reason, entTrial)

    useEffect(() => {
        const params = new URLSearchParams(window.location.search)
        setBillingContext({
            reason: normalizeBillingReason(params.get("reason")),
            sourceSessionId: params.get("sessionId") || undefined,
            ready: true,
        })
    }, [])

    useEffect(() => {
        if (!billingContext.ready) return
        void recordFunnelEvent("billing_opened", {
            reason,
            sessionId: sourceSessionId,
            trialRemaining: entTrial?.remaining,
            freeRemaining: entTrial?.freeRemaining,
            hasPaidSubscription,
        })
    }, [billingContext.ready, entTrial?.freeRemaining, entTrial?.remaining, hasPaidSubscription, reason, sourceSessionId])

    // Highlight the most "popular" plan when there's a badge, otherwise the middle plan
    const highlightedIdx = (() => {
        const byReason = sorted.findIndex((p) => p.code === pitch.recommendedPlan || p.id === pitch.recommendedPlan)
        if (byReason >= 0) return byReason
        const byBadge = sorted.findIndex((p) => p.badge)
        if (byBadge >= 0) return byBadge
        if (sorted.length >= 3) return Math.floor(sorted.length / 2)
        return -1
    })()

    return (
        <div className="flex flex-col gap-6">
            <div className="relative overflow-hidden rounded-xl border border-border bg-card p-5 sm:p-6">
                <div className="grain pointer-events-none absolute inset-0 opacity-50" />
                <div className="relative flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
                    <div className="flex max-w-3xl flex-col gap-2">
                        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                            <Sparkles className="size-3" />
                            {pitch.eyebrow}
                        </span>
                        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{pitch.title}</h1>
                        <p className="text-muted-foreground">{pitch.text}</p>
                    </div>
                    {!hasPaidSubscription && (
                        <div className="grid gap-2 rounded-lg border border-border bg-background/80 p-3 text-sm sm:min-w-64">
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Бесплатно осталось</span>
                                <span className="font-semibold tabular-nums">{formatFreeTrialRemaining(entTrial)}</span>
                            </div>
                            <div className="flex items-center justify-between gap-4">
                                <span className="text-muted-foreground">Рекомендуем</span>
                                <span className="font-semibold">{pitch.recommendedPlan === "trial" ? "Разовый" : pitch.recommendedPlan === "week" ? "5 пробных" : "Месяц"}</span>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <div className="flex flex-col gap-2">
                <h2 className="text-xl font-semibold tracking-tight">Выберите тариф</h2>
                <p className="text-muted-foreground">
                    Чем быстрее разберём свежие ошибки, тем выше шанс добрать баллы уже на следующем пробнике.
                </p>
            </div>

            <CurrentTariffCard
                tariff={currentTariff}
                entAccess={entAccess}
                trial={entTrial}
                locale={locale}
                hasPaid={hasPaidSubscription}
            />

            <PendingKaspiOrders orders={orders} isLoading={ordersLoading} />

            {isLoading ? (
                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                    {Array.from({ length: 4 }).map((_, i) => (
                        <Skeleton key={i} className="h-80 rounded-xl" />
                    ))}
                </div>
            ) : sorted.length === 0 ? (
                <Card>
                    <CardContent className="py-10 text-center text-muted-foreground">
                        Тарифы временно недоступны
                    </CardContent>
                </Card>
            ) : (
                <div
                    className={cn(
                        "grid gap-4 md:grid-cols-2",
                        sorted.length >= 4 ? "xl:grid-cols-4" : "lg:grid-cols-3",
                    )}
                >
                    {sorted.map((plan, idx) => (
                        <PlanCard
                            key={plan.id}
                            plan={plan}
                            highlighted={idx === highlightedIdx}
                            current={currentTariff?.isActive === true && currentTariff.code === plan.code}
                            user={user}
                            locale={locale}
                            pendingOrder={orders?.find((o) => o.planCode === plan.id)}
                            sourceReason={reason}
                            sourceSessionId={sourceSessionId}
                        />
                    ))}
                </div>
            )}

            <Card>
                <CardContent className="flex flex-col gap-4 p-5 text-sm text-muted-foreground">
                    <div className="flex items-center gap-3">
                        <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                            <ShieldCheck className="size-4" />
                        </div>
                        <p>
                            Выберите удобный способ оплаты: Kaspi для счёта по номеру телефона или Freedom Pay для
                            оплаты картой Visa / Mastercard.
                        </p>
                    </div>
                    <PaymentBrandStrip compact />
                </CardContent>
            </Card>
        </div>
    )
}

function PendingKaspiOrders({
                                orders,
                                isLoading,
                            }: {
    orders?: KaspiOrder[]
    isLoading: boolean
}) {
    const visibleOrders = (orders ?? []).filter((order) => {
        const expiresMs = parseTimestamp(order.expiresAt)
        if (expiresMs == null) return true
        const normalized = String(order.status || "").trim().toLowerCase()
        return !(expiresMs <= Date.now() && (normalized === "" || normalized === "pending" || normalized === "created"))
    })

    if (isLoading) {
        return <Skeleton className="h-20 rounded-xl" />
    }

    if (!visibleOrders.length) return null

    return (
        <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex flex-col gap-1">
                    <p className="font-semibold text-amber-900">Ожидает оплаты в Kaspi</p>
                    <p className="text-sm text-amber-800">
                        Откройте счёт или Kaspi QR и завершите оплату. После подтверждения доступ включится автоматически.
                    </p>
                </div>
                {visibleOrders.map((order) => {
                    const invoiceId = resolveOrderInvoiceId(order)
                    const canCancel = order.paymentType !== "qr"
                    return (
                        <div key={invoiceId || order.createdAt} className="flex flex-col gap-3 rounded-md border border-amber-200 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm">
                                <p className="font-medium">
                                    {order.planName}
                                    {order.paymentType === "qr" ? " · Kaspi QR" : ""}
                                </p>
                                <p className="text-muted-foreground">
                                    {order.amount.toLocaleString("ru-RU")} {order.currency}
                                </p>
                                {order.paymentType === "qr" && order.expiresAt ? (
                                    <p className="text-xs text-muted-foreground">
                                        Активен до {new Date(order.expiresAt).toLocaleString("ru-RU", {
                                            day: "2-digit",
                                            month: "short",
                                            hour: "2-digit",
                                            minute: "2-digit",
                                        })}
                                    </p>
                                ) : null}
                            </div>
                            {invoiceId ? (
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button size="sm" asChild>
                                    <Link href={`/dashboard/billing/kaspi/${encodeURIComponent(invoiceId)}`}>
                                        Продолжить оплату
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                                {canCancel ? <CancelKaspiOrderButton invoiceId={invoiceId} /> : null}
                              </div>
                            ) : null}
                        </div>
                    )
                })}
            </CardContent>
        </Card>
    )
}

function CancelKaspiOrderButton({ invoiceId }: { invoiceId: string }) {
    const { mutate } = useSWRConfig()
    const [loading, setLoading] = useState(false)

    const cancelOrder = async () => {
        if (!window.confirm("Отменить этот счёт Kaspi? После отмены можно будет выставить новый.")) {
            return
        }
        setLoading(true)
        try {
            await api(`/billing/kaspi/orders/${encodeURIComponent(invoiceId)}/cancel`, {
                method: "POST",
            })
            await mutate("/billing/kaspi/orders/active")
        } finally {
            setLoading(false)
        }
    }

    return (
        <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={cancelOrder}
            disabled={loading}
            className="border-amber-300 bg-white/80 text-amber-950 hover:bg-amber-100"
        >
            {loading ? <Loader2 className="size-4 animate-spin" /> : <XCircle className="size-4" />}
            Отменить
        </Button>
    )
}

function formatPrice(plan: NormalizedPlan): string {
    if (plan.price == null) return "—"
    return `${plan.price.toLocaleString("ru-RU")} ${plan.currency}`
}

function formatOldPrice(plan: NormalizedPlan): string | null {
    if (plan.oldPrice == null || plan.oldPrice <= 0) return null
    return `${plan.oldPrice.toLocaleString("ru-RU")} ${plan.currency}`
}

function PlanCard({
                      plan,
                      highlighted,
                      current,
                      user,
                      locale,
                      pendingOrder,
                      sourceReason,
                      sourceSessionId,
                  }: {
    plan: NormalizedPlan
    highlighted?: boolean
    current?: boolean
    user: User | null
    locale: Locale
    pendingOrder?: KaspiOrder
    sourceReason: BillingReason
    sourceSessionId?: string
}) {
    const router = useRouter()
    const { mutate } = useSWRConfig()
    const [showModal, setShowModal] = useState(false)
    const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>("kaspi")
    const [kaspiMethod, setKaspiMethod] = useState<KaspiMethod>("invoice")
    const [phone, setPhone] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<ReactNode | null>(null)

    const onCheckout = async () => {
        void recordFunnelEvent("plan_selected", {
            planCode: plan.code,
            planId: plan.id,
            price: plan.price,
            reason: sourceReason,
            sessionId: sourceSessionId,
        })
        if (pendingOrder) {
            const invoiceId = resolveOrderInvoiceId(pendingOrder)
            if (invoiceId) {
                router.push(`/dashboard/billing/kaspi/${encodeURIComponent(invoiceId)}`)
                return
            }
            setError("Не удалось открыть активный счёт. Обновите страницу и попробуйте ещё раз.")
            return
        }
        const userPhone = typeof user?.phone === "string" ? user.phone.trim() : ""
        setPhone(userPhone)
        setPaymentMethod("kaspi")
        setKaspiMethod("invoice")
        setShowModal(true)
        setError(null)
    }

    const handleKaspiCheckout = async () => {
        const digits = phone.replace(/\D/g, "")
        if (kaspiMethod === "invoice" && digits.length < 10) {
            setError("Введите корректный номер телефона")
            return
        }
        setLoading(true)
        setError(null)
        try {
            const rawResult = await api<KaspiCheckoutResponse>("/billing/kaspi/checkout", {
                method: "POST",
                body: {
                    planId: plan.id,
                    phoneNumber: kaspiMethod === "invoice" ? digits : "",
                    method: kaspiMethod,
                },
            })
            const result = normalizeKaspiCheckoutResponse(rawResult)
            await mutate("/billing/kaspi/orders/active")
            void recordFunnelEvent("checkout_created", {
                provider: "kaspi",
                planCode: plan.code,
                planId: plan.id,
                paymentType: kaspiMethod,
                reason: sourceReason,
                sessionId: sourceSessionId,
            })
            if (!result.invoiceId) {
                setError("Платёж создан, но сервер не вернул номер. Обновите страницу и откройте его из блока активных оплат.")
                return
            }
            setShowModal(false)
            router.push(`/dashboard/billing/kaspi/${encodeURIComponent(result.invoiceId)}`)
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err)
            if (msg.includes("KASPI_NOT_AUTHENTICATED")) {
                setError(
                    <>
                        Kaspi не авторизован.{" "}
                        <Link href="/dashboard/kaspi-setup" className="font-medium underline underline-offset-2">
                            Настроить сессию
                        </Link>
                        {" или обратитесь к поддержке."}
                    </>,
                )
            } else if (msg.includes("PENDING_ORDER_EXISTS")) {
                setError("Активная оплата уже существует. Обновите страницу и продолжите её из блока активных оплат.")
            } else {
                setError(kaspiMethod === "qr" ? "Ошибка при создании Kaspi QR. Попробуйте ещё раз." : "Ошибка при создании счёта. Попробуйте ещё раз.")
            }
        } finally {
            setLoading(false)
        }
    }

    const handleFreedomCheckout = async () => {
        setLoading(true)
        setError(null)
        try {
            const result = await api<CheckoutResponse>("/billing/checkout", {
                method: "POST",
                body: { planId: plan.id },
            })
            const checkoutUrl = result.checkoutUrl || result.paymentUrl
            if (!checkoutUrl) {
                setError("Платёж создан, но ссылка на оплату не пришла. Попробуйте ещё раз.")
                return
            }
            void recordFunnelEvent("checkout_created", {
                provider: "freedompay",
                planCode: plan.code,
                planId: plan.id,
                reason: sourceReason,
                sessionId: sourceSessionId,
            })
            setShowModal(false)
            window.location.assign(checkoutUrl)
        } catch (err: unknown) {
            const msg = err && typeof err === "object" && "message" in err ? String((err as { message: unknown }).message) : String(err)
            if (msg.includes("FREEDOMPAY_NOT_CONFIGURED")) {
                setError("Freedom Pay пока недоступен. Попробуйте Kaspi или обратитесь в поддержку.")
            } else {
                setError("Ошибка при переходе к оплате картой. Попробуйте ещё раз.")
            }
        } finally {
            setLoading(false)
        }
    }

    const features =
        plan.features.length > 0
            ? plan.features
            : [
                "Безлимитные пробники",
                "Разбор каждого вопроса",
                "Аналитика по предметам",
                "Лидерборд ЕНТ",
            ]

    const oldPriceLabel = formatOldPrice(plan)
    const discountPct =
        plan.price != null && plan.oldPrice != null && plan.oldPrice > plan.price
            ? Math.round(((plan.oldPrice - plan.price) / plan.oldPrice) * 100)
            : null

    return (
        <>
            <Card
                className={cn(
                    "relative flex flex-col overflow-hidden transition-all duration-200",
                    highlighted
                        ? "border-foreground shadow-lg ring-1 ring-foreground/10"
                        : "hover:border-foreground/40 hover:shadow-md",
                )}
            >
                {plan.badge && (
                    <div className="absolute right-4 top-4 z-10">
                        <Badge className="bg-accent text-accent-foreground hover:bg-accent capitalize">
                            {plan.badge}
                        </Badge>
                    </div>
                )}
                {highlighted && !plan.badge && (
                    <div className="absolute right-4 top-4 z-10">
                        <Badge className="bg-foreground text-background hover:bg-foreground">
                            Рекомендуем
                        </Badge>
                    </div>
                )}
                {current && (
                    <div className="absolute left-4 top-4 z-10">
                        <Badge className="bg-emerald-600 text-white hover:bg-emerald-600">
                            Текущий
                        </Badge>
                    </div>
                )}
                <CardContent className="flex flex-1 flex-col gap-5 p-6">
                    <div className="flex flex-col gap-1">
                        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                            {plan.code}
                        </p>
                        <p className="text-xl font-semibold">{plan.name}</p>
                        {plan.description && (
                            <p className="text-sm text-muted-foreground">{plan.description}</p>
                        )}
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-baseline gap-2 flex-wrap">
                            <span className="text-4xl font-semibold tabular-nums">{formatPrice(plan)}</span>
                            {oldPriceLabel && (
                                <span className="text-sm text-muted-foreground line-through tabular-nums">
                  {oldPriceLabel}
                </span>
                            )}
                            {discountPct != null && discountPct > 0 && (
                                <Badge variant="outline" className="border-accent/30 bg-accent/10 text-accent">
                                    −{discountPct}%
                                </Badge>
                            )}
                        </div>
                        {plan.durationDays && (
                            <p className="text-xs text-muted-foreground">
                                Срок действия: {plan.durationDays}{" "}
                                {plan.durationDays === 1
                                    ? "день"
                                    : plan.durationDays < 5
                                        ? "дня"
                                        : "дней"}
                            </p>
                        )}
                    </div>

                    <ul className="flex flex-1 flex-col gap-2 text-sm">
                        {features.map((f, i) => (
                            <li key={i} className="flex items-start gap-2">
                                <Check className="mt-0.5 size-4 shrink-0 text-emerald-600" />
                                <span>{f}</span>
                            </li>
                        ))}
                    </ul>

                    <Button
                        onClick={onCheckout}
                        disabled={current}
                        variant={highlighted ? "default" : "outline"}
                        className="h-11"
                    >
                        {current ? (
                            <>
                                <Check className="size-4" />
                                Текущий тариф
                            </>
                        ) : pendingOrder ? (
                            <>
                                Продолжить оплату
                                <ArrowRight className="size-4" />
                            </>
                        ) : (
                            <>
                                Оформить
                                <ArrowRight className="size-4" />
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
                    <Card className="w-full max-w-sm mx-4">
                        <CardContent className="flex flex-col gap-4 p-6">
                            <p className="text-lg font-semibold">Оформление оплаты</p>
                            <p className="text-sm text-muted-foreground">
                                Выберите, как удобнее оплатить этот тариф.
                            </p>
                            <div className="rounded-md bg-secondary/60 p-3 text-sm">
                                <div className="flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Тариф</span>
                                    <span className="font-medium">{plan.name}</span>
                                </div>
                                <div className="mt-1 flex items-center justify-between gap-3">
                                    <span className="text-muted-foreground">Сумма</span>
                                    <span className="font-medium">{formatPrice(plan)}</span>
                                </div>
                            </div>

                            <div className="grid gap-2">
                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("kaspi")}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition-colors",
                                        paymentMethod === "kaspi"
                                            ? "border-foreground bg-secondary"
                                            : "border-border hover:bg-secondary/70",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-medium">Kaspi</p>
                                            <p className="text-sm text-muted-foreground">
                                                Счёт на оплату или Kaspi QR
                                            </p>
                                        </div>
                                        <span
                                            className={cn(
                                                "size-4 rounded-full border",
                                                paymentMethod === "kaspi" ? "border-foreground bg-foreground" : "border-muted-foreground/40",
                                            )}
                                        />
                                    </div>
                                </button>

                                <button
                                    type="button"
                                    onClick={() => setPaymentMethod("freedom")}
                                    className={cn(
                                        "rounded-xl border p-3 text-left transition-colors",
                                        paymentMethod === "freedom"
                                            ? "border-foreground bg-secondary"
                                            : "border-border hover:bg-secondary/70",
                                    )}
                                >
                                    <div className="flex items-center justify-between gap-3">
                                        <div>
                                            <p className="font-medium">Freedom Pay</p>
                                            <p className="text-sm text-muted-foreground">
                                                Оплата картой Visa / Mastercard
                                            </p>
                                        </div>
                                        <span
                                            className={cn(
                                                "size-4 rounded-full border",
                                                paymentMethod === "freedom" ? "border-foreground bg-foreground" : "border-muted-foreground/40",
                                            )}
                                        />
                                    </div>
                                </button>
                            </div>

                            {paymentMethod === "kaspi" ? (
                                <>
                                    <div className="grid gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setKaspiMethod("invoice")}
                                            className={cn(
                                                "rounded-xl border p-3 text-left transition-colors",
                                                kaspiMethod === "invoice"
                                                    ? "border-foreground bg-secondary"
                                                    : "border-border hover:bg-secondary/70",
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <Smartphone className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                    <div>
                                                        <p className="font-medium">Счёт на оплату</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            Выставим счёт на номер телефона из Kaspi
                                                        </p>
                                                    </div>
                                                </div>
                                                <span
                                                    className={cn(
                                                        "size-4 rounded-full border",
                                                        kaspiMethod === "invoice" ? "border-foreground bg-foreground" : "border-muted-foreground/40",
                                                    )}
                                                />
                                            </div>
                                        </button>

                                        <button
                                            type="button"
                                            onClick={() => setKaspiMethod("qr")}
                                            className={cn(
                                                "rounded-xl border p-3 text-left transition-colors",
                                                kaspiMethod === "qr"
                                                    ? "border-foreground bg-secondary"
                                                    : "border-border hover:bg-secondary/70",
                                            )}
                                        >
                                            <div className="flex items-center justify-between gap-3">
                                                <div className="flex items-start gap-3">
                                                    <QrCode className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                                                    <div>
                                                        <p className="font-medium">Kaspi QR</p>
                                                        <p className="text-sm text-muted-foreground">
                                                            Сразу откроем экран с QR-кодом для оплаты
                                                        </p>
                                                    </div>
                                                </div>
                                                <span
                                                    className={cn(
                                                        "size-4 rounded-full border",
                                                        kaspiMethod === "qr" ? "border-foreground bg-foreground" : "border-muted-foreground/40",
                                                    )}
                                                />
                                            </div>
                                        </button>
                                    </div>

                                    {kaspiMethod === "invoice" ? (
                                        <div className="flex flex-col gap-2">
                                            <label className="text-sm font-medium">Номер телефона в Kaspi</label>
                                            <Input
                                                type="tel"
                                                placeholder="+7 (700) 123-45-67"
                                                value={phone}
                                                onChange={(e) => setPhone(e.target.value)}
                                                className={cn(error && "border-red-500")}
                                            />
                                            <p className="text-xs text-muted-foreground">
                                                На этот номер мы выставим счёт и откроем отдельный экран оплаты.
                                            </p>
                                        </div>
                                    ) : (
                                        <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
                                            Мы сразу создадим Kaspi QR и откроем отдельный экран, где можно отсканировать код
                                            или открыть ссылку оплаты, если она доступна.
                                        </div>
                                    )}
                                </>
                            ) : (
                                <div className="rounded-xl border border-border bg-secondary/40 p-3 text-sm text-muted-foreground">
                                    После нажатия мы перенаправим вас на защищённую страницу Freedom Pay для оплаты
                                    банковской картой.
                                </div>
                            )}

                            {error && <p className="text-xs text-red-500">{error}</p>}
                            <div className="flex gap-2">
                                <Button
                                    variant="outline"
                                    onClick={() => {
                                        setShowModal(false)
                                        setError(null)
                                    }}
                                    disabled={loading}
                                >
                                    Отмена
                                </Button>
                                <Button
                                    onClick={paymentMethod === "kaspi" ? handleKaspiCheckout : handleFreedomCheckout}
                                    disabled={loading}
                                    className="flex-1"
                                >
                                    {loading ? (
                                        <Loader2 className="size-4 animate-spin" />
                                    ) : paymentMethod === "freedom" ? (
                                        "Перейти к оплате"
                                    ) : kaspiMethod === "qr" ? (
                                        "Показать Kaspi QR"
                                    ) : (
                                        "Выставить счёт"
                                    )}
                                    {!loading && <ExternalLink className="size-4" />}
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </>
    )
}

function CurrentTariffCard({
                               tariff,
                               entAccess,
                               trial,
                               locale,
                               hasPaid,
                           }: {
    tariff: CurrentTariff | null
    entAccess?: AccessByExamItem
    trial?: TrialStatusItem
    locale: Locale
    hasPaid: boolean
}) {
    const title = localize(
        tariff?.name,
        locale,
        hasPaid ? "Premium" : "Стартовый доступ",
    )
    const description = localize(tariff?.description, locale)
    return (
        <Card className={cn(hasPaid ? "border-emerald-200 bg-emerald-50" : "bg-secondary/30")}>
            <CardContent className="flex flex-col gap-5 p-5 lg:flex-row lg:items-center lg:justify-between">
                <div className="flex items-start gap-3">
                    <div
                        className={cn(
                            "flex size-10 shrink-0 items-center justify-center rounded-md text-white",
                            hasPaid ? "bg-emerald-600" : "bg-foreground",
                        )}
                    >
                        {hasPaid ? <Crown className="size-5" /> : <Sparkles className="size-5" />}
                    </div>
                    <div>
                        <div className="flex flex-wrap items-center gap-2">
                            <p className={cn("font-semibold", hasPaid && "text-emerald-950")}>
                                Текущий тариф: {title}
                            </p>
                            {tariff?.isActive === false && (
                                <Badge variant="outline">Неактивен</Badge>
                            )}
                        </div>
                        {description && (
                            <p className={cn("text-sm text-muted-foreground", hasPaid && "text-emerald-800")}>
                                {description}
                            </p>
                        )}
                        {tariff?.expiresAt && (
                            <p className={cn("mt-1 text-xs text-muted-foreground", hasPaid && "text-emerald-800")}>
                                Действует до {formatDate(tariff.expiresAt)}
                            </p>
                        )}
                    </div>
                </div>

                <div
                    className={cn(
                        "grid gap-2",
                        hasPaid ? "sm:grid-cols-1 lg:min-w-[210px]" : "sm:grid-cols-2 lg:min-w-[420px]",
                    )}
                >
                    <TariffMetric label="Сегодня осталось" value={formatDailyRemaining(entAccess)} />
                    {!hasPaid && (
                        <TariffMetric label="Доступные попытки" value={formatFreeTrialRemaining(trial)} />
                    )}
                </div>
            </CardContent>
        </Card>
    )
}

function TariffMetric({ label, value }: { label: string; value: string }) {
    return (
        <div className="rounded-md border border-border/70 bg-background/80 px-3 py-2">
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                {label}
            </p>
            <p className="mt-0.5 font-semibold tabular-nums">{value}</p>
        </div>
    )
}

function formatDate(value: string) {
    return new Date(value).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "long",
        year: "numeric",
    })
}

function formatDailyRemaining(item: AccessByExamItem | undefined): string {
    if (!item) return "—"
    if (item.daily.isUnlimited) return "Без лимита"
    if (item.daily.limit == null) return "—"
    return `${item.daily.remaining ?? 0}/${item.daily.limit}`
}

function formatFreeTrialRemaining(trial: TrialStatusItem | undefined): string {
    if (!trial) return "—"
    const remaining = trial.freeRemaining ?? trial.remaining ?? 0
    const limit = trial.freeLimit ?? trial.limit ?? 0
    if (limit <= 0) return "Нужен Premium"
    return `${remaining}/${limit}`
}
