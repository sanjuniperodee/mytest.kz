import { MaterialCommunityIcons } from "@expo/vector-icons"
import useSWR from "swr"
import { Linking, Platform, ScrollView, StyleSheet, Text, View } from "react-native"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import type { AccessByExamItem, BillingPlan, CurrentTariff, TrialStatusItem } from "@/lib/api/types"
import {
  buildWhatsAppPaymentUrl,
  normalizeBillingPlan,
  type NormalizedPlan,
} from "@/lib/billing/whatsapp"
import { useAppTheme } from "@/lib/theme/provider"
import type { ThemeColors } from "@/lib/theme/colors"
import { fonts } from "@/lib/theme/fonts"
import { t, useUiLocale, type UiLocale } from "@/lib/i18n/ui"

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

export function BillingView() {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const { data, isLoading } = useSWR<BillingPlan[] | { items: BillingPlan[] }>("/billing/plans")

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

  const pay = (plan: NormalizedPlan) => {
    const url = buildWhatsAppPaymentUrl(plan, user, locale)
    void Linking.openURL(url)
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
              highlighted={idx === highlightedIdx}
              current={
                currentTariff?.isActive === true && currentTariff.code === plan.code
              }
              onCheckout={() => pay(plan)}
              colors={colors}
            />
          ))}
        </View>
      )}

      <Card style={{ marginTop: 8 }}>
        <View style={styles.footerRow}>
          <View style={[styles.footerIcon, { backgroundColor: colors.secondary }]}>
            <MaterialCommunityIcons name="shield-check" size={20} color={colors.foreground} />
          </View>
          <Text style={[styles.footerText, { color: colors.mutedForeground }]}>
            {t("billFooter", ui)}
          </Text>
        </View>
      </Card>
    </ScrollView>
  )
}

function PlanCard({
  plan,
  highlighted,
  current,
  onCheckout,
  colors,
  ui,
}: {
  plan: NormalizedPlan
  highlighted?: boolean
  current?: boolean
  onCheckout: () => void
  colors: ThemeColors
  ui: UiLocale
}) {
  const features =
    plan.features.length > 0
      ? plan.features
      : [
          t("billFeat1", ui),
          t("billFeat2", ui),
          t("billFeat3", ui),
          t("billFeat4", ui),
        ]

  const oldPriceLabel = formatOldPrice(plan, ui)
  const discountPct =
    plan.price != null && plan.oldPrice != null && plan.oldPrice > plan.price
      ? Math.round(((plan.oldPrice - plan.price) / plan.oldPrice) * 100)
      : null

  return (
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
        <Button variant={highlighted ? "primary" : "outline"} disabled={current} onPress={onCheckout}>
          {current ? t("billCurrentTariff", ui) : t("billCheckout", ui)}
        </Button>
      </View>
    </Card>
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
  footerIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  footerText: { flex: 1, fontSize: 13, lineHeight: 18 },
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
