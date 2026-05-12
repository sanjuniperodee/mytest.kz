import { useEffect } from "react"
import { ActivityIndicator, StyleSheet, View } from "react-native"
import { router } from "expo-router"
import { BillingView } from "@/components/dashboard/billing/BillingView"
import { mayAccessKaspiCommerce } from "@/lib/billing-region"
import { useLocation } from "@/lib/location"
import { useAppTheme } from "@/lib/theme/provider"

export default function BillingScreen() {
  const { isInKZ } = useLocation()
  const { colors } = useAppTheme()

  useEffect(() => {
    if (isInKZ !== null && !mayAccessKaspiCommerce(isInKZ)) {
      router.replace("/dashboard")
    }
  }, [isInKZ])

  if (!mayAccessKaspiCommerce(isInKZ)) {
    return (
      <View style={[styles.center, { backgroundColor: colors.secondary }]}>
        <ActivityIndicator size="large" color={colors.foreground} />
      </View>
    )
  }

  return <BillingView />
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
})
