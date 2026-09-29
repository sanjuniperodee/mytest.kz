import { Image, Pressable, StyleSheet, Text, View } from "react-native"
import { router } from "expo-router"
import { LogoMark } from "@/components/ui/logo-mark"
import { useTopInset } from "@/lib/use-top-inset"
import { MaterialCommunityIcons } from "@expo/vector-icons"
import { fonts } from "@/lib/theme/fonts"
import { useUiLocale } from "@/lib/i18n/ui"
import { useAppTheme } from "@/lib/theme/provider"
import { useAuth } from "@/lib/api/auth-context"
import { resolveMediaUrl } from "@/lib/api/client"
import { localize, type Locale } from "@/lib/api/i18n"

export function MobileHeader() {
  const { colors, resolved, toggle } = useAppTheme()
  const topInset = useTopInset()
  const { user } = useAuth()
  const { locale: uiLocale } = useUiLocale()
  const locale = uiLocale as Locale
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
          <LogoMark size={30} />
          <Text style={[styles.title, { color: colors.foreground }]}>mytest</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={resolved === "dark" ? "Включить светлую тему" : "Включить тёмную тему"}
          hitSlop={8}
          onPress={toggle}
          style={[styles.avatar, { borderColor: colors.border, backgroundColor: colors.card }]}
        >
          <MaterialCommunityIcons
            name={resolved === "dark" ? "weather-sunny" : "weather-night"}
            size={18}
            color={colors.foreground}
          />
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
