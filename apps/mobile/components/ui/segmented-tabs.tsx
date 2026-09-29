import { Pressable, StyleSheet, Text, View } from "react-native"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

/** In-page view switcher (feed filters, profile activity). */
export function SegmentedTabs<T extends string>({
  value,
  onChange,
  items,
}: {
  value: T
  onChange: (value: T) => void
  items: { value: T; label: string }[]
}) {
  const { colors } = useAppTheme()
  return (
    <View
      accessibilityRole="tablist"
      style={[styles.wrap, { backgroundColor: colors.card, borderColor: colors.border }]}
    >
      {items.map((item) => {
        const active = item.value === value
        return (
          <Pressable
            key={item.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(item.value)}
            style={[styles.tab, active && { backgroundColor: colors.foreground }]}
          >
            <Text
              numberOfLines={1}
              adjustsFontSizeToFit
              minimumFontScale={0.8}
              style={[styles.label, { color: active ? colors.background : colors.mutedForeground }]}
            >
              {item.label}
            </Text>
          </Pressable>
        )
      })}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { flexDirection: "row", gap: 4, padding: 4, borderRadius: 10, borderWidth: StyleSheet.hairlineWidth },
  tab: { flex: 1, minHeight: 40, borderRadius: 7, alignItems: "center", justifyContent: "center", paddingHorizontal: 8 },
  label: { fontSize: 13, fontFamily: fonts.sansSemi },
})
