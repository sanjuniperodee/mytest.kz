import { ActivityIndicator, StyleSheet, View } from "react-native"
import { useAppTheme } from "@/lib/theme/provider"

export function Spinner({
  size = "small",
  fullScreen,
}: {
  size?: "small" | "large"
  fullScreen?: boolean
}) {
  const { colors } = useAppTheme()
  return (
    <View style={[styles.wrap, fullScreen && styles.full]}>
      <ActivityIndicator
        size={size === "large" ? "large" : "small"}
        color={colors.foreground}
      />
    </View>
  )
}

const styles = StyleSheet.create({
  wrap: {
    padding: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  full: {
    flex: 1,
  },
})
