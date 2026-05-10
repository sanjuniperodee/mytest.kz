import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router } from "expo-router"
import { useState } from "react"
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Card } from "@/components/ui/card"
import { useAuth } from "@/lib/api/auth-context"
import { getTelegramChannelUrl } from "@/lib/config"
import { t, useUiLocale } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"
import { fonts } from "@/lib/theme/fonts"

const FAB_CLEARANCE = 72

export function ChannelGateView() {
  const { locale: ui } = useUiLocale()
  const { colors, resolved } = useAppTheme()
  const { width } = useWindowDimensions()
  const insets = useSafeAreaInsets()
  const { refresh } = useAuth()
  const [checking, setChecking] = useState(false)
  const channelUrl = getTelegramChannelUrl()
  const twoCols = width >= 640

  async function checkSubscription() {
    setChecking(true)
    try {
      const updated = await refresh()
      if (updated?.isChannelMember) {
        Alert.alert(t("cgAlertOkTitle", ui), t("cgAlertOkBody", ui))
        router.replace("/dashboard")
        return
      }
      Alert.alert(t("cgAlertPendingTitle", ui), t("cgAlertPendingBody", ui))
    } finally {
      setChecking(false)
    }
  }

  const bottomPad = Math.max(insets.bottom, 12) + FAB_CLEARANCE

  return (
    <View style={[styles.root, { backgroundColor: colors.secondary }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: bottomPad }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <Card style={styles.card}>
          <View style={styles.header}>
            <View style={[styles.iconCircle, { backgroundColor: `${colors.accent}22` }]}>
              <MaterialCommunityIcons name="send" size={22} color={colors.accent} />
            </View>
            <Text style={[styles.title, { color: colors.foreground }]}>{t("cgTitle", ui)}</Text>
            <Text style={[styles.desc, { color: colors.mutedForeground }]}>{t("cgDesc", ui)}</Text>
          </View>

          <Text style={[styles.hintCenter, { color: colors.mutedForeground }]}>
            {t("cgHintAfterSub", ui)}
          </Text>

          <View style={[styles.actions, twoCols && styles.actionsRow]}>
            <Pressable
              accessibilityRole="button"
              onPress={() => void Linking.openURL(channelUrl)}
              style={({ pressed }) => [
                styles.btnPrimary,
                twoCols && styles.btnInRow,
                { backgroundColor: colors.foreground, opacity: pressed ? 0.9 : 1 },
              ]}
            >
              <MaterialCommunityIcons name="open-in-new" size={18} color={colors.background} />
              <Text style={[styles.btnPrimaryLabel, { color: colors.background }]}>
                {t("cgOpenChannel", ui)}
              </Text>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              disabled={checking}
              onPress={() => void checkSubscription()}
              style={({ pressed }) => [
                styles.btnOutline,
                twoCols && styles.btnInRow,
                {
                  borderColor: colors.border,
                  backgroundColor: colors.card,
                  opacity: checking ? 0.45 : pressed ? 0.85 : 1,
                },
              ]}
            >
              {checking ? (
                <ActivityIndicator size="small" color={colors.foreground} />
              ) : (
                <MaterialCommunityIcons name="refresh" size={18} color={colors.foreground} />
              )}
              <Text style={[styles.btnOutlineLabel, { color: colors.foreground }]}>
                {checking ? t("cgChecking", ui) : t("cgVerifySub", ui)}
              </Text>
            </Pressable>
          </View>

          <View
            style={[
              styles.note,
              {
                borderColor: colors.border,
                backgroundColor:
                  resolved === "dark" ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
              },
            ]}
          >
            <MaterialCommunityIcons name="check-circle" size={18} color={colors.accent} />
            <Text style={[styles.noteText, { color: colors.mutedForeground }]}>
              {t("cgNoteTelegramOnly", ui)}
            </Text>
          </View>
        </Card>
      </ScrollView>
    </View>
  )
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    paddingHorizontal: 16,
    paddingTop: 16,
  },
  card: {
    maxWidth: 560,
    width: "100%",
    alignSelf: "center",
  },
  header: { alignItems: "center", paddingBottom: 8 },
  iconCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
  },
  title: {
    fontSize: 24,
    fontFamily: fonts.sansSemi,
    textAlign: "center",
    marginBottom: 8,
  },
  desc: { fontSize: 15, lineHeight: 22, textAlign: "center" },
  hintCenter: { fontSize: 13, textAlign: "center", marginTop: 16, marginBottom: 16 },
  actions: { gap: 12 },
  actionsRow: {
    flexDirection: "row",
    alignItems: "stretch",
  },
  btnPrimary: {
    minHeight: 48,
    borderRadius: 10,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    alignSelf: "stretch",
  },
  btnPrimaryLabel: { fontSize: 15, fontFamily: fonts.sansSemi },
  btnOutline: {
    minHeight: 48,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 14,
    alignSelf: "stretch",
  },
  /** Only in a horizontal row does flex distribute width; in a column, flex:1 stretched buttons vertically. */
  btnInRow: {
    flex: 1,
    minWidth: 0,
    alignSelf: "auto",
  },
  btnOutlineLabel: { fontSize: 15, fontFamily: fonts.sansSemi },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 20,
    padding: 12,
    borderRadius: 10,
    borderWidth: StyleSheet.hairlineWidth,
  },
  noteText: { flex: 1, fontSize: 13, lineHeight: 18 },
})
