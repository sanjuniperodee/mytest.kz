import type { ReactNode } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useAppTheme } from "@/lib/theme/provider"

type Variant = "primary" | "outline" | "ghost"

export function Button({
  children,
  onPress,
  disabled,
  variant = "primary",
}: {
  children: ReactNode
  onPress?: () => void
  disabled?: boolean
  variant?: Variant
}) {
  const { colors } = useAppTheme()
  const bg =
    variant === "primary"
      ? colors.foreground
      : variant === "outline"
        ? colors.card
        : "transparent"
  const fg =
    variant === "primary" ? colors.background : variant === "outline" ? colors.foreground : colors.foreground
  const border =
    variant === "outline" ? colors.border : variant === "ghost" ? "transparent" : colors.foreground

  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={disabled}
      style={({ pressed }) => [
        styles.btn,
        {
          backgroundColor: bg,
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
      ]}
    >
      <Text style={[styles.label, { color: fg }]}>{children}</Text>
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
  label: {
    fontSize: 15,
    fontWeight: "600",
  },
})
