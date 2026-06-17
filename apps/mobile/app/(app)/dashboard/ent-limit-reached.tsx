import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useEffect } from "react"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { router, useLocalSearchParams } from "expo-router"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/api/auth-context"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"
import { t, useUiLocale } from "@/lib/i18n/ui"

export default function EntLimitReachedScreen() {
  const { colors } = useAppTheme()
  const { locale: ui } = useUiLocale()
  const { user } = useAuth()
  const params = useLocalSearchParams<{ kind?: string | string[] }>()
  const rawKind = params.kind
  const kind = Array.isArray(rawKind) ? rawKind[0] : rawKind
  const isDaily = kind === "daily" || kind === "daily_limit"

  useEffect(() => {
    if (!user) return
    router.replace(isDaily ? "/dashboard/billing?reason=daily_limit" : "/dashboard/billing?reason=limit_exhausted")
  }, [user, isDaily])

  const title = isDaily ? t("entLimitTitleDaily", ui) : t("entLimitTitleTotal", ui)
  const body = isDaily ? t("entLimitBodyDaily", ui) : t("entLimitBodyTotal", ui)

  return (
    <ScrollView contentContainerStyle={[styles.pad, { backgroundColor: colors.secondary }]}>
      <Pressable onPress={() => router.back()} style={styles.backRow} accessibilityRole="button">
        <MaterialCommunityIcons name="arrow-left" size={16} color={colors.mutedForeground} />
        <Text style={[styles.backText, { color: colors.mutedForeground }]}>{t("examBackToCatalog", ui)}</Text>
      </Pressable>

      <Card style={[styles.card, { borderColor: colors.border, backgroundColor: colors.card }]}>
        <View style={[styles.iconWrap, { backgroundColor: `${colors.foreground}12` }]}>
          <MaterialCommunityIcons name="calendar-clock-outline" size={28} color={colors.foreground} />
        </View>
        <Text style={[styles.title, { color: colors.foreground }]}>{title}</Text>
        <Text style={[styles.body, { color: colors.mutedForeground }]}>{body}</Text>
        <Button onPress={() => router.replace("/dashboard/exams" as never)}>{t("entLimitCtaExams", ui)}</Button>
      </Card>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 32, flexGrow: 1 },
  backRow: { flexDirection: "row", alignItems: "center", gap: 6, marginBottom: 16 },
  backText: { fontSize: 14, fontFamily: fonts.sans },
  card: { padding: 20, borderRadius: 16, borderWidth: 1, gap: 12 },
  iconWrap: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "flex-start",
  },
  title: { fontSize: 20, fontFamily: fonts.sansSemi, lineHeight: 26 },
  body: { fontSize: 15, lineHeight: 22, fontFamily: fonts.sans },
})
