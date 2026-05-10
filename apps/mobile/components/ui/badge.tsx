import type { ReactNode } from "react"
import { StyleSheet, Text, View, type StyleProp, type ViewStyle } from "react-native"
import { useAppTheme } from "@/lib/theme/provider"

type Variant = "default" | "secondary" | "outline"

function isRenderableAsText(children: ReactNode): boolean {
  if (typeof children === "string" || typeof children === "number") return true
  if (Array.isArray(children)) {
    return children.every(
      (c) =>
        c == null || typeof c === "boolean" || typeof c === "string" || typeof c === "number",
    )
  }
  return false
}

export function Badge({
  children,
  variant = "secondary",
  style,
}: {
  children: ReactNode
  variant?: Variant
  style?: StyleProp<ViewStyle>
}) {
  const { colors } = useAppTheme()
  const bg =
    variant === "default"
      ? colors.foreground
      : variant === "outline"
        ? "transparent"
        : colors.secondary
  const fg =
    variant === "default" ? colors.background : variant === "outline" ? colors.foreground : colors.foreground
  const border =
    variant === "outline" ? colors.border : variant === "secondary" ? colors.border : colors.foreground

  return (
    <View style={[styles.wrap, { backgroundColor: bg, borderColor: border }, style]}>
      {isRenderableAsText(children) ? (
        <Text style={[styles.text, { color: fg }]} numberOfLines={1}>
          {children}
        </Text>
      ) : (
        children
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    alignSelf: "flex-start",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    borderWidth: StyleSheet.hairlineWidth,
  },
  text: {
    fontSize: 12,
    fontWeight: "600",
  },
})
