import type { ReactNode } from "react"
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { KeyboardAvoidingView, Platform } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { useAndroidKeyboardHeight } from "@/lib/use-keyboard-height"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"

/** Bottom sheet for pickers, dialogs and forms. */
export function Sheet({
  visible,
  onClose,
  title,
  description,
  children,
}: {
  visible: boolean
  onClose: () => void
  title: string
  description?: string
  children: ReactNode
}) {
  const { colors } = useAppTheme()
  const insets = useSafeAreaInsets()
  const keyboard = useAndroidKeyboardHeight()
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={[styles.fill, { paddingBottom: keyboard }]}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="Close" />
        <View
          style={[
            styles.sheet,
            { paddingBottom: Math.max(16, insets.bottom), backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Text accessibilityRole="header" style={[styles.title, { color: colors.foreground }]}>
            {title}
          </Text>
          {description ? <Text style={[styles.description, { color: colors.mutedForeground }]}>{description}</Text> : null}
          <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  )
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: "flex-end" },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: "rgba(0,0,0,0.42)" },
  sheet: {
    maxHeight: "88%", // keeps the top of the sheet visible above the keyboard
    borderWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: 0,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 16,
    paddingTop: 9,
  },
  handle: { width: 40, height: 5, borderRadius: 3, alignSelf: "center", marginBottom: 10 },
  title: { fontSize: 20, fontFamily: fonts.sansSemi },
  description: { fontSize: 13, lineHeight: 19, marginTop: 4 },
})
