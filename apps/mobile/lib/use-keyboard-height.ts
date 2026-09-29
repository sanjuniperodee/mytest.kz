import { useEffect, useState } from "react"
import { Keyboard, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"

/**
 * Height of the on-screen keyboard on Android. With edge-to-edge windows Android no longer
 * resizes the screen for the keyboard, so screens with inputs at the bottom add this as
 * padding. iOS returns 0: KeyboardAvoidingView handles it there.
 */
export function useAndroidKeyboardHeight(): number {
  const [height, setHeight] = useState(0)
  // The reported height excludes the navigation-bar inset the keyboard also covers.
  const { bottom } = useSafeAreaInsets()
  useEffect(() => {
    if (Platform.OS !== "android") return
    const show = Keyboard.addListener("keyboardDidShow", (e) => setHeight(e.endCoordinates.height))
    const hide = Keyboard.addListener("keyboardDidHide", () => setHeight(0))
    return () => {
      show.remove()
      hide.remove()
    }
  }, [])
  return height > 0 ? height + bottom : 0
}
