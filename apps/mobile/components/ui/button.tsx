import { Children, type ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

type Variant = "primary" | "outline" | "ghost" | "destructive"

export function Button({
  children,
  onPress,
  disabled,
  variant = "primary",
  size = "default",
  icon,
  fullWidth,
  accessibilityLabel,
}: {
  children?: ReactNode
  onPress?: () => void
  disabled?: boolean
  variant?: Variant
  size?: "default" | "sm"
  /** Rendered before the label; pass an already colored icon. */
  icon?: (color: string) => ReactNode
  fullWidth?: boolean
  accessibilityLabel?: string
}) {
  const { colors } = useAppTheme()
  const bg =
    variant === "primary"
      ? colors.foreground
      : variant === "outline"
        ? colors.card
        : variant === "destructive"
          ? colors.destructive
          : "transparent"
  const fg =
    variant === "primary"
      ? colors.background
      : variant === "destructive"
        ? colors.destructiveForeground
        : colors.foreground
  const border =
    variant === "outline"
      ? colors.border
      : variant === "ghost"
        ? "transparent"
        : variant === "destructive"
          ? colors.destructive
          : colors.foreground
  const small = size === "sm"

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled: !!disabled }}
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        small && styles.small,
        fullWidth && styles.full,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <View style={styles.row}>
        {icon ? icon(fg) : null}
        {Children.map(children, (child) =>
          typeof child === "string" || typeof child === "number" ? (
            <Text style={[styles.label, small && styles.labelSmall, { color: fg }]}>{child}</Text>
          ) : (
            child
          ),
        )}
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  btn: {
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 44,
  },
  small: { minHeight: 40, paddingVertical: 8, paddingHorizontal: 12 },
  full: { alignSelf: "stretch" },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8 },
  label: { fontSize: 15, fontFamily: fonts.sansSemi },
  labelSmall: { fontSize: 13 },
})
