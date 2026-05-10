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
      <View style={{ flex: 1 }}>
        <Stack
          screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.secondary } }}
        />
      </View>
      <WhatsAppFab />
    </View>
  )
}

const styles = StyleSheet.create({
  root: { flex: 1 },
})
