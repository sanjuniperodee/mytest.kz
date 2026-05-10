import { Redirect } from "expo-router"
import { SafeAreaView } from "react-native-safe-area-context"
import { Spinner } from "@/components/ui/spinner"
import { useAuth } from "@/lib/api/auth-context"
import { useAppTheme } from "@/lib/theme/provider"

export default function Index() {
  const { isLoading, isAuthenticated } = useAuth()
  const { colors } = useAppTheme()

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={["top"]}>
        <Spinner fullScreen size="large" />
      </SafeAreaView>
    )
  }

  if (isAuthenticated) return <Redirect href="/dashboard" />
  return <Redirect href="/landing" />
}
