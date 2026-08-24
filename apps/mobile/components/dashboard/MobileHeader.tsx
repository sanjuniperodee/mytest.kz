import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { useTopInset } from "@/lib/use-top-inset"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { useAuth } from "@/lib/api/auth-context"
import { resolveMediaUrl } from "@/lib/api/client"
import { localize, type Locale } from "@/lib/api/i18n"

export function MobileHeader() {
  const { colors } = useAppTheme()
  const topInset = useTopInset()
  const { user } = useAuth()
  const locale = ((user?.preferredLanguage as Locale) || "ru") as Locale
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
    localize(user?.fullName, locale) || user?.username || user?.phone || "U"
  const initials = displayName.slice(0, 2).toUpperCase()
  const avatarUri = resolveMediaUrl(user?.avatarUrl ?? null)

  return (
    <View
      style={[
        styles.shell,
        {
          paddingTop: topInset,
          borderBottomColor: colors.border,
          backgroundColor: colors.background,
          zIndex: 50,
          elevation: 50,
        },
      ]}
    >
      <View style={styles.bar}>
        <Pressable
          accessibilityLabel="На главную"
          hitSlop={12}
          onPress={() => router.push("/dashboard")}
          style={styles.brandLockup}
        >
          <View style={[styles.brandMark, { backgroundColor: colors.foreground }]}>
            <MaterialCommunityIcons name="star-four-points-small" size={16} color={colors.background} />
          </View>
          <Text style={[styles.title, { color: colors.foreground }]}>mytest</Text>
        </Pressable>
        <Pressable
          accessibilityLabel="Открыть профиль"
          hitSlop={10}
          onPress={() => router.push("/dashboard/profile")}
          style={[styles.avatar, { borderColor: colors.border, backgroundColor: colors.secondary }]}
        >
          {avatarUri ? (
            <Image source={{ uri: avatarUri }} style={styles.avatarImage} />
          ) : (
            <Text style={[styles.avatarText, { color: colors.foreground }]}>{initials}</Text>
          )}
        </Pressable>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  shell: {
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  bar: {
    width: "100%",
    maxWidth: 1200,
    alignSelf: "center",
    minHeight: 56,
    paddingHorizontal: 16,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  brandLockup: {
    flex: 1,
    minWidth: 0,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  brandMark: {
    width: 28,
    height: 28,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 16,
    fontFamily: fonts.sansSemi,
    letterSpacing: -0.2,
    textTransform: "lowercase",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarImage: { width: "100%", height: "100%" },
  avatarText: {
    fontSize: 12,
    fontFamily: fonts.sansSemi,
  },
})
