import { Stack } from "expo-router"
import { StyleSheet, View } from "react-native"
import { MobileHeader } from "@/components/dashboard/MobileHeader"
import { WhatsAppFab } from "@/components/common/WhatsAppFab"
import { useAppTheme } from "@/lib/theme/provider"

export default function DashboardLayout() {
  const { colors } = useAppTheme()
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
      <WhatsAppFab />
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
