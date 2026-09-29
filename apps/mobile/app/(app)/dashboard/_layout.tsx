import { Stack, usePathname } from "expo-router"
import { StyleSheet, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { MobileHeader } from "@/components/dashboard/MobileHeader"
import { DashboardBottomNavigation, TAB_BAR_HEIGHT } from "@/components/dashboard/DashboardBottomNavigation"
import { isImmersiveRoute } from "@/components/dashboard/nav-config"
import { WhatsAppFab } from "@/components/common/WhatsAppFab"
import { useAppTheme } from "@/lib/theme/provider"

export default function DashboardLayout() {
  const { colors } = useAppTheme()
  const pathname = usePathname()
  const insets = useSafeAreaInsets()
  const immersive = isImmersiveRoute(pathname)
  return (
    <View style={[styles.root, { backgroundColor: colors.secondary }]}>
      <MobileHeader />
      <View style={styles.contentShell}>
        <View style={styles.contentWrap}>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.secondary },
            }}
          />
        </View>
      </View>
      {immersive ? null : (
        <>
          <DashboardBottomNavigation />
          <WhatsAppFab bottomOffset={TAB_BAR_HEIGHT + Math.max(7, insets.bottom) + 12} />
        </>
      )}
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  contentShell: {
    flex: 1,
    alignItems: "center",
  },
  contentWrap: {
    flex: 1,
    width: "100%",
    maxWidth: 1200,
  },
})
