import { StyleSheet, Text, View } from "react-native"
import { t, useUiLocale } from "@/lib/i18n/ui"
import { fonts } from "@/lib/theme/fonts"
import { accentPalette } from "@/lib/theme/accents"
import { useAppTheme } from "@/lib/theme/provider"

export function SessionStatusBadge({ status }: { status: string }) {
  const { colors, resolved } = useAppTheme()
  const { locale } = useUiLocale()
  const accents = accentPalette(resolved)
  const tone =
    status === "completed"
      ? accents.emerald
      : status === "in_progress"
        ? accents.blue
        : status === "timed_out"
          ? accents.amber
          : { bg: colors.secondary, fg: colors.mutedForeground }
  const label =
    status === "completed"
      ? t("sessionCompleted", locale)
      : status === "in_progress"
        ? t("sessionInProgress", locale)
        : status === "timed_out"
          ? t("sessionTimedOut", locale)
          : t("sessionAbandoned", locale)
  return (
    <View style={[styles.wrap, { backgroundColor: tone.bg }]}>
      <Text style={[styles.text, { color: tone.fg }]}>{label}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { alignSelf: "flex-start", paddingHorizontal: 8, paddingVertical: 3, borderRadius: 999 },
  text: { fontSize: 11, fontFamily: fonts.sansSemi },
})
