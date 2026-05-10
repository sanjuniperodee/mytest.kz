import { Platform, StatusBar } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

/** Padding below status bar / notch; Android edge-to-edge fallback when insets are 0. */
export function useTopInset(): number {
  const { top } = useSafeAreaInsets()
  if (Platform.OS === "android") {
    return Math.max(top, StatusBar.currentHeight ?? 0)
  }
  return top
}
