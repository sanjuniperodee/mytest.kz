import { useMemo, useState } from "react"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import useSWR, { useSWRConfig } from "swr"
import {
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { api, ApiError } from "@/lib/api/client"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import { useLocation } from "@/lib/location"
import { mayAccessKaspiCommerce } from "@/lib/billing-region"
import type { AccessByExamItem, BillingPlan, CurrentTariff, TrialStatusItem, User } from "@/lib/api/types"
import {
  normalizeBillingPlan,
  type NormalizedPlan,
} from "@/lib/billing/whatsapp"
import {
  normalizeKaspiCheckoutResponse,
  resolveOrderInvoiceId,
  type KaspiCheckoutResponse,
  type KaspiOrder,
} from "@/lib/billing/kaspi"
import { useAppTheme } from "@/lib/theme/provider"
import type { ThemeColors } from "@/lib/theme/colors"
import { fonts } from "@/lib/theme/fonts"
import { t, useUiLocale, type UiLocale } from "@/lib/i18n/ui"
import { APPLE_IAP_PRODUCTS, isAppleIapAvailable } from "@/lib/billing/apple-iap"

function formatPrice(plan: NormalizedPlan, ui: UiLocale): string {
  if (plan.price == null) return "—"
  const loc = ui === "kk" ? "kk-KZ" : "ru-RU"
  return `${plan.price.toLocaleString(loc)} ${plan.currency}`
}

function formatOldPrice(plan: NormalizedPlan, ui: UiLocale): string | null {
  if (plan.oldPrice == null || plan.oldPrice <= 0) return null
  const loc = ui === "kk" ? "kk-KZ" : "ru-RU"
  return `${plan.oldPrice.toLocaleString(loc)} ${plan.currency}`
}

function durationWord(ui: UiLocale, days: number): string {
  if (days === 1) return t("billDay", ui)
  if (days >= 2 && days <= 4) return t("billDays2to4", ui)
  return t("billDays5plus", ui)
}

function formatTariffDate(value: string, ui: UiLocale) {
  return new Date(value).toLocaleDateString(ui === "kk" ? "kk-KZ" : "ru-RU", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  })
}

function normalizeOrders(data: KaspiOrder[] | { items: KaspiOrder[] } | null | undefined): KaspiOrder[] {
  if (Array.isArray(data)) return data
  if (data && Array.isArray(data.items)) return data.items
  return []
}

type PaymentMethod = "kaspi" | "apple"
type KaspiMethod = "invoice" | "qr"
type ApplePurchaseType = "in-app" | "subs"

function parseIapError(err: unknown): { code: string; message: string } {
  if (err instanceof Error) {
    const maybeCode = (err as { code?: unknown }).code
    return {
      code: typeof maybeCode === "string" ? maybeCode : "",
      message: err.message || String(err),
    }
  }
  if (typeof err === "object" && err) {
    const record = err as Record<string, unknown>
    return {
      code: typeof record.code === "string" ? record.code : "",
      message: typeof record.message === "string" ? record.message : JSON.stringify(record),
    }
  }
  return { code: "", message: String(err) }
}

function isUserCancelledIap(err: unknown) {
  const parsed = parseIapError(err)
  const haystack = `${parsed.code} ${parsed.message}`.toUpperCase()
  return (
    haystack.includes("E_USER_CANCELLED") ||
    haystack.includes("USER_CANCELLED") ||
    haystack.includes("USER_CANCELED")
  )
}

function shouldTryAlternateIapType(err: unknown) {
  const parsed = parseIapError(err)
  const haystack = `${parsed.code} ${parsed.message}`.toUpperCase()
  return (
    haystack.includes("E_ITEM_UNAVAILABLE") ||
    haystack.includes("E_DEVELOPER_ERROR") ||
    haystack.includes("E_UNKNOWN") ||
    haystack.includes("NOT AVAILABLE") ||
    haystack.includes("INVALID")
  )
}

function applePurchaseTypeOrder(planId: string): ApplePurchaseType[] {
  if (planId === "month" || planId === "annual") {
    return ["subs", "in-app"]
  }
  return ["in-app", "subs"]
}

function paymentFooterCopy(ui: UiLocale, canUseKaspi: boolean, canUseAppleIap: boolean) {
  if (canUseKaspi && canUseAppleIap) {
    return ui === "kk"
      ? "Өзіңізге ыңғайлы тәсілді таңдаңыз: Kaspi арқылы шот немесе QR, не App Store ішіндегі сатып алу."
      : "Выберите удобный способ оплаты: счёт или QR через Kaspi, либо покупку внутри App Store."
  }
  if (canUseKaspi) {
    return ui === "kk"
      ? "Төлем Kaspi арқылы қолжетімді: нөмірге шот қоюға немесе Kaspi QR ашуға болады."
      : "Оплата доступна через Kaspi: можно выставить счёт на номер телефона или открыть Kaspi QR."
  }
  if (canUseAppleIap) {
    return ui === "kk"
      ? "Бұл аймақта сатып алу қолданба ішінде App Store арқылы қолжетімді."
      : "В этом регионе покупка доступна внутри приложения через App Store."
  }
  return ui === "kk"
    ? "Қолданба ішінде төлем бұл құрылғыда әзірге қолжетімсіз. iPhone немесе iPad арқылы кіріп көріңіз."
    : "Покупка внутри приложения пока недоступна на этом устройстве. Попробуйте войти с iPhone или iPad."
}

export function BillingView() {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { user, refresh } = useAuth()
  const { isInKZ } = useLocation()
  const canUseKaspi = mayAccessKaspiCommerce(isInKZ)
  const canUseAppleIap = isAppleIapAvailable()
  const { mutate: mutateGlobal } = useSWRConfig()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data, isLoading } = useSWR<BillingPlan[] | { items: BillingPlan[] }>("/billing/plans")
  const { data: ordersData, isLoading: ordersLoading } = useSWR<KaspiOrder[] | { items: KaspiOrder[] }>(
    "/billing/kaspi/orders/active",
    (url: string) => api(url),
    { refreshInterval: 10000 },
  )

  const pendingOrders = normalizeOrders(ordersData)
  const rawPlans: BillingPlan[] = Array.isArray(data) ? data : data?.items ?? []
  const plans = rawPlans.map((p) => normalizeBillingPlan(p, locale))
  const sorted = [...plans].sort((a, b) => (a.price ?? 0) - (b.price ?? 0))
  const currentTariff = user?.currentTariff ?? null
  const entAccess = user?.accessByExam?.find((item) => item.examSlug === "ent")
  const entTrial = user?.trialStatus?.ent
  const hasPaidSubscription = Boolean(user?.hasActiveSubscription)

  const highlightedIdx = (() => {
    const byBadge = sorted.findIndex((p) => p.badge)
    if (byBadge >= 0) return byBadge
    if (sorted.length >= 3) return Math.floor(sorted.length / 2)
    return -1
  })()

  const cancelOrder = async (invoiceId: string) => {
    await api(`/billing/kaspi/orders/${encodeURIComponent(invoiceId)}/cancel`, {
      method: "POST",
    })
    await mutateGlobal("/billing/kaspi/orders/active")
  }

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: colors.secondary }]}> 
      <View style={[styles.pill, { backgroundColor: `${colors.accent}22` }]}> 
        <MaterialCommunityIcons name="star-four-points-small" size={14} color={colors.accent} />
        <Text style={[styles.pillText, { color: colors.accent }]}>{t("billPill", ui)}</Text>
      </View>
      <Text style={[styles.h1, { color: colors.foreground }]}>{t("billTitle", ui)}</Text>
      <Text style={[styles.lead, { color: colors.mutedForeground }]}>
        {t("billLead", ui)}
      </Text>

      <CurrentTariffCard
        tariff={currentTariff}
        entAccess={entAccess}
        trial={entTrial}
        locale={locale}
        ui={ui}
        hasPaid={hasPaidSubscription}
        colors={colors}
      />

      {canUseKaspi ? (
        <PendingKaspiOrders
          orders={pendingOrders}
          isLoading={ordersLoading}
          ui={ui}
          onCancel={cancelOrder}
        />
      ) : null}

      {isLoading ? (
        <View style={[styles.skelGrid, { gap: 12 }]}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[styles.skelCard, { backgroundColor: colors.card }]} />
          ))}
        </View>
      ) : sorted.length === 0 ? (
        <Card>
          <Text style={[styles.emptyPlans, { color: colors.mutedForeground }]}>
            {t("billEmpty", ui)}
          </Text>
        </Card>
      ) : (
        <View style={[styles.planGrid, sorted.length > 1 && styles.planGridTwo]}>
          {sorted.map((plan, idx) => (
            <PlanCard
              key={plan.id}
              plan={plan}
              ui={ui}
              locale={locale}
              user={user}
              highlighted={idx === highlightedIdx}
              current={
                currentTariff?.isActive === true && currentTariff.code === plan.code
              }
              pendingOrder={pendingOrders.find((o) => o.planCode === plan.id)}
              onOrderChanged={() => void mutateGlobal("/billing/kaspi/orders/active")}
              onRefreshUser={() => void refresh()}
              canUseKaspi={canUseKaspi}
              canUseAppleIap={canUseAppleIap}
              colors={colors}
            />
          ))}
        </View>
      )}

      <Card style={{ marginTop: 8 }}>
        <View style={styles.footerCard}>
          <View style={styles.footerRow}>
            <View style={[styles.footerIcon, { backgroundColor: colors.secondary }]}>
              <MaterialCommunityIcons name="shield-check" size={20} color={colors.foreground} />
            </View>
            <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
              {paymentFooterCopy(ui, canUseKaspi, canUseAppleIap)}
            </Text>
          </View>

          <View style={styles.footerChips}>
            {canUseKaspi ? (
              <>
                <View style={[styles.brandChip, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Text style={[styles.brandChipText, { color: colors.foreground }]}>Kaspi</Text>
                </View>
                <View style={[styles.brandChip, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                  <Text style={[styles.brandChipText, { color: colors.foreground }]}>Kaspi QR</Text>
                </View>
              </>
            ) : null}
            {canUseAppleIap ? (
              <View style={[styles.brandChip, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Text style={[styles.brandChipText, { color: colors.foreground }]}>App Store</Text>
              </View>
            ) : null}
          </View>
        </View>
      </Card>
    </ScrollView>
  )
}

function PendingKaspiOrders({
  orders,
  isLoading,
  ui,
  onCancel,
}: {
  orders: KaspiOrder[]
  isLoading: boolean
  ui: UiLocale
  onCancel: (invoiceId: string) => Promise<void>
}) {
  const { colors } = useAppTheme()
  const [cancellingId, setCancellingId] = useState<string | null>(null)

  const askCancel = (invoiceId: string) => {
    Alert.alert(
      ui === "kk" ? "Kaspi шотын болдырмау" : "Отмена счёта Kaspi",
      ui === "kk"
        ? "Осы шотты болдырғыңыз келе ме?"
        : "Отменить этот счёт? После отмены можно будет выставить новый.",
      [
        { text: ui === "kk" ? "Жоқ" : "Нет", style: "cancel" },
        {
          text: ui === "kk" ? "Иә, болдырмау" : "Да, отменить",
          style: "destructive",
          onPress: async () => {
            setCancellingId(invoiceId)
            try {
              await onCancel(invoiceId)
            } catch (err) {
              Alert.alert(
                ui === "kk" ? "Қате" : "Ошибка",
                err instanceof ApiError ? err.message : ui === "kk" ? "Шотты болдырмау мүмкін болмады" : "Не удалось отменить счёт",
              )
            } finally {
              setCancellingId(null)
            }
          },
        },
      ],
    )
  }

  if (isLoading) {
    return <View style={[styles.skelCard, { backgroundColor: colors.card, marginBottom: 12, height: 92 }]} />
  }

  if (!orders.length) return null

  return (
    <Card style={[styles.pendingCard, { borderColor: "#fcd34d", backgroundColor: "#fffbeb" }]}>
      <Text style={[styles.pendingTitle, { color: "#92400e" }]}> 
        {ui === "kk" ? "Kaspi-де төлем күтілуде" : "Ожидает оплаты в Kaspi"}
      </Text>
      <Text style={[styles.pendingDesc, { color: "#b45309" }]}> 
        {ui === "kk"
          ? "Шотты ашып, төлемді аяқтаңыз. Расталған соң Premium автоматты түрде қосылады."
          : "Откройте счёт и завершите оплату. После подтверждения доступ включится автоматически."}
      </Text>

      <View style={{ gap: 10, marginTop: 10 }}>
        {orders.map((order) => {
          const invoiceId = resolveOrderInvoiceId(order)
          const canCancel = order.paymentType !== "qr"
          return (
            <View key={invoiceId || order.createdAt} style={[styles.pendingItem, { borderColor: "#fde68a" }]}> 
              <View style={{ flex: 1, gap: 4 }}>
                <Text style={[styles.pendingItemTitle, { color: "#111827" }]}>
                  {order.planName}
                  {order.paymentType === "qr" ? " · Kaspi QR" : ""}
                </Text>
                <Text style={{ color: "#6b7280", fontSize: 13 }}>
                  {order.amount.toLocaleString("ru-RU")} {order.currency}
                </Text>
                {order.expiresAt ? (
                  <Text style={{ color: "#6b7280", fontSize: 12 }}>
                    {ui === "kk" ? "Белсенді:" : "Активен до:"} {new Date(order.expiresAt).toLocaleString("ru-RU")}
                  </Text>
                ) : null}
              </View>

              {invoiceId ? (
                <View style={{ gap: 8, minWidth: 150 }}>
                  <Button
                    onPress={() => router.push(`/dashboard/billing/kaspi/${encodeURIComponent(invoiceId)}` as never)}
                  >
                    {ui === "kk" ? "Төлемді жалғастыру" : "Продолжить оплату"}
                  </Button>
                  {canCancel ? (
                    <Button
                      variant="outline"
                      disabled={cancellingId === invoiceId}
                      onPress={() => askCancel(invoiceId)}
                    >
                      {cancellingId === invoiceId ? (ui === "kk" ? "Болдырылуда..." : "Отмена...") : (ui === "kk" ? "Болдырмау" : "Отменить")}
                    </Button>
                  ) : null}
                </View>
              ) : null}
            </View>
          )
        })}
      </View>
    </Card>
  )
}

function PlanCard({
  plan,
  highlighted,
  current,
  pendingOrder,
  user,
  locale,
  onOrderChanged,
  onRefreshUser,
  canUseKaspi,
  canUseAppleIap,
  colors,
  ui,
}: {
  plan: NormalizedPlan
  highlighted?: boolean
  current?: boolean
  pendingOrder?: KaspiOrder
  user: User | null
  locale: Locale
  onOrderChanged: () => void
  onRefreshUser: () => void
  canUseKaspi: boolean
  canUseAppleIap: boolean
  colors: ThemeColors
  ui: UiLocale
}) {
  const [showModal, setShowModal] = useState(false)
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(canUseKaspi ? "kaspi" : "apple")
  const [kaspiMethod, setKaspiMethod] = useState<KaspiMethod>("invoice")
  const [phone, setPhone] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const hasAnyMobilePayment = canUseKaspi || canUseAppleIap

  const onCheckout = () => {
    if (!hasAnyMobilePayment) {
      Alert.alert(
        ui === "kk" ? "Төлем қолжетімсіз" : "Оплата недоступна",
        ui === "kk"
          ? "Бұл құрылғыда қолданба ішіндегі сатып алу әзірге қолжетімсіз."
          : "Покупка внутри приложения пока недоступна на этом устройстве.",
      )
      return
    }
    if (pendingOrder) {
      const invoiceId = resolveOrderInvoiceId(pendingOrder)
      if (invoiceId) {
        router.push(`/dashboard/billing/kaspi/${encodeURIComponent(invoiceId)}` as never)
        return
      }
      setError(ui === "kk" ? "Белсенді шот табылмады" : "Не удалось открыть активный счёт")
      setShowModal(true)
      return
    }

    const userPhone = typeof user?.phone === "string" ? user.phone.trim() : ""
    setPhone(userPhone)
    setError(null)
    setPaymentMethod(canUseKaspi ? "kaspi" : "apple")
    setKaspiMethod("invoice")
    setShowModal(true)
  }

  const handleAppleCheckout = async () => {
    const productId = APPLE_IAP_PRODUCTS[plan.id]
    if (!productId) {
      setError(ui === "kk" ? "Бұл тариф App Store үшін бапталмаған" : "Этот тариф не настроен для App Store")
      return
    }
    setLoading(true)
    setError(null)
    try {
      const IAP = await import("react-native-iap")
      await IAP.initConnection()
      if (typeof IAP.requestPurchase !== "function") {
        throw new Error("IAP_REQUEST_UNAVAILABLE")
      }
      let purchase: unknown = null
      let lastError: unknown = null
      const purchaseTypes = applePurchaseTypeOrder(plan.id)
      for (let idx = 0; idx < purchaseTypes.length; idx += 1) {
        const currentType = purchaseTypes[idx]
        try {
          if (typeof IAP.fetchProducts === "function") {
            await IAP.fetchProducts({
              skus: [productId],
              type: currentType,
            } as never)
          }
          purchase = await IAP.requestPurchase({
            type: currentType,
            request: {
              apple: {
                sku: productId,
              },
              ios: {
                sku: productId,
              },
            },
          } as never)
          break
        } catch (err) {
          if (isUserCancelledIap(err)) {
            setError(null)
            return
          }
          lastError = err
          const canFallback = idx < purchaseTypes.length - 1 && shouldTryAlternateIapType(err)
          if (!canFallback) throw err
        }
      }
      if (!purchase && lastError) {
        throw lastError
      }
      const first = Array.isArray(purchase) ? purchase[0] : purchase
      let receiptData =
        (first as any)?.transactionReceipt ||
        (first as any)?.transactionReceiptIOS ||
        (first as any)?.originalJson
      if (!receiptData && typeof IAP.getReceiptIOS === "function") {
        try {
          receiptData = await IAP.getReceiptIOS()
        } catch {
          // keep original behavior below if receipt could not be read
        }
      }
      if (!receiptData) {
        throw new Error("IAP_RECEIPT_MISSING")
      }

      await api("/billing/apple/verify-receipt", {
        method: "POST",
        body: { receiptData, productId },
      })
      await IAP.finishTransaction({ purchase: first, isConsumable: false } as never)
      onRefreshUser()
      setShowModal(false)
      Alert.alert(ui === "kk" ? "Дайын" : "Готово", ui === "kk" ? "Premium қосылды" : "Premium подключён")
    } catch (err) {
      if (isUserCancelledIap(err)) return
      const message = err instanceof ApiError ? err.message : parseIapError(err).message
      if (message.includes("APPLE_IAP_NOT_CONFIGURED")) {
        setError(
          ui === "kk"
            ? "App Store төлемі серверде бапталмаған. Қолдауға жазыңыз."
            : "App Store-оплата пока не настроена на сервере. Напишите в поддержку.",
        )
      } else if (
        message.includes("APPLE_RECEIPT_INVALID") ||
        message.includes("APPLE_RECEIPT_EMPTY") ||
        message.includes("APPLE_PRODUCT_NOT_FOUND")
      ) {
        setError(
          ui === "kk"
            ? "Төлем жасалды, бірақ чек тексеруден өтпеді. Қайта көріңіз немесе қолдауға жазыңыз."
            : "Покупка прошла, но чек не подтвердился. Повторите попытку или обратитесь в поддержку.",
        )
      } else if (message.includes("APPLE_PLAN_NOT_MAPPED")) {
        setError(
          ui === "kk"
            ? "Бұл App Store өнімі тарифке байланыстырылмаған. Қолдауға жазыңыз."
            : "Этот App Store-продукт не привязан к тарифу. Напишите в поддержку.",
        )
      } else {
        setError(ui === "kk" ? "Сатып алу сәтсіз аяқталды. Қайта көріңіз." : "Покупка не завершена. Попробуйте снова.")
      }
    } finally {
      setLoading(false)
    }
  }

  const handleKaspiCheckout = async () => {
    const digits = phone.replace(/\D/g, "")
    if (kaspiMethod === "invoice" && digits.length < 10) {
      setError(ui === "kk" ? "Дұрыс телефон нөмірін енгізіңіз" : "Введите корректный номер телефона")
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
      onOrderChanged()

      if (!result.invoiceId) {
        setError(
          ui === "kk"
            ? "Шот құрылды, бірақ нөмірі қайтпады. Парақты жаңартып, белсенді шоттан ашып көріңіз."
            : "Счёт создан, но номер счёта не вернулся. Обновите страницу и откройте его из активных счетов.",
        )
        return
      }

      setShowModal(false)
      router.push(`/dashboard/billing/kaspi/${encodeURIComponent(result.invoiceId)}` as never)
    } catch (err) {
      const message = err instanceof ApiError ? err.message : String(err)
      if (message.includes("KASPI_NOT_AUTHENTICATED")) {
        setError(ui === "kk" ? "Kaspi қазір қолжетімсіз. Қолдауға жазыңыз." : "Kaspi сейчас недоступен. Обратитесь в поддержку.")
      } else if (message.includes("PENDING_ORDER_EXISTS")) {
        setError(ui === "kk" ? "Белсенді шот бар. Оны жалғастырыңыз." : "Активный счёт уже есть. Продолжите его оплату.")
      } else {
        setError(
          kaspiMethod === "qr"
            ? ui === "kk"
              ? "Kaspi QR құру қатесі. Қайталап көріңіз."
              : "Ошибка при создании Kaspi QR. Попробуйте еще раз."
            : ui === "kk"
              ? "Шот құру қатесі. Қайталап көріңіз."
              : "Ошибка при создании счёта. Попробуйте еще раз.",
        )
      }
    } finally {
      setLoading(false)
    }
  }

  const features = useMemo(
    () =>
      plan.features.length > 0
        ? plan.features
        : [
            t("billFeat1", ui),
            t("billFeat2", ui),
            t("billFeat3", ui),
            t("billFeat4", ui),
          ],
    [plan.features, ui],
  )

  const oldPriceLabel = formatOldPrice(plan, ui)
  const discountPct =
    plan.price != null && plan.oldPrice != null && plan.oldPrice > plan.price
      ? Math.round(((plan.oldPrice - plan.price) / plan.oldPrice) * 100)
      : null

  return (
    <>
      <Card
        style={[
          styles.planCard,
          highlighted && { borderColor: colors.foreground },
        ]}
      >
        {(plan.badge || (highlighted && !plan.badge)) && (
          <View style={styles.badgeTopRight}>
            <View
              style={[
                styles.miniPill,
                {
                  backgroundColor: plan.badge ? colors.accent : colors.foreground,
                },
              ]}
            >
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: "700",
                  color: colors.background,
                  textTransform: plan.badge ? "capitalize" : "none",
                }}
              >
                {plan.badge || t("billRecommended", ui)}
              </Text>
            </View>
          </View>
        )}
        {current ? (
          <View style={styles.badgeTopLeft}>
            <View style={[styles.miniPill, { backgroundColor: "#ECFDF5", borderWidth: 1, borderColor: "#059669" }]}>
              <Text style={{ fontSize: 11, fontWeight: "700", color: "#059669" }}>
                {t("billCurrentBadge", ui)}
              </Text>
            </View>
          </View>
        ) : null}

        <Text style={[styles.planCode, { color: colors.mutedForeground }]}>{plan.code}</Text>
        <Text style={[styles.planName, { color: colors.foreground }]}>{plan.name}</Text>
        {plan.description ? (
          <Text style={[styles.planDesc, { color: colors.mutedForeground }]}>{plan.description}</Text>
        ) : null}

        <View style={{ marginTop: 12 }}>
          <View style={{ flexDirection: "row", alignItems: "baseline", flexWrap: "wrap", gap: 8 }}>
            <Text style={[styles.priceBig, { color: colors.foreground }]}>{formatPrice(plan, ui)}</Text>
            {oldPriceLabel ? (
              <Text style={[styles.oldPrice, { color: colors.mutedForeground }]}>
                {oldPriceLabel}
              </Text>
            ) : null}
            {discountPct != null && discountPct > 0 ? (
              <View
                style={[
                  styles.miniPill,
                  {
                    borderWidth: StyleSheet.hairlineWidth,
                    borderColor: `${colors.accent}55`,
                    backgroundColor: `${colors.accent}18`,
                  },
                ]}
              >
                <Text style={{ fontSize: 11, fontWeight: "700", color: colors.accent }}>
                  −{discountPct}%
                </Text>
              </View>
            ) : null}
          </View>
          {plan.durationDays ? (
            <Text style={[styles.duration, { color: colors.mutedForeground }]}>
              {t("billDurationPrefix", ui)} {plan.durationDays} {durationWord(ui, plan.durationDays)}
            </Text>
          ) : null}
        </View>

        <View style={{ marginTop: 14, gap: 8, flex: 1 }}>
          {features.map((f, i) => (
            <View key={i} style={styles.featureRow}>
              <MaterialCommunityIcons name="check-circle" size={18} color="#059669" />
              <Text style={[styles.featureText, { color: colors.foreground }]}>{f}</Text>
            </View>
          ))}
        </View>

        <View style={{ marginTop: 16 }}>
          <Button
            variant={highlighted ? "primary" : "outline"}
            disabled={current || !hasAnyMobilePayment}
            onPress={onCheckout}
          >
            {current
              ? t("billCurrentTariff", ui)
              : pendingOrder
                ? (ui === "kk" ? "Төлемді жалғастыру" : "Продолжить оплату")
                : !hasAnyMobilePayment
                  ? (ui === "kk" ? "Қолжетімсіз" : "Недоступно")
                : t("billCheckout", ui)}
          </Button>
        </View>
      </Card>

      <Modal visible={showModal} transparent animationType="fade" onRequestClose={() => setShowModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={[styles.modalCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
            <Text style={[styles.modalTitle, { color: colors.foreground }]}>
              {ui === "kk" ? "Төлемді рәсімдеу" : "Оформление оплаты"}
            </Text>
            <Text style={[styles.modalLead, { color: colors.mutedForeground }]}>
              {ui === "kk"
                ? "Төлем тәсілін таңдаңыз: Kaspi шоты, Kaspi QR немесе қолданба ішіндегі App Store сатып алуы."
                : "Выберите способ оплаты: счёт Kaspi, Kaspi QR или покупку внутри App Store."}
            </Text>

            <View style={[styles.modalSummary, { backgroundColor: colors.secondary, borderColor: colors.border }]}>
              <View style={styles.modalSummaryRow}>
                <Text style={{ color: colors.mutedForeground }}>{ui === "kk" ? "Тариф" : "Тариф"}</Text>
                <Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{plan.name}</Text>
              </View>
              <View style={styles.modalSummaryRow}>
                <Text style={{ color: colors.mutedForeground }}>{ui === "kk" ? "Бағасы" : "Цена"}</Text>
                <Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi }}>{formatPrice(plan, ui)}</Text>
              </View>
            </View>

            <View style={{ gap: 8 }}>
              <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
                {ui === "kk" ? "Төлем тәсілі" : "Способ оплаты"}
              </Text>
              <View style={styles.methodGrid}>
                {canUseKaspi ? (
                  <Pressable
                    disabled={loading}
                    onPress={() => {
                      setPaymentMethod("kaspi")
                      setError(null)
                    }}
                    style={[
                      styles.methodCard,
                      {
                        borderColor: paymentMethod === "kaspi" ? colors.foreground : colors.border,
                        backgroundColor: paymentMethod === "kaspi" ? colors.secondary : colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.methodTitle, { color: colors.foreground }]}>Kaspi</Text>
                    <Text style={[styles.methodDesc, { color: colors.mutedForeground }]}>
                      {ui === "kk"
                        ? "Нөмірге шот немесе Kaspi QR"
                        : "Счёт на номер телефона или Kaspi QR"}
                    </Text>
                  </Pressable>
                ) : null}
                {canUseAppleIap ? (
                  <Pressable
                    disabled={loading}
                    onPress={() => {
                      setPaymentMethod("apple")
                      setError(null)
                    }}
                    style={[
                      styles.methodCard,
                      {
                        borderColor: paymentMethod === "apple" ? colors.foreground : colors.border,
                        backgroundColor: paymentMethod === "apple" ? colors.secondary : colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.methodTitle, { color: colors.foreground }]}>App Store</Text>
                    <Text style={[styles.methodDesc, { color: colors.mutedForeground }]}>
                      {ui === "kk"
                        ? "Қолданба ішіндегі сатып алу"
                        : "Покупка внутри приложения"}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
            </View>

            {paymentMethod === "kaspi" && canUseKaspi ? (
              <View style={{ gap: 8 }}>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
                  {ui === "kk" ? "Kaspi тәсілі" : "Сценарий Kaspi"}
                </Text>
                <View style={styles.methodGrid}>
                  <Pressable
                    disabled={loading}
                    onPress={() => {
                      setKaspiMethod("invoice")
                      setError(null)
                    }}
                    style={[
                      styles.methodCard,
                      {
                        borderColor: kaspiMethod === "invoice" ? colors.foreground : colors.border,
                        backgroundColor: kaspiMethod === "invoice" ? colors.secondary : colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.methodTitle, { color: colors.foreground }]}>
                      {ui === "kk" ? "Шот" : "Счёт"}
                    </Text>
                    <Text style={[styles.methodDesc, { color: colors.mutedForeground }]}>
                      {ui === "kk"
                        ? "Kaspi нөміріне шот қоямыз"
                        : "Выставим счёт на номер Kaspi"}
                    </Text>
                  </Pressable>
                  <Pressable
                    disabled={loading}
                    onPress={() => {
                      setKaspiMethod("qr")
                      setError(null)
                    }}
                    style={[
                      styles.methodCard,
                      {
                        borderColor: kaspiMethod === "qr" ? colors.foreground : colors.border,
                        backgroundColor: kaspiMethod === "qr" ? colors.secondary : colors.card,
                      },
                    ]}
                  >
                    <Text style={[styles.methodTitle, { color: colors.foreground }]}>Kaspi QR</Text>
                    <Text style={[styles.methodDesc, { color: colors.mutedForeground }]}>
                      {ui === "kk"
                        ? "Дайын QR немесе төлем сілтемесі"
                        : "Готовый QR или ссылка на оплату"}
                    </Text>
                  </Pressable>
                </View>
              </View>
            ) : null}

            {paymentMethod === "kaspi" && kaspiMethod === "invoice" ? (
              <>
                <Text style={[styles.modalLabel, { color: colors.mutedForeground }]}>
                  {ui === "kk" ? "Kaspi нөмірі" : "Номер Kaspi"}
                </Text>
                <TextInput
                  style={[styles.modalInput, { color: colors.foreground, borderColor: colors.border }]}
                  placeholder="77000000000"
                  placeholderTextColor={colors.mutedForeground}
                  keyboardType="phone-pad"
                  value={phone}
                  onChangeText={setPhone}
                  editable={!loading}
                />
              </>
            ) : null}

            {paymentMethod === "apple" ? (
              <View style={[styles.noteCard, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
                <Text style={[styles.noteTitle, { color: colors.foreground }]}>
                  {ui === "kk" ? "App Store ішіндегі сатып алу" : "Покупка внутри App Store"}
                </Text>
                <Text style={[styles.noteDesc, { color: colors.mutedForeground }]}>
                  {ui === "kk"
                    ? "Төлем Apple аккаунтыңыз арқылы расталады. Расталғаннан кейін Premium бірден қосылады."
                    : "Оплата подтвердится через ваш Apple ID. После покупки Premium включится автоматически."}
                </Text>
              </View>
            ) : null}

            {error ? <Text style={styles.modalError}>{error}</Text> : null}

            <View style={styles.modalActions}>
              <Button variant="outline" disabled={loading} onPress={() => setShowModal(false)}>
                {ui === "kk" ? "Бас тарту" : "Отмена"}
              </Button>
              <Button
                disabled={loading}
                onPress={() => void (paymentMethod === "apple" ? handleAppleCheckout() : handleKaspiCheckout())}
              >
                {loading
                  ? ui === "kk"
                    ? "Орындалуда..."
                    : "Выполняем..."
                  : paymentMethod === "apple"
                    ? ui === "kk"
                      ? "App Store арқылы сатып алу"
                      : "Купить через App Store"
                    : kaspiMethod === "qr"
                      ? ui === "kk"
                        ? "Kaspi QR көрсету"
                        : "Показать Kaspi QR"
                      : ui === "kk"
                        ? "Шот қою"
                        : "Выставить счёт"}
              </Button>
            </View>
          </View>
        </View>
      </Modal>
    </>
  )
}

function CurrentTariffCard({
  tariff,
  entAccess,
  trial,
  locale,
  ui,
  hasPaid,
  colors,
}: {
  tariff: CurrentTariff | null
  entAccess?: AccessByExamItem
  trial?: TrialStatusItem
  locale: Locale
  ui: UiLocale
  hasPaid: boolean
  colors: ThemeColors
}) {
  const { resolved } = useAppTheme()
  const title = localize(
    tariff?.name,
    locale,
    hasPaid ? t("billTariffDefaultPaid", ui) : t("billTariffDefaultFree", ui),
  )
  const description = localize(tariff?.description, locale)

  const paidSurface =
    resolved === "dark"
      ? { border: "#065F46", bg: "#052e22", title: "#ECFDF5", muted: "#A7F3D0", exp: "#6EE7B7" }
      : { border: "#A7F3D0", bg: "#ECFDF5", title: "#064E3B", muted: "#065F46", exp: "#047857" }

  return (
    <Card
      style={{
        marginBottom: 16,
        borderColor: hasPaid ? paidSurface.border : colors.border,
        backgroundColor: hasPaid ? paidSurface.bg : colors.card,
      }}
    >
      <View style={styles.tariffInner}>
        <View style={styles.tariffLeft}>
          <View
            style={[
              styles.tariffIcon,
              { backgroundColor: hasPaid ? "#059669" : colors.foreground },
            ]}
          >
            <MaterialCommunityIcons
              name={hasPaid ? "crown" : "star-four-points-small"}
              size={22}
              color="#fff"
            />
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
              <Text
                style={[
                  styles.tariffTitle,
                  { color: hasPaid ? paidSurface.title : colors.foreground },
                ]}
              >
                {t("billTariffCurrentPrefix", ui)} {title}
              </Text>
              {tariff?.isActive === false ? (
                <Badge variant="outline">
                  <Text style={{ fontSize: 11 }}>{t("billInactive", ui)}</Text>
                </Badge>
              ) : null}
            </View>
            {description ? (
              <Text
                style={[
                  styles.tariffDesc,
                  { color: hasPaid ? paidSurface.muted : colors.mutedForeground },
                ]}
              >
                {description}
              </Text>
            ) : null}
            {tariff?.expiresAt ? (
              <Text
                style={[
                  styles.tariffExp,
                  { color: hasPaid ? paidSurface.exp : colors.mutedForeground },
                ]}
              >
                {t("billExpires", ui)} {formatTariffDate(tariff.expiresAt, ui)}
              </Text>
            ) : null}
          </View>
        </View>

        <View style={[styles.metricsGrid, !hasPaid && styles.metricsGridTwo]}>
          <TariffMetric label={t("billMetricDailyLeft", ui)} value={formatDailyRemaining(entAccess, ui)} colors={colors} />
          {!hasPaid ? (
            <TariffMetric label={t("billMetricTrial", ui)} value={formatFreeTrialRemaining(trial)} colors={colors} />
          ) : null}
        </View>
      </View>
    </Card>
  )
}

function TariffMetric({
  label,
  value,
  colors,
}: {
  label: string
  value: string
  colors: ThemeColors
}) {
  return (
    <View style={[styles.metricBox, { borderColor: colors.border, backgroundColor: colors.secondary }]}>
      <Text style={[styles.metricLabel, { color: colors.mutedForeground }]}>{label}</Text>
      <Text style={[styles.metricValue, { color: colors.foreground }]}>{value}</Text>
    </View>
  )
}

function formatDailyRemaining(item: AccessByExamItem | undefined, ui: UiLocale): string {
  if (!item) return "—"
  if (item.daily.isUnlimited) return t("billUnlimited", ui)
  if (item.daily.limit == null) return "—"
  return `${item.daily.remaining ?? 0}/${item.daily.limit}`
}

function formatFreeTrialRemaining(trial: TrialStatusItem | undefined): string {
  if (!trial) return "—"
  const remaining = trial.freeRemaining ?? trial.remaining ?? 0
  const limit = trial.freeLimit ?? trial.limit ?? 0
  return `${remaining}/${limit}`
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120 },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "flex-start",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
    marginBottom: 10,
  },
  pillText: { fontSize: 11, fontWeight: "600" },
  h1: { fontSize: 28, fontFamily: fonts.sansSemi, letterSpacing: -0.5 },
  lead: { fontSize: 15, lineHeight: 22, marginBottom: 16 },
  skelGrid: { flexDirection: "row", flexWrap: "wrap" },
  skelCard: {
    flexGrow: 1,
    minWidth: "45%",
    height: 280,
    borderRadius: 14,
    opacity: 0.7,
  },
  emptyPlans: { textAlign: "center", paddingVertical: 28, fontSize: 15 },
  pendingCard: {
    marginBottom: 12,
  },
  pendingTitle: {
    fontSize: 16,
    fontFamily: fonts.sansSemi,
  },
  pendingDesc: {
    marginTop: 4,
    fontSize: 13,
    lineHeight: 18,
  },
  pendingItem: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 10,
  },
  pendingItemTitle: {
    fontSize: 14,
    fontFamily: fonts.sansSemi,
  },
  planGrid: { gap: 12 },
  planGridTwo: { flexDirection: "row", flexWrap: "wrap" },
  planCard: {
    flexGrow: 1,
    minWidth: "46%",
    padding: 18,
    position: "relative",
  },
  badgeTopRight: { position: "absolute", right: 12, top: 12, zIndex: 2 },
  badgeTopLeft: { position: "absolute", left: 12, top: 12, zIndex: 2 },
  miniPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  planCode: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
    letterSpacing: 0.6,
    marginBottom: 4,
  },
  planName: { fontSize: 19, fontFamily: fonts.sansSemi },
  planDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  priceBig: { fontSize: 28, fontFamily: fonts.sansSemi, fontVariant: ["tabular-nums"] },
  oldPrice: {
    fontSize: 13,
    textDecorationLine: "line-through",
    fontVariant: ["tabular-nums"],
  },
  duration: { fontSize: 11, marginTop: 6 },
  featureRow: { flexDirection: "row", alignItems: "flex-start", gap: 8 },
  featureText: { flex: 1, fontSize: 13, lineHeight: 18 },
  footerRow: { flexDirection: "row", gap: 12, alignItems: "center", paddingVertical: 4 },
  footerCard: { gap: 12 },
  footerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: { flex: 1, fontSize: 13, lineHeight: 18 },
  footerChips: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  brandChip: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  brandChipText: {
    fontSize: 12,
    fontFamily: fonts.sansSemi,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.45)",
    padding: 20,
    justifyContent: "center",
  },
  modalCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 14,
    padding: 16,
    gap: 12,
  },
  modalTitle: { fontSize: 18, fontFamily: fonts.sansSemi },
  modalLead: { fontSize: 13, lineHeight: 18 },
  modalSummary: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  modalSummaryRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  modalLabel: { fontSize: 12 },
  methodGrid: { gap: 8 },
  methodCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 12,
    padding: 12,
    gap: 4,
  },
  methodTitle: { fontSize: 14, fontFamily: fonts.sansSemi },
  methodDesc: { fontSize: 12, lineHeight: 17 },
  modalInput: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 16,
  },
  modalError: {
    color: "#dc2626",
    fontSize: 12,
    lineHeight: 17,
  },
  noteCard: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 12,
    gap: 4,
  },
  noteTitle: { fontSize: 13, fontFamily: fonts.sansSemi },
  noteDesc: { fontSize: 12, lineHeight: 17 },
  modalActions: {
    flexDirection: "row",
    gap: 8,
  },
  tariffInner: { gap: 16 },
  tariffLeft: { flexDirection: "row", gap: 12, alignItems: "flex-start" },
  tariffIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  tariffTitle: { fontSize: 16, fontFamily: fonts.sansSemi },
  tariffDesc: { fontSize: 13, marginTop: 4, lineHeight: 18 },
  tariffExp: { fontSize: 11, marginTop: 6 },
  metricsGrid: { gap: 8 },
  metricsGridTwo: { flexDirection: "row", flexWrap: "wrap" },
  metricBox: {
    flex: 1,
    minWidth: 120,
    borderRadius: 8,
    borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  metricLabel: { fontSize: 10, fontWeight: "700", letterSpacing: 0.4, textTransform: "uppercase" },
  metricValue: { marginTop: 4, fontFamily: fonts.sansSemi, fontVariant: ["tabular-nums"] },
})
