"use client"

import useSWR from "swr"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, Crown, Sparkles, ShieldCheck, Loader2, ExternalLink, XCircle } from "lucide-react"
import { useState, type ReactNode } from "react"
import { useSWRConfig } from "swr"
import { Card, CardContent } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { useAuth } from "@/lib/api/auth-context"
import { api } from "@/lib/api/client"
import { localize, type Locale } from "@/lib/api/i18n"
import { cn } from "@/lib/utils"
import type { AccessByExamItem, BillingPlan, CurrentTariff, TrialStatusItem, User } from "@/lib/api/types"

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
    checkoutUrl: string | null
    receiptUrl: string | null
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

function isRecord(value: unknown): value is Record<string, unknown> {
    return Boolean(value) && typeof value === "object" && !Array.isArray(value)
}

function getString(value: unknown): string | null {
    if (typeof value === "string" && value.trim()) return value.trim()
    if (typeof value === "number" && Number.isFinite(value)) return String(value)
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

export default function BillingPage() {
    const { user } = useAuth()
    const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
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

    // Highlight the most "popular" plan when there's a badge, otherwise the middle plan
    const highlightedIdx = (() => {
        const byBadge = sorted.findIndex((p) => p.badge)
        if (byBadge >= 0) return byBadge
        if (sorted.length >= 3) return Math.floor(sorted.length / 2)
        return -1
    })()

    return (
        <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
        <span className="inline-flex w-fit items-center gap-1.5 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
          <Sparkles className="size-3" />
          Подписка
        </span>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Тарифы</h1>
                <p className="text-muted-foreground">
                    Откройте полный доступ к пробникам, разборам и аналитике
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
                        />
                    ))}
                </div>
            )}

            <Card>
                <CardContent className="flex items-center gap-3 p-5 text-sm text-muted-foreground">
                    <div className="flex size-9 shrink-0 items-center justify-center rounded-md bg-secondary text-foreground">
                        <ShieldCheck className="size-4" />
                    </div>
                    <p>
                        Оплата через Kaspi: нажмите «Оформить», введите номер телефона из приложения Kaspi —
                        и оплатите выставленный счёт напрямую.
                    </p>
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
    if (isLoading) {
        return <Skeleton className="h-20 rounded-xl" />
    }

    if (!orders?.length) return null

    return (
        <Card className="border-amber-300 bg-amber-50">
            <CardContent className="flex flex-col gap-3 p-5">
                <div className="flex flex-col gap-1">
                    <p className="font-semibold text-amber-900">Ожидает оплаты в Kaspi</p>
                    <p className="text-sm text-amber-800">
                        Откройте счёт и оплатите его в приложении Kaspi. После оплаты доступ включится автоматически.
                    </p>
                </div>
                {orders.map((order) => {
                    const invoiceId = resolveOrderInvoiceId(order)
                    return (
                        <div key={invoiceId || order.createdAt} className="flex flex-col gap-3 rounded-md border border-amber-200 bg-white/70 p-3 sm:flex-row sm:items-center sm:justify-between">
                            <div className="text-sm">
                                <p className="font-medium">{order.planName}</p>
                                <p className="text-muted-foreground">
                                    {order.amount.toLocaleString("ru-RU")} {order.currency}
                                </p>
                            </div>
                            {invoiceId ? (
                              <div className="flex flex-col gap-2 sm:flex-row">
                                <Button size="sm" asChild>
                                    <Link href={`/dashboard/billing/kaspi/${encodeURIComponent(invoiceId)}`}>
                                        Продолжить оплату
                                        <ArrowRight className="size-4" />
                                    </Link>
                                </Button>
                                <CancelKaspiOrderButton invoiceId={invoiceId} />
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
                  }: {
    plan: NormalizedPlan
    highlighted?: boolean
    current?: boolean
    user: User | null
    locale: Locale
    pendingOrder?: KaspiOrder
}) {
    const router = useRouter()
    const { mutate } = useSWRConfig()
    const [showModal, setShowModal] = useState(false)
    const [phone, setPhone] = useState("")
    const [loading, setLoading] = useState(false)
    const [error, setError] = useState<ReactNode | null>(null)

    const onCheckout = async () => {
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
        setShowModal(true)
        setError(null)
    }

    const handleKaspiCheckout = async () => {
        const digits = phone.replace(/\D/g, "")
        if (digits.length < 10) {
            setError("Введите корректный номер телефона")
            return
        }
        setLoading(true)
        setError(null)
        try {
            const rawResult = await api<KaspiCheckoutResponse>("/billing/kaspi/checkout", {
                method: "POST",
                body: { planId: plan.id, phoneNumber: digits },
            })
            const result = normalizeKaspiCheckoutResponse(rawResult)
            await mutate("/billing/kaspi/orders/active")
            if (!result.invoiceId) {
                setError("Счёт создан, но сервер не вернул номер счёта. Обновите страницу и откройте его из блока активных счетов.")
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
                setError("Счёт уже выставлен. Обновите страницу и продолжите оплату из блока активных счетов.")
            } else {
                setError("Ошибка при создании счёта. Попробуйте ещё раз.")
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
                            <p className="text-lg font-semibold">Оплата через Kaspi</p>
                            <p className="text-sm text-muted-foreground">
                                Мы выставим счёт на номер из Kaspi и откроем отдельный экран оплаты.
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
                            <div className="flex flex-col gap-2">
                                <label className="text-sm font-medium">Номер телефона в Kaspi</label>
                                <Input
                                    type="tel"
                                    placeholder="+7 (700) 123-45-67"
                                    value={phone}
                                    onChange={(e) => setPhone(e.target.value)}
                                    className={cn(error && "border-red-500")}
                                />
                                {error && <p className="text-xs text-red-500">{error}</p>}
                            </div>
                            <div className="flex gap-2">
                                <Button variant="outline" onClick={() => setShowModal(false)} disabled={loading}>
                                    Отмена
                                </Button>
                                <Button onClick={handleKaspiCheckout} disabled={loading} className="flex-1">
                                    {loading ? <Loader2 className="size-4 animate-spin" /> : "Выставить счёт"}
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
                        <TariffMetric label="Пробные попытки" value={formatFreeTrialRemaining(trial)} />
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
    return `${remaining}/${limit}`
}
