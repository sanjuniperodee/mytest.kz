import type { ReactNode } from "react"
import type { StyleProp, ViewStyle } from "react-native"
import { StyleSheet, View } from "react-native"
import { useAppTheme } from "@/lib/theme/provider"

export function Card({
  children,
  padded = true,
  style,
}: {
  children: ReactNode
  padded?: boolean
  style?: StyleProp<ViewStyle>
}) {
  const { colors } = useAppTheme()
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.card, borderColor: colors.border },
        padded && styles.pad,
        style,
      ]}
    >
      {children}
    </View>
  )
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
  },
  pad: {
    padding: 16,
  },
})
