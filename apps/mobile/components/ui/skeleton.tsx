import type { DimensionValue, StyleProp, ViewStyle } from "react-native"
import { View } from "react-native"
import { useAppTheme } from "@/lib/theme/provider"

export function Skeleton({
  height = 16,
  width = "100%",
  radius = 8,
  style,
}: {
  height?: number
  width?: DimensionValue
  radius?: number
  style?: StyleProp<ViewStyle>
}) {
  const { colors } = useAppTheme()
  return <View style={[{ height, width, borderRadius: radius, backgroundColor: colors.secondary }, style]} />
}
