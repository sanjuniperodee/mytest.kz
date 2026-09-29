import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { Sheet } from "@/components/ui/sheet"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

export type SelectOption<T extends string> = { value: T; label: string }

/** Labelled field that opens a bottom sheet with the options. */
export function SelectSheet<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: SelectOption<T>[]
  onChange: (value: T) => void
}) {
  const { colors } = useAppTheme()
  const [open, setOpen] = useState(false)
  const current = options.find((o) => o.value === value)
  return (
    <View style={styles.wrap}>
      <Text style={[styles.label, { color: colors.mutedForeground }]}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${current?.label ?? ""}`}
        onPress={() => setOpen(true)}
        style={[styles.field, { borderColor: colors.border, backgroundColor: colors.background }]}
      >
        <Text numberOfLines={1} style={[styles.value, { color: colors.foreground }]}>
          {current?.label ?? "—"}
        </Text>
        <MaterialCommunityIcons name="chevron-down" size={20} color={colors.mutedForeground} />
      </Pressable>
      <Sheet visible={open} onClose={() => setOpen(false)} title={label}>
        <View style={styles.list}>
          {options.map((o) => {
            const active = o.value === value
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => {
                  setOpen(false)
                  onChange(o.value)
                }}
                style={[styles.row, { borderBottomColor: colors.border, backgroundColor: active ? colors.secondary : "transparent" }]}
              >
                <Text style={[styles.rowText, { color: colors.foreground }]}>{o.label}</Text>
                {active ? <MaterialCommunityIcons name="check" size={20} color={colors.foreground} /> : null}
              </Pressable>
            )
          })}
        </View>
      </Sheet>
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: { gap: 6 },
  label: { fontSize: 13, fontFamily: fonts.sansSemi },
  field: { minHeight: 46, borderWidth: StyleSheet.hairlineWidth, borderRadius: 10, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 8 },
  value: { flex: 1, fontSize: 14, fontFamily: fonts.sans },
  list: { paddingTop: 10 },
  row: { minHeight: 52, borderBottomWidth: StyleSheet.hairlineWidth, flexDirection: "row", alignItems: "center", gap: 10, paddingHorizontal: 10 },
  rowText: { flex: 1, fontSize: 15, fontFamily: fonts.sans },
})
