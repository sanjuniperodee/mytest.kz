import { useEffect, useRef, useState } from "react"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router, useLocalSearchParams } from "expo-router"
import useSWR, { useSWRConfig } from "swr"
import {
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/api/auth-context"
import { api, ApiError } from "@/lib/api/client"
import {
  formatKaspiDateTime,
  formatTimeLeft,
  paymentStatusKind,
  type KaspiOrder,
} from "@/lib/billing/kaspi"
import { mayAccessKaspiCommerce } from "@/lib/billing-region"
import { t, useUiLocale } from "@/lib/i18n/ui"
import { useLocation } from "@/lib/location"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

type PaymentOrder = KaspiOrder

function statusMeta(status: string) {
  const kind = paymentStatusKind(status)
  if (kind === "paid") {
    return {
      kind,
      titleRu: "Оплата прошла",
      titleKk: "Төлем сәтті өтті",
      descRu: "Подписка активирована. Можно возвращаться к пробникам.",
      descKk: "Жазылым белсендірілді. Сынақтарға қайта оралуға болады.",
      icon: "check-circle-outline" as const,
      color: "#047857",
      bg: "#ecfdf5",
      border: "#a7f3d0",
      badgeRu: "Оплачено",
      badgeKk: "Төленді",
    }
  }
  if (kind === "inactive") {
    return {
      kind,
      titleRu: "Счёт неактивен",
      titleKk: "Шот белсенді емес",
      descRu: "Этот счёт уже не активен. Выставьте новый на странице тарифов.",
      descKk: "Бұл шот енді белсенді емес. Тарифтер бетінен жаңасын құрыңыз.",
      icon: "close-circle-outline" as const,
      color: "#b91c1c",
      bg: "#fef2f2",
      border: "#fecaca",
      badgeRu: "Отменен",
      badgeKk: "Болдырылмады",
    }
  }
  return {
    kind,
    titleRu: "Ожидаем оплату",
    titleKk: "Төлем күтілуде",
    descRu: "Откройте счёт в Kaspi и подтвердите оплату. Статус обновляется автоматически.",
    descKk: "Kaspi-де шотты ашып, төлемді растаңыз. Күйі автоматты жаңарады.",
    icon: "clock-outline" as const,
    color: "#b45309",
    bg: "#fffbeb",
    border: "#fcd34d",
    badgeRu: "Ожидает",
    badgeKk: "Күтілуде",
  }
}

export default function KaspiInvoiceScreen() {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { isInKZ } = useLocation()
  const { refresh } = useAuth()
  const { mutate: mutateGlobal } = useSWRConfig()
  const refreshedAfterPaid = useRef(false)
  const params = useLocalSearchParams<{ invoiceId?: string | string[] }>()
  const raw = params.invoiceId
  const invoiceId = Array.isArray(raw) ? raw[0] : raw
  const [nowMs, setNowMs] = useState(() => Date.now())
  const [cancelling, setCancelling] = useState(false)

  const { data: order, error, isLoading, mutate, isValidating } = useSWR<PaymentOrder>(
    invoiceId ? `/billing/orders/${encodeURIComponent(invoiceId)}` : null,
    (url: string) => api(url),
    {
      refreshInterval: (current) => (paymentStatusKind(current?.status) === "pending" ? 5000 : 0),
      keepPreviousData: true,
    },
  )

  useEffect(() => {
    if (order?.status === "paid" && !refreshedAfterPaid.current) {
      refreshedAfterPaid.current = true
      void refresh().then(() => {
        void mutateGlobal("/billing/kaspi/orders/active")
      })
    }
  }, [mutateGlobal, order?.status, refresh])

  useEffect(() => {
    if (!order?.expiresAt || paymentStatusKind(order.status) !== "pending") return
    const timer = setInterval(() => setNowMs((prev) => prev + 1000), 1000)
    return () => clearInterval(timer)
  }, [order?.expiresAt, order?.status])

  useEffect(() => {
    if (isInKZ !== null && !mayAccessKaspiCommerce(isInKZ)) {
      router.replace("/dashboard")
    }
  }, [isInKZ])

  const onCancelOrder = () => {
    if (!invoiceId) return
    Alert.alert(
      ui === "kk" ? "Шотты болдырмау" : "Отмена счёта",
      ui === "kk" ? "Осы шотты болдырғыңыз келе ме?" : "Отменить этот счёт Kaspi?",
      [
        { text: ui === "kk" ? "Жоқ" : "Нет", style: "cancel" },
        {
          text: ui === "kk" ? "Иә, болдырмау" : "Да, отменить",
          style: "destructive",
          onPress: async () => {
            setCancelling(true)
            try {
              const updated = await api<PaymentOrder>(`/billing/kaspi/orders/${encodeURIComponent(invoiceId)}/cancel`, {
                method: "POST",
              })
              await mutate(updated, false)
              await mutateGlobal("/billing/kaspi/orders/active")
            } catch (err) {
              Alert.alert(
                ui === "kk" ? "Қате" : "Ошибка",
                err instanceof ApiError ? err.message : ui === "kk" ? "Шотты болдырмау мүмкін болмады" : "Не удалось отменить счёт",
              )
            } finally {
              setCancelling(false)
            }
          },
        },
      ],
    )
  }

  if (!mayAccessKaspiCommerce(isInKZ)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.secondary }]}>
        <Spinner size="large" />
      </View>
    )
  }

  if (!invoiceId) {
    return (
      <View style={[styles.center, { backgroundColor: colors.secondary }]}> 
        <Card>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}> 
            {ui === "kk" ? "Шот табылмады" : "Счёт не найден"}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}> 
            {ui === "kk"
              ? "Тарифтер бетіне оралып, белсенді шотты ашып көріңіз."
              : "Вернитесь к тарифам и откройте активный счёт."}
          </Text>
          <View style={{ marginTop: 10 }}>
            <Button onPress={() => router.replace("/dashboard/billing")}> 
              {ui === "kk" ? "Тарифтерге оралу" : "Открыть тарифы"}
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  if (isLoading && !order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.secondary }]}> 
        <Spinner size="large" />
      </View>
    )
  }

  if (!order) {
    return (
      <View style={[styles.center, { backgroundColor: colors.secondary }]}> 
        <Card>
          <Text style={[styles.cardTitle, { color: colors.foreground }]}> 
            {ui === "kk" ? "Күй уақытша қолжетімсіз" : "Статус пока недоступен"}
          </Text>
          <Text style={[styles.cardDesc, { color: colors.mutedForeground }]}> 
            {error instanceof ApiError && error.status === 404
              ? (ui === "kk" ? "Шот табылмады." : "Мы не нашли этот счёт.")
              : (ui === "kk" ? "Біраздан соң қайта тексеріңіз." : "Проверьте ещё раз через несколько секунд.")}
          </Text>
          <View style={{ gap: 8, marginTop: 12 }}>
            <Button variant="outline" onPress={() => void mutate()}>
              {ui === "kk" ? "Қайта тексеру" : "Проверить еще раз"}
            </Button>
            <Button onPress={() => router.replace("/dashboard/billing")}> 
              {ui === "kk" ? "Тарифтерге оралу" : "Открыть тарифы"}
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  const meta = statusMeta(order.status)
  const payUrl = order.checkoutUrl || order.qrToken || order.receiptUrl
  const statusKind = paymentStatusKind(order.status)
  const canCancel = statusKind === "pending" && order.paymentType !== "qr"
  const expiresIn = formatTimeLeft(order.expiresAt, nowMs)
  const isQrPayment = order.paymentType === "qr"

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: colors.secondary }]}> 
      <Pressable onPress={() => router.replace("/dashboard/billing")}>
        <Text style={[styles.back, { color: colors.accent }]}> 
          {ui === "kk" ? "← Тарифтер" : "← Тарифы"}
        </Text>
      </Pressable>

      <Card style={{ borderColor: meta.border, backgroundColor: meta.bg }}>
        <View style={styles.statusHead}>
          <View style={[styles.statusIcon, { backgroundColor: "#fff" }]}> 
            <MaterialCommunityIcons name={meta.icon} size={22} color={meta.color} />
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <Text style={[styles.statusTitle, { color: meta.color }]}> 
              {ui === "kk" ? meta.titleKk : meta.titleRu}
            </Text>
            <Text style={[styles.statusDesc, { color: meta.color }]}> 
              {ui === "kk" ? meta.descKk : meta.descRu}
            </Text>
          </View>
        </View>

        <View style={[styles.badge, { borderColor: meta.border }]}> 
          <Text style={{ color: meta.color, fontSize: 12, fontWeight: "700" }}>
            {ui === "kk" ? meta.badgeKk : meta.badgeRu}
          </Text>
        </View>

        <View style={[styles.info, { borderColor: `${meta.color}33`, backgroundColor: "#ffffffdd" }]}> 
          <InfoRow label={ui === "kk" ? "Тариф" : "Тариф"} value={order.planName} />
          <InfoRow
            label={ui === "kk" ? "Сома" : "Сумма"}
            value={`${order.amount.toLocaleString("ru-RU")} ${order.currency}`}
          />
          <InfoRow label={ui === "kk" ? "Шот" : "Счёт"} value={order.orderNumber || order.invoiceId} mono />
          <InfoRow label={ui === "kk" ? "Құрылды" : "Создан"} value={formatKaspiDateTime(order.createdAt)} />
          {order.expiresAt ? (
            <InfoRow label={ui === "kk" ? "Жарамды" : "Действует до"} value={formatKaspiDateTime(order.expiresAt)} />
          ) : null}
          {order.expiresAt && statusKind === "pending" && expiresIn ? (
            <InfoRow label={ui === "kk" ? "Қалған уақыт" : "Осталось времени"} value={expiresIn} />
          ) : null}
          {order.statusDesc ? <InfoRow label="Kaspi" value={order.statusDesc} /> : null}
          {order.paidAt ? <InfoRow label={ui === "kk" ? "Төленген" : "Оплачен"} value={formatKaspiDateTime(order.paidAt)} /> : null}
        </View>

        {isQrPayment && payUrl ? (
          <View style={[styles.qrHint, { borderColor: `${meta.color}33` }]}> 
            <Text style={{ color: meta.color, fontSize: 13, lineHeight: 18 }}>
              {ui === "kk"
                ? "Kaspi QR қолданылады. Төлем сілтемесін ашып, Kaspi ішінде төлемді растаңыз."
                : "Для этого счёта используется Kaspi QR. Откройте ссылку и подтвердите оплату в Kaspi."}
            </Text>
          </View>
        ) : null}

        <View style={{ gap: 8, marginTop: 14 }}>
          {payUrl && statusKind === "pending" ? (
            <Button onPress={() => void Linking.openURL(payUrl)}>
              {isQrPayment
                ? (ui === "kk" ? "Kaspi QR ашу" : "Открыть Kaspi QR")
                : (ui === "kk" ? "Kaspi шотын ашу" : "Открыть счёт Kaspi")}
            </Button>
          ) : null}

          {statusKind === "paid" ? (
            <Button onPress={() => router.replace("/dashboard")}> 
              {ui === "kk" ? "Кабинетке өту" : "Перейти в кабинет"}
            </Button>
          ) : (
            <Button variant="outline" disabled={isValidating} onPress={() => void mutate()}>
              {isValidating
                ? (ui === "kk" ? "Тексерілуде..." : "Проверяем...")
                : (ui === "kk" ? "Төлемді тексеру" : "Проверить оплату")}
            </Button>
          )}

          {canCancel ? (
            <Button variant="outline" disabled={cancelling || isValidating} onPress={onCancelOrder}>
              {cancelling
                ? (ui === "kk" ? "Болдырылуда..." : "Отмена...")
                : (ui === "kk" ? "Шотты болдырмау" : "Отменить счёт")}
            </Button>
          ) : null}
        </View>
      </Card>
    </ScrollView>
  )
}

function InfoRow({
  label,
  value,
  mono,
}: {
  label: string
  value: string
  mono?: boolean
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={[styles.infoValue, mono ? styles.infoMono : null]}>{value}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 120, gap: 10 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
  },
  back: {
    fontSize: 14,
    fontFamily: fonts.sansSemi,
  },
  cardTitle: {
    fontSize: 18,
    fontFamily: fonts.sansSemi,
  },
  cardDesc: {
    marginTop: 6,
    fontSize: 14,
    lineHeight: 20,
  },
  statusHead: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  statusIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTitle: {
    fontSize: 20,
    fontFamily: fonts.sansSemi,
  },
  statusDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  badge: {
    marginTop: 12,
    alignSelf: "flex-start",
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  info: {
    marginTop: 12,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    gap: 7,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  infoLabel: {
    color: "#6b7280",
    fontSize: 12,
  },
  infoValue: {
    color: "#111827",
    fontSize: 13,
    fontFamily: fonts.sansSemi,
    flex: 1,
    textAlign: "right",
  },
  infoMono: {
    fontFamily: "Courier",
    fontSize: 12,
  },
  qrHint: {
    marginTop: 10,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    padding: 10,
    backgroundColor: "#ffffffd0",
  },
})
