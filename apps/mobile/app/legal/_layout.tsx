import { Stack } from "expo-router"
import { useAppTheme } from "@/lib/theme/provider"

export default function LegalLayout() {
  const { colors } = useAppTheme()

  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.foreground,
        headerTitleStyle: { color: colors.foreground },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  )
}
