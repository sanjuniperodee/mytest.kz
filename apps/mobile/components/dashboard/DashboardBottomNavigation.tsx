import { MaterialCommunityIcons } from "@expo/vector-icons"
import { router, usePathname } from "expo-router"
import { useEffect, useMemo, useState } from "react"
import { Pressable, StyleSheet, Text, View } from "react-native"
import { useSafeAreaInsets } from "react-native-safe-area-context"
import { Avatar } from "@/components/ui/avatar"
import { Sheet } from "@/components/ui/sheet"
import { useAuth } from "@/lib/api/auth-context"
import { localize, type Locale } from "@/lib/api/i18n"
import { useTr } from "@/lib/i18n/use-tr"
import { t, useUiLocale } from "@/lib/i18n/ui"
import { useUnreadMessages } from "@/lib/social/use-unread"
import { fonts } from "@/lib/theme/fonts"
import { useAppTheme } from "@/lib/theme/provider"
import { isCommunityArea, MORE_NAV, PRIMARY_NAV, type NavItem } from "./nav-config"

export const TAB_BAR_HEIGHT = 56

export function DashboardBottomNavigation() {
  const { colors, resolved, toggle } = useAppTheme()
  const insets = useSafeAreaInsets()
  const pathname = usePathname()
  const tr = useTr()
  const { user, signOut } = useAuth()
  const { locale: ui, setLocale } = useUiLocale()
  const [moreOpen, setMoreOpen] = useState(false)
  const unread = useUnreadMessages(user?.isChannelMember !== false)

  const isActive = (item: NavItem) =>
    item.href === "/dashboard/community" ? isCommunityArea(pathname, user?.id) : item.match(pathname, user?.id)
  const isMoreRoute = !PRIMARY_NAV.some(isActive)
  const displayName = useMemo(
    () =>
      [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() ||
      localize(user?.fullName, ui as Locale) ||
      user?.username ||
      user?.phone ||
      "Профиль",
    [ui, user],
  )

  useEffect(() => setMoreOpen(false), [pathname])

  const navigate = (href: string) => {
    setMoreOpen(false)
    router.push(href as never)
  }
  const unreadLabel = unread > 99 ? "99+" : String(unread)

  return (
    <>
      <View
        style={[
          styles.bar,
          { paddingBottom: Math.max(7, insets.bottom), borderTopColor: colors.border, backgroundColor: colors.background },
        ]}
      >
        {PRIMARY_NAV.map((item) => {
          const active = isActive(item)
          return (
            <Pressable
              key={item.href}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => navigate(item.href)}
              style={[styles.tab, active && { backgroundColor: `${colors.accent}14` }]}
            >
              <View>
                <MaterialCommunityIcons name={item.icon} size={21} color={active ? colors.accent : colors.mutedForeground} />
                {item.href === "/dashboard/community" && unread > 0 ? (
                  <View style={[styles.dot, { backgroundColor: colors.accent, borderColor: colors.background }]} />
                ) : null}
              </View>
              <Text numberOfLines={1} style={[styles.tabLabel, { color: active ? colors.accent : colors.mutedForeground }]}>
                {(item.tab ?? item.label)[ui]}
              </Text>
            </Pressable>
          )
        })}
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: moreOpen, selected: isMoreRoute }}
          onPress={() => setMoreOpen(true)}
          style={[styles.tab, (moreOpen || isMoreRoute) && { backgroundColor: `${colors.accent}14` }]}
        >
          <MaterialCommunityIcons
            name="dots-horizontal"
            size={22}
            color={moreOpen || isMoreRoute ? colors.accent : colors.mutedForeground}
          />
          <Text style={[styles.tabLabel, { color: moreOpen || isMoreRoute ? colors.accent : colors.mutedForeground }]}>
            {tr("Ещё", "Тағы")}
          </Text>
        </Pressable>
      </View>

      <Sheet
        visible={moreOpen}
        onClose={() => setMoreOpen(false)}
        title={tr("Ещё", "Тағы")}
        description={tr("Аккаунт и дополнительные разделы", "Аккаунт және қосымша бөлімдер")}
      >
        <Pressable
          onPress={() => navigate("/dashboard/profile")}
          style={[styles.profile, { backgroundColor: colors.secondary }]}
        >
          <Avatar person={user ?? {}} size={44} />
          <View style={styles.profileCopy}>
            <Text numberOfLines={1} style={[styles.profileName, { color: colors.foreground }]}>
              {displayName}
            </Text>
            <Text numberOfLines={1} style={[styles.profileSub, { color: colors.mutedForeground }]}>
              {user?.phone || user?.telegramUsername || tr("Открыть профиль", "Профильді ашу")}
            </Text>
          </View>
          <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
        </Pressable>

        <View style={styles.routes}>
          {MORE_NAV.map((item) => {
            const active = isActive(item)
            return (
              <Pressable
                key={item.href}
                accessibilityRole="button"
                onPress={() => navigate(item.href)}
                style={[styles.route, active && { backgroundColor: `${colors.accent}14` }]}
              >
                <View style={[styles.routeIcon, { backgroundColor: active ? colors.accent : colors.secondary }]}>
                  <MaterialCommunityIcons
                    name={item.icon}
                    size={19}
                    color={active ? colors.accentForeground : colors.foreground}
                  />
                </View>
                <Text style={[styles.routeLabel, { color: active ? colors.accent : colors.foreground }]}>
                  {item.label[ui]}
                </Text>
                {item.showUnread && unread > 0 ? (
                  <View style={[styles.badge, { backgroundColor: colors.accent }]}>
                    <Text style={[styles.badgeText, { color: colors.accentForeground }]}>{unreadLabel}</Text>
                  </View>
                ) : null}
                <MaterialCommunityIcons name="chevron-right" size={20} color={colors.mutedForeground} />
              </Pressable>
            )
          })}
        </View>

        <View style={[styles.setting, { borderColor: colors.border }]}>
          <Text style={[styles.routeLabel, { color: colors.foreground }]}>{t("language", ui)}</Text>
          <View style={[styles.switch, { backgroundColor: colors.secondary }]}>
            {(["ru", "kk"] as const).map((lang) => (
              <Pressable
                key={lang}
                accessibilityRole="button"
                accessibilityState={{ selected: ui === lang }}
                onPress={() => setLocale(lang)}
                style={[styles.choice, ui === lang && { backgroundColor: colors.foreground }]}
              >
                <Text style={{ color: ui === lang ? colors.background : colors.foreground, fontFamily: fonts.sansSemi, fontSize: 12 }}>
                  {lang.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
        <View style={[styles.setting, { borderColor: colors.border }]}>
          <Text style={[styles.routeLabel, { color: colors.foreground }]}>{tr("Тема", "Тақырып")}</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={resolved === "dark" ? tr("Включить светлую тему", "Жарық тақырыпты қосу") : tr("Включить тёмную тему", "Қараңғы тақырыпты қосу")}
            onPress={toggle}
            style={[styles.switch, styles.themeButton, { backgroundColor: colors.secondary }]}
          >
            <MaterialCommunityIcons name={resolved === "dark" ? "weather-sunny" : "weather-night"} size={16} color={colors.foreground} />
            <Text style={{ color: colors.foreground, fontFamily: fonts.sansSemi, fontSize: 12 }}>
              {resolved === "dark" ? tr("Светлая", "Жарық") : tr("Тёмная", "Қараңғы")}
            </Text>
          </Pressable>
        </View>

        <Pressable
          accessibilityRole="button"
          onPress={() => {
            setMoreOpen(false)
            void signOut()
            router.replace("/landing")
          }}
          style={styles.logout}
        >
          <MaterialCommunityIcons name="logout" size={19} color={colors.mutedForeground} />
          <Text style={[styles.routeLabel, { color: colors.mutedForeground }]}>{t("logout", ui)}</Text>
        </Pressable>
      </Sheet>
    </>
  )
}

const styles = StyleSheet.create({
  bar: { flexDirection: "row", borderTopWidth: StyleSheet.hairlineWidth, paddingHorizontal: 6, paddingTop: 6 },
  tab: { flex: 1, minHeight: 49, borderRadius: 12, alignItems: "center", justifyContent: "center", gap: 3, paddingHorizontal: 2 },
  tabLabel: { fontSize: 10, fontFamily: fonts.sansSemi },
  dot: { position: "absolute", top: -2, right: -4, width: 9, height: 9, borderRadius: 5, borderWidth: 1.5 },
  profile: { flexDirection: "row", alignItems: "center", gap: 11, borderRadius: 16, padding: 12, marginTop: 14, marginBottom: 10 },
  profileCopy: { flex: 1, minWidth: 0 },
  profileName: { fontSize: 14, fontFamily: fonts.sansSemi },
  profileSub: { fontSize: 12, marginTop: 2 },
  routes: { gap: 4 },
  route: { minHeight: 52, borderRadius: 13, paddingHorizontal: 10, flexDirection: "row", alignItems: "center", gap: 11 },
  routeIcon: { width: 36, height: 36, borderRadius: 9, alignItems: "center", justifyContent: "center" },
  routeLabel: { flex: 1, fontSize: 14, fontFamily: fonts.sansSemi },
  badge: { minWidth: 22, paddingHorizontal: 6, paddingVertical: 3, borderRadius: 11, alignItems: "center" },
  badgeText: { fontSize: 11, fontFamily: fonts.sansBold },
  setting: { marginTop: 10, minHeight: 52, borderWidth: StyleSheet.hairlineWidth, borderRadius: 13, paddingHorizontal: 12, flexDirection: "row", alignItems: "center", gap: 10 },
  switch: { flexDirection: "row", borderRadius: 9, padding: 3 },
  themeButton: { alignItems: "center", gap: 6, paddingHorizontal: 10, minHeight: 37 },
  choice: { minWidth: 39, height: 31, borderRadius: 7, alignItems: "center", justifyContent: "center" },
  logout: { minHeight: 52, flexDirection: "row", alignItems: "center", gap: 11, paddingHorizontal: 12, marginTop: 4 },
})
