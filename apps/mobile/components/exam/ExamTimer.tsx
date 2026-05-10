import { StyleSheet, Text, View } from "react-native"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useAppTheme } from "@/lib/theme/provider"

export function formatHMS(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  if (h > 0) {
    return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`
  }
  return `${m}:${String(sec).padStart(2, "0")}`
}

export function ExamTimer({
  remaining,
}: {
  remaining: number | null | undefined
}) {
  const { colors } = useAppTheme()
  if (remaining == null) return null
  const secs = Number(remaining)
  if (!Number.isFinite(secs)) return null
  const isCritical = secs <= 60
  const isWarning = secs <= 300 && !isCritical

  const bg = isCritical
    ? "#FFE4E6"
    : isWarning
      ? "#FEF3C7"
      : colors.secondary
  const fg = isCritical ? "#9F1239" : isWarning ? "#92400E" : colors.foreground
  const border = isCritical ? "#FECACA" : isWarning ? "#FDE68A" : colors.border

  return (
    <View style={[styles.box, { backgroundColor: bg, borderColor: border }]}>
      <MaterialCommunityIcons name="clock-outline" size={14} color={fg} />
      <Text style={[styles.text, { color: fg }]}>{formatHMS(secs)}</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  box: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  text: {
    fontVariant: ["tabular-nums"],
    fontWeight: "600",
    fontSize: 14,
  },
})
