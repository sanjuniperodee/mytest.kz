import type { ReactNode } from "react"
import { RefreshControl, ScrollView, StyleSheet } from "react-native"

/** Standard scrolling page body used by every dashboard screen. */
export function Screen({
  children,
  onRefresh,
  refreshing,
  gap = 20,
}: {
  children: ReactNode
  onRefresh?: () => void
  refreshing?: boolean
  gap?: number
}) {
  return (
    <ScrollView
      contentContainerStyle={[styles.pad, { gap }]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={!!refreshing} onRefresh={onRefresh} /> : undefined}
    >
      {children}
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  pad: { padding: 16, paddingBottom: 96 },
})
