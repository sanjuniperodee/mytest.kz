import { MaterialCommunityIcons } from "@expo/vector-icons"
import { useEffect, useState } from "react"
import { Linking, Pressable, StyleSheet, View } from "react-native"
import { api } from "@/lib/api/client"

type LandingRuntimeSettings = { whatsappUrl?: string }

const DEFAULT_WA_DIGITS = "77775932124"

export function WhatsAppFab() {
  const [href, setHref] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    api<LandingRuntimeSettings>("/public/landing-settings")
      .then((data) => {
        if (cancelled) return
        const url = data.whatsappUrl?.trim()
        if (url) setHref(url)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [])

  const open = () => {
    const fallback = `https://wa.me/${DEFAULT_WA_DIGITS}`
    void Linking.openURL(href ?? fallback)
  }

  return (
    <Pressable
      onPress={open}
      style={[styles.fab, { backgroundColor: "#25D366" }]}
      accessibilityLabel="WhatsApp"
    >
      <View style={styles.iconWrap} pointerEvents="none">
        <MaterialCommunityIcons name="whatsapp" size={30} color="#FFFFFF" />
      </View>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  fab: {
    position: "absolute",
    right: 18,
    bottom: 28,
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: "center",
    justifyContent: "center",
    elevation: 4,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  /** Center MDI WhatsApp glyph (visual bbox is slightly top-heavy). */
  iconWrap: { marginTop: 1 },
})
