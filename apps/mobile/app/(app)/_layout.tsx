import { Stack } from "expo-router"
import { Redirect, router, usePathname } from "expo-router"
import { useEffect } from "react"
import { SafeAreaView } from "react-native-safe-area-context"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/api/auth-context"
import { useAppTheme } from "@/lib/theme/provider"

const CHANNEL_GATE = "/dashboard/channel-gate"

export default function AppLayout() {
  const { isLoading, isAuthenticated, user } = useAuth()
  const pathname = usePathname()
  const { colors } = useAppTheme()

  useEffect(() => {
    if (isLoading || !isAuthenticated || !user) return
    if (user.telegramId && user.isChannelMember === false && pathname !== CHANNEL_GATE) {
      router.replace(CHANNEL_GATE)
    }
  }, [isLoading, isAuthenticated, user, pathname])

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Spinner fullScreen size="large" />
      </SafeAreaView>
    )
  }

  if (!isAuthenticated) return <Redirect href="/login" />

  if (
    user?.telegramId &&
    user.isChannelMember === false &&
    pathname !== CHANNEL_GATE
  ) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Spinner fullScreen size="large" />
      </SafeAreaView>
    )
  }

  return <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.secondary } }} />
}
